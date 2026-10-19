import type * as THREE from "three";

import type { Building } from "../../scenes/junction/buildingList";
import type { JunctionKit } from "../../scenes/junction/junctionKit";
import { DOOR_HEAD, footprintBox } from "../entrances";
import { doorHalfOf, doorPoint, ROOM_HEIGHT, type InteriorDef } from "../interiors";
import { FLOOR_PITCH } from "./courtGeometry";

/** Floor of the first storey to the underside of the roof: two floors up, then a room. */
export const COURT_HEIGHT = 2 * FLOOR_PITCH + ROOM_HEIGHT;

/** What a room's wall has outside the 6 cm skin the room draws for itself (WALL 0.4 - SKIN 0.06). */
const OUTER = 0.34;

type Plaster = (minX: number, maxX: number, minZ: number, maxZ: number, y0: number, y1: number) => void;

/**
 * The outside of Palm Court: four plaster walls the full height of the three floors, with a gap in the
 * front wall at each street door and a lintel over it, and a roof slab. The rooms inside draw their own floors,
 * ceilings and wall skins (interiorBuilder.ts), so this shell is hidden whenever the player is indoors and
 * the rooms never share a visible face with it. The doorways are cut from the rooms' own door positions, so
 * the shell and the room agree on where the openings are.
 *
 * The shell is a placeholder box like every building here; the façade pieces (windows, doors, signs) come from
 * the shared façade layout (junctionFacades.ts).
 */
export function addCourtShell(group: THREE.Group, kit: JunctionKit, building: Building, streetRooms: readonly InteriorDef[]): void {
  const box = footprintBox(building);
  const plaster: Plaster = (minX, maxX, minZ, maxZ, y0, y1) => {
    if (maxX - minX < 0.01 || maxZ - minZ < 0.01 || y1 - y0 < 0.01) {
      return;
    }
    kit.box(
      group,
      "painted_plaster_wall",
      [maxX - minX, y1 - y0, maxZ - minZ],
      [(minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2],
      { tint: building.tint, roughness: 1, weather: true },
    );
  };

  // West and east walls, then the back wall between them.
  plaster(box.minX, box.minX + OUTER, box.minZ, box.maxZ, 0, COURT_HEIGHT);
  plaster(box.maxX - OUTER, box.maxX, box.minZ, box.maxZ, 0, COURT_HEIGHT);
  plaster(box.minX + OUTER, box.maxX - OUTER, box.maxZ - OUTER, box.maxZ, 0, COURT_HEIGHT);

  // The front wall (the "-z" face, at the smallest z): solid, except for a door gap in each street room's wall.
  const gaps = streetRooms
    .filter((def) => def.facing === "-z")
    .map((def) => {
      const { x } = doorPoint(def);
      const half = doorHalfOf(def);
      return { from: x - half, to: x + half };
    })
    .sort((a, b) => a.from - b.from);
  const frontZ0 = box.minZ;
  const frontZ1 = box.minZ + OUTER;
  let cursor = box.minX + OUTER;
  for (const gap of gaps) {
    plaster(cursor, gap.from, frontZ0, frontZ1, 0, COURT_HEIGHT);
    plaster(gap.from, gap.to, frontZ0, frontZ1, DOOR_HEAD, COURT_HEIGHT);
    cursor = gap.to;
  }
  plaster(cursor, box.maxX - OUTER, frontZ0, frontZ1, 0, COURT_HEIGHT);

  kit.box(
    group,
    "concrete",
    [box.maxX - box.minX + 0.3, 0.3, box.maxZ - box.minZ + 0.3],
    [(box.minX + box.maxX) / 2, COURT_HEIGHT + 0.15, (box.minZ + box.maxZ) / 2],
    { tint: "#cfc6b6" },
  );
}
