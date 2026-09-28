// The oil style of the Taleframe paint engine: brush registration and a settings helper.
//
// The engine paints synchronously, so it cannot load images itself. Register the two bristle brushes once with
// loadOilBrushes() before the first oil paint. <TaleframeEffects> does this for you; if you call
// applyTaleframeEffects() yourself, await loadOilBrushes() first (inside your own delayRender flow).
import {staticFile} from 'remotion';
import type {WatercolorSettings} from '../taleframe/effects/native/paint/model';
import {setOilBrushes} from '../taleframe/effects/native/paint/render';

/** Folder under public/ that holds the procedural oil brushes (tools/oil/brushes.py writes it). */
export const OIL_BRUSH_DIR = 'taleframe/oil/brushes';
/** The two horizontal brushes the engine uses: the small one for most boxes, the large one for broad boxes. */
export const OIL_BRUSH_FILES = {small: '0_small_h.png', large: '2_large_h.png'} as const;

/** One focus region in frame uv (0..1, top-left origin): centre and radii. */
export type OilFocusEllipse = readonly [cx: number, cy: number, rx: number, ry: number];

export type OilOptions = {
  /** Size of every stroke relative to the brush preset: 1 = the preset's cell, 2 = twice as long and wide. */
  strokeScale?: number;
  /** 1 or more. How much less detail outside the focus regions: finer strokes need more error to appear, and the
   * two finest levels are thinned. 1 = every stroke the painting asks for. */
  looseness?: number;
  /** Up to four ellipses where fine strokes gather (faces, hands, the hero prop). Tuples or a flat list. */
  focus?: readonly OilFocusEllipse[] | readonly number[];
};

export type OilWatercolorSettings = Partial<WatercolorSettings> & {style: 'oil'};

/** Flatten focus ellipses to the engine's layout: whole ellipses only, at most four, finite numbers. */
export function oilFocus(focus: OilOptions['focus']): number[] {
  if (!focus) return [];
  const flat: number[] = [];
  for (const item of focus as readonly (number | OilFocusEllipse)[]) {
    if (typeof item === 'number') flat.push(item);
    else flat.push(...item);
  }
  const whole = Math.min(4, Math.floor(flat.length / 4)) * 4;
  const out = flat.slice(0, whole);
  return out.every(Number.isFinite) ? out : [];
}

/** Watercolor settings painted in oil. The watercolor's brushSize, detail, edgeScale and seed still apply. */
export function oilStyle(watercolor: Partial<WatercolorSettings>, options: OilOptions = {}): OilWatercolorSettings {
  const focus = oilFocus(options.focus);
  return {
    ...watercolor,
    style: 'oil',
    ...(options.strokeScale !== undefined ? {strokeScale: options.strokeScale} : {}),
    ...(options.looseness !== undefined ? {looseness: options.looseness} : {}),
    ...(focus.length ? {focus} : {}),
  };
}

function loadBrush(file: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => resolve(img), reject);
    img.onerror = () => reject(new Error(`Cannot load oil brush ${OIL_BRUSH_DIR}/${file}. Run tools/oil/brushes.py.`));
    img.src = staticFile(`${OIL_BRUSH_DIR}/${file}`);
  });
}

let pending: Promise<void> | null = null;
/** Load the two bristle brushes and register them with the paint engine. Memoised; a failure rejects and resets,
 * so the next call tries again. */
export function loadOilBrushes(): Promise<void> {
  pending ??= Promise.all([loadBrush(OIL_BRUSH_FILES.small), loadBrush(OIL_BRUSH_FILES.large)])
    .then(([small, large]) => setOilBrushes(small, large))
    .catch(error => {pending = null; throw error;});
  return pending;
}
