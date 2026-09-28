# Validate a film

Rendering successfully is only one part of delivery. Verify the source behavior, inspect representative frames, then check the encoded file.

## Automated checks

```sh
npm run check
```

This runs TypeScript and the repository's tests. For a finished master:

```sh
npm run verify -- out/my-film.mp4
```

Verification decodes the full video. If its `.render.json` manifest is present, it also compares dimensions, frame rate, and frame count. The `.verify.json` result records those facts. It does not assess composition, copy, cursor alignment, or pacing.

For films with scene transitions, `npm run check:scenes -- --gl angle` renders the reference reel's transitions at the start, middle, and end of each window and confirms that a revisited frame repeats exactly after other seeks. Use it as a model for checking your own film's windows.

## Visual checks

Run the [keynote test](film-language.md#8-the-keynote-test) first: no shot that behaves like a slide, no small centered headlines alone on an empty frame, no captions over UI that nobody asked for, transitions that carry motion, cuts on actions or beats.

Render full-resolution stills before a long export and inspect:

- First and last frames, settled title frames, and the widest text line.
- Hover, press, and changed-state frames for every important interaction.
- Camera extremes, including the background edges and any clipped UI.
- Beginning, middle, and end of each transition or animated effect, and the frames on each side of every hard cut.
- Every frame of a transition window in the encoded file (an image strip is fastest), to catch a one-frame flash or an empty edge.
- Direct seeks into scenes that depend on fonts, texture loading, or component state.

Confirm that the actual font loaded, the content fits, the pointer tip hits the intended target, and the result has a readable hold. Check that effects do not obscure small controls or create unintended flashes.

After encoding, inspect frames from the MP4 and watch the viewing copy:

```sh
npm run frames -- out/my-film.mp4 out/encoded-review 1,4,8
npm run preview -- out/my-film.mp4 out/my-film-preview.mp4
```

Choose timestamps inside that film's duration and around its important actions. The preview comes from the master, preserving its layout.

## Depth films and painted looks

Everything above applies to a [depth film](depth-films.md). A painted film adds four checks.

**Type border.** The type engine checks every visible word on every frame and logs every group whose ink leaves the 10 % border as a `SAFEAREA` browser error, and the kit's render scripts print browser errors in their output. Keep the log and count them; a delivered render has none:

```sh
npm run render -- Painted-Depth --gl angle --out out/painted-depth.mp4 | tee out/painted-depth.log
npm run qa -- out/painted-depth.mp4 --log out/painted-depth.log
```

Stills report them too. `safeAreaViolations(lines, {config})` scans the copy over its whole life without rendering.

**Held-frame steadiness.** Painted strokes should hold between held pictures and change only as much as the subject and the camera do. Compare each shot with a reference render of the same edit (the previous version, or the same film in watercolor), leaving the transitions out:

```sh
.venv/bin/python tools/qa/steadiness.py out/painted-depth.mp4 --reference out/previous.mp4 --shots "lake:0-118,room:158-222"
```

A ratio near 1.0 is as steady as the reference. Above about 1.2 the strokes jump: compare that shot's held frames side by side. See [QA tools](../tools/qa/README.md).

**At 100 %.** Faces, hands, and the prop each scene is about (oil loosens everything outside its focus ellipses). Matte edges: no halo, no sliver of a subject left on the plate, no filled patch that shows as the planes move. Plane edges and holes at the camera's extremes. The start, middle, and end of every transition, and the frames on each side of it.

**Clocks.** Pictures change every second frame; transitions and the camera inside them change every frame. A transition that steps on twos, or a drift of copy that stutters, is a bug.

## Check a long master

A long or 4K film is safer to render in chunks from one bundle:

```sh
npm run master -- Painted-Depth out/painted-depth.mp4 --chunks 6 | tee out/painted-depth.log
npm run verify -- out/painted-depth.mp4
npm run qa -- out/painted-depth.mp4 --log out/painted-depth.log
```

`master` renders frame ranges one after another with `--gl angle`, encodes each chunk and deletes its frames before starting the next, joins the chunks without re-encoding, adds the soundtrack once (`--audio FILE` copies a file's audio, `--audio render` renders the composition's own once), and checks that each chunk and the joined master have the expected frame count. It does not compare pictures across a join; inspect those frames yourself (below). When it finishes, it deletes its chunks and writes the render manifest that `verify` compares against. Run `node scripts/master-chunked.mjs --help` for every option.

An interrupted run keeps its finished chunks in `OUT.mp4.chunks/` and continues. The folder's `manifest.json` records what they come from: the composition, props, frame ranges, render settings, soundtrack, and a fingerprint of `src/`, `public/` and the locked dependencies. If any of it changed since, for example because you edited the film, the next run stops instead of joining old chunks to new ones. Pass `--restart` to discard them, or delete the folder.

`qa` writes `VIDEO.qa.json` and prints it: codec, size, frame rate, frame count, EBU R128 loudness (integrated, range, true peak), a contact sheet beside the video, and the `SAFEAREA` count from the log (without `--log` it prints `SAFEAREA not checked`). For web delivery the target is −14 LUFS integrated with a true peak at or below −1 dBTP (`--target` changes it). It exits with code 2 when loudness or `SAFEAREA` fails. It needs only the FFmpeg that Remotion ships.

Then:

- Inspect the frames on each side of every join (`chunks` in `OUT.mp4.render.json` lists the ranges) with `npm run frames`; the motion must continue across them.
- Read the contact sheet for missing shots, wrong order, and flashes.
- Make a share copy and a small preview from the master:

```sh
npx remotion ffmpeg -i out/painted-depth.mp4 -c:v libx264 -crf 20 -maxrate 80M -bufsize 160M -pix_fmt yuv420p -c:a copy -movflags +faststart out/painted-depth-share.mp4
npx remotion ffmpeg -i out/painted-depth.mp4 -vf "scale=-2:720:flags=lanczos" -c:v libx264 -crf 23 -pix_fmt yuv420p -c:a copy -movflags +faststart out/painted-depth-720p.mp4
```

## Render heavy films on a shared machine

- Render depth films and painted looks with `--gl angle`. Before blaming your film for a slow render, read the GPU load (`ioreg -r -d 1 -c IOAccelerator | grep "Device Utilization"` on a Mac): another app holding the GPU once made a render 13 times slower.
- Watch the disk. Each bundle copies `public/` into a temporary folder (`remotion-webpack-bundle-*` in the system's temporary directory). `npm run render` and `npm run master` delete theirs when they finish, even after an error; the GPU checks (`check:effects`, `check:transitions`, `check:scenes`) leave theirs, so clear those folders on a nearly full disk.
- When Remotion lacks the memory to encode while it renders, it keeps every frame on disk until it encodes. `npm run render` writes PNG frames: roughly 15 MB per 4K frame, over 20 GB per minute at 24 fps. `npm run master` writes JPEG at quality 96: about 4 MB per 4K frame, about 5.8 GB per minute at 24 fps. On a nearly full disk, render in chunks with `npm run master`: each chunk encodes and deletes its frames before the next one starts.
- For model work (depth maps, mattes), try a short range or a crop first, run one GPU job at a time, and start long jobs as detached processes. The depth tools skip finished work, so a stopped job resumes. A plain SAM 2.1 streaming session keeps every frame on the GPU; the kit's tracker keeps a pruned sliding window instead ([depth tools](../tools/depth/README.md#prepare-footage)).

## Check portability when handing off

Use a fresh clone and `npm ci` rather than a copied dependency folder. Run `npm run check` and render at least a representative still. For a delivery that uses GPU transitions/effects, include one of those frames in the check. Confirm that media tools and assets resolve inside the new installation or documented system dependencies.

Record the tested commit, operating system, architecture, Node version, Remotion/browser versions, commands, outputs, and any limitations. A result on one platform does not establish successful renders on every other platform. Keep generated reports with the delivery; do not label a check as passed until it has run.
