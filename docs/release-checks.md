# Version 1.0 checks

Checked on 24 September 2026 on macOS, Apple silicon, with Node.js 22.11.0, Remotion 4.0.527, and Chrome for Testing 149.0.7790.0. These checks describe this environment, not every computer.

A fresh source-only copy installed with `npm ci`, passed TypeScript and all 21 tests, and rendered a launch-film still and a 1080p watercolor transition using its own dependencies. It did not need an adjacent app or Taleframe checkout. The agent skill and relative documentation links were also checked.

## Example films

Both sample masters decode fully and match their render settings:

| Example | Size | Frame rate | Frames | Length |
|---|---|---|---|---|
| Launch-Film | 1920 × 1080 | 30 fps | 540 | 18 seconds |
| UI-Demo | 1920 × 1080 | 30 fps | 720 | 24 seconds |

The exports use H.264, yuv420p, and BT.709 color. They are silent. The release includes smaller viewing copies made from these masters.

Representative frames were inspected for type fit, camera framing, hover/click states, text holds, and the closing. The UI example was also checked with 4K stills. A separate handoff exercise changed the launch example's name, copy, color, and website and checked the resulting frames.

## Transitions and effects

All 20 transition shaders rendered at 1080p. Pixel comparisons checked exact start/end images and repeatability after seeking. See [transition checks](transitions-validation.md).

All eight effects passed the software-renderer checks for repeated frames. The checks also covered disabled effects, effect order, held source frames, and missing-source errors. Watercolor, pigment, and Helios gallery frames were inspected separately.

The renderer defaults to software WebGL2 (`swangle`) for repeatability. Hardware ANGLE is faster but showed small watercolor brush differences after seeking. Taleframe's spatial watercolor renderer is included; its separate optical-flow preparation is not. See [effects](effects.md) for the practical limits.

## Video footage

The footage extractor produced exactly 36 frames from an 18-second clip sampled at 2 fps. Both the effects and transition wrappers rendered this sequence. Ten requests in a mixed time order matched the expected image pixels, including cache eviction, a repeated request, negative time, and holding the final frame. Attempts to overwrite a nonempty directory or the source video were rejected.

## Repeat the checks

```sh
npm ci
npm run check
npm run check:transitions
npm run check:effects
npm run verify -- out/my-film.mp4
```

The last command needs a rendered film. GPU checks save images and reports under `out/`; that directory is not part of the source repository. Inspect representative frames from your own film before delivering it.
