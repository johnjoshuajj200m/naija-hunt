import { describe, expect, it } from "vitest";

import { alignSun, brightestColumn, columnAzimuth, columnShiftFor, shiftColumns } from "./hdriSun";

const W = 16;
const H = 4;

/** A dim image with one bright "sun" pixel. */
function imageWithSun(column: number, row = 1): Float32Array {
  const data = new Float32Array(W * H * 4).fill(0.1);
  const i = (row * W + column) * 4;
  data[i] = data[i + 1] = data[i + 2] = 50;
  return data;
}

describe("hdriSun", () => {
  it("finds the column of the brightest pixel", () => {
    expect(brightestColumn(imageWithSun(5), W, H)).toBe(5);
    expect(brightestColumn(imageWithSun(0, 3), W, H)).toBe(0);
  });

  it("maps columns to azimuths in the three.js equirect convention", () => {
    // The image centre is azimuth 0, i.e. the +x direction.
    expect(columnAzimuth(W / 2 - 0.5, W)).toBeCloseTo(0);
    expect(columnAzimuth(-0.5, W)).toBeCloseTo(-Math.PI);
  });

  it("computes a wrapped, non-negative whole-column shift", () => {
    expect(columnShiftFor(0, Math.PI / 2, W)).toBe(4);
    expect(columnShiftFor(Math.PI / 2, 0, W)).toBe(12); // wraps, never negative
    expect(columnShiftFor(1, 1, W)).toBe(0);
  });

  it("shifts rows circularly without losing or altering any pixel", () => {
    const original = imageWithSun(14);
    const shifted = shiftColumns(original, W, H, 4);
    expect(brightestColumn(shifted, W, H)).toBe(2); // 14 + 4 wraps to 2
    const sum = (a: Float32Array) => a.reduce((n, v) => n + v, 0);
    expect(sum(shifted)).toBeCloseTo(sum(original));
  });

  it("puts the sun on the requested azimuth to within one column", () => {
    const target = 0.9; // radians, atan2(z, x) of the directional light
    const aligned = alignSun(imageWithSun(3), W, H, target);
    const azimuth = columnAzimuth(brightestColumn(aligned, W, H), W);
    expect(Math.abs(azimuth - target)).toBeLessThanOrEqual(Math.PI / W + 1e-9);
  });

  it("does not copy the image when the sun is already in place", () => {
    const original = imageWithSun(W / 2 - 1);
    // Column 7 has azimuth (7.5/16 - 0.5) * 2pi, so asking for exactly that azimuth is a no-op.
    expect(alignSun(original, W, H, columnAzimuth(W / 2 - 1, W))).toBe(original);
  });
});
