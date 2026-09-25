# Quick start

Install Node.js 22 or newer. Clone the private repository using an account with access, open its folder in a terminal, then install the locked dependencies:

```sh
npm ci
npm run studio
```

Studio lists the registered compositions. `Motion-Reel` is a 60 fps motion-design reel made with the kit. `Motion-Showcase` is a labeled catalog of the motion vocabulary: the eight newer scene transitions, 3D space, camera moves, a speed ramp, all type presets, and the type effects. `Product-Explainer`, `Product-Launch`, and `Kit-Reel` are three films about an unnamed AI workspace and about the kit itself: a UX explainer, a dark launch, and a 9:16 social reel. `Launch-Film` is the reference editorial launch film: an editorial style sheet, type and UI shots taking turns, kinetic type, a card portal, and an expand from a clicked button. `Scene-Transitions` shows the five scene transitions between launch-film shots. `Starter` and `UI-Demo` provide a calmer fictional app walkthrough. The other galleries let you inspect motion recipes, shader transitions, and effects before choosing a treatment.

## Customize the starter

Copy `examples/starter.json` to a new file, such as `examples/my-demo.json`. Edit its copy, accent, fonts, and output settings. The starter has a 24-second story. Its JSON changes that story's content; it does not replace the UI or discover a new app automatically.

Its fields are `appName`, `prompt`, `heading`, `replyTitle`, `replyItems`, `settingsTitle`, `closingTagline`, `website`, `accent`, `fontFamily`, `headingFontFamily`, `fonts`, and `output`. The included publishing controls are fictional example UI. The settings label can change through JSON; another interaction needs a scene adapter.

The schema accepts even 16:9 dimensions from 640 × 360 through 7680 × 4320 and frame rates of 24, 25, 30, 50, or 60. It limits text length to prevent obvious overflow, but the chosen font still needs visual inspection. For another layout, interaction, duration, or aspect ratio, create a custom composition with the shared components.

## Customize the launch film

Copy `examples/launch.json` and edit its name, opening lines, outcome lines, website, accent color, and output settings. It is an 18-second example:

```sh
npm run stills -- Launch-Film --props examples/launch.json --gl angle --times 1.5,4.5,6.2,10,13.4,17 --out out/launch-stills
npm run render -- Launch-Film --props examples/launch.json --gl angle --out out/launch.mp4
```

The style sheet, shot list, board and note UI, transitions, and timings live in `src/examples/LaunchFilm.tsx`. Ask your agent to adapt those when the story, product, or style needs it. JSON is a shortcut for the listed fields, not a full scene editor. Headlines are sized to fit the frame with the actual font.

Films built from React shots render much faster with hardware graphics; add `--gl angle` to `render` and `stills` unless the film uses Taleframe shaders or effects (see [When a render fails](#when-a-render-fails)).

## Inspect stills

```sh
npm run check
npm run stills -- Starter --props examples/my-demo.json --times 1,7,12,18,22 --out out/my-demo-stills
```

Open `out/my-demo-stills/index.html` for a contact sheet. Full-resolution PNGs and a manifest are in the same folder. `--times` uses seconds and rounds to the nearest frame. Use times around clicks and scene transitions as well as settled frames.

## Render and verify

```sh
npm run render -- Starter --props examples/my-demo.json --out out/my-demo.mp4
npm run preview -- out/my-demo.mp4 out/my-demo-preview.mp4
npm run verify -- out/my-demo.mp4
npm run frames -- out/my-demo.mp4 out/my-demo-encoded 1,7,12,18,22
```

The renderer writes the MP4 and a `.render.json` manifest. Verification decodes the whole video and compares dimensions, fps, and frame count with that manifest when present. It writes a `.verify.json` report. Extracted encoded frames have their own contact sheet.

The preview is derived from the master and capped at 1920 pixels wide. This preserves the master layout; rendering the same UI at a different browser scale can alter text and control geometry. See [validation](validation.md) for what still needs visual review.

To render another composition, replace `Starter` with its name and omit `--props` if the defaults are sufficient:

```sh
npm run render -- Launch-Film --out out/launch.mp4
npm run stills -- Motion-Catalogue --times 3.5 --out out/catalogue
```

The three demo films are built from React shots, so render them with `--gl angle`. Each takes well under a minute on a recent Mac:

```sh
npm run render -- Product-Explainer --gl angle --out out/product-explainer.mp4
npm run render -- Product-Launch --gl angle --out out/product-launch.mp4
npm run render -- Kit-Reel --gl angle --out out/kit-reel.mp4
npm run render -- Motion-Showcase --gl angle --out out/motion-showcase.mp4
npm run render -- Motion-Reel --gl angle --out out/motion-reel.mp4
```

`Kit-Reel` is 1080 × 1920. Stills and previews work the same way for vertical films.

## Use actual app UI

Put new assets under `public/` and a new scene under `src/`. Read [app adapters](app-adapters.md) before connecting real UI components. Register the composition in `src/index.tsx`, then use its name in the same commands. Use [components](components.md) to reuse text and camera behavior instead of rewriting it.

For a painted still background, the standalone processor is also included:

```sh
npm run watercolor -- public/demo/landscape-a.svg out/painted.png --width 1920 --height 1080 --blur 2
```

This softens the source before painting. See the [watercolor still tool](../tools/watercolor/README.md) for settings and the [effects guide](effects.md) for processing inside a composition.

## When a render fails

The first render downloads Remotion's dedicated Chrome. Allow that download and keep the machine online for dependency installation; local assets can render offline once setup is complete. Chrome may require normal system dependencies on Linux.

The CLI uses software WebGL2 (`swangle`) by default for repeatable shader output, including watercolor. Hardware ANGLE is much faster, especially for films built from React shots with [scene transitions](scene-transitions.md) and motion blur; use `--gl angle` for those. Some Taleframe paint details vary slightly on repeated frames under ANGLE. To try hardware rendering on your machine:

```sh
npm run stills -- Transition-Gallery --times 1 --out out/gpu-check --gl angle
```

For limited memory, reduce concurrent render workers with `--concurrency 2`. Keep dependencies pinned with `npm ci`; if a failure persists, retain the error and record the operating system, Node version, composition, props, and command. Do not hide failures by exporting a different scene.
