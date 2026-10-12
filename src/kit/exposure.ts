// The stop-motion finish's exposure, asked for one frame without drawing anything.
// The finish changes the exposure of the whole frame with every held picture. On painted pictures that is the life of
// stop-motion; on large flat light interface it reads as a flicker. To keep it on the painting only: finish the film
// with `stopmotion.exposure: 0` and multiply the painted layer by `stopmotionExposure()` yourself (CSS
// `filter: brightness(gain)` on that layer is the same multiplication). See docs/high-resolution.md.
import {normalizePostEffects} from '../taleframe/effects/native/model';
import {stopmotionFrame} from '../taleframe/effects/native/stopmotion/timing';
import {stopmotionVisualState} from '../taleframe/effects/native/stopmotion/visual';
import {frameStart} from '../taleframe/effects/time';
import type {EffectsSettings} from './TaleframeEffects';

/** What the finish `settings` would multiply film frame `frame` by (with exposure 0.08: about 0.95 to 1.06). It is
 * the engine's own timing and random hand, so it changes exactly when a held picture opens. */
export function stopmotionExposure(settings: EffectsSettings, frame: number, fps: number): number {
  const rate = {num: fps, den: 1}, stop = normalizePostEffects({...settings, excludeText: false, excludeTransitions: false}).stopmotion;
  return stopmotionVisualState(stop, stopmotionFrame(frameStart(frame, rate), stop, rate))?.gain ?? 1;
}
