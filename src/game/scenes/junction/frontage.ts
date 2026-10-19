/**
 * Frontage geometry shared by the facade generator, the building shells, the collision list and the
 * entrance table. Pure: nothing here imports three or any scene module, so data files can use it.
 * Metres, y up. A "frontage" is one face of a building box.
 */

export type Facing = "+x" | "-x" | "+z" | "-z";

/** normal points away from the building. tangent is the direction a facade offset grows. yaw turns +z to the normal. */
export const FACING: Record<Facing, { normal: [number, number]; tangent: [number, number]; yaw: number }> = {
  "+x": { normal: [1, 0], tangent: [0, -1], yaw: Math.PI / 2 },
  "-x": { normal: [-1, 0], tangent: [0, 1], yaw: -Math.PI / 2 },
  "+z": { normal: [0, 1], tangent: [1, 0], yaw: 0 },
  "-z": { normal: [0, -1], tangent: [-1, 0], yaw: Math.PI },
};

/** The part of a building the frontage maths needs. Building (junctionBuildings.ts) satisfies it. */
export type Footprint = { x0: number; x1: number; z0: number; z1: number };

export const frontageLength = (building: Footprint, facing: Facing): number => {
  const alongZ = facing === "+x" || facing === "-x";
  return Math.abs(alongZ ? building.z0 - building.z1 : building.x1 - building.x0);
};

/** One bay per ~3.4 m, never fewer than two. */
export const bayCountOf = (length: number): number => Math.max(2, Math.floor(length / 3.4));

/** Centre of a bay along the frontage, measured from the frontage centre. */
export function bayOffset(length: number, bay: number): number {
  const bays = bayCountOf(length);
  return (bay + 0.5) * (length / bays) - length / 2;
}

/** The face plane's centre point. x for "+x"/"-x" faces, z for "+z"/"-z" faces, the other axis at the middle. */
export function faceCenter(building: Footprint, facing: Facing): { x: number; z: number } {
  const x = facing === "+x" ? building.x1 : facing === "-x" ? building.x0 : (building.x0 + building.x1) / 2;
  const z = facing === "+z" ? building.z0 : facing === "-z" ? building.z1 : (building.z0 + building.z1) / 2;
  return { x, z };
}

/** World position on the face plane at the middle of a bay. */
export function bayWorldPoint(building: Footprint, facing: Facing, bay: number): { x: number; z: number } {
  const centre = faceCenter(building, facing);
  const offset = bayOffset(frontageLength(building, facing), bay);
  const f = FACING[facing];
  return { x: centre.x + f.tangent[0] * offset, z: centre.z + f.tangent[1] * offset };
}
