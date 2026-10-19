import * as THREE from "three";

/**
 * One canvas for every shop sign, instead of one texture per sign.
 *
 * Each cell is the same 512x128 the signs used before, so the lettering is not resampled. A pad of
 * the cell's own background colour sits between cells so mipmaps blend into that colour rather than
 * into the neighbouring sign. The decision to keep the atlas is checked against memory in
 * junctionSigns.test.ts and against the measured texture total after a real render.
 *
 * The atlas can be drawn at a smaller `scale` (the mobile tier uses 0.5), which keeps the lettering
 * crisp at phone distances and pays for the signs Palm Court added.
 */

export const SIGN_CELL_W = 512;
export const SIGN_CELL_H = 128;
export const SIGN_PAD = 16;

export type SignCell = { id: string; text: string; bg: string; fg: string };

export const SIGN_CELLS: readonly SignCell[] = [
  { id: "ade-and-sons", text: "ADE & SONS HARDWARE", bg: "#2a312e", fg: "#d9b04a" },
  { id: "glory-fabrics", text: "GLORY FABRICS", bg: "#1d3226", fg: "#faf6ee" },
  { id: "zion-tyres", text: "ZION TYRES", bg: "#2a312e", fg: "#d9b04a" },
  { id: "mallam-suya", text: "MALLAM SUYA", bg: "#1d3226", fg: "#faf6ee" },
  { id: "fresh-bread", text: "FRESH BREAD", bg: "#efe6d0", fg: "#1d3226" },
  { id: "spare-parts", text: "SPARE PARTS", bg: "#2a312e", fg: "#d9b04a" },
  { id: "palm-plaza", text: "PALM PLAZA", bg: "#1d3226", fg: "#efe6d0" },
  { id: "mama-put", text: "MAMA PUT", bg: "#c9694a", fg: "#efe6d0" },
  { id: "ankara-house", text: "ANKARA HOUSE", bg: "#1d3226", fg: "#d9b04a" },
  { id: "cold-room", text: "COLD ROOM", bg: "#2a312e", fg: "#efe6d0" },
  { id: "welding-works", text: "WELDING WORKS", bg: "#2a312e", fg: "#d9b04a" },
  { id: "carpentry", text: "CARPENTRY", bg: "#efe6d0", fg: "#1d3226" },
  // Palm Court: the building, its ground-floor shops, the directory and the unit plates (court/courtPlan.ts).
  { id: "palm-court", text: "PALM COURT", bg: "#1d3226", fg: "#efe6d0" },
  { id: "glow-pharmacy", text: "GLOW PHARMACY", bg: "#efe6d0", fg: "#1d6b43" },
  { id: "naija-phones", text: "NAIJA PHONES", bg: "#2a312e", fg: "#efe6d0" },
  { id: "bola-provisions", text: "BOLA PROVISIONS", bg: "#c9694a", fg: "#efe6d0" },
  { id: "court-directory", text: "TENANTS", bg: "#2a312e", fg: "#d9b04a" },
  { id: "to-let", text: "TO LET", bg: "#c9694a", fg: "#efe6d0" },
  { id: "unit-2a", text: "UNIT 2A", bg: "#2a312e", fg: "#efe6d0" },
  { id: "unit-2b", text: "UNIT 2B", bg: "#2a312e", fg: "#efe6d0" },
  { id: "unit-2c", text: "UNIT 2C", bg: "#2a312e", fg: "#efe6d0" },
  { id: "unit-3a", text: "UNIT 3A", bg: "#2a312e", fg: "#efe6d0" },
  { id: "unit-3b", text: "UNIT 3B", bg: "#2a312e", fg: "#efe6d0" },
  { id: "unit-3c", text: "UNIT 3C", bg: "#2a312e", fg: "#efe6d0" },
  { id: "eko-tailors", text: "EKO TAILORS", bg: "#efe6d0", fg: "#1d3226" },
  { id: "adaeze-law", text: "ADAEZE LAW", bg: "#1d3226", fg: "#d9b04a" },
  { id: "naija-print", text: "NAIJA PRINT HUB", bg: "#2f5f8a", fg: "#efe6d0" },
];

export type PixelRect = { x: number; y: number; w: number; h: number };

type Metrics = { w: number; h: number; pad: number };

/** Cell, cell height and pad, in pixels, at a scale (1 is the full 512x128 cell). */
function metrics(scale: number): Metrics {
  return {
    w: Math.round(SIGN_CELL_W * scale),
    h: Math.round(SIGN_CELL_H * scale),
    pad: Math.max(2, Math.round(SIGN_PAD * scale)),
  };
}

export function signAtlasSize(count = SIGN_CELLS.length, scale = 1): { width: number; height: number } {
  const m = metrics(scale);
  return {
    width: m.w + m.pad * 2,
    height: m.pad + count * (m.h + m.pad),
  };
}

/** Cell rectangle in canvas pixels, inset from its neighbours by the pad. */
export function signCellPixels(index: number, scale = 1): PixelRect {
  const m = metrics(scale);
  return {
    x: m.pad,
    y: m.pad + index * (m.h + m.pad),
    w: m.w,
    h: m.h,
  };
}

export type UvRect = { u0: number; v0: number; u1: number; v1: number };

/** UV rectangle for a cell. v grows upward, canvas y grows downward. */
export function signCellUv(index: number, count = SIGN_CELLS.length, scale = 1): UvRect {
  const { width, height } = signAtlasSize(count, scale);
  const { x, y, w, h } = signCellPixels(index, scale);
  return {
    u0: x / width,
    u1: (x + w) / width,
    v0: 1 - (y + h) / height,
    v1: 1 - y / height,
  };
}

/**
 * Estimated GPU bytes, using the same rules as the diagnostics: 4 bytes a pixel and a full mip chain.
 * `separate` is one 512x128 texture per sign. `atlas` is the single padded canvas at `scale`.
 */
export function estimateSignBytes(count = SIGN_CELLS.length, scale = 1): { separate: number; atlas: number } {
  const bytes = (w: number, h: number): number => Math.round(w * h * 4 * (4 / 3));
  const { width, height } = signAtlasSize(count, scale);
  return { separate: count * bytes(SIGN_CELL_W, SIGN_CELL_H), atlas: bytes(width, height) };
}

function drawLabel(context: CanvasRenderingContext2D, cell: SignCell, rect: PixelRect, scale: number): void {
  context.fillStyle = cell.fg;
  context.textAlign = "center";
  context.textBaseline = "middle";
  // Large lettering, so the name still reads from the middle of the street. Long names shrink to fit.
  let fontSize = Math.round(82 * scale);
  const smallest = Math.max(8, Math.round(20 * scale));
  const step = Math.max(1, Math.round(2 * scale));
  context.font = `700 ${fontSize}px sans-serif`;
  while (context.measureText(cell.text).width > rect.w - 36 * scale && fontSize > smallest) {
    fontSize -= step;
    context.font = `700 ${fontSize}px sans-serif`;
  }
  context.fillText(cell.text, rect.x + rect.w / 2, rect.y + rect.h / 2 - 4 * scale);
  context.fillStyle = cell.fg === "#d9b04a" ? "#d9b04a" : "#b88f35";
  context.fillRect(rect.x, rect.y + rect.h - 10 * scale, rect.w, 8 * scale);
}

export type SignAtlas = {
  texture: THREE.CanvasTexture;
  uv: Record<string, UvRect>;
};

export function createSignAtlas(scale = 1): SignAtlas {
  const count = SIGN_CELLS.length;
  const { width, height } = signAtlasSize(count, scale);
  const pad = metrics(scale).pad;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a 2D canvas for the shop signs.");
  }

  context.fillStyle = "#1a1917";
  context.fillRect(0, 0, width, height);
  const uv: Record<string, UvRect> = {};
  SIGN_CELLS.forEach((cell, index) => {
    const rect = signCellPixels(index, scale);
    // The pad around the lettering is the cell's own background, so a mipmap blend stays on-colour.
    context.fillStyle = cell.bg;
    context.fillRect(rect.x - pad, rect.y - pad / 2, rect.w + pad * 2, rect.h + pad);
    context.fillStyle = cell.bg;
    context.fillRect(rect.x, rect.y, rect.w, rect.h);
    drawLabel(context, cell, rect, scale);
    uv[cell.id] = signCellUv(index, count, scale);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, uv };
}

/** The atlas and the one material every sign in the district shares, so a sign anywhere costs no extra draw call. */
export type SignKit = SignAtlas & { material: THREE.MeshStandardMaterial };

export function createSignKit(scale = 1): SignKit {
  const atlas = createSignAtlas(scale);
  return { ...atlas, material: new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, metalness: 0.08 }) };
}

/** A sign plane whose UVs cover one atlas cell and nothing else. */
export function createSignPlane(width: number, height: number, cell: UvRect): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, cell.u0 + uv.getX(i) * (cell.u1 - cell.u0), cell.v0 + uv.getY(i) * (cell.v1 - cell.v0));
  }
  uv.needsUpdate = true;
  return geometry;
}
