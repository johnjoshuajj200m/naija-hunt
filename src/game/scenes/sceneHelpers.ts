import * as THREE from "three";

export type Vec3 = [number, number, number];

export function standard(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(params);
}

/** Clone of a texture with its own repeat, sharing the same canvas image. */
export function withRepeat(texture: THREE.Texture, x: number, y: number): THREE.Texture {
  const clone = texture.clone();
  clone.repeat.set(x, y);
  clone.needsUpdate = true;
  return clone;
}

type MeshOptions = {
  rotation?: Vec3;
  cast?: boolean;
  receive?: boolean;
  name?: string;
};

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3,
  options?: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  if (options?.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  }
  mesh.castShadow = options?.cast ?? true;
  mesh.receiveShadow = options?.receive ?? true;
  if (options?.name) {
    mesh.name = options.name;
  }
  parent.add(mesh);
  return mesh;
}

export type InstanceSpec = {
  position: Vec3;
  rotation?: Vec3;
  /** Euler order for `rotation`. Defaults to "XYZ". Use "YXZ" to tilt an object that has been turned about y. */
  rotationOrder?: THREE.EulerOrder;
  scale?: Vec3 | number;
  color?: THREE.ColorRepresentation;
};

export function addInstances(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  specs: InstanceSpec[],
  options?: { cast?: boolean; receive?: boolean; name?: string },
): THREE.InstancedMesh | null {
  if (specs.length === 0) {
    return null;
  }
  const mesh = new THREE.InstancedMesh(geometry, material, specs.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  specs.forEach((spec, index) => {
    dummy.position.set(spec.position[0], spec.position[1], spec.position[2]);
    const rotation = spec.rotation ?? [0, 0, 0];
    dummy.rotation.set(rotation[0], rotation[1], rotation[2], spec.rotationOrder ?? "XYZ");
    const scale = spec.scale ?? 1;
    if (typeof scale === "number") {
      dummy.scale.setScalar(scale);
    } else {
      dummy.scale.set(scale[0], scale[1], scale[2]);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (spec.color !== undefined) {
      mesh.setColorAt(index, color.set(spec.color));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = options?.cast ?? true;
  mesh.receiveShadow = options?.receive ?? true;
  if (options?.name) {
    mesh.name = options.name;
  }
  parent.add(mesh);
  return mesh;
}

/** Frees the GPU memory of every geometry, material and material texture under `root`, each once. */
export function disposeTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) {
      return;
    }
    geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      materials.add(material);
    }
  });
  for (const geometry of geometries) {
    geometry.dispose();
  }
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) {
        textures.add(value);
      }
    }
    material.dispose();
  }
  for (const texture of textures) {
    texture.dispose();
  }
}

/** Building footprint centred on x/z, base at y = 0. */
export function footprintGeometry(width: number, depth: number, height: number, bevel = 0.05): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 1,
  });
  // Shape y becomes -z and the extrusion axis becomes up, so the footprint stays centred.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Side profile (length along x, height along y) extruded across `width` on z, centred. */
export function profileGeometry(points: Array<[number, number]>, width: number, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point[0], point[1]);
    } else {
      shape.lineTo(point[0], point[1]);
    }
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  return geometry;
}
