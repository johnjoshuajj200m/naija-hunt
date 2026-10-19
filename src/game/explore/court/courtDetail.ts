import * as THREE from "three";

import { FACING } from "../../scenes/junction/frontage";
import type { JunctionKit } from "../../scenes/junction/junctionKit";
import { createSignPlane, type SignKit } from "../../scenes/junction/junctionSigns";
import { addMesh } from "../../scenes/sceneHelpers";
import { PANEL_DEPTH, panelSlide, type DoorFrame } from "../automaticDoor";
import { DOOR_HEAD } from "../entrances";
import { doorHalfOf, doorPoint, roomName, type InteriorDef } from "../interiors";
import { interiorById } from "../interiorRegistry";
import { roomOwner, tagOwner } from "../spaces";
import { CALL_BUTTON, COURT_ID, X } from "./courtGeometry";
import { COURT_UNITS } from "./courtPlan";
import { FLOOR_IDS, FLOOR_LABELS, LEVELS, ROOM, stripRoomId, type Level } from "./courtIds";
import { floorElevation, indicatedFloor, startLift, type LiftState } from "./lift";
import { roomDoorFrame } from "./portals";
import { flightTreads, landingSlabs } from "./stairs";

/** Standing surface above a room's elevation (interiorBuilder FLOOR_Y). */
const FLOOR_Y = 0.15;

function groupOf(root: THREE.Object3D, id: string): THREE.Object3D {
  const group = root.getObjectByName(roomName({ id }));
  if (!group) {
    throw new Error(`Palm Court's room "${id}" has not been built yet.`);
  }
  return group;
}

function defOf(id: string): InteriorDef {
  const def = interiorById(id);
  if (!def) {
    throw new Error(`Palm Court has no room "${id}".`);
  }
  return def;
}

/** The cabin's doors sit in the lift room's east wall, the landings' in the strip's own west wall: the same opening, one wall each side. */
export const CABIN_FRAME: DoorFrame = roomDoorFrame(defOf(ROOM.lift));
export const LANDING_FRAME: DoorFrame = { x: CABIN_FRAME.x, z: CABIN_FRAME.z, inward: [1, 0], tangent: CABIN_FRAME.tangent, half: CABIN_FRAME.half };

// ---- The lift's dynamic faces: one canvas for the floor indicator, one for the cabin's buttons.

const INDICATOR_SIZE = { w: 192, h: 64 };
const PANEL_SIZE = { w: 96, h: 192 };

type Face = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture };

function makeFace(width: number, height: number): Face {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a 2D canvas for the lift display.");
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return { canvas, context, texture };
}

const AMBER = "#ffb347";
const DIM = "#4a4540";

/** G 2 3 along a black strip. The floor the cabin is at (or passing) is lit; a travelling cabin shows its direction. */
function drawIndicator(face: Face, lift: LiftState): void {
  const { context, canvas } = face;
  const shown = indicatedFloor(lift);
  const moving = lift.phase === "moving" && lift.target !== null;
  context.fillStyle = "#101010";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 40px sans-serif";
  LEVELS.forEach((level) => {
    context.fillStyle = level === shown ? AMBER : DIM;
    context.fillText(FLOOR_LABELS[level], 28 + level * 48, canvas.height / 2 + 2);
  });
  context.font = "bold 30px sans-serif";
  context.fillStyle = AMBER;
  if (moving) {
    context.fillText(lift.target !== null && lift.target > lift.from ? "\u25B2" : "\u25BC", 168, canvas.height / 2);
  }
  face.texture.needsUpdate = true;
}

/** Three round buttons, top floor first. The target is lit amber, the floor the cabin is at is lit green. */
function drawPanel(face: Face, lift: LiftState): void {
  const { context, canvas } = face;
  context.fillStyle = "#2a2d2e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#7d8284";
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 34px sans-serif";
  [...LEVELS].reverse().forEach((level, row) => {
    const cy = 36 + row * 60;
    const target = lift.target === level;
    const here = lift.floor === level && lift.phase !== "moving";
    context.beginPath();
    context.arc(canvas.width / 2, cy, 24, 0, Math.PI * 2);
    context.fillStyle = target ? AMBER : here ? "#7ed38a" : "#3b3f40";
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = "#b9bdbe";
    context.stroke();
    context.fillStyle = target || here ? "#1a1a1a" : "#d8dcdc";
    context.fillText(FLOOR_LABELS[level], canvas.width / 2, cy + 2);
  });
  face.texture.needsUpdate = true;
}

// ---- Sliding steel leaves.

type Leaves = { group: THREE.Group; set: (open: number, y: number) => void };

function makeLeaves(frame: DoorFrame, material: THREE.Material, owner: ReturnType<typeof roomOwner>): Leaves {
  const group = new THREE.Group();
  // The group's x axis runs along the door's tangent, so a leaf slides by changing its x.
  group.rotation.y = Math.atan2(-frame.tangent[1], frame.tangent[0]);
  const height = DOOR_HEAD - 0.1;
  const geometry = new THREE.BoxGeometry(frame.half - 0.01, height, 0.07);
  const left = new THREE.Mesh(geometry, material);
  const right = new THREE.Mesh(geometry, material);
  for (const leaf of [left, right]) {
    leaf.position.y = height / 2;
    leaf.castShadow = false;
    leaf.receiveShadow = false;
    group.add(leaf);
  }
  const set = (open: number, y: number): void => {
    const slide = panelSlide(open, frame.half);
    left.position.x = -(frame.half / 2 + slide);
    right.position.x = frame.half / 2 + slide;
    group.position.set(frame.x + frame.inward[0] * PANEL_DEPTH, y + FLOOR_Y, frame.z + frame.inward[1] * PANEL_DEPTH);
    // A leaf that has slid fully into the wall is not worth a draw call.
    left.visible = open < 0.995;
    right.visible = open < 0.995;
  };
  set(0, 0);
  return { group: tagOwner(group, owner), set };
}

// ---- Static fittings.

function addPlate(group: THREE.Object3D, signs: SignKit, cell: string, width: number, position: [number, number, number], yaw: number): void {
  const uv = signs.uv[cell];
  if (!uv) {
    throw new Error(`Sign "${cell}" is not on the atlas.`);
  }
  addMesh(group, createSignPlane(width, width / 4, uv), signs.material, position, { rotation: [0, yaw, 0], cast: false, receive: false });
}

/** The treads, landings and handrails of the stair core. They are part of the core's room, so they show with it. */
function addStairs(root: THREE.Object3D, kit: JunctionKit): void {
  const core = groupOf(root, ROOM.stairs);
  const place = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, top: number, bottom: number, tint: string): void => {
    kit.box(core, "concrete", [box.maxX - box.minX, top - bottom, box.maxZ - box.minZ], [(box.minX + box.maxX) / 2, (top + bottom) / 2, (box.minZ + box.maxZ) / 2], {
      tint,
      roughness: 0.95,
      cast: false,
    });
  };
  for (const flight of [1, 2, 3, 4] as const) {
    flightTreads(flight).forEach((tread, index) => {
      place(tread.box, tread.top, tread.bottom, index % 2 === 0 ? "#bdb4a4" : "#c6bdad");
    });
  }
  for (const slab of landingSlabs()) {
    place(slab.box, slab.top, slab.bottom, "#b6ad9d");
  }
}

/** The call button beside the lift doors on every landing, and the plates that name the units. */
function addLanding(root: THREE.Object3D, kit: JunctionKit, level: Level): void {
  const room = groupOf(root, stripRoomId(level));
  // Local y is above the floor of this floor's room (the group sits at its elevation).
  const wall = X.stripW + 0.4;
  kit.flat(room, [0.05, 0.3, 0.14], [wall + 0.025, 1.1, CALL_BUTTON.z], { tint: "#2b2e2f" });
  kit.flat(room, [0.04, 0.07, 0.07], [wall + 0.06, 1.17, CALL_BUTTON.z], { tint: "#e9a23a" });
  kit.flat(room, [0.04, 0.07, 0.07], [wall + 0.06, 1.03, CALL_BUTTON.z], { tint: "#e9a23a" });
  // Steel jamb strips either side of the lift doors, so the doors read as doors from down the hall.
  const half = LANDING_FRAME.half;
  for (const side of [-1, 1]) {
    kit.flat(room, [0.06, 2.7, 0.1], [wall + 0.03, 1.35, LANDING_FRAME.z + side * (half + 0.05)], { tint: "#9aa0a0" });
  }
  kit.flat(room, [0.06, 0.12, half * 2 + 0.2], [wall + 0.03, 2.66, LANDING_FRAME.z], { tint: "#9aa0a0" });
}

function addUnitPlates(root: THREE.Object3D, signs: SignKit): void {
  for (const unit of COURT_UNITS) {
    const def = defOf(unit.roomId);
    if (def.outer === undefined) {
      continue;
    }
    const hall = groupOf(root, def.outer);
    const door = doorPoint(def);
    const half = doorHalfOf(def);
    const { normal, tangent, yaw } = FACING[def.facing];
    // On the hall's wall just beside the doorway, facing out into the hall.
    const along = -(half + 0.75);
    const x = door.x + normal[0] * 0.41 + tangent[0] * along;
    const z = door.z + normal[1] * 0.41 + tangent[1] * along;
    if (unit.plate) {
      addPlate(hall, signs, unit.plate, 0.6, [x, 2.15, z], yaw);
    }
    addPlate(hall, signs, unit.tenant?.sign ?? "to-let", unit.tenant ? 1.3 : 1.0, [x, unit.plate ? 1.75 : 2.05, z], yaw);
  }
}

function addDirectory(root: THREE.Object3D, signs: SignKit): void {
  const lobby = groupOf(root, stripRoomId(0));
  addPlate(lobby, signs, "court-directory", 2.0, [X.stripW + 0.41, 1.85, -8], FACING["+x"].yaw);
}

export type CourtDetail = {
  /** Brings the lift's doors, cabin and displays in line with the lift's state. Cheap to call every frame. */
  update: (lift: LiftState) => void;
  /** The two lift door frames, for the controller's door blockers. */
  landingFrame: DoorFrame;
  cabinFrame: DoorFrame;
};

/**
 * Everything Palm Court has that is not a plain room: the stair flights, the lift (its leaves, indicators and
 * cabin buttons), call buttons, unit plates and the lobby directory. Call after the rooms are built and before
 * they are merged: static pieces go into their room's group, and the lift's moving pieces are separate objects
 * tagged with the room they belong to, so they show and hide with it.
 */
export function addCourtDetail(root: THREE.Group, kit: JunctionKit, signs: SignKit): CourtDetail {
  addStairs(root, kit);
  for (const level of LEVELS) {
    addLanding(root, kit, level);
  }
  addUnitPlates(root, signs);
  addDirectory(root, signs);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: "#aeb3b3", metalness: 0.55, roughness: 0.38 });
  const liftOwner = roomOwner({ id: ROOM.lift, buildingId: COURT_ID, floorId: FLOOR_IDS[0] }, "door");
  const cabinLeaves = makeLeaves(CABIN_FRAME, leafMaterial, liftOwner);
  const landings = LEVELS.map((level) =>
    makeLeaves(LANDING_FRAME, leafMaterial, roomOwner({ id: stripRoomId(level), buildingId: COURT_ID, floorId: FLOOR_IDS[level] }, "door")),
  );
  root.add(cabinLeaves.group, ...landings.map((entry) => entry.group));

  // Displays. The indicator over every landing's doors and the one in the cabin share a canvas; the cabin's buttons have their own.
  const indicator = makeFace(INDICATOR_SIZE.w, INDICATOR_SIZE.h);
  const panel = makeFace(PANEL_SIZE.w, PANEL_SIZE.h);
  const indicatorMaterial = new THREE.MeshBasicMaterial({ map: indicator.texture, toneMapped: false });
  const panelMaterial = new THREE.MeshBasicMaterial({ map: panel.texture, toneMapped: false });
  const indicatorGeometry = new THREE.PlaneGeometry(0.72, 0.24);

  const landingIndicators = LEVELS.map((level) => {
    const mesh = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    mesh.position.set(X.stripW + 0.4 + 0.02, floorElevation(level) + FLOOR_Y + 2.98, LANDING_FRAME.z);
    mesh.rotation.y = FACING["+x"].yaw;
    return tagOwner(mesh, roomOwner({ id: stripRoomId(level), buildingId: COURT_ID, floorId: FLOOR_IDS[level] }, "door"));
  });
  const cabin = defOf(ROOM.lift);
  const cabinIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
  cabinIndicator.position.set(cabin.room.minX + 0.4 + 0.02, FLOOR_Y + 2.9, LANDING_FRAME.z);
  cabinIndicator.rotation.y = FACING["+x"].yaw;
  const cabinPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.8), panelMaterial);
  cabinPanel.position.set(cabin.room.maxX - 1.05, FLOOR_Y + 1.25, cabin.room.maxZ - 0.4 - 0.02);
  cabinPanel.rotation.y = FACING["-z"].yaw;
  for (const mesh of [cabinIndicator, cabinPanel]) {
    tagOwner(mesh, liftOwner);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  for (const mesh of landingIndicators) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  }
  root.add(cabinIndicator, cabinPanel, ...landingIndicators);

  const cabinGroup = groupOf(root, ROOM.lift);
  const cabinBaseY = cabin.elevation ?? 0;
  let drawn = "";
  const update = (lift: LiftState): void => {
    cabinGroup.position.y = cabinBaseY + lift.y;
    cabinLeaves.set(lift.open, lift.y);
    landings.forEach((entry, index) => entry.set(lift.floor === index && lift.phase !== "moving" ? lift.open : 0, floorElevation(index as Level)));
    cabinIndicator.position.y = lift.y + FLOOR_Y + 2.9;
    cabinPanel.position.y = lift.y + FLOOR_Y + 1.25;
    const signature = `${indicatedFloor(lift)}|${lift.phase === "moving" ? "m" : "s"}|${lift.target ?? "-"}|${lift.floor}|${lift.from}`;
    if (signature !== drawn) {
      drawn = signature;
      drawIndicator(indicator, lift);
      drawPanel(panel, lift);
    }
  };
  update(startLift());
  const detail: CourtDetail = { update, landingFrame: LANDING_FRAME, cabinFrame: CABIN_FRAME };
  registry.set(root, detail);
  return detail;
}

const registry = new WeakMap<THREE.Object3D, CourtDetail>();

/** Palm Court's live parts under a junction root, so the walk controller can drive them. */
export function courtDetailOf(root: THREE.Object3D): CourtDetail | undefined {
  return registry.get(root);
}
