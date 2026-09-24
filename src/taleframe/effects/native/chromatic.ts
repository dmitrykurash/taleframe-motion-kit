/** Bounded Gaussian edge-field footprint, shared by GPU and Canvas fallback.
 * Radius is a standard deviation in project pixels, independent of preview size. */
export const BLUR_TAPS = 6;
export function chromaticBlurPlan(width: number, height: number, projectWidth: number, projectHeight: number, radius: number) {
  const levels: { width: number; height: number }[] = [];
  while (Math.max(radius * width / projectWidth, radius * height / projectHeight) > 4 && (width > 1 || height > 1)) {
    width = Math.max(1, Math.ceil(width / 2));
    height = Math.max(1, Math.ceil(height / 2));
    levels.push({ width, height });
  }
  return { levels, width, height, x: gaussianKernel(radius * width / projectWidth), y: gaussianKernel(radius * height / projectHeight) };
}
export function gaussianKernel(sigma: number) {
  const step = Math.max(1, sigma / 2), weights = new Float32Array(BLUR_TAPS + 1);
  weights[0] = 1;
  if (sigma > 0) for (let i = 1; i <= BLUR_TAPS; i++) weights[i] = Math.exp(-.5 * (i * step / sigma) ** 2);
  let sum = weights[0];
  for (let i = 1; i <= BLUR_TAPS; i++) sum += 2 * weights[i];
  for (let i = 0; i <= BLUR_TAPS; i++) weights[i] /= sum;
  return { step, weights };
}
