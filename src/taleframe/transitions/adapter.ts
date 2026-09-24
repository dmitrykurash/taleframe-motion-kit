import {cubicBezier} from './easing';
import {getTransitionModule, hasTransition, resolveParams} from './registry';
import type {Ease, TransitionParamValue} from './types';

/** Endpoints are exact; the last frame of the window is the new picture. */
export function transitionFrame(frame: number, fromFrame: number, durationInFrames: number, fps: number, kind: string, values?: Record<string, TransitionParamValue>, ease?: Exclude<Ease, 'hold'>) {
  if (!hasTransition(kind)) throw new Error(`Unknown transition "${kind}". See docs/transitions.md for the available names.`);
  if (![frame, fromFrame, durationInFrames, fps].every(Number.isFinite) || fps <= 0 || !Number.isInteger(durationInFrames) || durationInFrames < 2) {
    throw new Error('A transition needs finite frame values, a positive fps, and at least two whole frames.');
  }
  const module = getTransitionModule(kind);
  const progress = Math.max(0, Math.min(1, (frame - fromFrame) / (durationInFrames - 1)));
  const curve = ease ?? module.meta.defaultEase;
  if (curve !== 'linear' && (curve.length !== 4 || !curve.every(Number.isFinite) || curve[0] < 0 || curve[0] > 1 || curve[2] < 0 || curve[2] > 1)) {
    throw new Error('Transition easing must be linear or a valid cubic-bezier tuple.');
  }
  return {
    module, progress,
    eased: curve === 'linear' ? progress : cubicBezier(...curve)(progress),
    seconds: Math.max(0, Math.min(durationInFrames - 1, frame - fromFrame)) / fps,
    durationSec: durationInFrames / fps,
    fps, params: resolveParams(kind, values),
  };
}

/** Source crop for a full-frame input, with centered cover or contain behavior. */
export function imagePlacement(sourceWidth: number, sourceHeight: number, width: number, height: number, fit: 'cover' | 'contain' | 'stretch') {
  if (![sourceWidth, sourceHeight, width, height].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Image and canvas sizes must be positive.');
  if (fit === 'stretch') return {x: 0, y: 0, width, height};
  const ratio = fit === 'contain' ? Math.min(width / sourceWidth, height / sourceHeight) : Math.max(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * ratio, h = sourceHeight * ratio;
  return {x: (width - w) / 2, y: (height - h) / 2, width: w, height: h};
}
