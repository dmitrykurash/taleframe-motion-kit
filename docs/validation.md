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

## Check portability when handing off

Use a fresh clone and `npm ci` rather than a copied dependency folder. Run `npm run check` and render at least a representative still. For a delivery that uses GPU transitions/effects, include one of those frames in the check. Confirm that media tools and assets resolve inside the new installation or documented system dependencies.

Record the tested commit, operating system, architecture, Node version, Remotion/browser versions, commands, outputs, and any limitations. A result on one platform does not establish successful renders on every other platform. Keep generated reports with the delivery; do not label a check as passed until it has run.
