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

## Motion vocabulary (version 1.2)

Checked on 25 September 2026 on the same Mac.

- `npm run check` passed TypeScript and all 44 tests, including springs that settle exactly, repeatable handheld noise and hits, arcs, stagger orders and grid waves, speed ramps integrated exactly, camera moves that start and end on their framings, 3D camera keys and depth, every one of the 18 presets starting hidden and landing exactly at rest, and the geometry of the eight new transitions (a continuous whip strip, tiles that cover any stage, split halves that clear the frame at any angle, cards that never overlap).
- `npm run check:scenes -- --gl angle` rendered all 14 transition windows of Scene-Transitions and Motion-Showcase at three points each; every revisited frame was identical after out-of-order seeks.
- The 66-second Motion-Showcase (1920 × 1080, 30 fps, 1980 frames) rendered with `--gl angle` in about 36 seconds, decodes fully, and matches its render settings. Every frame of all eight new transition windows and the first frames after every cut were inspected in the encoded file.
- Found and fixed during these checks: `MotionBlur` inside a speed ramp kept a full-speed shutter, so slow motion still streaked (the clock now carries its rate, and the shutter follows it); a close-up of the composer in Product-Explainer showed a band of the sidebar at the frame edge (the framing now clears it); several type shots opened on a few empty frames after their cut (their first move now starts on the cut).

## Motion-design abilities (version 1.3)

Checked on 25 September 2026 on the same Mac.

- Removed after review: the `whip` scene transition and the `Echo` type effect. Changed defaults: type is medium (500) and filled unless a weight or outlines are asked for; `TextSwap` rolls the old text up out of its mask as the new one rises; `Marquee` rows are filled.
- `npm run check` passed TypeScript and all 46 tests, including springs that follow new targets without jumps, liquid spans whose leading edge runs ahead, rubber-band limits, bounce impacts and squash, morph geometry and colors, the bento grid camera (full frame on the outgoing cell, the whole grid in the middle, full frame on the incoming cell), the split-screen divider, the split's move through the opening, field waves, and a seeded pen loop that goes all the way around its word.
- `npm run check:scenes -- --gl angle` rendered all 17 transition windows of Scene-Transitions, Motion-Showcase, and Motion-Reel at three points each; every revisited frame was identical after out-of-order seeks, including the grid of eight live shots with canvases and particles.
- Motion-Reel (1920 × 1080, 60 fps, 1800 frames) rendered with `--gl angle` in about 32 seconds.
- Found and fixed during these checks: hand-drawn marks used a normalized dash on a non-scaling stroke, which Chrome measures in different units, so loops and boxes stopped a third of the way round (they now draw point by point); dissolving particle type left the letters' antialiased edges behind (the swept region is now cleared whole); `bounce` returned no impact times before its drop began; the palette's search row was clipped once the card shrank to its results.


## Painted depth films and oil (version 1.4)

Checked on the same Mac (Apple M3 Pro, macOS, Node.js 22.23.1, Remotion 4.0.527). How to run these checks on your own film is in [validation](validation.md#depth-films-and-painted-looks).

- `npm run check` passed TypeScript and all 78 tests. The new ones cover the oil settings (watercolor unchanged without `style`, focus trimmed to whole ellipses and at most four, `strokeScale` and `looseness` clamped), a stroke lattice that scales with `strokeScale` on all four levels, the recorded hashes of the four paint files, and the depth engine: camera paths that pass through their keys without overshoot, projection that inverts back to the plane, cover scale under roll, sideways travel and pull-back, depth of field, match cuts that put anchor on anchor, held-frame and anchor lookup, focus ellipses, UI layers, the safe-area check on each visible word's real ink box over a group's whole life, including a word's own gesture (a flight's rise, a stamp's scale, an arrival from the right), cover scale that stays continuous and keeps a plate's own look, a tools-written footage `frames.json` resolving on twos with its handles, and cuts that pass a centre to a shader without one being rejected.
- `npm run check:effects` still passed for all eight effects. Oil is a style of watercolor and has its own checks: under `swangle` it repeated exactly after a seek and after another picture (0 differing bytes); under `angle` a seek changed 5–42 bytes of a 960 × 540 frame, each by 1 of 255. The oil panel, the second of nine pairs in the 27-second `Effects-Gallery`, was inspected with and without a focus ellipse.
- `tools/oil/brushes.py` regenerated all 41 brush files with a maximum pixel difference of 0 and an identical `brushes.json`.
- The depth compositor rendered stills with `--gl angle` of type in a shot, a watercolor cut mid-mix centered on an anchor, a UI card with its focus pull and dive-through, a guest plane with a bloom reveal, a ghost fill, a periphery plane, occlusion of type by a nearer plane, overlay type with a stamp, a glint and a rush, and the watercolor fallback, at 0.6–1.8 s per 1080p frame. The same frame at 960 × 540, 1920 × 1080 and 3840 × 2160 matched in layout (a blurred mean difference of 1.6–2.9 of 255), with type crisp at 4K. A frame rendered after a later one in a new session matched its first render within 1 of 255. A deliberately wide line logged `SAFEAREA`; lines inside the border did not.
- `tools/depth/prepare.py` cut the three demo paintings into 4, 3 and 4 planes with fills and tracks (depth about 6 s and mattes about 10 s per scene on Apple silicon); a second run rebuilt nothing. The plane previews, the filled plates, and each cut-out over magenta were inspected for halos and holes. `public/demo/depth/` is 3.0 MB.
- A 2-second footage job (25 held frames on twos with 12-frame handles, a tracked boat matte, a depth-band plane and fills) rendered through a `DepthFilm` shot built with `footagePlanes` and `heldFrames` in loose oil, at three frames across the clip, without errors.
- The footage path ran all five steps on a 2-second pan clip: 24 held frames on twos, depth, a tracked matte, planes with fills, and a track that followed the pan (x from 0.466 to 0.236). These checks found that a pruned SAM 2.1 session froze its mask after about ten frames, because the model numbers a streamed frame by how many frames it stores; the tracker now passes each frame's index. On a 192-frame clip its GPU memory then stayed at 0.22 GB, and its masks matched an unpruned session.
- Wireframe registration found a synthetic screenshot's scale as 1.33334 (expected 1.33333) and its offset as −79.93 px (expected −80). `measure_font.py` measured Instrument Serif's cap height as 0.72 em.
- `npm run master` rendered Launch-Film (540 frames) in 3 chunks with `--gl angle` in about 17 seconds. Its join check caught a soundtrack option that dropped 3 frames, which was fixed. A rerun resumed from the kept chunks, `npm run verify` passed against its manifest, `--audio render` produced an AAC track, and no bundle or temporary folder was left behind.
- `npm run qa` read −21.76 LUFS on a sine test clip, where a full FFmpeg's `ebur128` reads −21.8, and reported a silent film and a silent audio track as such. It counted a `SAFEAREA` line in a render log and exited with code 2. The share-copy and 720p commands in [validation](validation.md#check-a-long-master) were run on a Launch-Film master.
- `Painted-Depth` (22 seconds, 528 frames at 1920 × 1080 and 24 fps, silent) rendered with `--gl angle` in 62–66 seconds while other apps held the GPU at 61–81 %. `npm run verify` decoded all 528 frames against the render manifest, and `npm run qa` counted 0 `SAFEAREA` reports in the render log. Held-frame steadiness against a watercolor render of the same edit (`--props` with `{"watercolor": true}`) gave ratios of 1.027 (lake), 0.99 (room), 0.991 (card) and 1.047 (harbour). Frame differences show clean holds on twos outside the cuts and no one-frame jump where a cut hands back to the held clock. Stills of every shot, both transitions at start, middle and end, and the UI beat were inspected at 100 %.
- `tools/qa/steadiness.py` ran on two kit renders, alone, against a reference, and with `--hold 1`. Through `npm run steadiness` with the Python environment active, a Launch-Film master measured against its own share copy gave ratios of 0.998–0.999: re-encoding does not move the metric.

```sh
npm run check
npm run check:effects
npm run master -- COMPOSITION out/film.mp4 --chunks 4 | tee out/film.log
npm run verify -- out/film.mp4
npm run qa -- out/film.mp4 --log out/film.log
```
