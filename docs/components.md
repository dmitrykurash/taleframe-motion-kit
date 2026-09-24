# Shared components

Import from `src/kit/index.ts`. In a file under `src/examples/`, that is `../kit`. Times are seconds; coordinates and sizes are logical stage units unless noted otherwise. Components derive time from Remotion's current frame, with an optional `time` override where supported.

## Stage and camera

| API | Main inputs | Purpose |
|---|---|---|
| `LogicalStage` | `children`, `background?` | A 1920 × 1080 stage scaled to a 16:9 output |
| `CameraLayer` | `camera: {x, y, scale}`, `children`, `style?` | Transform an entire UI scene around stage center |
| `focusCamera` | `target`, `scale`, `screen?` | Place a stage point at the requested screen point; default screen is center |
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

See `src/kit` for precise types and other exports. Keep a scene's action times together so UI state, cursor, and camera cannot silently drift apart.

## Transitions and effects

The [transition guide](transitions.md) documents the Taleframe transition wrappers and [effects guide](effects.md) documents image/video processing and their galleries. Read those APIs before deciding where to apply them; they are separate from moving React children with `CameraLayer`.
