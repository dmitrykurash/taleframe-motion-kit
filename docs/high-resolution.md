# High-resolution renders

`npm run render -- Film --gl angle --scale 2` renders a 1920 × 1080 film at 3840 × 2160. Two things go wrong at that size that do not go wrong at the film's own size, and neither shows in a still at rest. Check for both before you call a 4K file done.

## Motion blur can overrun the browser

`MotionBlur` mounts the whole picture once per sample and averages the copies. At `--scale 2` every copy costs four times the memory. When the total passes the browser's tile memory, Chrome leaves tiles out **without an error**: in moving frames parts of the picture come out black or grey, in rectangles, while every still frame looks perfect.

The fix is to render a moving frame in several passes, each with a share of its samples, and average the passes.

```tsx
import {getInputProps} from 'remotion';
import {PassedMotionBlur, samplesForStreak} from './kit';

const {blurPass} = getInputProps() as {blurPass?: number};
<PassedMotionBlur pass={blurPass} dense={4} shutter={0.5} samples={samplesForStreak(speed, 32)}>
  {() => <Scene/>}
</PassedMotionBlur>
```

Without `blurPass` this is plain `MotionBlur`. With it, a pass mounts at most `samples / dense` copies (`blurPasses()`): 6 samples become 6 passes of 1, 15 become 5 of 3, 32 become 4 of 8, never more than 7 passes. A frame that needs fewer passes is black in the others.

1. Write the plan: for every frame, `blurPasses(samples, 4).passes`, as `{"groups": [...]}`.
2. Render each pass with `{"blurPass": K}` as props: `npm run render -- Film --gl angle --scale 2 --crf 12 --props pass-K.json --out pass-K.mp4`. Add `--range FROM-TO` (seconds) to render in stretches: a whole-film render keeps every frame on disk until it is encoded.
3. Average: `python3 -B tools/hires/average.py plan.json film.mp4 pass-0.mp4 pass-1.mp4 …`. It stops if a picture disagrees with the plan.

A fixed limit ("no more than 8 samples at once") is not enough. Where the camera is slow, large layers are laid out at full size in every sample, and six of them can already be too many. Tie the limit to the density, as `blurPasses` does.

## Compare every new size with the one you trust

```bash
python3 -B tools/qa/compare.py film-4k.mp4 film-1080p.mp4
```

It reads both files frame by frame at a small size and lists the frames to look at. Text that is sharper at 4K shows as a small steady difference. A frame that is many levels darker in one file has lost pieces of its picture.

## Flat interface under a stop-motion finish

The painted finish changes exposure with each held picture (`stopmotion.exposure`). On a painting that is the look. On a large flat window it is a pulse of a dozen levels, many times a second. Keep it on the painting only: finish with `exposure: 0`, and multiply the painted layer by `stopmotionExposure(settings, frame, fps)` (`filter: brightness()` on that layer). Measure the tone of a flat area across consecutive held pictures, not only the painting.

## Raw frames through ffmpeg

When you pipe raw planes into ffmpeg, label them on the way in (`-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv` before `-i -`, plus `setparams`). Asked for bt709 on the output only, recent ffmpeg converts unlabelled planes and the picture comes out about a level darker.
