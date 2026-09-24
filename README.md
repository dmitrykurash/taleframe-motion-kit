# Taleframe

A reusable library for product launches, app demonstrations, and motion reels. Build films with real UI, guided cameras, natural typing, kinetic typography, scene transitions with true motion blur, and transitions and effects from Taleframe.

Films made with the kit follow one [film language](docs/film-language.md): a launch film, not a keynote. The agent reads the requested style and commits to it, lets type shots and UI shots take turns, uses big kinetic type, and cuts like an editor.

The kit is a Remotion project with editable examples and instructions for coding agents. Use it directly or ask an agent to turn your brief and assets into a film. It runs from this repository; no adjacent app or Taleframe checkout is required.

![Launch-film example](docs/images/launch-film.png)

![The five scene transitions](docs/images/scene-transitions.jpg)

![Frames from the demo films: a UX explainer, a dark launch, and a vertical reel about the kit](docs/images/demo-films.jpg)

[Watch the sample films](https://github.com/dmitrykurash/taleframe-motion-kit/releases/tag/v1.1.0) or open the examples in Studio.

## Start with an agent

Clone this private repository with an account that has access, then open the folder in your coding tool:

```sh
git clone https://github.com/dmitrykurash/taleframe-motion-kit.git
cd taleframe-motion-kit
```

Give your agent this prompt, replacing the bracketed details:

> Read AGENTS.md and use the Taleframe skill in this repository. Create a [25-second product launch / UI demonstration / motion reel] for [product or subject]. The audience is [audience]. Show [two or three features or ideas]. UI source, screenshots, or recordings are at [paths]; brand assets are at [paths]. The style is [adjectives and references, e.g. "loud and bold, like a sneaker drop" or "calm and premium"]. Deliver [resolution, aspect ratio, frame rate], an MP4 preview, editable source, and the render command. Use the supplied UI to support product claims. Make reasonable implementation choices and complete the film, including visual checks.

Add a review point if you want to approve a storyboard or visual direction first. The kit does not force one approval process or one style on every film.

## Try it yourself

Install **Node.js 22 or newer**, then run:

```sh
npm ci
npm run studio
```

Choose a composition in Remotion Studio:

| Composition | What it shows |
|---|---|
| `Product-Explainer` | A 52-second UX explainer for an unnamed AI workspace: four features, each a type card and then the product doing it |
| `Product-Launch` | A 26-second dark launch for the same product: word beats, a hero shot, a zoom into Allow, and a counter |
| `Kit-Reel` | A 31-second 1080 × 1920 reel about the kit, made with the kit; each scene transition names itself as it plays |
| `Scene-Transitions` | A 22-second reel of the five scene transitions between launch-film shots, with kinetic type |
| `Starter` / `UI-Demo` | A 24-second editable app demonstration with typing, results, settings, and a closing |
| `Launch-Film` | An 18-second launch in the editorial style: type and UI shots taking turns, a card portal, and an expand from Publish |
| `Motion-Catalogue` | Text, typing, camera, cursor, and badge recipes |
| `Transition-Gallery` | The included Taleframe shader transitions for pictures and footage |
| `Effects-Gallery` | The included image and canvas effect treatments |

Render the starter with its supplied settings:

```sh
npm run render -- Starter --props examples/starter.json --out out/starter.mp4
npm run preview -- out/starter.mp4 out/starter-preview.mp4
npm run verify -- out/starter.mp4
```

The first render downloads Remotion's dedicated Chrome. Media tools come from the pinned Remotion installation. See [quick start](docs/quick-start.md) for stills, custom props, and troubleshooting.

## What you can reuse

- A shot list (`Shots`) with hard cuts by default and five scene transitions for React shots: `zoom`, `portal`, `expand`, `slice`, and `glitch`.
- Temporal motion blur (`MotionBlur`) for transitions and any fast move.
- Logical stages for 16:9, 9:16, 1:1, and 4:5 outputs; the scene transitions adapt to each.
- Kinetic typography: mask reveals, slams, word rolls, rapid word sequences, counters, scrambles, and track-ins.
- Camera keyframes, target framing, cursor paths, hover and click timing, and background parallax.
- Natural typing with repeatable key timing and a smoothly following camera.
- Word and character reveals, expanding badges, and closing sequences.
- 20 Taleframe shader transitions and 8 effects for pictures and footage, with galleries and adjustable settings.
- A frame-based workflow that renders correctly when seeking directly to any moment.

The starter demonstrates a fictional app. Changing its JSON personalizes that example; a film about a real app needs that app's UI source, screenshots, or recording. For a different story, layout, interaction, or duration, create a custom composition using the same library.

The supplied examples use Inter, DM Sans, Geist Mono, and Instrument Serif. Replace fonts, colors, assets, pacing, and copy to fit your project. Effects are optional: a quiet background and a few precise movements can be enough.

## Project map

| Location | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Entry point for coding agents |
| [Production skill](.agents/skills/taleframe-motion-kit/SKILL.md) | Workflow and decision guidance |
| [src/kit](src/kit/index.ts) | Shared animation components and helpers |
| [src/examples](src/examples) | Editable film examples |
| [examples/brief.md](examples/brief.md) | A short brief template |
| [examples/starter.json](examples/starter.json) | Starter copy, brand settings, and output settings |
| `public/` | Local assets served to the renderer |
| `scripts/` | Preview, render, frame extraction, and verification tools |

Start with [film language](docs/film-language.md) for the rules every film follows, then [components](docs/components.md) to build shots, [kinetic type](docs/kinetic-type.md), [scene transitions](docs/scene-transitions.md), [motion direction](docs/motion-direction.md), and [app adapters](docs/app-adapters.md) for authentic UI. The [shader transition guide](docs/transitions.md), [effects guide](docs/effects.md), [video-footage guide](docs/video-sources.md), and [validation guide](docs/validation.md) cover their respective workflows.

Keep the full repository when handing it to another person or agent. Copying only the skill does not install the components, example assets, or renderer.

See [release checks](docs/release-checks.md) for what was tested, and [included assets and source](ASSET_NOTICES.md) for source records and dependency notices.
