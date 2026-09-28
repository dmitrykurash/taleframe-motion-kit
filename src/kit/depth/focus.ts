// Focus ellipses for the oil style: where the painting must read (the hero prop, a lit window, a face). The oil
// style lowers its fine-level thresholds inside them, so small strokes gather there. Ellipses are [cx, cy, rx, ry]
// in plane uv (0..1, top-left origin), on the held frame, because each plane is painted in its own space.
import {trackLookup, type Track} from './anchors';
import type {DepthConfig} from './config';

export type Ellipse = [cx: number, cy: number, rx: number, ry: number];
/** An ellipse keyed on a held frame: [held, cx, cy, rx, ry] in uv. */
export type EllipseKey = [held: number, cx: number, cy: number, rx: number, ry: number];

/** Linear interpolation through keys sorted by held frame, holding the ends. */
export function keyedEllipse(keys: readonly EllipseKey[], held: number): Ellipse {
  if (!keys.length) throw new Error('keyedEllipse needs at least one key.');
  const pick = (k: EllipseKey): Ellipse => [k[1], k[2], k[3], k[4]];
  if (held <= keys[0][0]) return pick(keys[0]);
  const last = keys[keys.length - 1];
  if (held >= last[0]) return pick(last);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (held >= a[0] && held <= b[0]) {
      const u = (held - a[0]) / Math.max(1, b[0] - a[0]);
      return [1, 2, 3, 4].map(k => a[k] + (b[k] - a[k]) * u) as Ellipse;
    }
  }
  return pick(last);
}

/** A tracked subject as an ellipse covering `scale` of it. Tracks are in frame fractions, as the preparation tools
 * write them: x and w of the width, y, h and r of the height. */
export function trackedEllipse(track: Track<{x: number; y: number; r?: number; w?: number; h?: number}>, held: number,
  config: DepthConfig, scale = 1): Ellipse | null {
  const t = trackLookup(track)(held);
  if (!t) return null;
  const aspect = config.height / config.width;
  const rx = (t.r !== undefined ? t.r * aspect : (t.w ?? .2 * aspect) / 2) * scale;
  const ry = (t.r ?? (t.h ?? .2) / 2) * scale;
  return [t.x, t.y, rx, ry];
}

/** A plane's focus function from still ellipses and keyed ellipses (the engine keeps the first four). */
export function focusEllipses(...parts: (Ellipse | readonly EllipseKey[])[]): (held: number) => Ellipse[] {
  return (held: number) => parts.map(p => typeof p[0] === 'number' ? p as Ellipse : keyedEllipse(p as readonly EllipseKey[], held)).slice(0, 4);
}
