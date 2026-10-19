import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// "color" is kept so vertex-tinted meshes that share a material keep their individual tints when merged.
const KEPT_ATTRIBUTES = new Set(["position", "normal", "uv", "color"]);

/** A copy with only position/normal/uv/color, non-indexed, so geometries of different kinds can be merged. */
function normalised(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const copy = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(copy.attributes)) {
    if (!KEPT_ATTRIBUTES.has(name)) {
      copy.deleteAttribute(name);
    }
  }
  copy.clearGroups();
  if (!copy.getAttribute("normal")) {
    copy.computeVertexNormals();
  }
  if (!copy.getAttribute("uv")) {
    copy.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(copy.getAttribute("position").count * 2), 2));
  }
  return copy;
}

/**
 * Bakes every plain mesh under `group` into one mesh per (material, shadow flags). Nothing moves and
 * no triangle is added or lost; only the number of draw calls falls. Use it for scenery that never
 * moves on its own. Instanced meshes, lines and meshes with several materials are left alone.
 *
 * Positions are baked relative to the group, so the group itself can still be moved or turned.
 * Per-object frustum culling is lost, which is fine for small scenery that is mostly in view.
 */
export function mergeStaticByMaterial(group: THREE.Object3D): void {
  group.updateWorldMatrix(true, true);
  const toGroup = group.matrixWorld.clone().invert();
  const relative = new THREE.Matrix4();

  type Bucket = { material: THREE.Material; cast: boolean; receive: boolean; geometries: THREE.BufferGeometry[] };
  const buckets = new Map<string, Bucket>();
  const merged: THREE.Mesh[] = [];

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) {
      return;
    }
    const geometry = normalised(object.geometry);
    geometry.applyMatrix4(relative.copy(toGroup).multiply(object.matrixWorld));
    const key = `${object.material.uuid}|${object.castShadow}|${object.receiveShadow}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: object.material, cast: object.castShadow, receive: object.receiveShadow, geometries: [] };
      buckets.set(key, bucket);
    }
    bucket.geometries.push(geometry);
    merged.push(object);
  });

  for (const mesh of merged) {
    mesh.removeFromParent();
  }
  let index = 0;
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false);
    for (const part of bucket.geometries) {
      part.dispose();
    }
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.name = `merged-${group.name || "group"}-${index}`;
    group.add(mesh);
    index += 1;
  }
}
