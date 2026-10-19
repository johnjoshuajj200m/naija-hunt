import * as THREE from "three";

export type SignArrow = "up" | "left" | "right";
export type SignRow = { label: string; arrow: SignArrow };

/**
 * Original, fictional direction sign: green board, white border and lettering, one row per
 * destination. All names are invented for this project. Drawn on a canvas, so nothing is downloaded.
 */
export function createDirectionSignTexture(rows: SignRow[]): THREE.CanvasTexture {
  const rowHeight = 120;
  const width = 1024;
  const height = rowHeight * rows.length + 48;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a 2D canvas for the direction sign.");
  }

  context.fillStyle = "#0d5c3a";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#f4f1e6";
  context.lineWidth = 10;
  context.strokeRect(14, 14, width - 28, height - 28);

  context.fillStyle = "#f4f1e6";
  context.strokeStyle = "#f4f1e6";
  context.textBaseline = "middle";
  context.font = "700 66px sans-serif";

  rows.forEach((row, index) => {
    const cy = 24 + rowHeight * index + rowHeight / 2;
    context.textAlign = "left";
    context.fillText(row.label, 64, cy);

    // Arrow, drawn as a path so it does not depend on a font having the glyph.
    const ax = width - 120;
    context.lineWidth = 12;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (row.arrow === "up") {
      context.moveTo(ax, cy + 34);
      context.lineTo(ax, cy - 34);
      context.moveTo(ax - 26, cy - 8);
      context.lineTo(ax, cy - 34);
      context.lineTo(ax + 26, cy - 8);
    } else {
      const dir = row.arrow === "right" ? 1 : -1;
      context.moveTo(ax - 34 * dir, cy);
      context.lineTo(ax + 34 * dir, cy);
      context.moveTo(ax + 8 * dir, cy - 26);
      context.lineTo(ax + 34 * dir, cy);
      context.lineTo(ax + 8 * dir, cy + 26);
    }
    context.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
