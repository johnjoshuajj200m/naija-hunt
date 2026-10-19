import * as THREE from "three";

import { TEXTURE_TILE_METRES, type TextureId } from "./assetList";
import type { JunctionAssets } from "./loadJunctionAssets";
import { addMesh, type Vec3 } from "../sceneHelpers";
import { applyWorldUv } from "./worldUv";

export type PbrOptions = {
  tint?: THREE.ColorRepresentation;
  roughness?: number;
  side?: THREE.Side;
  /** Read the tint from vertex colours instead of a uniform, so differently tinted meshes can share a material. */
  vertexColors?: boolean;
};

/**
 * Tints a wall so its base is a little darker than its top. The shift stays inside the colour, about
 * 12% at the ground and none at the parapet, which reads as grime without a second texture.
 */
export function paintWallVariation(geometry: THREE.BufferGeometry, tint: THREE.ColorRepresentation): void {
  const base = new THREE.Color(tint);
  const position = geometry.getAttribute("position");
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i += 1) {
    minY = Math.min(minY, position.getY(i));
    maxY = Math.max(maxY, position.getY(i));
  }
  const span = Math.max(0.001, maxY - minY);
  const values = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = (position.getY(i) - minY) / span;
    color.copy(base).multiplyScalar(Math.min(1, 0.88 + 0.12 * t));
    values[i * 3] = color.r;
    values[i * 3 + 1] = color.g;
    values[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
}

/** Fills a geometry's colour attribute with one colour. */
export function paintVertices(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation): void {
  const rgb = new THREE.Color(color);
  const count = geometry.getAttribute("position").count;
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    values[i * 3] = rgb.r;
    values[i * 3 + 1] = rgb.g;
    values[i * 3 + 2] = rgb.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
}

/**
 * Shared material and geometry helpers for the junction. PBR materials are cached, so ten walls with
 * the same plaster and tint share one material (and one set of GPU textures).
 */
export function createJunctionKit(assets: JunctionAssets) {
  const cache = new Map<string, THREE.MeshStandardMaterial>();

  /**
   * Poly Haven material: colour, OpenGL normal map and ARM (AO / roughness / metalness packed).
   * roughness and metalness are multipliers of the ARM map, so 1 means "use the map as authored".
   */
  const pbr = (id: TextureId, options: PbrOptions = {}): THREE.MeshStandardMaterial => {
    const vertexColors = options.vertexColors ?? false;
    const tint = new THREE.Color(vertexColors ? "#ffffff" : (options.tint ?? "#ffffff"));
    const key = `${id}|${tint.getHexString()}|${options.roughness ?? 1}|${options.side ?? THREE.FrontSide}|${vertexColors}`;
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }
    const set = assets.textures[id];
    const material = new THREE.MeshStandardMaterial({
      color: tint,
      map: set.diff,
      normalMap: set.nor,
      aoMap: set.arm,
      roughnessMap: set.arm,
      metalnessMap: set.arm,
      roughness: options.roughness ?? 1,
      metalness: 1,
      side: options.side ?? THREE.FrontSide,
      vertexColors,
    });
    cache.set(key, material);
    return material;
  };

  /**
   * A box textured at the real-world scale of its material. `size` is [x, y, z]; `position` is its centre.
   * Its tint is stored in vertex colours, so every box of one texture shares a single material and the
   * static scenery can be merged into very few draw calls.
   */
  const box = (
    parent: THREE.Object3D,
    id: TextureId,
    size: Vec3,
    position: Vec3,
    options: PbrOptions & { rotationY?: number; cast?: boolean; receive?: boolean; name?: string; weather?: boolean } = {},
  ): THREE.Mesh => {
    const geometry = applyWorldUv(new THREE.BoxGeometry(size[0], size[1], size[2]), TEXTURE_TILE_METRES[id]);
    if (options.weather) {
      paintWallVariation(geometry, options.tint ?? "#ffffff");
    } else {
      paintVertices(geometry, options.tint ?? "#ffffff");
    }
    return addMesh(parent, geometry, pbr(id, { roughness: options.roughness, side: options.side, vertexColors: true }), position, {
      rotation: [0, options.rotationY ?? 0, 0],
      cast: options.cast,
      receive: options.receive,
      name: options.name,
    });
  };

  // Untextured materials for small props: stock on a shelf, a stool, a pot. No texture, so no texture memory.
  const plainMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.82, metalness: 0.03, vertexColors: true });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: "#cfeaf0",
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    vertexColors: true,
  });

  type PartOptions = { tint?: THREE.ColorRepresentation; rotationY?: number; cast?: boolean; name?: string };

  /** A flat-coloured box. Every flat box shares one material, so a whole room merges into one draw. */
  const flat = (parent: THREE.Object3D, size: Vec3, position: Vec3, options: PartOptions & { glass?: boolean } = {}): THREE.Mesh => {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    paintVertices(geometry, options.tint ?? "#ffffff");
    return addMesh(parent, geometry, options.glass ? glassMaterial : plainMaterial, position, {
      rotation: [0, options.rotationY ?? 0, 0],
      cast: options.cast ?? false,
      receive: false,
      name: options.name,
    });
  };

  /** A flat-coloured upright cylinder (stool seat, pot, roll of cloth, tyre). `position` is the centre. */
  const cylinder = (
    parent: THREE.Object3D,
    radius: number,
    height: number,
    position: Vec3,
    options: PartOptions & { segments?: number; topRadius?: number } = {},
  ): THREE.Mesh => {
    const geometry = new THREE.CylinderGeometry(options.topRadius ?? radius, radius, height, options.segments ?? 8);
    paintVertices(geometry, options.tint ?? "#ffffff");
    return addMesh(parent, geometry, plainMaterial, position, { cast: options.cast ?? false, receive: false, name: options.name });
  };

  return { pbr, box, flat, cylinder, plainMaterial, glassMaterial };
}

export type JunctionKit = ReturnType<typeof createJunctionKit>;
