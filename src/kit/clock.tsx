import React, {createContext, useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

/** Seconds added to the composition clock below this point (motion-blur samples, deliberate time shifts). */
const ClockOffset = createContext(0);

/** Film time in seconds. Inside `MotionBlur` or `TimeShift` it includes that sample's offset,
 * so scenes that read time here are blurred along their own motion. */
export function useTime() {
  const {fps} = useVideoConfig();
  return useCurrentFrame() / fps + useContext(ClockOffset);
}

/** Playback rate of the local clock relative to the film: 1 normally, below 1 inside slow motion. */
const ClockRate = createContext(1);
export const useClockRate = () => useContext(ClockRate);

/** Children run at `rate` times the speed of their parent's clock (rates multiply when nested). Combine
 * with TimeShift; SpeedRamp does both. MotionBlur scales its shutter by the rate, so slow motion blurs less. */
export function ClockScale({rate, children}: {rate: number; children: React.ReactNode}) {
  const outer = useContext(ClockRate);
  if (!Number.isFinite(rate) || rate < 0) throw new Error('ClockScale needs a finite rate of 0 or more.');
  return <ClockRate.Provider value={outer * rate}>{children}</ClockRate.Provider>;
}

/** Render children as if the clock were `by` seconds later (negative: earlier). Offsets nest. */
export function TimeShift({by, children}: {by: number; children: React.ReactNode}) {
  const outer = useContext(ClockOffset);
  if (!Number.isFinite(by)) throw new Error('TimeShift needs a finite offset in seconds.');
  return <ClockOffset.Provider value={outer + by}>{children}</ClockOffset.Provider>;
}
