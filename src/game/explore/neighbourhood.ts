import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { TextureId } from "../scenes/junction/assetList";
import { paintVertices } from "../scenes/junction/junctionKit";
import type { JunctionKit } from "../scenes/junction/junctionKit";
import { TREASURE } from "./movement";

const SLAB = 0.3;

/**
 * Roads, pavements and the plaza landmark, parented onto the groups that already exist so they share
 * those groups' merged materials. Nothing here allocates a new texture.
 */
export function buildNeighbourhood(root: THREE.Object3D, kit: JunctionKit): void {
  const street = root.getObjectByName("street");
  const buildings = root.getObjectByName("PLACEHOLDER_buildings");
  if (!street || !buildings) {
    throw new Error("The neighbourhood is built onto the existing street and building groups.");
  }

  const road = (size: [number, number, number], position: [number, number, number]) =>
    kit.box(street, "asphalt_02", size, position, { cast: false });
  const pave = (size: [number, number, number], position: [number, number, number]) =>
    kit.box(street, "brick_pavement_02", size, position, { tint: "#e6cdb4" });
  const kerb = (size: [number, number, number], position: [number, number, number]) =>
    kit.box(street, "concrete", size, position, { cast: false });
  const walkY = 0.15 - SLAB / 2;

  // Cross street, continued west from the existing asphalt, which ends at x=-70.
  road([52, SLAB, 12], [-96, -SLAB / 2, -24]);
  // Market street in three pieces, so it does not cover the cross street or the south road.
  road([10, SLAB, 42], [-86, -SLAB / 2, 3]);
  road([10, SLAB, 67], [-86, -SLAB / 2, -63.5]);
  road([10, SLAB, 5], [-86, -SLAB / 2, -109.5]);
  // South road. It stops short of the avenue buildings.
  road([86, SLAB, 10], [-73, -SLAB / 2, -102]);

  // Sidewalks stop at each carriageway. East walk is x -81..-78.6; west walk is x -95.5..-91.5.
  for (const centerZ of [3, -63.5] as const) {
    const length = centerZ === 3 ? 42 : 67;
    pave([2.4, SLAB, length], [-79.8, walkY, centerZ]);
    pave([4, SLAB, length], [-93.5, walkY, centerZ]);
    kerb([0.22, 0.16, length], [-81.1, 0.08, centerZ]);
    kerb([0.22, 0.16, length], [-90.9, 0.08, centerZ]);
  }
  // South-road sidewalks, split so they do not pave over the market street (x -91..-81).
  pave([24, SLAB, 2.2], [-103.5, walkY, -95.8]);
  pave([48, SLAB, 2.2], [-56, walkY, -95.8]);
  pave([24, SLAB, 2.2], [-103.5, walkY, -108.3]);
  pave([48, SLAB, 2.2], [-56, walkY, -108.3]);

  // The junction pavements stop at x=-70. Continue them to the market street, split around its carriageway.
  pave([11, SLAB, 5], [-75.5, walkY, -15.5]);
  kerb([11, 0.16, 0.22], [-75.5, 0.08, -17.9]);
  pave([5.2, SLAB, 2], [-93.7, walkY, -17]);
  kerb([5.2, 0.16, 0.22], [-93.7, 0.08, -17.9]);
  pave([11, SLAB, 5], [-75.5, walkY, -32.5]);
  kerb([11, 0.16, 0.22], [-75.5, 0.08, -30.15]);
  pave([18, SLAB, 5], [-100, walkY, -32.5]);
  kerb([18, 0.16, 0.22], [-100, 0.08, -30.15]);
  // A thin joint where the junction asphalt meets the west continuation.
  kit.box(street, "concrete", [0.28, 0.04, 11.5], [-70, 0.02, -24], { tint: "#d2cdc4", cast: false });

  // Palm Plaza: a brick square just north of the cross street, clear of the carriageway.
  pave([18, SLAB, 12], [-105, walkY, -10]);
  dressPlaza(street, buildings, kit);
  dressMarket(street, buildings, kit);

  // Cream shop bands on the market frontages. They share the plaster material already in the building group.
  for (const [x, z, length] of [
    [-78.08, 12, 15],
    [-78.08, -4, 11],
    [-78.08, -52, 22],
    [-78.08, -80, 22],
    [-115.92, 10, 15],
    [-115.92, -56, 26],
    [-115.92, -86, 22],
  ] as const) {
    kit.box(buildings, "painted_plaster_wall", [0.08, 0.28, length], [x, 3.15, z], { tint: "#efe6d0", cast: false });
  }
  kit.box(buildings, "painted_plaster_wall", [66, 0.28, 0.08], [-75, 3.15, -111.92], { tint: "#efe6d0", cast: false });

  // Landmark tower. The shaft stays inside its collision box. Bands and the cap trim are added in dressPlaza.
  kit.box(buildings, "concrete", [3.2, 16, 3.2], [-110, 8, -7], { tint: "#d6cdbd" });
  kit.box(buildings, "corrugated_iron_02", [4.2, 0.25, 4.2], [-110, 16.3, -7], { tint: "#8a8070" });

  buildClue(root);
}

const GROUND = 0.15;

function dress(
  parent: THREE.Object3D,
  kit: JunctionKit,
  id: TextureId,
  size: [number, number, number],
  position: [number, number, number],
  tint: string,
  cast = false,
): THREE.Mesh {
  return kit.box(parent, id, size, position, { tint, cast });
}

function pot(
  parent: THREE.Object3D,
  kit: JunctionKit,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  tint: string,
): void {
  const geometry = new THREE.CylinderGeometry(radius, radius * 0.86, height, 6);
  geometry.translate(0, height / 2, 0);
  paintVertices(geometry, tint);
  const mesh = new THREE.Mesh(geometry, kit.pbr("concrete", { vertexColors: true }));
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function fruit(
  parent: THREE.Object3D,
  kit: JunctionKit,
  x: number,
  y: number,
  z: number,
  radius: number,
  tint: string,
): void {
  const geometry = new THREE.SphereGeometry(radius, 7, 5);
  geometry.translate(0, radius * 0.92, 0);
  paintVertices(geometry, tint);
  const mesh = new THREE.Mesh(geometry, kit.pbr("painted_plaster_wall", { vertexColors: true }));
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

/** A dark stain on the pavement. The plaza is outside the shadow map, so this is the contact shade. */
function contact(parent: THREE.Object3D, kit: JunctionKit, x: number, z: number, width: number, depth: number): void {
  dress(parent, kit, "concrete", [width, 0.02, depth], [x, GROUND + 0.006, z], "#241c16");
}

function crate(parent: THREE.Object3D, kit: JunctionKit, x: number, y: number, z: number): void {
  dress(parent, kit, "concrete", [0.46, 0.28, 0.4], [x, y, z], "#8a5a32");
  for (const offset of [-0.1, 0.1]) {
    dress(parent, kit, "concrete", [0.48, 0.035, 0.05], [x, y + 0.1, z + offset], "#5a3822");
  }
  dress(parent, kit, "concrete", [0.04, 0.22, 0.42], [x + 0.2, y, z], "#6b4428");
}

type StallKind = "provisions" | "fabric" | "cook";

/** An open stall. `face` is the side the counter looks toward, so the square and the road stay clear. */
function addStall(
  parent: THREE.Object3D,
  ground: THREE.Object3D,
  kit: JunctionKit,
  x: number,
  z: number,
  face: 1 | -1,
  kind: StallKind,
): void {
  const cloth = kind === "fabric" ? "#1d3226" : kind === "cook" ? "#c9694a" : "#d9a62e";
  const goods = kind === "fabric" ? ["#1d3226", "#d9b04a", "#efe6d0"] : ["#c9694a", "#1d3226", "#d9b04a", "#efe6d0"];
  for (const dx of [-1.05, 1.05]) {
    for (const dz of [-0.75, 0.75]) {
      dress(parent, kit, "concrete", [0.1, 2.15, 0.1], [x + dx, GROUND + 1.075, z + dz], "#cfc6b6");
    }
  }
  const roof = dress(parent, kit, "corrugated_iron_02", [2.5, 0.06, 1.9], [x, GROUND + 2.32, z], "#c4b49a");
  roof.rotation.z = -0.14 * face;
  dress(parent, kit, "painted_plaster_wall", [2.15, 0.02, 1.45], [x, GROUND + 2.08, z], "#2a241e");
  dress(parent, kit, "painted_plaster_wall", [0.05, 0.55, 1.75], [x - face * 1.05, GROUND + 1.85, z], cloth);
  const counterX = x + face * 0.42;
  const top = GROUND + 0.66;
  dress(parent, kit, "concrete", [0.5, 0.56, 0.1], [counterX, GROUND + 0.28, z - 0.62], "#b7a588");
  dress(parent, kit, "concrete", [0.5, 0.56, 0.1], [counterX, GROUND + 0.28, z + 0.62], "#b7a588");
  dress(parent, kit, "concrete", [0.68, 0.08, 1.62], [counterX, top - 0.04, z], "#e4d2b4");
  if (kind === "fabric") {
    goods.forEach((tint, index) => {
      const hangZ = z - 0.48 + index * 0.48;
      for (let fold = 0; fold < 3; fold += 1) {
        const sheet = dress(
          parent,
          kit,
          "painted_plaster_wall",
          [0.035, 0.72 - fold * 0.08, 0.13],
          [x - face * (0.9 + fold * 0.025), GROUND + 1.32 - fold * 0.03, hangZ + (fold - 1) * 0.04],
          tint,
        );
        sheet.rotation.z = face * 0.06;
      }
    });
  } else {
    goods.forEach((tint, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      fruit(
        parent,
        kit,
        counterX + face * (column - 0.5) * 0.24,
        top,
        z - 0.28 + column * 0.34 + row * 0.08,
        0.11 + (index % 3) * 0.02,
        tint,
      );
    });
  }
  crate(parent, kit, x - face * 0.15, GROUND + 0.14, z + 1.05);
  dress(parent, kit, "concrete", [0.32, 0.42, 0.32], [x + face * 1.15, GROUND + 0.21, z + 0.85], "#2a312e");
  contact(ground, kit, x, z, 2.3, 1.7);
  if (kind === "cook") {
    pot(parent, kit, counterX, top, z + 0.28, 0.16, 0.2, "#8a8070");
    pot(parent, kit, counterX - face * 0.08, top, z - 0.22, 0.11, 0.16, "#c9694a");
  }
}

function dressPlaza(street: THREE.Object3D, buildings: THREE.Object3D, kit: JunctionKit): void {
  // The cross street ends at z=-18. This slab is the step up along the whole south edge of the square.
  dress(street, kit, "concrete", [18.6, 0.18, 2.6], [-105, 0.07, -16.95], "#d9d0c2");
  dress(street, kit, "concrete", [7.2, 0.04, 6.2], [-104.2, GROUND + 0.025, -11.2], "#e7d3b4");
  dress(street, kit, "brick_pavement_02", [7.6, 0.03, 0.35], [-104.2, GROUND + 0.03, -8.15], "#c4a88a", true);
  dress(street, kit, "brick_pavement_02", [7.6, 0.03, 0.35], [-104.2, GROUND + 0.03, -14.25], "#c4a88a", true);
  dress(street, kit, "brick_pavement_02", [0.35, 0.03, 6.4], [-107.75, GROUND + 0.03, -11.2], "#c4a88a", true);
  dress(street, kit, "brick_pavement_02", [0.35, 0.03, 6.4], [-100.65, GROUND + 0.03, -11.2], "#c4a88a", true);
  dress(street, kit, "concrete", [0.7, 0.08, 8], [-95.75, GROUND + 0.02, -10], "#d9d0c2");

  dress(buildings, kit, "concrete", [3.55, 0.5, 3.55], [-110, 0.25, -7], "#cfc6b6");
  contact(street, kit, -110, -7, 4.1, 4.1);
  dress(buildings, kit, "painted_plaster_wall", [3.4, 0.22, 3.4], [-110, 4.3, -7], "#efe6d0");
  dress(buildings, kit, "painted_plaster_wall", [3.4, 0.22, 3.4], [-110, 11.4, -7], "#efe6d0");
  dress(buildings, kit, "concrete", [0.16, 11, 0.1], [-110.85, 6.2, -8.72], "#b7ad9c");
  dress(buildings, kit, "concrete", [0.16, 11, 0.1], [-109.15, 6.2, -8.72], "#b7ad9c");
  dress(buildings, kit, "corrugated_iron_02", [2.4, 0.35, 2.4], [-110, 16.65, -7], "#6f675c");
  dress(buildings, kit, "painted_plaster_wall", [0.28, 0.7, 0.28], [-110, 17.15, -7], "#d9b04a");

  addStall(buildings, street, kit, -99.2, -14.2, -1, "provisions");
  addStall(buildings, street, kit, -99.2, -6.4, -1, "fabric");
  for (const [sx, sz] of [
    [-97.6, -10.4],
    [-97.6, -9.5],
    [-98.3, -9.9],
  ] as const) {
    dress(buildings, kit, "concrete", [0.34, 0.42, 0.34], [sx, GROUND + 0.21, sz], "#2a312e");
  }

  // Stays after the marker is collected, so the spot is still a place.
  dress(buildings, kit, "painted_plaster_wall", [1.7, 0.04, 1.7], [TREASURE.x, GROUND + 0.04, TREASURE.z], "#d9b04a");
  dress(buildings, kit, "concrete", [1.15, 0.28, 1.15], [TREASURE.x, GROUND + 0.16, TREASURE.z], "#cfc6b6");
  for (const [bx, bz] of [
    [TREASURE.x - 0.85, TREASURE.z - 0.85],
    [TREASURE.x + 0.85, TREASURE.z - 0.85],
    [TREASURE.x - 0.85, TREASURE.z + 0.85],
    [TREASURE.x + 0.85, TREASURE.z + 0.85],
  ] as const) {
    dress(buildings, kit, "concrete", [0.14, 0.55, 0.14], [bx, GROUND + 0.28, bz], "#2a312e");
  }
}

function dressMarket(street: THREE.Object3D, buildings: THREE.Object3D, kit: JunctionKit): void {
  for (const [z, length] of [
    [12, 13],
    [-4, 10],
    [-52, 18],
  ] as const) {
    const roof = dress(buildings, kit, "corrugated_iron_02", [1.7, 0.05, length], [-79.35, 3.45, z], "#b7aa94");
    roof.rotation.z = 0.16;
    dress(buildings, kit, "painted_plaster_wall", [1.35, 0.02, length - 0.4], [-79.45, 3.28, z], "#2a241e");
  }
  const counter = (z: number) => {
    dress(buildings, kit, "concrete", [0.42, 0.52, 0.1], [-79.45, GROUND + 0.26, z - 0.62], "#b7a588");
    dress(buildings, kit, "concrete", [0.42, 0.52, 0.1], [-79.45, GROUND + 0.26, z + 0.62], "#b7a588");
    dress(buildings, kit, "concrete", [0.58, 0.08, 1.55], [-79.45, GROUND + 0.56, z], "#e4d2b4");
    contact(street, kit, -79.45, z, 0.9, 1.8);
  };
  counter(12);
  for (const [index, tint] of ["#1d3226", "#d9b04a", "#c9694a"].entries()) {
    dress(buildings, kit, "painted_plaster_wall", [0.28, 0.08, 0.22], [-79.4, GROUND + 0.64, 12 - 0.4 + index * 0.38], tint);
    dress(buildings, kit, "painted_plaster_wall", [0.28, 0.06, 0.2], [-79.38, GROUND + 0.7, 12 - 0.38 + index * 0.38], "#efe6d0");
  }
  counter(-4);
  pot(buildings, kit, -79.4, GROUND + 0.6, -3.7, 0.15, 0.18, "#8a8070");
  pot(buildings, kit, -79.32, GROUND + 0.6, -4.3, 0.11, 0.14, "#2a312e");
  fruit(buildings, kit, -79.5, GROUND + 0.6, -4.0, 0.1, "#c9694a");
  counter(-48);
  crate(buildings, kit, -79.7, GROUND + 0.14, -46.85);
  crate(buildings, kit, -79.68, GROUND + 0.44, -46.85);

  // Stalls on the west pavement, in front of the set-back buildings, clear of the carriageway.
  addStall(buildings, street, kit, -93.7, 8, 1, "fabric");
  addStall(buildings, street, kit, -93.7, -8, 1, "provisions");
  addStall(buildings, street, kit, -93.7, -40, 1, "cook");
  // Kept 7 m from the Cold Room door (z -52), so neither the stall nor the camera behind a player at the door is in the way.
  addStall(buildings, street, kit, -93.7, -59, 1, "fabric");
}

/** A temporary marker: a dark post and a separate gold standard, so only the gold can glow. */
function buildClue(parent: THREE.Object3D): void {
  const post = new THREE.CylinderGeometry(0.08, 0.12, 2.2, 8);
  post.translate(0, 1.1, 0);
  paintVertices(post, "#2a312e");
  const flag = new THREE.BoxGeometry(0.72, 0.32, 0.05).toNonIndexed();
  flag.translate(0.2, 2.15, 0);
  paintVertices(flag, "#d9b04a");
  const stone = new THREE.OctahedronGeometry(0.34, 0);
  stone.translate(0, 2.6, 0);
  paintVertices(stone, "#d9b04a");
  const goldGeometry = mergeGeometries([flag, stone]);
  if (!goldGeometry) {
    throw new Error("The clue marker geometry could not be built.");
  }
  const group = new THREE.Group();
  group.name = "clue-marker";
  group.position.set(TREASURE.x, 0, TREASURE.z);
  const postMesh = new THREE.Mesh(
    post,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 }),
  );
  postMesh.castShadow = false;
  postMesh.name = "clue-post";
  const gold = new THREE.Mesh(
    goldGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.42,
      metalness: 0.35,
      emissive: "#d9b04a",
      emissiveIntensity: 0.28,
    }),
  );
  gold.castShadow = false;
  gold.name = "clue-gold";
  group.add(postMesh, gold);
  parent.add(group);
}
