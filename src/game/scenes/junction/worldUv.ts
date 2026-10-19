import * as THREE from "three";

/**
 * Rewrites a geometry's UVs so one texture tile covers `tileMetres` of real surface, whatever the size
 * of the box or plane. Poly Haven publishes each material's real-world tile size, so this gives correct
 * texel density on every wall, road and kerb without cloning textures.
 *
 * Each vertex is projected along the axis its normal points along most. Call this after the geometry
 * has its final size; the mesh may then be translated or turned in 90-degree steps without changing density.
 */
export function applyWorldUv(geometry: THREE.BufferGeometry, tileMetres: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!normal) {
    throw new Error("applyWorldUv needs vertex normals.");
  }
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = position.getX(i);
      v = position.getZ(i);
    } else if (nx >= nz) {
      u = position.getZ(i);
      v = position.getY(i);
    } else {
      u = position.getX(i);
      v = position.getY(i);
    }
    uv[i * 2] = u / tileMetres;
    uv[i * 2 + 1] = v / tileMetres;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}
