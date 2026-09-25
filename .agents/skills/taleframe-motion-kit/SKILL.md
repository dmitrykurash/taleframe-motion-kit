---
name: taleframe-motion-kit
description: Create or revise product launches, app demonstration videos, and motion reels with Taleframe. Use its Remotion components, camera and cursor choreography, kinetic typography, scene transitions with motion blur, and Taleframe shader transitions and effects to deliver editable films and verified exports that look like modern launch films, not presentations.
---

# Taleframe

Turn a brief and supplied assets into an editable film and a verified video. This skill belongs to the full Taleframe repository. Keep it with the components, examples, assets, and render scripts; copying the skill alone does not install the renderer.

## Non-negotiables

These hold for every film unless the brief explicitly asks otherwise. Details and the reasons are in [film language](../../../docs/film-language.md).

1. **A launch film, not a keynote.** No shot behaves like a slide (fade in, hold, fade out on an empty frame). Something is always arriving, holding for reading, or leaving; motion carries across cuts.
2. **Read the style and commit.** Infer the style from the brief (named references, adjectives, brand assets, audience, music, platform), pick a style family, write a 5–8 line style sheet into the brief, and apply it to every shot.
3. **Type and UI take turns.** A type shot states one idea; a UI shot proves it. No headlines or captions over UI unless the task needs a short attached label or the brief asks for text on or beside the product.
4. **Kinetic typography.** Big (160–420 px display on the 1920 × 1080 stage), short (1–6 words), tight, and moving with meaning: `MaskReveal`, `Slam`, `WordRoll`, `WordSequence`, `Counter`, `Scramble`, `TrackIn`. Hold long enough to read.
5. **Cuts first, designed transitions second.** Default to hard cuts on action or beat. Use `zoom`, `portal`, `expand`, `slice`, or `glitch` when a transition carries meaning; two or three kinds per film, never the same one twice in a row. Never cube, flip, page-curl, mosaic, twirl, constant-speed pushes, or a dissolve between every shot.

## Choose the film around the brief

Read [production decisions](references/production.md) for a new film or a substantial change of direction. Establish audience, subject, useful task or message, evidence, brand, style, length, and delivery format from the request. Infer routine choices; ask only when missing information materially blocks the work.

A launch can lead with a promise and build to its proof. A UI demonstration can start inside a recognizable task. A motion reel can organize around a visual rhythm. Choose the structure that serves the user's purpose, then write a shot list that alternates type and UI shots. Do not impose a logo opening, a fixed scene count, a particular background, or every effect in the library.

For a real product, use its components, screenshots, or recordings. Read [app adapters](../../../docs/app-adapters.md) when adding a new app. Keep its UI faithful and make rendered states deterministic with thin adapters. Demonstration data may be fictional, but capabilities, successful live verification, and security claims must have support in the product.

## Build with the library

- Read [components](../../../docs/components.md) and the reference films: `Launch-Film` (`src/examples/LaunchFilm.tsx`, an editorial style sheet with type and UI shots taking turns) and `Scene-Transitions` (`src/examples/SceneTransitionReel.tsx`, shots in `src/examples/showcase/`, a loud technical style). `Product-Explainer` (`src/examples/ProductExplainer.tsx`, a light UX explainer), `Product-Launch` (`src/examples/ProductLaunch.tsx`, minimal premium in black), and `Kit-Reel` (`src/examples/KitReel.tsx`, a 9:16 social reel) share one stateless product UI in `src/examples/workspace/` and show a style sheet, camera framing, and every transition in each format. `Starter` is a calmer UI walkthrough; do not copy its centered fade-in type beats into a launch film.
- Build the film as a `Shots` list of full-stage shots. Each shot reads time with `useTime()` or `useShot()`, has an opaque background, and contains no `<Audio>`.
- Use [kinetic type](../../../docs/kinetic-type.md) for type shots (18 motion presets, swaps, and effects) and [scene transitions](../../../docs/scene-transitions.md) between React shots (thirteen kinds; pick two or three per film by style). `Motion-Showcase` (`src/examples/MotionShowcase.tsx`) shows every newer technique with its name. Use [Taleframe shader transitions](../../../docs/transitions.md) for footage and stills, or for a deliberately painterly style, and [effects](../../../docs/effects.md) only when the style sheet calls for them.
- Read [motion direction](../../../docs/motion-direction.md) for camera, cursor, typing, parallax, and the motion vocabulary: springs, camera moves, handheld and hits, arcs, staggers, `Enter`, `SpeedRamp`, and 3D `Space`. Choose a motion palette per film (one signature move, two or three supporting ones, one surprise) and do not repeat a move in neighboring shots. Wrap fast moves in `MotionBlur`.
- Derive every visible state from frame time and fixed inputs. Cursor, camera, state changes, and textures must agree on a direct seek. Avoid animation timers, wall clocks, unseeded randomness, and live service calls inside rendered scenes.
- Reuse `src/kit` primitives; keep product-specific UI and content in project files. Preserve approved user choices.

## Review and deliver

Follow the user's requested checkpoints. If approval of a storyboard or images was requested before implementation, finish that reviewable stage and pause its dependent work. If the complete film is authorized, proceed through implementation, visual review, fixes, and rendering.

Use [quick start](../../../docs/quick-start.md) for commands and [validation](../../../docs/validation.md) for checks. Render films built from React shots with `--gl angle`; it is many times faster than the default software renderer, which is only needed for exact repeatability of Taleframe shaders and effects. Inspect text fit, reading holds, cursor hits, selected states, camera coverage, and the start, middle, and end of every transition. Run the [keynote test](../../../docs/film-language.md#8-the-keynote-test) on stills and on the encoded film. A passing type check does not establish visual quality.

Deliver the master, a viewing copy when useful, editable source and props, the style sheet, and a reproducible render command. State material limitations or deliberate UI approximations. Local video production does not imply authorization to publish it or operate a live app account.
