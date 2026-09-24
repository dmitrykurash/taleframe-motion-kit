# Motion direction

Build a consistent visual language around the subject. Smooth camera travel, readable type, and well-timed holds are useful across many styles; a specific palette, font, or effect is a project choice. Read [film language](film-language.md) first: it sets the rules for launch films (no keynote look, a committed style, type and UI taking turns, kinetic type, cuts before transitions). This page covers the craft inside a shot.

## A reason for each movement

Guide attention from subject to action to result. A camera can follow text while it is typed, trail a pointer toward a control, or move closer to a detail that proves the claim. Give the viewer time to read the destination before another important change.

Use relative scale deliberately. Product UI should retain its own proportions and text sizing; magnify it with the camera. Editorial copy can be larger, but a secondary line or URL should have a clear relationship to the primary heading. Avoid making every scene equally large and active.

Count the entry, reveal, reading hold, and exit in each scene's duration. Text that finishes revealing at the moment it exits has no reading hold. A setting that changes while the camera is already leaving may be technically present but invisible to the viewer.

## Coordinates and timing

`LogicalStage` picks its logical size from the output's aspect ratio: 1920 × 1080 for 16:9, 1080 × 1920 for 9:16, 1080 × 1080 for 1:1, and 1080 × 1350 for 4:5. A 4K or 2160 × 3840 composition scales its stage 2×; other ratios throw. Each ratio needs its own layout; nothing is cropped or stretched to fit. Read the stage with `useStage()` and pass it to `focusCamera` in portrait and square films; scene transitions read it themselves.

In a vertical film, product UI is set larger than on a desktop stage so its type reads on a phone: `Kit-Reel` places a 720 × 1000 window at 1.35× and pushes to 1.5× while a prompt is typed. Keep headlines inside the middle 1300 px of the 1920 px height, clear of the captions and buttons that social apps draw over the top and bottom.

Use seconds from `frame / fps` for scene timing. Keep related action times together and share them between cursor, UI state, and camera. `CameraLayer` transforms around the stage center. Put the cursor inside that layer when its path is measured in the same coordinates as the UI; `focusCamera` calculates how to place a chosen target on screen.

Shared motion curves:

| Helper | Behavior | Useful for |
|---|---|---|
| `travel` | Deliberate ease in and out | Camera moves and exits |
| `arrive` | Fast entry, long settle | A new object entering |
| `glide` | Gentle start with a long settle | An already visible object moving |
| `curves.punchIn` | Accelerates hard to full speed | Moves into a cut or out of frame |
| `curves.punchOut` | Arrives at full speed, settles long | Landings after a cut, type rising into place |
| `curves.snap` | Strong in–out | A push between two rests |
| `overshoot(bounce)` | Fast opening with optional overshoot | Playful styles only |

Keep most moves compatible instead of choosing a new easing for every object. Nothing important moves linearly. See [components](components.md) for signatures and units.

A move faster than about 30 logical pixels per frame strobes without motion blur. Render such moves inside `MotionBlur` (see [scene transitions](scene-transitions.md#motion-blur-elsewhere)); a 180° shutter (`shutter: .5`) matches film.

## Camera and cursor

Measure target centers in the untransformed UI. Account for the pointer's tip rather than its full SVG box. Show the native hover state before the press and hold the resulting state briefly afterward.

For a settings scene, a useful sequence is title → current option → pointer to control → changed option → Save. The camera may trail the pointer slightly, but the pointer and target should remain readable at the moment of action. Recheck coordinates after text or layout changes.

## Typing and text

Natural typing uses fixed but uneven keystroke intervals, occasional small hesitations, and short spaces. `useTyping` measures the actual font and exposes a smoothly tracked width. Use that width for camera follow; starting a separate ease for each phrase produces a repeated accelerate/stop pattern. Typing belongs inside UI; headlines use [kinetic type](kinetic-type.md).

Type shots use the kinetic components: `MaskReveal` for most headlines, `Slam`, `WordRoll`, `WordSequence`, `Counter`, `Scramble`, and `TrackIn` where the style calls for them. `WordReveal` and `CharacterReveal` are quiet options for calm, editorial moments; a small centered line fading in on an empty frame is the look to avoid.

Load fonts before measuring. Use genuine weight files where needed. Character positioning preserves Latin pair kerning and uses grapheme segmentation; for connected scripts such as Arabic or Indic, prefer whole-word animation so shaping remains intact. Set deliberate line breaks when the copy needs two lines.

An uncluttered type shot often needs only its heading and a strong ground. Additional captions, labels, or decoration should earn their place in the story, and headlines do not sit on top of UI shots unless the brief asks for it.

## Background depth

Drive the background from the same camera as the foreground with a lower translation gain. A starting depth of 7–13% gives a distant plane; shallow zoom changes reinforce the distance. Avoid unrelated drift that moves against the foreground.

Overscan keeps the enlarged image's edges outside the frame. For a centered full-stage background, `(scale - 1) × stageWidth / 2` must exceed the absolute horizontal translation; apply the equivalent condition vertically. `backgroundCoversFrame` checks that simplified case. Inspect the whole path, source aspect ratio, and transition texture transforms as well.

## Transitions and effects

Cut first. When a designed transition is justified, use a [scene transition](scene-transitions.md) between React shots (`zoom`, `portal`, `expand`, `slice`, `glitch`) or a [Taleframe shader transition](transitions.md) between pictures and footage. A painted spread suits an organic, handmade film; a UI workflow usually wants a cut, an `expand` from the clicked control, or a `portal` through a card. The transition should not hide the action the viewer came to see. The [effects guide](effects.md) covers processing order and settings.

Use texture and distortion selectively. A background may benefit from a treatment that makes small UI text unreadable. When preparing painted imagery, soften the source before painting if needed, then preserve the brush detail. Grain and stop motion are independent choices, not implied by a watercolor look.

## Keep the rendered result stable

Derive animation from frames, use fixed seeds, and wait for assets, fonts, and GPU work before capture. Check cold direct seeks; a component measured before its stylesheet loads can retain incorrect geometry. Review the encoded output as well as Studio playback.
