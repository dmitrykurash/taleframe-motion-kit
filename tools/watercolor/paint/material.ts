import type { Affine } from './types';

/** Canvas uses a top-left origin; paint geometry uses bottom-left reference
 * pixels. Conjugate by the vertical reflection, then change pixel units. */
export function paintMaterialTransform(material: Affine, width: number, height: number): Affine {
  const [a, b, c, d, e, f] = material, scale = 1080 / Math.min(width, height);
  return [a, -b, -c, d, (e + c * height) * scale, (height - d * height - f) * scale];
}
