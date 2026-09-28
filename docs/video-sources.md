# Use video with transitions and effects

Convert a local video into a numbered PNG sequence once. The canvas source then selects the correct picture for each requested frame, including out-of-order render requests. It works with both `TaleframeEffects` and `TaleframeTransition`.

From the repository root:

```sh
npm run sequence -- "my-footage.mp4" public/footage/forest --fps 30 --width 1920
```

This uses the kit's bundled FFmpeg and creates `frame-000000.png`, `frame-000001.png`, and so on, plus `manifest.json`. The output directory must be absent or empty. Existing files are never overwritten; extraction happens in a temporary directory and is moved into place after success.

`--fps` defaults to 30 and sets the sequence's sampling rate. With only `--width` or `--height`, aspect ratio is preserved. Specifying both resizes to those exact dimensions. Omit both to retain the source's decoded dimensions. The manifest reports the actual width, height, frame count, and sequence rate. Use those values below. PNG sequences take more disk space than compressed video; extract the clip and size you intend to use. The bundled FFmpeg has no fps filter, so this portable extractor uses accurate seeks at each requested timestamp with two workers. Extraction can take longer than a single video decode. The source must report a finite duration.

To cut footage into painted planes that a camera travels through, use the [depth tools](../tools/depth/README.md#prepare-footage) instead: they extract only the held frames the edit shows and write the planes, fills, and anchor tracks a [depth film](depth-films.md) reads.

## Process a video background

```tsx
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {TaleframeEffects} from '../kit/TaleframeEffects';
import {imageSequenceSource} from '../kit/imageSequence';

// Example: manifest.json says {fps: 30, frameCount: 180, ...}.
// Keep this object stable: module scope or React.useMemo, not a new source every frame.
const forest = imageSequenceSource({
  directory: 'footage/forest',
  frameCount: 180,
  fps: 30,
  fit: 'cover',
});

export function PaintedFootage() {
  return <AbsoluteFill style={{background: '#fff'}}>
    <TaleframeEffects source={forest}
      effects={{watercolor: {enabled: true, amount: 1, paper: 0}}}/>
    {/* Put crisp UI and text above the processed background. */}
  </AbsoluteFill>;
}
```

`directory` is relative to `public/`; the helper resolves it through Remotion's `staticFile`. It expects the extractor's zero-based `frame-%06d.png` naming. It does not read the manifest automatically. Copy `fps` and `frameCount` from it, or import the JSON through your composition build.

The sequence rate is independent of the export rate. A 30 fps source in a 60 fps composition holds each picture for two output frames and keeps the same playback speed. At the end, the last picture holds. Set `loop: true` to repeat. `startFrame: 30` starts one second into a 30 fps sequence; loops then repeat the range from frame 30 through the final frame. Times before zero clamp to that starting picture.

`fit` can be `cover` (fill and crop), `contain` (whole picture with unused margins), or `stretch` (fill without preserving aspect ratio). The helper caches up to four decoded frames per source in each render browser. It loads frames asynchronously and resolves only when the selected picture has been drawn. No browser video playback clock is involved.

The source receives the wrapper's clock. Inside a Remotion `Sequence`, it naturally starts at that sequence's local frame zero. `TaleframeEffects` with stopmotion enabled supplies held source times, so the video picture also holds. Watercolor uses the native spatial brushwork; the separate optical-flow stage is not included, so brush detail may vary between source pictures.

## Transition between two video clips

Extract the second clip into another directory, then create another source. Both clips sample the transition component's local clock:

```tsx
import React from 'react';
import {TaleframeTransition} from '../kit/TaleframeTransition';
import {imageSequenceSource} from '../kit/imageSequence';

const before = imageSequenceSource({directory: 'footage/forest', fps: 30, frameCount: 180});
const after = imageSequenceSource({directory: 'footage/river', fps: 30, frameCount: 150});

export function FootageTransition() {
  return <TaleframeTransition kind="watercolor" from={before} to={after}
    fromFrame={60} durationInFrames={36} params={{count: 2}}/>;
}
```

At 60 fps, this transition starts at one second and lasts 0.6 seconds. The clips are already playing before it starts. To start the incoming clip at the transition boundary, wrap its draw function and subtract that boundary's time:

```tsx
import type {SequenceFrameContext} from '../kit/imageSequence';

const afterAtTransition = {
  draw: (ctx: CanvasRenderingContext2D, info: SequenceFrameContext) =>
    after.draw(ctx, {...info, seconds: info.seconds - 1}),
};
```

Use `afterAtTransition` as `to`. Before the boundary, negative times clamp to the first selected source picture.

The transition uses the component's composition frame rate; `fromFrame` and `durationInFrames` are output frames. Sequence `fps` always describes the extracted source. The PNGs contain no sound. Add a separate Remotion `Audio` layer for the original or edited audio, with matching timing and trims when needed.
