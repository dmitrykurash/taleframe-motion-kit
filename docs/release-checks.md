# Release checks

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
npm run check:scenes -- --gl angle
npm run verify -- out/my-film.mp4
```

The last command needs a rendered film. GPU checks save images and reports under `out/`; that directory is not part of the source repository. Inspect representative frames from your own film before delivering it.

## Film language, kinetic type, and scene transitions

Checked on 25 September 2026 on the same Mac (Apple M3 Pro, macOS, Node.js 22.23.1, Remotion 4.0.527, Chrome Headless Shell 149.0.7790.0).

- `npm run check` passed TypeScript and all 32 tests, including shot planning (cuts, alignment, windows that do not fit, the frame exactly on a cut), shutter sampling, zoom, expand, portal, and slice geometry, band scheduling, glitch repeatability, and the glyph distance field used to aim word portals.
- `npm run check:scenes -- --gl angle` rendered all five transitions of the Scene-Transitions reel at three points of each window. Every revisited frame was identical after out-of-order seeks. Frames took 0.14–0.34 s.
- The 22-second Scene-Transitions reel and the 18-second Launch-Film rendered at 1920 × 1080, 30 fps with `--gl angle` in about 20 and 12 seconds. Every frame of every transition window was inspected in the encoded files. The same reel with the software renderer had not finished after 20 minutes, so films built from React shots should render with `--gl angle`.
- Found and fixed during these checks: a one-frame flash of the incoming shot when a transition starts exactly on its cut; Chrome shrinking SVG text above about 10,000 px, which misplaced deep word-portal zooms (the zoom is now applied with a CSS transform); an empty frame edge under channel-split and directional blur (layers now render beyond the frame); a lingering border as an expand window approached the frame edge (it now grows past the frame).

## Demo films and vertical stages (version 1.1)

Checked on 25 September 2026 on the same Mac.

- `npm run check` passed TypeScript and all 36 tests, including the stage chosen for each output ratio, `focusCamera` on a portrait stage, transitions measured on a portrait stage, and shot plans for the three demo films.
- `npm run check:scenes -- --gl angle` rendered all six transitions of the Scene-Transitions reel at three points of each window; every revisited frame was identical.
- The masters decode fully and match their render settings:

| Example | Size | Frame rate | Frames | Length | Render time (`--gl angle`) |
|---|---|---|---|---|---|
| Product-Explainer | 1920 × 1080 | 30 fps | 1560 | 52 seconds | about 25 s |
| Product-Launch | 1920 × 1080 | 30 fps | 780 | 26 seconds | about 17 s |
| Kit-Reel | 1080 × 1920 | 30 fps | 945 | 31.5 seconds | about 19 s |

- Every transition window was inspected frame by frame in the encoded files: zoom, expand, slice, glitch, word portal, the painted watercolor, the motion-blur whip, and the match cut from a card into the product window. The UI shots were checked for typing, cursor hits, hover and press states, reading holds, and camera framing.
- Found and fixed during these checks: `WordRoll` moved its line up on `exit` without a mask, so the words stayed visible (the line now leaves through its own mask); close-ups framed a sliver of the sidebar at the frame edge; a zoom that landed on an empty frame before its headline began; a word that finished decoding as it left the frame.

