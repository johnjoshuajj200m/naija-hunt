/**
 * Helpers that keep the image-based lighting and the directional sun pointing the same way.
 *
 * The HDRI only lights the scene. Its brightest pixel is its sun; before the environment map is built,
 * the image is turned about the vertical axis (a circular shift of pixel columns) so that sun lines up
 * with the directional light that casts our shadows. Doing it on the pixels avoids relying on how a
 * renderer signs its environment rotation.
 *
 * Equirectangular convention (matches three.js): column u = atan2(z, x) / 2pi + 0.5.
 */

/** Column of the brightest pixel in an RGBA float equirectangular image. */
export function brightestColumn(rgba: ArrayLike<number>, width: number, height: number): number {
  let best = -1;
  let bestColumn = 0;
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const i = (row * width + column) * 4;
      const luminance = 0.2126 * (rgba[i] ?? 0) + 0.7152 * (rgba[i + 1] ?? 0) + 0.0722 * (rgba[i + 2] ?? 0);
      if (luminance > best) {
        best = luminance;
        bestColumn = column;
      }
    }
  }
  return bestColumn;
}

/** World azimuth, atan2(z, x), of an image column's centre. */
export function columnAzimuth(column: number, width: number): number {
  return ((column + 0.5) / width - 0.5) * 2 * Math.PI;
}

/** Whole-column shift that moves azimuth `from` onto azimuth `to`, in [0, width). */
export function columnShiftFor(fromAzimuth: number, toAzimuth: number, width: number): number {
  const turns = (toAzimuth - fromAzimuth) / (2 * Math.PI);
  const shift = Math.round(turns * width) % width;
  return shift < 0 ? shift + width : shift;
}

/** Returns a copy of the image with every row shifted right by `shift` columns, wrapping around. */
export function shiftColumns(rgba: Float32Array, width: number, height: number, shift: number): Float32Array {
  const out = new Float32Array(rgba.length);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const from = (row * width + column) * 4;
      const to = (row * width + ((column + shift) % width)) * 4;
      out[to] = rgba[from] ?? 0;
      out[to + 1] = rgba[from + 1] ?? 0;
      out[to + 2] = rgba[from + 2] ?? 0;
      out[to + 3] = rgba[from + 3] ?? 1;
    }
  }
  return out;
}

/** Aligns the image's sun to `targetAzimuth` (atan2(z, x) of the directional light's direction). */
export function alignSun(rgba: Float32Array, width: number, height: number, targetAzimuth: number): Float32Array {
  const sunColumn = brightestColumn(rgba, width, height);
  const shift = columnShiftFor(columnAzimuth(sunColumn, width), targetAzimuth, width);
  return shift === 0 ? rgba : shiftColumns(rgba, width, height, shift);
}
