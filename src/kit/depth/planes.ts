// Painted planes: the colour picture cut by a plane mask (or the plate with its subjects filled in), tinted, then
// painted in the plane's own space. Painting before the camera moves keeps every stroke on the plane it belongs
// to, however far the camera travels (no "shower door").
import {applyTaleframeEffects, type EffectsSettings} from '../../taleframe/effects/adapter';
import {DEFAULT_WATERCOLOR, type WatercolorSettings} from '../../taleframe/effects/native/paint/model';
import {loadOilBrushes, oilFocus} from '../oil';
import {outputSize, type DepthConfig} from './config';
import type {Ellipse} from './focus';
import {applyMask} from './mask';
import {depthImage, releaseSurface, surface} from './raster';
import type {PlaneSource} from './sources';

/** Taleframe watercolor settings; add `style: 'oil'` (see oilStyle in ../oil) for the oil style. */
export type PaintSettings = Partial<WatercolorSettings>;
export type TintSettings = NonNullable<EffectsSettings['duotone']>;

export type PaintedPlaneOptions = {
  source: PlaneSource;
  held: number;
  config: DepthConfig;
  /** Output pixels per stage pixel (default 1). The plane is painted at output resolution. */
  scale?: number;
  /** Watercolor or oil; false or absent leaves the picture unpainted. */
  paint?: PaintSettings | false;
  /** Duotone applied before the paint (a per-shot colour grade that the strokes then carry). */
  tint?: TintSettings;
  /** Added to the paint seed: planes of one shot get different brush layouts. */
  seed?: number;
  /** Multiplies brushSize: subjects a step finer than the plates behind them (0.8), haze broader (1.2). */
  brush?: number;
  /** Oil only: up to four ellipses (plane uv) where fine strokes gather. */
  focus?: readonly Ellipse[] | readonly number[];
};

const cache = new Map<string, Promise<HTMLCanvasElement>>();
let limit = 16;

/** How many painted planes to keep (default 16). Keep it above the number of planes one frame draws. */
export function setPlaneCacheLimit(n: number) {
  if (!Number.isInteger(n) || n < 1) throw new Error('The plane cache needs room for at least one plane.');
  limit = n;
}

/** The same settings painted in watercolor: the oil-only controls are dropped. One flag brings an earlier
 * watercolor look back (DepthFilm's `forceWatercolor`). */
export function asWatercolor(paint: PaintSettings): PaintSettings {
  if (paint.style !== 'oil') return paint;
  const {style: _style, focus: _focus, strokeScale: _strokeScale, looseness: _looseness, ...watercolor} = paint;
  return watercolor;
}

/** The final paint settings for a plane: enabled, the plane's seed and brush, and for oil its focus ellipses. */
export function planePaintSettings(paint: PaintSettings, o: {seed?: number; brush?: number; focus?: PaintedPlaneOptions['focus']}): PaintSettings {
  const settings: PaintSettings = {...paint, enabled: true, seed: ((paint.seed ?? DEFAULT_WATERCOLOR.seed) + (o.seed ?? 0)) >>> 0};
  if (o.brush !== undefined && o.brush !== 1) settings.brushSize = (paint.brushSize ?? DEFAULT_WATERCOLOR.brushSize) * o.brush;
  if (paint.style === 'oil' && o.focus) {
    const focus = oilFocus(o.focus);
    if (focus.length) settings.focus = focus; else delete settings.focus;
  }
  return settings;
}

/** The painted picture of one plane on one held frame (output size, alpha = the plane's coverage). Cached by its
 * sources, held frame, size and settings; the canvas stays valid for the caller even after it leaves the cache. */
export function paintedPlane(o: PaintedPlaneOptions): Promise<HTMLCanvasElement> {
  const {source: s, held, config} = o;
  const {width, height} = outputSize(config, o.scale ?? 1);
  const paint = o.paint ? planePaintSettings(o.paint, o) : null;
  const paths = {color: s.color(held), mask: s.mask?.(held), fill: s.fill?.(held), fillMask: s.fillMask?.(held)};
  const key = JSON.stringify([width, height, held, paths, paint, o.tint ?? null]);
  const hit = cache.get(key);
  if (hit) {cache.delete(key); cache.set(key, hit); return hit;}
  const pending = (async () => {
    const [color, mask, fill, fillMask] = await Promise.all([depthImage(paths.color), paths.mask && depthImage(paths.mask),
      paths.fill && depthImage(paths.fill), paths.fillMask && depthImage(paths.fillMask)]);
    if (paint?.style === 'oil') await loadOilBrushes();
    // Not a pooled surface: the cache owns it and callers may hold it past eviction.
    const canvas = Object.assign(document.createElement('canvas'), {width, height});
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(color, 0, 0, width, height);
    if (fill) {
      const tmp = surface(width, height);
      tmp.drawImage(fill, 0, 0, width, height);
      if (fillMask) applyMask(tmp, fillMask);
      ctx.drawImage(tmp.canvas, 0, 0);
      releaseSurface(tmp);
    }
    if (mask) applyMask(ctx, mask);
    if (o.tint) applyTaleframeEffects(ctx, {order: ['duotone'], duotone: {...o.tint, enabled: true}}, held, config.fps);
    if (paint) applyTaleframeEffects(ctx, {order: ['watercolor'], watercolor: paint}, held, config.fps);
    return canvas;
  })();
  cache.set(key, pending);
  pending.catch(() => {if (cache.get(key) === pending) cache.delete(key);});
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  return pending;
}
