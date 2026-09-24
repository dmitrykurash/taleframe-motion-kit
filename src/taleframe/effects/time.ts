// Native Taleframe frame-clock helpers; input time is in 48 kHz samples.
import { SAMPLE_RATE, type Fps } from './types';
const SR = SAMPLE_RATE;

export function frameStart(n: number, fps: Fps): number {
  return Math.round((n * SR * fps.den) / fps.num);
}

export function frameAt(pos: number, fps: Fps): number {
  let n = Math.floor((pos * fps.num) / (SR * fps.den));
  if (frameStart(n + 1, fps) <= pos) n++;
  else if (frameStart(n, fps) > pos) n--;
  return n;
}

export function frameCeil(pos: number, fps: Fps): number {
  const n = frameAt(pos, fps);
  const s = frameStart(n, fps);
  return s === pos ? s : frameStart(n + 1, fps);
}

export function frameFloor(pos: number, fps: Fps): number {
  return frameStart(frameAt(pos, fps), fps);
}
