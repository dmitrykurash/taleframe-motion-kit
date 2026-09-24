import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {TimeShift, useTime} from './clock';

/** Centered, evenly stratified sample offsets in seconds for one exposure.
 * `shutter` is a fraction of the frame interval: 0.5 equals a 180° film shutter. */
export function shutterOffsets(samples: number, shutter: number, fps: number): number[] {
  if (!Number.isFinite(shutter) || shutter < 0 || shutter > 2) throw new Error('shutter must be 0–2 frame intervals.');
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('fps must be positive.');
  const n = Math.max(1, Math.floor(samples));
  if (n === 1 || shutter === 0) return [0];
  return Array.from({length: n}, (_, i) => ((i + .5) / n - .5) * shutter / fps);
}

/** Samples needed so neighboring copies of a streak stay about `spacing` logical pixels apart.
 * Short streaks get no blur; any blur uses at least 6 copies, because 2–4 copies read as ghosts. */
export function samplesForStreak(streakPixels: number, max = 24, spacing = 3): number {
  if (!Number.isFinite(streakPixels) || streakPixels <= spacing * 2) return 1;
  const cap = Math.max(1, Math.floor(max));
  return Math.min(cap, Math.max(6, Math.ceil(streakPixels / spacing)));
}

export type MotionBlurProps = {
  /** Draw the complete, opaque picture for one sample time (seconds). */
  children: (time: number) => React.ReactNode;
  /** Exposure as a fraction of one frame. 0.5 = 180° (film default); 0 disables blur. */
  shutter?: number;
  /** Copies averaged per frame. Cost grows linearly; 8–16 covers most moves. */
  samples?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Temporal motion blur: renders the picture at several instants inside the shutter and averages them.
 * Each copy is composited over the previous ones with opacity 1/(i+1), which yields an exact mean for
 * opaque pictures: static regions stay pixel-identical, moving regions streak along their real path.
 * Everything below that reads `useTime()` is sampled too. Give the picture an opaque background. */
export function MotionBlur({children, shutter = .5, samples = 12, time, style}: MotionBlurProps) {
  const clock = useTime(), t = time ?? clock;
  const {fps} = useVideoConfig();
  const offsets = shutterOffsets(samples, shutter, fps);
  if (offsets.length === 1) return <>{children(t)}</>;
  return <AbsoluteFill style={{isolation: 'isolate', ...style}}>
    {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
      <TimeShift by={offset}>{children(t + offset)}</TimeShift>
    </AbsoluteFill>)}
  </AbsoluteFill>;
}
