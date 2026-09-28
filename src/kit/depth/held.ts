// Held pictures: footage is extracted only for the frames the edit shows (on twos, 12 pictures a second), and each
// output frame shows the latest picture at or before it. A still painting is held frame 0 for its whole shot.

/** The latest listed frame at or before `frame` (the first one before the list starts). `frames` must be sorted. */
export function heldFrame(frames: readonly number[], frame: number): number {
  if (!frames.length) throw new Error('A held-frame list needs at least one frame.');
  if (frame <= frames[0]) return frames[0];
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {const mid = (lo + hi + 1) >> 1; if (frames[mid] <= frame) lo = mid; else hi = mid - 1;}
  return frames[lo];
}

/** A shot's held-frame lookup from the film frames that have a picture (any order, duplicates allowed). */
export function heldFrames(frames: readonly number[]): (frame: number) => number {
  const list = [...new Set(frames)].sort((a, b) => a - b);
  if (!list.length || !list.every(Number.isInteger)) throw new Error('heldFrames needs a non-empty list of whole film frames.');
  return (frame: number) => heldFrame(list, frame);
}

/** Film frames first, first + step, … up to last (inclusive): the frames to extract for a shot on twos. */
export function onTwos(first: number, last: number, step = 2): number[] {
  if (!Number.isInteger(first) || !Number.isInteger(last) || last < first || !Number.isInteger(step) || step < 1) {
    throw new Error('onTwos needs whole frames first <= last and a whole step of at least 1.');
  }
  const out: number[] = [];
  for (let f = first; f <= last; f += step) out.push(f);
  return out;
}

/** A still painting: every frame shows held frame 0. */
export const heldStill = () => 0;
