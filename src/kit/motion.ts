import {Easing, interpolate} from 'remotion';

export const clamp = (v: number) => Math.min(1, Math.max(0, v));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const progress = (t: number, start: number, duration: number) =>
  duration <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / duration);
export const ease = Easing.bezier(0.76, 0, 0.24, 1);
export const settle = Easing.bezier(0.16, 1, 0.3, 1);
/** For an element that is already visible and moves from rest: a short lead-in, then a long settle. */
export const glide = Easing.bezier(0.45, 0.05, 0.15, 1);
export const travel = (t: number, start: number, duration: number) => ease(progress(t, start, duration));
export const arrive = (t: number, start: number, duration: number) => settle(progress(t, start, duration));
export const fade = (t: number, start: number, end: number) => progress(t, start, end - start);

export function keyed(t:number, times:number[], values:number[]) {
  return interpolate(t, times, values, {easing:ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
}
