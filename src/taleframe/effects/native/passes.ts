/** Saved order is execution order: the last pass sees every result below it. */
import type { PostEffectKey, PostEffects } from '../types';
import { DEFAULT_POST_EFFECTS } from './model';
import { postEffectOrder } from './order';
import { watercolorActive, pigmentActive } from './paint/model';
import { heliosActive } from './helios/model';
import { stopmotionAppearanceActive } from './stopmotion/visual';

export function effectHasPixels(e: PostEffects, key: PostEffectKey): boolean {
  switch (key) {
    case 'watercolor': return watercolorActive(e.watercolor);
    case 'pigment': return pigmentActive(e.pigment);
    case 'helios': return heliosActive(e.helios);
    case 'stopmotion': return stopmotionAppearanceActive(e.stopmotion);
    case 'grain': return e.grain.enabled && e.grain.amount > 0;
    case 'chromatic': return e.chromatic.enabled && e.chromatic.strength !== 0;
    case 'lens': return e.lens.enabled && (e.lens.distortion !== 0 || e.lens.zoom !== 1);
    case 'duotone': return e.duotone.enabled && e.duotone.amount > 0;
  }
}

export function postEffectPasses(e: PostEffects): PostEffectKey[] {
  return postEffectOrder(e).filter(key => effectHasPixels(e, key));
}

/** A pass gets precisely one enabled effect. In particular, a later blur must
 * sample the already-rendered grain/paint, not their original source image. */
export function isolatePostEffect(e: PostEffects, key: PostEffectKey): PostEffects {
  return { ...DEFAULT_POST_EFFECTS, [key]: e[key] };
}
