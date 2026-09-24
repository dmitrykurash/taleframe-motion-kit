---
name: taleframe-motion-kit
description: Create or revise product launches, app demonstration videos, and motion reels with Taleframe. Use its Remotion components, camera and cursor choreography, animated typography, and Taleframe transitions and effects to deliver editable films and verified exports.
---

# Taleframe

Turn a brief and supplied assets into an editable film and a verified video. This skill belongs to the full Taleframe repository. Keep it with the components, examples, assets, and render scripts; copying the skill alone does not install the renderer.

## Choose the film around the brief

Read [production decisions](references/production.md) for a new film or a substantial change of direction. Establish audience, subject, useful task or message, evidence, brand, length, and delivery format from the request. Infer routine choices; ask only when missing information materially blocks the work.

A launch can lead with a promise and build to its proof. A UI demonstration can start inside a recognizable task. A motion reel can organize around a visual rhythm. Choose the structure that serves the user's purpose. Do not impose a logo opening, a fixed scene count, a particular background, or every effect in the library.

For a real product, use its components, screenshots, or recordings. Read [app adapters](../../../docs/app-adapters.md) when adding a new app. Keep its UI faithful and make rendered states deterministic with thin adapters. Demonstration data may be fictional, but capabilities, successful live verification, and security claims must have support in the product.

## Build with the library

- Read [components](../../../docs/components.md) and the relevant example. Reuse `src/kit` primitives; keep product-specific UI and content in the project files.
- Start from the JSON-driven example for its existing story. Use custom React scenes for a different structure, interaction, or duration.
- Read [motion direction](../../../docs/motion-direction.md) for camera, typography, typing, pacing, and parallax. Choose [transitions](../../../docs/transitions.md) or [effects](../../../docs/effects.md) only when they improve the intended visual treatment.
- Derive every visible state from frame time and fixed inputs. Cursor, camera, state changes, and textures must agree on a direct seek. Avoid animation timers, wall clocks, unseeded randomness, and live service calls inside rendered scenes.
- Preserve approved user choices. Example fonts, copy, colors, effects, and timings are editable presets.

## Review and deliver

Follow the user's requested checkpoints. If approval of a storyboard or images was requested before implementation, finish that reviewable stage and pause its dependent work. If the complete film is authorized, proceed through implementation, visual review, fixes, and rendering.

Use [quick start](../../../docs/quick-start.md) for current commands and [validation](../../../docs/validation.md) for checks. Inspect text fit, reading holds, cursor hits, selected states, camera coverage, transitions, and the final encoded output. A passing type check does not establish visual quality.

Deliver the master, a viewing copy when useful, editable source and props, and a reproducible render command. State material limitations or deliberate UI approximations. Local video production does not imply authorization to publish it or operate a live app account.
