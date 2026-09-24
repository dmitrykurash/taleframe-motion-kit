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

/** Render children as if the clock were `by` seconds later (negative: earlier). Offsets nest. */
export function TimeShift({by, children}: {by: number; children: React.ReactNode}) {
  const outer = useContext(ClockOffset);
  if (!Number.isFinite(by)) throw new Error('TimeShift needs a finite offset in seconds.');
  return <ClockOffset.Provider value={outer + by}>{children}</ClockOffset.Provider>;
}
