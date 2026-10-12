# Shared components

Import from `src/kit/index.ts`. In a file under `src/examples/`, that is `../kit`. Times are seconds; coordinates and sizes are logical stage units unless noted otherwise. Components derive time from Remotion's current frame, with an optional `time` override where supported.

## Stage and camera

| API | Main inputs | Purpose |
|---|---|---|
| `LogicalStage` | `children`, `background?` | A logical stage chosen by aspect ratio (1920 × 1080, 1080 × 1920, 1080 × 1080, or 1080 × 1350), scaled to the output |
| `useStage` / `stageFor` / `STAGES` | — / `width`, `height` / — | The enclosing stage size, the stage for an output size, and the four supported stages |
| `CameraLayer` | `camera: {x, y, scale}`, `children`, `style?` | Transform an entire UI scene around stage center |
| `focusCamera` | `target`, `scale`, `screen?`, `stage?` | Place a stage point at the requested screen point; default screen is center. Pass `stage` (e.g. `STAGES.portrait`) outside 16:9 |
| `cameraAt` | `time`, `keyframes` | Interpolate `{time, x, y, scale}` poses; hold endpoints |
| `ParallaxBackground` | `camera`, `depth?`, `overscan?`, `src?`, `children?`, `color?` | Move a distant background with the foreground camera |
| `parallaxCamera` | `camera`, `depth?`, `overscan?` | Calculate that reduced camera transform |
| `backgroundCoversFrame` | `camera`, `width?`, `height?` | Check coverage of a centered background filling the stage |

`depth` defaults to `.12`; `overscan` defaults to `1.20`. Positive scale and increasing keyframe times are required. `CameraLayer` uses a center origin; do not mix it with top-left transform math. Put the cursor inside the camera layer to share the UI's coordinate system.

## Text and fonts

| API | Main inputs | Purpose |
|---|---|---|
| `FontLoader` | `fonts`, `children` | Load supplied font files before mounting measured text |
| `CharacterReveal` | `text`, `start?`, `stagger?`, `duration?`, `exit?` | Closely staggered glyph reveal with optional blur and movement |
| `WordReveal` | Same reveal timing inputs | A line that grows as words enter |
| `TypedText` | `text`, `start`, `end`, `caret?` | Uneven, repeatable typing with a frame-driven caret |
| `useTyping` | `text`, `start`, `end`, `seed?`, font settings | Visible text and measured width for custom UI and camera follow |
| `useTextMetrics` | `text`, font settings | Widths and glyph positions after the font is ready |
| `useTime` | None | Current frame divided by fps |

Font settings include `fontFamily`, `fontSize`, `fontWeight`, and `letterSpacing`. Reveals also accept `color`, `blur`, `rise`, `exitDuration`, `style`, and `time`. Align their containers with flex or grid to center them. Split multiple lines explicitly; the reveal components do not wrap paragraphs automatically.

`FontLoader` records have `{family, src, weight?, style?}`; local `src` values are relative to `public/`. `useTyping` returns `{text, width, fullWidth, schedule, complete, ready}`. Use its damped `width` for the camera, while the visible `text` changes on the fixed keystroke schedule. Connected scripts should generally use whole words instead of individual glyph animation.

Example title scene:

```tsx
import React from 'react';
import {LogicalStage, WordReveal} from '../kit';

export function TitleScene() {
  return <LogicalStage background="#f6f5f1">
    <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
      <WordReveal text="A clearer next step." start={0.2} exit={3.4}
        fontFamily="Instrument Serif" fontSize={112} color="#242424" />
    </div>
  </LogicalStage>;
}
```

Use the example's font-loading setup or `FontLoader` before rendering a custom font.

## Kinetic type

| API | Main inputs | Purpose |
|---|---|---|
| `MaskReveal` | `lines`, `by?`, `start?`, `stagger?`, `exit?`, font settings | Words, letters, or lines rise out of a baseline mask and leave upward |
| `WordRoll` | `words`, `at`, `prefix?` | A word slot that rolls to the next word while the line width follows |
| `Slam` | `text`, `start?`, `scaleFrom?` | A fast scale hit with a speed blur |
| `WordSequence` | `words`, `beat?` or `times?`, `palettes?` | One word per beat, full frame, hard cuts |
| `Counter` | `to`, `from?`, `start?`, `decimals?`, `prefix?`, `suffix?` | A number counting with tabular figures |
| `Scramble` | `text`, `start?`, `duration?` | Characters cycle and resolve left to right |
| `TrackIn` | `text`, `start?`, `trackFrom?` | Wide tracking tightening into a title |
| `useTextWidths` | `texts`, font | Widths of several strings after the font loads |
| `KineticText` | `lines`, `by?`, `enter?`, `exit?`, `start?`, `stagger?`, `order?`, `exitAt?`, font settings | Any of 18 motion presets per line, word, or letter, with a stagger order and a separate exit |
| `TextSwap` | `texts`, `at`, `enter?`, `exit?`, `by?` | Type-to-type transitions in place; the slot's width follows |
| `Mark` | `lines` (runs with `mark`), `kind?`, `at?`, `markColor?`, `markedColor?` | Marker, underline, strike, box, or hand-drawn circle drawn onto words |
| `Marquee` | `text`, `rows?`, `speed?`, `angle?`, `alternate?` | Endless rows of repeating type (filled; `outlineRows` only when asked) |
| `TypeWall` | `word`, `rows?`, `variants?`, `palettes?`, `band?`, `ripple?` | Rows of one word in varying widths, weights, and slants |
| `ParticleText` | `text`, `mode?`, `start?`, `duration?`, `count?`, `accent?` | Letters that dissolve into dust, assemble from it, or swirl into a galaxy |
| `Shine` | `text`, `at?`, `duration?`, `shineColor?` | A sheen of light crossing the letters |
| `CircleText` | `text`, `radius?`, `speed?` | Type on a turning circle |
| `SplitText` | `text`, `start?`, `distance?`, `exitAt?` | A word cut in half; the halves slide in and lock, then part |
| `Breathe` | `text`, `min?`, `max?`, `speed?`, `wavelength?` | A weight wave through a variable font |
| `PRESETS`, `PRESET_NAMES`, `poseAt`, `poseStyle` | — | The preset catalog and its pose math, for custom components |

In these components `letterSpacing` is in em. See [kinetic type](kinetic-type.md) for timing and practice.

## Shots, scene transitions, motion blur

| API | Main inputs | Purpose |
|---|---|---|
| `Shots` | `shots: {until?, content, enter?, name?}[]` | A film as a list of full-stage shots, hard cuts by default |
| `useShot` | None | `{index, name, start, end, local}` of the enclosing shot |
| `planShots` | `shots` | Cut times and transition windows; throws when they do not fit |
| `SceneTransition` | `kind`, `from`, `to`, `start`, `duration?`, options | One transition between two React scenes |
| `SCENE_TRANSITIONS` | — | Names, default lengths, alignment, and intended use per kind |
| `MotionBlur` | `children: (time) => node`, `shutter?`, `samples?`, `phase?` | Temporal motion blur for any opaque picture |
| `PassedMotionBlur`, `blurPasses` | `pass?`, `dense?` + `MotionBlur` props | The same blur rendered in passes for `--scale 2` ([high-resolution renders](high-resolution.md)) |
| `stopmotionExposure` | `(settings, frame, fps)` | The finish's exposure gain for a frame, to give to a painted layer only |
| `shutterOffsets`, `samplesForStreak` | — | Sample times inside the shutter; sample count for a streak length |
| `useTime`, `TimeShift` | `by` (seconds) | The film clock, and a scoped offset of it (motion-blur samples use this) |
| `curves`, `overshoot` | — | Shared launch-film easing: `punchIn`, `punchOut`, `snap`, `open`, `glide` |
| `ClockScale`, `useClockRate` | `rate` | Run children's clock at a rate; `MotionBlur` scales its shutter by it |

Transition kinds are `zoom`, `portal`, `expand`, `slice`, `glitch`, `stack`, `tiles`, `split`, `focus`, `liquid`, `tilt`, `cards`, `grid`, and `divide`; their options are listed in [scene transitions](scene-transitions.md). Shots must be opaque, read the clock inside themselves, and keep audio outside.

## Cursor, badge, closing

`Cursor` accepts a path of `{time, x, y}` points, a `clicks` array of times, optional `enter`/`exit`, and `size`/`time`. A path point anchors the SVG's upper-left corner; its drawn tip is roughly `(2, 1.8) × size / 26` farther inside. Account for this small offset when aiming at narrow controls. Use the same click times to drive the UI's pressed and selected states; the cursor does not click real controls.

`VerificationBadge` accepts `label`, `start`, and `exit`, plus `icon`, `size`, `fontFamily`, `fontSize`, `color`, `background`, and `time`. It enters as a circle, expands to reveal a label, then retracts. Its default shield is illustrative; use actual product proof UI for claims of real verification, or supply an ordinary status icon and label.

`ClosingSequence` is a ten-second insert with `name`, `tagline` (an array of lines), `website`, and optional `symbol`, font settings, colors, and `time`. Put it on a `LogicalStage`. Its name is live text; a brand with a custom wordmark should provide its native vector treatment instead of substituting a similar font.

## Motion helpers

- `progress(t, start, duration)` returns clamped 0–1 progress.
- `travel(t, start, duration)` applies the shared deliberate ease.
- `arrive(t, start, duration)` applies a fast arrival and long settle.
- `glide(p)`, `ease(p)`, and `settle(p)` ease normalized progress.
- `mix(a, b, p)` interpolates values; `clamp(v)` bounds 0–1.
- `keystrokeSchedule` and `trackedWidth` are lower-level typing helpers.

## Motion vocabulary

| API | Main inputs | Purpose |
|---|---|---|
| `spring`, `springCurve` | `t`, `{duration, bounce}` / `bounce` | A damped spring in seconds, or as a 0–1 curve over a window |
| `moveCamera` | `t`, `from`, `to`, `start`, `duration`, `move` | Camera between two framings: `'glide'`, `'drift'`, `'spring'`, `'crash'`, `'whip'` |
| `Handheld` | `amount?`, `impacts?`, `hit?`, `children` | Organic camera wander plus hits at chosen times, edges covered |
| `shake`, `impact`, `drift` / `Drift` | `t`, options | Raw handheld offsets, a decaying jolt, and a slow float for holds |
| `arc` | `p`, `from`, `to`, `bend?` | A point on a curved path |
| `stagger`, `staggerRank`, `gridDelay` | index, count, order or pattern | Delays for pieces in a line or a grid |
| `Enter` | `preset?`, `start?`, `exit?`, `exitAt?`, `distance?`, `children` | Any element arriving and leaving with a motion preset |
| `SpeedRamp`, `rampTime`, `rampRate` | `keys: {at, rate}[]` | Slow motion, freezes, and rushes for everything inside |
| `Space`, `Plane` | `camera`, `perspective?`, `focus?`, `aperture?` / `x`, `y`, `z`, rotations, size | A 3D stage for floating UI, with depth of field |
| `camera3DAt`, `depthOf` | keys / point, camera | Interpolate 3D camera keys; distance of a point from the camera |
| `springTo` | `t`, `keys: {at, value}[]`, spring | A value that springs to each new target; responses add up, so it never jumps |
| `liquidRange` | `t`, `keys: {at, start, end}[]` | A span whose leading edge runs ahead of the trailing one: liquid tab indicators and toggle knobs |
| `rubberBand` | `value`, `min`, `max`, `reach?` | Resistance past a limit, for drags beyond the end of a slider |
| `bounce` | `t`, `{start, height, gravity, restitution}` | A dropped ball's height, speed, squash, stretch, and impact times |
| `Morph`, `morphAt`, `fitScale` | `states: {at, width, height, radius?, color?, content?, id?, fill?}[]` | One shape through many UI states; content swaps with a short blur; a camera scale that fits each state |
| `Trail` | `count?`, `spacing?`, `fade?`, `children: (time) => node` | Fading ghosts of a moving element |
| `Viewfinder` | `title?`, `specs?`, `sections?`, `color?`, `accent?` | A camera frame over a film: brackets, labels, timecode, progress, section |
| `SelectionBox` | `rect`, `start?`, `label?`, `name?` | A design-tool selection: outline, handles, size chip |
| `PatternField`, `fieldWave` | `columns`, `rows`, `cell`, `glyph(col, row, t)` | A grid of dots, crosses, tiles, or rings driven by waves |
| `BlockField` | `columns`, `rows`, `height(col, row, t)`, `color(col, row, t)`, `camera?`, `ball?` | A 3D field of blocks on a canvas, with lighting, fog, and a ball |

See [motion direction](motion-direction.md#motion-vocabulary) for how to use them, and `src/kit` for precise types and other exports. Keep a scene's action times together so UI state, cursor, and camera cannot silently drift apart.

## Transitions and effects

[Scene transitions](scene-transitions.md) connect React shots. The [shader transition guide](transitions.md) documents the Taleframe wrappers for pictures and footage, and the [effects guide](effects.md) documents image/video processing and their galleries. Read those APIs before deciding where to apply them; they are separate from moving React children with `CameraLayer`.

## Depth films, oil, and looks

`src/kit/depth` (exported from `src/kit`) is a canvas compositor for painted films made of pictures: `DepthFilm` takes shots of planes at depths, a camera per shot (`cameraPath`, `passage`, `matchCamera`), cuts through anchors, ink type (`InkLine`, `InkGroup`), UI layers in depth (`uiSequence`, `uiDrawing`), motes, and a finish. [Depth films](depth-films.md) documents it.

| API | Main inputs | Purpose |
|---|---|---|
| `oilStyle` | `watercolor`, `{strokeScale?, looseness?, focus?}` | Watercolor settings that paint in oil ([paint in oil](effects.md#paint-in-oil)) |
| `loadOilBrushes` | None | Load the oil brushes once before calling `applyTaleframeEffects` yourself; `TaleframeEffects` and `DepthFilm` do it for you |
| `looseOil`, `LOOSE_OIL`, `TIGHT_OIL` | `watercolor?`, `focus?` | Oil looks: bold and loose, or at the preset's stroke size |
| `WATERCOLOR_BROAD`, `WATERCOLOR_FINE` | — | Watercolor brushes for plates and for busy subjects |
| `SWIRL_LENS`, `SWIRL_LENS_UI`, `PAINTED_FINISH` | — | The swirl lens and the painted finish, tuned at 4K ([named looks](effects.md#named-looks)) |
| `paintedFinish` | `scale` (1 = 1920 × 1080, 2 = 3840 × 2160) | The painted finish scaled for the output; equals `PAINTED_FINISH` at 2 |
