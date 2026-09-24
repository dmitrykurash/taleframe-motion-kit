/** Split visible characters, keeping emoji, combining marks and joined glyphs intact. */
export function graphemes(text: string): string[] {
  return Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text), part => part.segment);
}

/** Fixed keystroke timing. Inputs are seconds, independent of render frame rate. */
export function keystrokeSchedule(text: string, start: number, end: number, initialSeed = 7821): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('Typing requires finite times with end >= start.');
  }
  const characters = graphemes(text);
  if (characters.length === 0) return [];
  if (characters.length === 1) return [start];
  let seed = initialSeed >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const intervals = characters.slice(1).map((character, i) => {
    const previous = characters[i];
    let delay = .035 + random() * .055;
    if (/\s/u.test(character)) delay *= .62;
    if (/\s/u.test(previous)) delay += .018 + random() * .055;
    if (/[.,:;!?]/u.test(previous)) delay += .08 + random() * .06;
    if (random() < .08) delay += .035 + random() * .065;
    if (character === previous) delay *= .70;
    return delay;
  });
  const factor = (end - start) / intervals.reduce((a, b) => a + b, 0);
  let time = start;
  const schedule = [start, ...intervals.map(interval => (time += interval * factor))];
  schedule[schedule.length - 1] = end;
  return schedule;
}

export function typedAt(text: string, schedule: readonly number[], t: number): string {
  return graphemes(text).slice(0, schedule.filter(time => time <= t).length).join('');
}

/** Sum damped responses to individual keys; the camera never restarts a word tween. */
export function trackedWidth(t: number, times: readonly number[], widths: readonly number[], tau = .075): number {
  if (widths.length !== times.length + 1 || tau <= 0) {
    throw new Error('trackedWidth needs one prefix width per key plus the empty prefix, and tau > 0.');
  }
  return times.reduce((sum, time, i) => {
    if (t <= time) return sum;
    const age = (t - time) / tau;
    const response = 1 - (1 + age) * Math.exp(-age);
    return sum + (widths[i + 1] - widths[i]) * response;
  }, widths[0]);
}
