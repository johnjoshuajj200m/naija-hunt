import * as THREE from "three";

import { addInstances, addMesh, type InstanceSpec } from "../sceneHelpers";
import { createStripeTexture } from "../textures";
import type { AssetTier } from "./assetList";
import {
  facadeLevel,
  layoutFacade,
  STOREY,
  type FacadeLayout,
  type Facing,
  type SignSpot,
} from "./junctionFacades";
import { paintVertices, type JunctionKit } from "./junctionKit";
import { alongRange, DOOR_HEAD, enterableEntranceOf, footprintBox, placeOnFace } from "../../explore/entrances";
import { INTERIORS, interiorById } from "../../explore/interiorRegistry";
import { interiorBlocks, lintelBox, splitWall, type InteriorDef } from "../../explore/interiors";
import { FACING, faceCenter, frontageLength } from "./frontage";
import { createRecessPanel } from "./junctionRecess";
import { createSignPlane, type SignKit } from "./junctionSigns";
import { addCourtShell } from "../../explore/court/courtShell";
import { COURT_ID, FLOOR_PITCH } from "../../explore/court/courtGeometry";

/**
 * PLACEHOLDER buildings. Boxes with plaster and shopfronts, standing in for the commissioned modular
 * Nigerian building kit (docs/COMMISSION_BRIEFS.md). The frontages the camera sees carry procedural
 * windows, balconies and signs; the rest stay plain. None of this is final art.
 */

export type { Building } from "./buildingList";
export { BUILDINGS } from "./buildingList";
import { BUILDINGS, type Building } from "./buildingList";

/**
 * A building with an open door. The ground floor is a shell: the outer part of the room's walls, in the
 * building's colour, with the doorway left open, plain walls filling the rest of the footprint, and a
 * plain floor. The upper floors stay one solid volume. The inside skin of the walls, the real floor and
 * the furniture belong to the room (interiorBuilder.ts), which is drawn when the door is near, so the
 * doorway looks onto the furnished room while the walls never share a visible face with it.
 */
function addEnterableShell(group: THREE.Group, kit: JunctionKit, building: Building, def: InteriorDef, tint: string, height: number): void {
  const box = footprintBox(building);
  const width = box.maxX - box.minX;
  const depthZ = box.maxZ - box.minZ;
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const ground = STOREY.ground;
  const upperH = height - ground;
  const plaster = (area: { minX: number; maxX: number; minZ: number; maxZ: number }, y0: number, y1: number) => {
    if (area.maxX - area.minX < 0.01 || area.maxZ - area.minZ < 0.01 || y1 - y0 < 0.01) {
      return;
    }
    kit.box(
      group,
      "painted_plaster_wall",
      [area.maxX - area.minX, y1 - y0, area.maxZ - area.minZ],
      [(area.minX + area.maxX) / 2, (y0 + y1) / 2, (area.minZ + area.maxZ) / 2],
      { tint, roughness: 1, weather: true },
    );
  };

  kit.box(group, "painted_plaster_wall", [width, upperH, depthZ], [cx, ground + upperH / 2, cz], {
    tint,
    roughness: 1,
    weather: true,
  });
  kit.box(group, "concrete", [width + 0.3, 0.3, depthZ + 0.3], [cx, height + 0.15, cz], { tint: "#cfc6b6" });

  // The room's own walls, with the doorway gap, at full ground height, and a lintel over the gap.
  for (const block of interiorBlocks(def)) {
    if (block.kind === "wall") {
      const { outer } = splitWall(def, block);
      if (outer) {
        plaster(outer, 0, ground);
      }
    }
  }
  const { room, facing } = def;
  const lintel = splitWall(def, lintelBox(def)).outer;
  if (lintel) {
    plaster(lintel, DOOR_HEAD, ground);
  }

  // Solid ground floor wherever the building extends past the room, so the street side stays one block.
  const [b0, b1] = alongRange(box, facing);
  const [r0, r1] = alongRange(room, facing);
  plaster(placeOnFace(box, facing, 0, facing === "-x" || facing === "+x" ? width : depthZ, b0, r0), 0, ground);
  plaster(placeOnFace(box, facing, 0, facing === "-x" || facing === "+x" ? width : depthZ, r1, b1), 0, ground);

  // A plain floor for a doorway seen from far away. The room's own floor sits 5 cm above it.
  kit.box(group, "concrete", [room.maxX - room.minX - 0.8, 0.1, room.maxZ - room.minZ - 0.8], [(room.minX + room.maxX) / 2, 0.05, (room.minZ + room.maxZ) / 2], {
    tint: def.tint.floor,
    cast: false,
  });
}

/** The facade layout for one of a building's frontages, or null when that frontage is left plain. */
export function layoutFrontage(building: Building, facing: Facing, tier: AssetTier): FacadeLayout | null {
  if (facadeLevel(building.id, facing) === "none") {
    return null;
  }
  const f = FACING[facing];
  const length = frontageLength(building, facing);
  const { x: faceX, z: faceZ } = faceCenter(building, facing);
  return layoutFacade({
    buildingId: building.id,
    facing,
    length,
    floors: building.floors,
    tier,
    yaw: f.yaw,
    at: (offset, y, out) => [
      faceX + f.tangent[0] * offset + f.normal[0] * out,
      y,
      faceZ + f.tangent[1] * offset + f.normal[1] * out,
    ],
    // Palm Court's floors are a room height apart, not the standard storeys.
    ...(building.id === COURT_ID ? { storeys: { ground: FLOOR_PITCH, upper: FLOOR_PITCH } } : {}),
  });
}

export function buildBuildings(parent: THREE.Group, kit: JunctionKit, tier: AssetTier, signKit: SignKit): void {
  const group = new THREE.Group();
  group.name = "PLACEHOLDER_buildings";
  parent.add(group);

  const trim: InstanceSpec[] = [];
  const glass: InstanceSpec[] = [];
  const shutters: InstanceSpec[] = [];
  const awnings: InstanceSpec[] = [];
  const signs: SignSpot[] = [];

  const take = (layout: FacadeLayout): void => {
    for (const piece of layout.pieces) {
      const bucket = { trim, glass, shutter: shutters, awning: awnings }[piece.bucket];
      bucket.push(piece.spec);
    }
    signs.push(...layout.signs);
  };

  for (const building of BUILDINGS) {
    const width = building.x1 - building.x0;
    const depth = building.z0 - building.z1;
    const height = STOREY.ground + (building.floors - 1) * STOREY.upper;
    const cx = (building.x0 + building.x1) / 2;
    const cz = (building.z0 + building.z1) / 2;

    const entrance = enterableEntranceOf(building.id);
    const interior = entrance?.interiorId ? interiorById(entrance.interiorId) : undefined;
    if (building.id === COURT_ID) {
      // Three floors of real rooms behind several doors: its own shell (court/courtShell.ts).
      addCourtShell(
        group,
        kit,
        building,
        INTERIORS.filter((def) => def.buildingId === COURT_ID && def.outer === undefined),
      );
    } else if (interior) {
      addEnterableShell(group, kit, building, interior, building.tint, height);
    } else {
      kit.box(group, building.wall ?? "painted_plaster_wall", [width, height, depth], [cx, height / 2, cz], {
        tint: building.tint,
        roughness: 1,
        weather: true,
      });
      kit.box(group, "concrete", [width + 0.3, 0.3, depth + 0.3], [cx, height + 0.15, cz], { tint: "#cfc6b6" });
    }

    if (building.roof === "lean-to") {
      const roof = kit.box(group, "corrugated_iron_02", [width * 0.7, 0.08, depth * 0.6], [cx, height + 0.9, cz], { tint: "#c9b79a" });
      roof.rotation.z = 0.1;
    }
    if (building.tank) {
      const tankGeometry = new THREE.CylinderGeometry(1.1, 1.1, 1.8, 16);
      paintVertices(tankGeometry, "#22262a");
      const tank = new THREE.Mesh(tankGeometry, kit.pbr("corrugated_iron_02", { vertexColors: true }));
      tank.position.set(cx - width * 0.2, height + 1.2, cz + depth * 0.15);
      tank.castShadow = true;
      tank.receiveShadow = true;
      group.add(tank);
    }

    for (const facing of building.faces) {
      const layout = layoutFrontage(building, facing, tier);
      if (!layout) {
        continue;
      }
      take(layout);
      if (layout.recess) {
        addRecess(group, kit, building.tint, layout.recess);
      }
    }
  }

  // South face of the plaza tower, above the approach from the cross street.
  signs.push({ id: "palm-plaza", position: [-110, 13.5, -8.78], yaw: Math.PI, width: 2.5 });

  const unit = new THREE.BoxGeometry(1, 1, 1);
  addInstances(group, unit, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.72, metalness: 0.04 }), trim, {
    cast: false,
    name: "facade-trim",
  });
  addInstances(group, unit, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.78 }), glass, {
    cast: false,
    name: "facade-glass",
  });
  addInstances(group, unit, kit.pbr("corrugated_iron_02", { tint: "#ffffff" }), shutters, { name: "facade-shutters" });
  addInstances(
    group,
    unit,
    new THREE.MeshStandardMaterial({ map: createStripeTexture("#ffffff", "#c9bba0"), roughness: 0.8, side: THREE.DoubleSide }),
    awnings,
    { name: "facade-awnings" },
  );
  addSigns(group, signs, signKit);
}

/** The single recessed window on ADE & SONS. Same plaster material as the walls, so it adds no draw call. */
function addRecess(group: THREE.Group, kit: JunctionKit, tint: string, recess: NonNullable<FacadeLayout["recess"]>): void {
  const geometry = createRecessPanel(recess.openingW, recess.openingH, 0.22, recess.depth, tint);
  const mesh = new THREE.Mesh(geometry, kit.pbr("painted_plaster_wall", { roughness: 1, vertexColors: true }));
  mesh.position.set(recess.position[0], recess.position[1], recess.position[2]);
  mesh.rotation.y = recess.yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "recess-prototype-ade";
  group.add(mesh);
}

function addSigns(group: THREE.Group, spots: SignSpot[], signKit: SignKit): void {
  if (spots.length === 0) {
    return;
  }
  const atlas = signKit;
  const material = signKit.material;
  for (const spot of spots) {
    const cell = atlas.uv[spot.id];
    if (!cell) {
      throw new Error(`Shop sign "${spot.id}" is not on the atlas.`);
    }
    const sign = addMesh(group, createSignPlane(spot.width, spot.width / 4, cell), material, spot.position, {
      rotation: [0, spot.yaw, 0],
      cast: false,
    });
    sign.name = `sign-${spot.id}`;
  }
}
