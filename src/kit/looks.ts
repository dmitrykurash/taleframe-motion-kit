// Named looks for painted films: brush presets, the swirl lens and the painted finish, ready for
// applyTaleframeEffects() or <TaleframeEffects>. Spread a look to change one control: {...WATERCOLOR_BROAD, seed: 7}.
//
// The painted-film chain runs in this order:
//   1. an optional per-shot duotone tint (tintEffects), before the paint, so the brushwork carries the grade;
//   2. per-plane paint (paintEffects with a watercolor or oil look);
//   3. the swirl lens on the composited frame (lensEffects);
//   4. the painted finish once, on the whole frame: stopmotion on twos, soft-light grain, a light duotone.
import type {EffectsSettings, PostEffects} from '../taleframe/effects/types';
import type {WatercolorSettings} from '../taleframe/effects/native/paint/model';
import type {HeliosSettings} from '../taleframe/effects/native/helios/model';
import {oilStyle, type OilOptions, type OilWatercolorSettings} from './oil';

/** Broad watercolor: wide brushes, moderate wet edges, strong paper, strokes that grow toward the frame edge.
 * The default for landscapes, rooms and background plates. */
export const WATERCOLOR_BROAD: Partial<WatercolorSettings> = {
  enabled: true, amount: 1, wetness: .39, detail: 0, brushSize: .51, strokes: 1, edgeScale: .63, paper: .73, seed: 5201,
};

/** Fine watercolor: a small, very wet brush with no edge growth. For a busy subject whose shapes must survive. */
export const WATERCOLOR_FINE: Partial<WatercolorSettings> = {
  enabled: true, amount: 1, wetness: 1, detail: 0, brushSize: .23, strokes: 1, edgeScale: 0, paper: .63, seed: 5869,
};

/** Loose oil: every stroke twice the preset's size, and much less detail outside the focus regions.
 * Visible, confident brushwork that still keeps faces and the hero prop readable. */
export const LOOSE_OIL: Readonly<Required<Omit<OilOptions, 'focus'>>> = {strokeScale: 2, looseness: 2.4};

/** Oil at the preset's own stroke size, with every stroke the painting asks for. Tighter and more detailed. */
export const TIGHT_OIL: Readonly<Required<Omit<OilOptions, 'focus'>>> = {strokeScale: 1, looseness: 1};

/** A watercolor look painted in loose oil. Pass focus ellipses (frame uv) where detail should gather. */
export function looseOil(watercolor: Partial<WatercolorSettings> = WATERCOLOR_BROAD, focus?: OilOptions['focus']): OilWatercolorSettings {
  return oilStyle(watercolor, {...LOOSE_OIL, focus});
}

/** Swirl lens for painted plates: a wide sharp centre and a soft, swirled edge. */
export const SWIRL_LENS: Partial<HeliosSettings> = {
  enabled: true, amount: 1, aperture: 2.9, focusX: .5, focusY: .5, focusRadius: .57, focusFeather: .41,
  blur: 23, swirl: .68, curvature: .45, highlightBoost: .35, vignette: .12,
};

/** Swirl lens for a product UI layer: a sharper focus edge and more blur and swirl around it. */
export const SWIRL_LENS_UI: Partial<HeliosSettings> = {
  ...SWIRL_LENS, aperture: 4.8, focusRadius: .58, focusFeather: .26, blur: 44, swirl: .8,
};

/** The painted finish, applied once to the whole frame: stopmotion at 12 fps with handmade jitter, rotation, boil
 * and texture, then soft-light monochrome grain, then a light cool-shadow, warm-highlight duotone. */
export const PAINTED_FINISH: EffectsSettings = {
  order: ['stopmotion', 'grain', 'duotone'],
  stopmotion: {enabled: true, fps: 12, jitter: 2.75, rotation: .14, boil: 2.8, texture: 1, exposure: .08, seed: 6004},
  grain: {enabled: true, amount: .37, size: 2.3, monochrome: true, animated: true, speed: .5, blend: 'soft-light'},
  duotone: {enabled: true, amount: .25, shadows: '#17233d', highlights: '#f4cda2'},
};

/** PAINTED_FINISH for an output scale (1 = 1920 × 1080, 2 = 3840 × 2160). The finish is tuned at 4K and its jitter,
 * boil and grain are measured in output pixels, so smaller renders scale them down; the grain also gets lighter,
 * because one grain cell per pixel reads coarser than the 4K grain it replaces. At scale 2 it equals PAINTED_FINISH. */
export function paintedFinish(scale: number): EffectsSettings {
  const k = scale / 2;
  const stop = PAINTED_FINISH.stopmotion ?? {}, grain = PAINTED_FINISH.grain ?? {};
  return {
    ...PAINTED_FINISH,
    stopmotion: {...stop, jitter: (stop.jitter ?? 0) * k, boil: (stop.boil ?? 0) * k},
    grain: {...grain, size: Math.max(1, (grain.size ?? 1) * k), amount: (grain.amount ?? 0) * Math.min(1, .1 + .9 * k)},
  };
}

/** Effects that only paint (watercolor or oil). With oil, await loadOilBrushes() before applyTaleframeEffects(). */
export const paintEffects = (watercolor: Partial<WatercolorSettings>): EffectsSettings => ({order: ['watercolor'], watercolor});

/** Effects that only apply the swirl lens. */
export const lensEffects = (helios: Partial<HeliosSettings> = SWIRL_LENS): EffectsSettings => ({order: ['helios'], helios});

/** Effects that only tint: a per-shot duotone grade, applied before the paint. */
export const tintEffects = (duotone: Partial<PostEffects['duotone']>): EffectsSettings =>
  ({order: ['duotone'], duotone: {enabled: true, ...duotone}});
