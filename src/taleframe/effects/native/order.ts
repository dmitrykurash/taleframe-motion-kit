import type { PostEffectKey, PostEffects } from '../types';

/** Execution order: first is nearest the source, last is the topmost effect. */
export const DEFAULT_POST_EFFECT_ORDER: readonly PostEffectKey[] = Object.freeze([
  'watercolor', 'pigment', 'helios', 'lens', 'stopmotion', 'chromatic', 'duotone', 'grain',
]);
const known = new Set<string>(DEFAULT_POST_EFFECT_ORDER);

/** Repair partial/untrusted orders and append missing effects in their original order. */
export function normalizePostEffectOrder(value: unknown): PostEffectKey[] {
  const order: PostEffectKey[] = [], seen = new Set<string>();
  for (const key of [...(Array.isArray(value) ? value : []), ...DEFAULT_POST_EFFECT_ORDER]) {
    if (typeof key !== 'string' || !known.has(key) || seen.has(key)) continue;
    seen.add(key); order.push(key as PostEffectKey);
  }
  return order;
}

/** Includes disabled effects so toggling one does not lose its position. */
export function postEffectOrder(effects: Pick<PostEffects, 'order'> | undefined | null): PostEffectKey[] {
  return normalizePostEffectOrder(effects?.order);
}
