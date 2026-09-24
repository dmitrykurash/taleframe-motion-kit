# Motion direction

Build a consistent visual language around the subject. Smooth camera travel, readable type, and well-timed holds are useful across many styles; a specific palette, font, or effect is a project choice.

## A reason for each movement

Guide attention from subject to action to result. A camera can follow text while it is typed, trail a pointer toward a control, or move closer to a detail that proves the claim. Give the viewer time to read the destination before another important change.

Use relative scale deliberately. Product UI should retain its own proportions and text sizing; magnify it with the camera. Editorial copy can be larger, but a secondary line or URL should have a clear relationship to the primary heading. Avoid making every scene equally large and active.

Count the entry, reveal, reading hold, and exit in each scene's duration. Text that finishes revealing at the moment it exits has no reading hold. A setting that changes while the camera is already leaving may be technically present but invisible to the viewer.

## Coordinates and timing

`LogicalStage` uses 1920 × 1080 logical units and supports 16:9 outputs. A 4K composition scales the stage 2×. Portrait and square films need a custom layout, not a stretched stage.

Use seconds from `frame / fps` for scene timing. Keep related action times together and share them between cursor, UI state, and camera. `CameraLayer` transforms around the stage center. Put the cursor inside that layer when its path is measured in the same coordinates as the UI; `focusCamera` calculates how to place a chosen target on screen.

Shared motion curves:

| Helper | Behavior | Useful for |
|---|---|---|
| `travel` | Deliberate ease in and out | Camera moves and exits |
| `arrive` | Fast entry, long settle | A new object entering |
| `glide` | Gentle start with a long settle | An already visible object moving |

Keep most moves compatible instead of choosing a new easing for every object. See [components](components.md) for signatures and units.

## Camera and cursor

Measure target centers in the untransformed UI. Account for the pointer's tip rather than its full SVG box. Show the native hover state before the press and hold the resulting state briefly afterward.

For a settings scene, a useful sequence is title → current option → pointer to control → changed option → Save. The camera may trail the pointer slightly, but the pointer and target should remain readable at the moment of action. Recheck coordinates after text or layout changes.

## Typing and text

Natural typing uses fixed but uneven keystroke intervals, occasional small hesitations, and short spaces. `useTyping` measures the actual font and exposes a smoothly tracked width. Use that width for camera follow; starting a separate ease for each phrase produces a repeated accelerate/stop pattern.

`WordReveal` expands a centered phrase as words arrive. `CharacterReveal` uses short overlapping entries; an 8ms stagger gives a nearly simultaneous reveal. A small initial blur can soften the entry, then resolves to crisp text. These are defaults to adjust, not rules for every treatment.

Load fonts before measuring. Use genuine weight files where needed. Character positioning preserves Latin pair kerning and uses grapheme segmentation; for connected scripts such as Arabic or Indic, prefer whole-word animation so shaping remains intact. Set deliberate line breaks when the copy needs two lines.

An uncluttered text beat often needs only its heading and background. Additional captions, labels, or decoration should earn their place in the story.

## Background depth

Drive the background from the same camera as the foreground with a lower translation gain. A starting depth of 7–13% gives a distant plane; shallow zoom changes reinforce the distance. Avoid unrelated drift that moves against the foreground.

Overscan keeps the enlarged image's edges outside the frame. For a centered full-stage background, `(scale - 1) × stageWidth / 2` must exceed the absolute horizontal translation; apply the equivalent condition vertically. `backgroundCoversFrame` checks that simplified case. Inspect the whole path, source aspect ratio, and transition texture transforms as well.

## Transitions and effects

Choose transitions to connect scenes. A painted spread can suit organic imagery, while a simpler move can keep a UI workflow coherent. The effect should not hide the action the viewer came to see. Read the [transition guide](transitions.md) for supported options and the [effects guide](effects.md) for processing order and settings.

Use texture and distortion selectively. A background may benefit from a treatment that makes small UI text unreadable. When preparing painted imagery, soften the source before painting if needed, then preserve the brush detail. Grain and stop motion are independent choices, not implied by a watercolor look.

## Keep the rendered result stable

Derive animation from frames, use fixed seeds, and wait for assets, fonts, and GPU work before capture. Check cold direct seeks; a component measured before its stylesheet loads can retain incorrect geometry. Review the encoded output as well as Studio playback.
