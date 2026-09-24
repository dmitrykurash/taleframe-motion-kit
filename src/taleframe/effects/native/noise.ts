/** Integer hash shared with GLSL; independent of evaluation order and wall time. */
export function pixelNoise(x: number, y: number, tick: number, channel: number): number {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(tick, 2246822519) ^ Math.imul(channel + 1, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
