import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {TimeShift, useClockRate, useTime} from './clock';

/** Centered, evenly stratified sample offsets in seconds for one exposure.
 * `shutter` is a fraction of the frame interval: 0.5 equals a 180° film shutter. */
export function shutterOffsets(samples: number, shutter: number, fps: number, phase = .5): number[] {
  if (!Number.isFinite(shutter) || shutter < 0 || shutter > 2) throw new Error('shutter must be 0–2 frame intervals.');
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('fps must be positive.');
  const n = Math.max(1, Math.floor(samples));
  if (shutter === 0) return [0];
  if (n === 1) return [(phase - .5) * shutter / fps];      // one sample: the middle of the exposure, unless it is one of a set (phase)
  return Array.from({length: n}, (_, i) => ((i + phase) / n - .5) * shutter / fps);
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
  /** Where in its stratum each sample sits, 0–1 (0.5: its middle). A picture averaged from G renders, each of n
   * samples at phase (g + 0.5) / G, is the picture of n x G evenly spread samples. */
  phase?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Temporal motion blur: renders the picture at several instants inside the shutter and averages them.
 * Each copy is composited over the previous ones with opacity 1/(i+1), which yields an exact mean for
 * opaque pictures: static regions stay pixel-identical, moving regions streak along their real path.
 * Everything below that reads `useTime()` is sampled too. Give the picture an opaque background. */
export function MotionBlur({children, shutter = .5, samples = 12, phase = .5, time, style}: MotionBlurProps) {
  const clock = useTime(), t = time ?? clock;
  const {fps} = useVideoConfig();
  // The shutter stays open for a fraction of a *film* frame; inside a speed ramp that spans less (or more) shot time.
  const offsets = shutterOffsets(samples, Math.min(2, shutter * useClockRate()), fps, phase);
  if (offsets.length === 1) return offsets[0] === 0 ? <>{children(t)}</> : <TimeShift by={offsets[0]}>{children(t + offsets[0])}</TimeShift>;
  return <AbsoluteFill style={{isolation: 'isolate', ...style}}>
    {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
      <TimeShift by={offset}>{children(t + offset)}</TimeShift>
    </AbsoluteFill>)}
  </AbsoluteFill>;
}

/** How the samples of one frame are spread over render passes when the picture is rendered `dense` times as many
 * pixels as its own size (4 at --scale 2). A sample then costs the browser `dense` times the memory, so a pass mounts
 * at most samples / dense of them: no pass asks more than the render at the film's own size, which mounts them all.
 * 6 samples at dense 4: 6 passes of 1. 8: 4 of 2. 15: 5 of 3. 32: 4 of 8. See docs/high-resolution.md. */
export function blurPasses(samples: number, dense = 4): {passes: number; own: number} {
  if (samples <= 1) return {passes: 1, own: 1};
  const own = Math.max(1, Math.floor(samples / dense));
  return {passes: Math.ceil(samples / own), own};
}

/** `MotionBlur` for a film that is also rendered in passes. `pass` undefined: all samples at once (the normal render).
 * `pass` k: this render mounts only its share of the samples; a frame that needs fewer passes than k + 1 is black.
 * tools/hires/average.py takes the mean of the passes. */
export function PassedMotionBlur({pass, dense = 4, samples = 12, ...rest}: MotionBlurProps & {pass?: number; dense?: number}) {
  if (pass === undefined) return <MotionBlur samples={samples} {...rest}/>;
  const {passes, own} = blurPasses(samples, dense);
  if (pass >= passes) return <AbsoluteFill style={{background: '#000'}}/>;
  return <MotionBlur {...rest} samples={own} phase={(pass + .5) / passes}/>;
}
