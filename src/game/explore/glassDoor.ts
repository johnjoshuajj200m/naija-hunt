import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { FACING } from "../scenes/junction/frontage";
import {
  doorBlockers,
  eased,
  PANEL_DEPTH,
  presenceAt,
  SHUT,
  stepDoor,
  type DoorFrame,
  type DoorState,
} from "./automaticDoor";
import { frameOfEntrance } from "./doorway";
import { DOOR_HEAD, type ResolvedEntrance } from "./entrances";
import { glassDoorName } from "./interiors";
import { GROUND_FLOOR, roomOwner, tagOwner } from "./spaces";
import type { Aabb } from "./movement";

/**
 * The two sliding glass panels of an automatic door, one group per door. The panels slide sideways into
 * the wall either side of the doorway, so an open door is a clean opening and a closed one is a pair of
 * framed panes you can see the room through. Frames are dark aluminium; the glass is a pale translucent
 * pane, never an opaque rectangle. The group never casts a shadow and shares its geometry and materials
 * with every other glass door.
 */

/** Bottom of the panels: level with the floor. */
const PANEL_BOTTOM = 0.15;
const PANEL_HEIGHT = DOOR_HEAD - PANEL_BOTTOM - 0.05;
const PANEL_THICK = 0.05;
const STILE = 0.07;

export type GlassDoor = {
  id: string;
  frame: DoorFrame;
  group: THREE.Group;
  state: DoorState;
  /** True once the player has been in the approach patch, until they leave its grown edge. */
  approached: boolean;
};

export type GlassDoorSet = {
  doors: GlassDoor[];
  /** Advance every door by dt seconds with the player at (x, z). */
  update: (dt: number, x: number, z: number) => void;
  /** What the doors that are not fully open still block. */
  blockers: () => Aabb[];
  openness: (id: string) => number | null;
  /** The door nearest (x, z) within `range` metres, with how open it is. */
  nearest: (x: number, z: number, range: number) => { id: string; open: number } | null;
};

function panelGeometries(half: number): { frame: THREE.BufferGeometry; glass: THREE.BufferGeometry } {
  const width = half - 0.01;
  const part = (w: number, h: number, x: number, y: number, depth = PANEL_THICK): THREE.BufferGeometry => {
    const geometry = new THREE.BoxGeometry(w, h, depth);
    geometry.translate(x, y, 0);
    return geometry;
  };
  const centreY = PANEL_BOTTOM + PANEL_HEIGHT / 2;
  const frame = mergeGeometries(
    [
      part(STILE, PANEL_HEIGHT, -width / 2 + STILE / 2, centreY),
      part(STILE, PANEL_HEIGHT, width / 2 - STILE / 2, centreY),
      part(width, 0.1, 0, PANEL_BOTTOM + PANEL_HEIGHT - 0.05),
      part(width, 0.2, 0, PANEL_BOTTOM + 0.1),
      // A push bar on the edge that meets the other panel.
      part(0.03, 0.55, width / 2 - STILE - 0.04, centreY, PANEL_THICK + 0.06),
    ],
    false,
  );
  const glass = part(width - STILE * 2, PANEL_HEIGHT - 0.3, 0, centreY + 0.05, 0.014);
  return { frame, glass };
}

/**
 * Builds one pair of panels for each sliding-glass entrance and adds them to `root`. The panels are live
 * objects (they move), so they are not merged with the static scenery.
 */
export function createGlassDoors(root: THREE.Object3D, entrances: readonly ResolvedEntrance[]): GlassDoorSet {
  const sliding = entrances.filter((entrance) => entrance.state === "open" && entrance.doorKind === "sliding-glass");
  const half = sliding[0]?.half ?? 0.85;
  const geometry = panelGeometries(half);
  const frameMaterial = new THREE.MeshStandardMaterial({ color: "#3b4144", roughness: 0.38, metalness: 0.65 });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#c4e6ee",
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });

  const doors: GlassDoor[] = sliding.map((entrance) => {
    const group = new THREE.Group();
    group.name = glassDoorName(entrance.id);
    // A street door is on the ground floor of its building. It is drawn with the street, and with its room.
    tagOwner(group, roomOwner({ id: entrance.id, buildingId: entrance.buildingId, floorId: GROUND_FLOOR }, "door"));
    group.position.set(entrance.door.x, 0, entrance.door.z);
    // Local +z points away from the building and local +x runs along the wall, to the right as you walk in.
    group.rotation.y = FACING[entrance.facing].yaw;
    for (const side of [-1, 1]) {
      const panel = new THREE.Group();
      panel.name = side < 0 ? "panel-left" : "panel-right";
      panel.position.z = -PANEL_DEPTH;
      // The push bar is modelled on the +x edge. The right panel is mirrored so its bar meets the left one in the middle.
      panel.scale.x = -side;
      const frame = new THREE.Mesh(geometry.frame, frameMaterial);
      const glass = new THREE.Mesh(geometry.glass, glassMaterial);
      frame.castShadow = false;
      frame.receiveShadow = false;
      glass.castShadow = false;
      glass.receiveShadow = false;
      // Draw the glass after every opaque thing, and after the frame, so the room shows through it.
      glass.renderOrder = 2;
      panel.add(frame, glass);
      group.add(panel);
    }
    root.add(group);
    return { id: entrance.id, frame: frameOfEntrance(entrance), group, state: SHUT, approached: false };
  });

  const place = (door: GlassDoor): void => {
    const slide = eased(door.state.openness) * door.frame.half;
    const [left, right] = door.group.children;
    // The left panel's own x is mirrored (scale -1), so its centre sits at -(half/2) of the opening and slides outward.
    if (left) {
      left.position.x = -(door.frame.half / 2 + slide);
    }
    if (right) {
      right.position.x = door.frame.half / 2 + slide;
    }
  };
  doors.forEach(place);

  const set: GlassDoorSet = {
    doors,
    update: (dt, x, z) => {
      for (const door of doors) {
        const presence = presenceAt(door.frame, x, z, door.approached);
        door.approached = presence.approach;
        const before = door.state.openness;
        door.state = stepDoor(door.state, presence, dt);
        if (door.state.openness !== before) {
          place(door);
        }
      }
    },
    blockers: () => doors.flatMap((door) => doorBlockers(door.frame, door.state.openness)),
    openness: (id) => doors.find((door) => door.id === id)?.state.openness ?? null,
    nearest: (x, z, range) => {
      let best: { id: string; open: number } | null = null;
      let bestDistance = range;
      for (const door of doors) {
        const distance = Math.hypot(x - door.frame.x, z - door.frame.z);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = { id: door.id, open: door.state.openness };
        }
      }
      return best;
    },
  };
  registry.set(root, set);
  return set;
}

const registry = new WeakMap<THREE.Object3D, GlassDoorSet>();

/** The glass doors built under a junction root, so the walk controller can drive them. */
export function glassDoorsOf(root: THREE.Object3D): GlassDoorSet | undefined {
  return registry.get(root);
}