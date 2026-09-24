import { frameCeil, frameFloor } from '../../time';
import { SAMPLE_RATE, type Fps, type PostEffects } from '../../types';
import type { StopmotionSettings } from './model';

/** A visual clock only: audio always keeps the original timeline clock. */
export interface StopmotionScope {
  fps: number;
  anchor: number;
  excludeText: boolean;
  excludeTransitions: boolean;
  /** Earliest visible source sample inherited from a trimmed parent instance. */
  minimum?: number;
}

export function stopmotionScope(effects: PostEffects | undefined, anchor = 0): StopmotionScope | null {
  const stop = effects?.stopmotion;
  return stop?.enabled && Number.isFinite(stop.fps) && stop.fps > 0
    ? { fps: stop.fps, anchor, excludeText: !!effects?.excludeText, excludeTransitions: !!effects?.excludeTransitions }
    : null;
}

/** Deterministic exposure time in 48 kHz samples; no accumulated floating-point clock. */
export function stopmotionTime(t: number, captureFps: number, anchor = 0): number {
  if (!Number.isFinite(t) || !Number.isFinite(captureFps) || captureFps <= 0) return t;
  const step = SAMPLE_RATE / captureFps;
  return anchor + Math.round(Math.floor((t - anchor) / step + 1e-9) * step);
}

export function stopmotionPose(t: number, settings: StopmotionSettings | undefined, anchor = 0): number {
  return settings?.enabled && settings.fps > 0 ? Math.floor((t - anchor) * settings.fps / SAMPLE_RATE + 1e-9) : 0;
}

/** First output frame of the current exposure, never later than the current frame. */
export function stopmotionFrame(t: number, settings: StopmotionSettings | undefined, fps: Fps, anchor = 0): number {
  const current = frameFloor(t, fps);
  return settings?.enabled ? Math.min(current, frameCeil(stopmotionTime(current, settings.fps, anchor), fps)) : current;
}

/** Output-frame-aligned pose. Clamp at a cut so a freshly active clip never disappears. */
export function stopmotionLayerTime(t: number, scopes: readonly StopmotionScope[], fps: Fps, start: number, text = false): number {
  let sampled = t;
  let minimum = start;
  for (const scope of scopes) {
    if (text && scope.excludeText) continue;
    sampled = stopmotionTime(sampled, scope.fps, scope.anchor);
    minimum = Math.max(minimum, scope.minimum ?? -Infinity);
  }
  return Math.min(t, Math.max(Number.isFinite(minimum) ? frameCeil(minimum, fps) : -Infinity, frameCeil(sampled, fps)));
}

/** Parent timeline clock → child source clock, including trimmed instances. */
export function childStopmotionScopes(scopes: readonly StopmotionScope[], start: number, offset: number, minimum = -Infinity): StopmotionScope[] {
  return scopes.map(scope => {
    const floor = Math.max(minimum, (scope.minimum ?? -Infinity) + offset - start);
    return { ...scope, anchor: scope.anchor + offset - start, ...(Number.isFinite(floor) ? { minimum: floor } : {}) };
  });
}
