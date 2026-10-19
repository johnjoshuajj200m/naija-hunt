import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { mergeStaticByMaterial } from "./mergeStatic";

const triangleCount = (root: THREE.Object3D): number => {
  let triangles = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry as THREE.BufferGeometry;
      triangles += (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;
    }
  });
  return triangles;
};

const meshCount = (root: THREE.Object3D): number => {
  let meshes = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes += 1;
    }
  });
  return meshes;
};

// precise = true measures real vertices. The default box of a rotated object is looser than its true extent.
const worldBox = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root, true);

function sampleGroup(): { group: THREE.Group; red: THREE.Material; blue: THREE.Material } {
  const red = new THREE.MeshStandardMaterial({ color: "red" });
  const blue = new THREE.MeshStandardMaterial({ color: "blue" });
  const group = new THREE.Group();
  group.name = "sample";
  // Indexed box, indexed cylinder, non-indexed extrusion: three kinds of geometry sharing two materials.
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), red);
  box.position.set(5, 1, -4);
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), red);
  cylinder.position.set(-3, 0.5, 2);
  cylinder.rotation.y = 0.6;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2, 0), new THREE.Vector2(0, 2)]);
  const extrusion = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }), blue);
  extrusion.position.set(0, 0, 8);
  // A nested child, as a vehicle's parts would be.
  const holder = new THREE.Group();
  holder.position.set(10, 0, 0);
  holder.rotation.y = Math.PI / 2;
  const wheel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), blue);
  wheel.position.set(1, 0.5, 0);
  holder.add(wheel);
  group.add(box, cylinder, extrusion, holder);
  return { group, red, blue };
}

describe("mergeStaticByMaterial", () => {
  it("leaves one mesh per material and loses no triangles", () => {
    const { group } = sampleGroup();
    const before = triangleCount(group);
    expect(meshCount(group)).toBe(4);

    mergeStaticByMaterial(group);

    expect(meshCount(group)).toBe(2);
    expect(triangleCount(group)).toBe(before);
  });

  it("keeps every object exactly where it was", () => {
    const { group } = sampleGroup();
    const before = worldBox(group);

    mergeStaticByMaterial(group);

    const after = worldBox(group);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
  });

  it("still lets the group itself be moved afterwards", () => {
    const { group } = sampleGroup();
    mergeStaticByMaterial(group);
    const resting = worldBox(group);

    group.position.x += 100;

    const moved = worldBox(group);
    expect(moved.min.x - resting.min.x).toBeCloseTo(100, 3);
  });

  it("keeps each mesh's own vertex colours when meshes of one material are merged", () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const paint = (color: string) => {
      const geometry = new THREE.BoxGeometry();
      const rgb = new THREE.Color(color);
      const count = geometry.getAttribute("position").count;
      const values = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        values.set([rgb.r, rgb.g, rgb.b], i * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
      return geometry;
    };
    const group = new THREE.Group();
    group.add(new THREE.Mesh(paint("#ff0000"), material), new THREE.Mesh(paint("#0000ff"), material));

    mergeStaticByMaterial(group);

    expect(group.children).toHaveLength(1);
    const colors = (group.children[0] as THREE.Mesh).geometry.getAttribute("color");
    const first = new THREE.Color().fromBufferAttribute(colors, 0);
    const last = new THREE.Color().fromBufferAttribute(colors, colors.count - 1);
    expect(first.getHexString()).toBe("ff0000");
    expect(last.getHexString()).toBe("0000ff");
  });

  it("keeps shadow flags apart and never merges instanced meshes", () => {
    const material = new THREE.MeshStandardMaterial();
    const group = new THREE.Group();
    const caster = new THREE.Mesh(new THREE.BoxGeometry(), material);
    caster.castShadow = true;
    const plain = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 3);
    group.add(caster, plain, instanced);

    mergeStaticByMaterial(group);

    const meshes = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    expect(meshes).toHaveLength(3); // casting, non-casting, and the untouched instanced mesh
    expect(meshes.some((m) => m instanceof THREE.InstancedMesh)).toBe(true);
  });
});
