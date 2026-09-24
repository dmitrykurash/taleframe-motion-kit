import type { Affine } from '../../types';

export interface BrushGrid {
  spacing: number; columns: number; rows: number; segments: number;
  /** Absolute material-cell coordinates of the first submitted cell. */
  originX: number; originY: number;
}

/** Geometry is bounded by visible pixels and a fixed per-pass ceiling, even
 * for a tiny preview, an extreme aspect ratio or a manually typed brush size. */
export function brushGrid(reference: readonly [number, number], width: number, height: number, brushSize: number, level: number, material?: Affine, edgeScale = 0): BrushGrid {
  const cell = 9 + 48 * Math.sqrt(brushSize);
  const segments = [6, 4, 1][level];
  const instanceLimit = Math.min(80000, Math.floor(480000 / (2 * (segments + 1))));
  let budget = Math.max(256, Math.min(instanceLimit, Math.floor(width * height / 5)));
  let spacing = Math.max(2.5, cell * [1, .43, .10][level], Math.sqrt(reference[0] * reference[1] / budget));
  const peripheral = Number.isFinite(edgeScale) ? Math.max(0, Math.min(4, edgeScale)) : 0;
  if (material || peripheral > 0) {
    const empty = (): BrushGrid => ({ spacing, columns: 0, rows: 0, segments, originX: 0, originY: 0 });
    const transform: Affine = material ?? [1, 0, 0, 1, 0, 0];
    const [a, b, c, d, e, f] = transform, determinant = a * d - b * c;
    if (!transform.every(Number.isFinite) || !Number.isFinite(determinant) || determinant === 0) return empty();
    const ia = d / determinant, ib = -b / determinant, ic = -c / determinant, id = a / determinant;
    const ie = (c * f - d * e) / determinant, iff = (b * e - a * f) / determinant;
    // Largest inverse singular value. Unlike the inverse bounding box, this
    // bound is independent of pan AND rotation. Stabilize insignificant trig
    // round-off so rotating a clip does not reseed a budget-limited lattice.
    const x = ia * ia + ib * ib, y = ic * ic + id * id, cross = ia * ic + ib * id;
    const inverseScale = Number(Math.sqrt((x + y + Math.hypot(x - y, 2 * cross)) / 2).toPrecision(12));
    const stretch = Number((inverseScale * Math.sqrt(Math.abs(determinant))).toPrecision(12));
    // A stroke can reach <4.3 cells (long half-path + width + feature pull).
    // Five cells also contain its jittered seed and the analytical edge.
    // compositionScale() enlarges peripheral strokes up to this factor.
    const growth = Math.exp((peripheral / (1 + peripheral * .5)) * .65);
    const halo = Math.max(5, Math.ceil(5 * stretch * growth - 1e-9));
    // A tiny preview still needs both sides of the halo. Raise only its
    // minimum instance allowance, retaining the fixed per-pass vertex cap.
    if (peripheral > 0) budget = Math.min(instanceLimit, Math.max(budget, (halo * 2 + 4) ** 2));
    const axisBudget = Math.floor(Math.sqrt(budget)) - halo * 2 - 2;
    if (!Number.isFinite(inverseScale) || !Number.isFinite(ie) || !Number.isFinite(iff) || axisBudget < 1) return empty();
    spacing = Math.max(spacing, Math.hypot(reference[0], reference[1]) * inverseScale / axisBudget);
    const x1 = ia * reference[0], x2 = ic * reference[1], y1 = ib * reference[0], y2 = id * reference[1];
    const minX = ie + Math.min(0, x1) + Math.min(0, x2), maxX = ie + Math.max(0, x1) + Math.max(0, x2);
    const minY = iff + Math.min(0, y1) + Math.min(0, y2), maxY = iff + Math.max(0, y1) + Math.max(0, y2);
    const originX = Math.floor(minX / spacing) - halo, originY = Math.floor(minY / spacing) - halo;
    const columns = Math.ceil(maxX / spacing) + halo - originX, rows = Math.ceil(maxY / spacing) + halo - originY;
    // uOrigin is an ivec2. Reject unreachable/ill-conditioned coordinates
    // rather than overflowing a shader integer or submitting unbounded work.
    const integerLimit = 2_147_400_000;
    if (![originX, originY, columns, rows].every(Number.isFinite)
      || Math.abs(originX) + columns > integerLimit || Math.abs(originY) + rows > integerLimit
      || columns < 1 || rows < 1 || columns * rows > budget) return empty();
    return { spacing, columns, rows, segments, originX, originY };
  }
  let columns = Math.ceil(reference[0] / spacing), rows = Math.ceil(reference[1] / spacing);
  while (columns * rows > budget) { spacing *= 1.02; columns = Math.ceil(reference[0] / spacing); rows = Math.ceil(reference[1] / spacing); }
  return { spacing, columns, rows, segments, originX: 0, originY: 0 };
}
