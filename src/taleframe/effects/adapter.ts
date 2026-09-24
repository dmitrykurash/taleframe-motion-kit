import {normalizePostEffects} from './native/model';
import {applyPostEffects} from './native/render';
import {stopmotionFrame} from './native/stopmotion/timing';
import {frameAt, frameStart} from './time';
import type {EffectsSettings, Fps, PostEffects} from './types';

export type EffectsFrame = {
  /** Source frame, held when Stopmotion is enabled. Use this for source animation. */
  frame: number;
  /** Actual output frame. Use only for intentionally smooth overlays. */
  outputFrame: number;
  fps: number;
  seconds: number;
  width: number;
  height: number;
};

export function normalizeEffects(settings: EffectsSettings = {}): PostEffects {
  return normalizePostEffects({...settings, excludeText: false, excludeTransitions: false});
}

export function effectFrame(frame: number, fps: number, width: number, height: number, settings: EffectsSettings = {}): EffectsFrame {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) throw new Error('Effects need a finite frame and a positive frame rate.');
  const rate: Fps = {num: fps, den: 1};
  const effects = normalizeEffects(settings);
  const sample = stopmotionFrame(frameStart(frame, rate), effects.stopmotion, rate);
  const sourceFrame = frameAt(sample, rate);
  return {frame: sourceFrame, outputFrame: frame, fps, seconds: sourceFrame / fps, width, height};
}

/** Process the current source canvas. Rebuild its source pixels before every call. */
export function applyTaleframeEffects(ctx: CanvasRenderingContext2D, settings: EffectsSettings, frame: number, fps: number): void {
  const rate: Fps = {num: fps, den: 1};
  applyPostEffects(ctx, {width: ctx.canvas.width, height: ctx.canvas.height, postEffects: normalizeEffects(settings)}, frameStart(frame, rate), rate);
}

export {disposePostEffects as disposeTaleframeEffects} from './native/render';
export {DEFAULT_POST_EFFECTS as DEFAULT_TALEFRAME_EFFECTS} from './native/model';
export type {EffectsSettings, PostEffectKey} from './types';
