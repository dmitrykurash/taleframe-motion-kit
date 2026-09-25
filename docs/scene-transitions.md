# Scene transitions

Fourteen transitions for live React scenes: UI, typography, product shots. They work directly on the shots you build with the kit, keep type and UI vector-sharp at any zoom, and carry true motion blur where things move fast. Open **Scene-Transitions** in Studio for the first five between realistic launch-film shots, **Motion-Showcase** for the newer ones, each named by a label while it plays, and **Motion-Reel** for `grid`, `divide`, and a color-filled circle `expand` in a motion-design reel.

They are different from the [Taleframe shader transitions](transitions.md), which operate on pictures (images, footage, canvas drawings) and include the painted looks. Use scene transitions between React shots; use the shaders for footage and stills or when a film is deliberately painterly.

Read [film language](film-language.md) first: most cuts in a launch film are hard cuts, and a designed transition needs a reason.

| `kind` | Use it for | Default length |
|---|---|---|
| `zoom` | Accelerate into a point of the outgoing shot, cut on the blur, land in the next shot. Loud and classic. | 0.5 s, centered on the cut |
| `portal` | Fly through a word, a card, or a dot of the outgoing shot into the next shot. | 1.1 s, starts at the cut |
| `expand` | The next shot grows out of the element that was just clicked, while the current one pushes back and dims. | 0.7 s, starts at the cut |
| `slice` | Bands of the frame push across with a stagger, optionally led by brand-color bars. | 0.6 s, centered on the cut |
| `glitch` | A short digital hit around a hard cut: RGB split, tearing, smeared rows, stutter. | 0.42 s, centered on the cut |
| `stack` | The next shot slides over as a card while the current one sinks back into depth. Calm and product-like. | 0.75 s, starts at the cut |
| `tiles` | The frame breaks into a grid of tiles that shrink away in a wave, ripple, rows, or at random. | 0.8 s, centered on the cut |
| `split` | A line of light cracks the frame and the halves slide apart to reveal the next shot. | 0.7 s, starts at the cut |
| `focus` | A rack focus: out of focus and back in, with the swap hidden in the blur. The premium alternative to a dissolve. | 0.7 s, centered on the cut |
| `liquid` | Both shots ripple as if under moving water; the swap happens inside the distortion. | 0.8 s, centered on the cut |
| `tilt` | Two planes pass in 3D: the current shot tips back and falls away as the next one swings up into place. | 0.8 s, centered on the cut |
| `cards` | The app-switcher move: shrink to a card, slide along the strip, grow into the next shot. | 1.1 s, centered on the cut |
| `grid` | Pull back to a bento grid of live shots, hold, and push into the next one. A recap, a chapter jump, a show of range. | 1.5 s, centered on the cut |
| `divide` | The next shot pushes in to share a split screen, the two hold side by side, then the new one takes the frame. | 1.3 s, centered on the cut |

Pick by style (see the table in [film language](film-language.md#2-read-the-style-and-commit-to-it)): `focus`, `stack`, and `cards` suit calm and premium films; `zoom`, `slice`, and `glitch` loud ones; `tilt`, `tiles`, `split`, `divide`, and `grid` graphic ones and motion-design reels; `liquid` dreamy or organic ones. Use two or three kinds per film, not all of them.

## Build a film from shots

`Shots` plays a list of full-stage scenes. Each shot ends at `until` (film seconds); the next shot follows with a hard cut unless it has an `enter` transition. Put it inside a `LogicalStage`.

```tsx
import {LogicalStage, Shots} from '../kit';

<LogicalStage background="#0c0d10">
  <Shots shots={[
    {until: 2.1, content: <HeadlineShot start={0}/>},
    {until: 5.4, content: <DashboardShot start={2.1}/>,
      enter: {kind: 'portal', text: 'Relay', fontSize: 520, fontWeight: 1000}},
    {until: 7.0, content: <ComposerShot start={5.4}/>},                    // hard cut
    {until: 9.2, content: <ResultShot start={7.0}/>,
      enter: {kind: 'expand', source: {x: 1352, y: 578, width: 210, height: 76, radius: 38}, color: '#ff5a1f'}},
    {content: <ClosingShot start={9.2}/>, enter: {kind: 'zoom', focus: {x: 960, y: 540}}},
  ]}/>
</LogicalStage>
```

- A transition window is placed on the cut by `align`: `'center'` (half before, half after), `'start'` (begins at the cut), or `'end'`. `duration` is in seconds. `Shots` throws a clear error when a window does not fit between the neighboring cuts.
- Both shots keep playing through the window, so the incoming shot is already on screen before its cut when a window is centered. Design it to be composed at that moment, or start its entrance so that it lands as the transition does.
- `useShot()` inside a shot returns `{index, name, start, end, local}`, where `local` is seconds since the shot's cut.

For a single transition without a shot list, use `SceneTransition` directly:

```tsx
<SceneTransition kind="slice" from={<StatShot/>} to={<GridShot/>} start={4.2} duration={.6}
  lead={['#ff5a1f', '#d6ff3b']}/>
```

Before `start` it renders `from` exactly; after the window it renders `to` exactly.

## Shots must be opaque scenes that read the clock

- Each shot fills the 1920 × 1080 stage with an opaque background.
- Read time inside the shot with `useTime()` or `useShot()`, not from a value computed outside and passed in. Motion blur renders the shot at several instants inside one frame; a shot that reads the clock animates correctly in every sample.
- Keep `<Audio>` outside shots. A transition renders both shots (and motion blur renders them several times), so audio inside a shot would play more than once.
- Use `OffthreadVideo` or an image sequence for footage inside a shot; a playing HTML `<Video>` element is not frame-accurate when it is copied.

## Options

Positions and sizes are logical stage units, the same space as `LogicalStage`, `CameraLayer`, and `focusCamera`. All options are optional unless noted.

Common: `shutter` (motion-blur exposure as a fraction of a frame; 0.5 is a 180° shutter, 0 turns blur off) and `quality` (most copies averaged in the fastest frame). `zoom`, `portal`, and `expand` also take `backdrop`, the color behind anything that would expose empty space.

### `zoom`

| Option | Default | Meaning |
|---|---|---|
| `focus` | stage center | Point of the outgoing shot the camera rushes toward: the element the next idea is about |
| `landing` | stage center | Point of the incoming shot the camera settles on |
| `push` | 2.4 | Scale the outgoing shot reaches at the cut |
| `land` | 1.6 | Scale the incoming shot starts from before settling to 1 |
| `roll` | 0 | Degrees of roll into the cut; the landing unwinds it. 2–5 adds energy |
| `cut` | 0.5 | Where the cut falls inside the window |
| `flash` / `flashColor` | 0.18 / white | Light burst at the cut |
| `chroma` | 0.35 | Radial color fringing at peak speed |

Each frame shows only one shot: samples near the cut continue that shot's own motion instead of mixing the two into gray. Aim `focus` at the element that matters (a card, a button, a number) so the push reads as intent.

### `portal`

Give exactly one of `text`, `rect`, or `circle`.

| Option | Default | Meaning |
|---|---|---|
| `text` | — | A word. Its letters rise out of a baseline mask with the incoming shot inside them, then the camera flies through the thickest stroke |
| `at`, `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing` | center, baseline at 62 % height; DM Sans, 440, 900, −0.04 em | The word's position (baseline center) and type. Heavy weights make the best portals |
| `rect` | — | `{x, y, width, height, radius}` of a card, screen, or tile in the outgoing shot. The incoming shot appears nested inside it, then the camera pushes until the rect is the frame |
| `circle` | — | `{x, y, radius}` of a dot or round control |
| `reveal` | 0.38 text, 0.2 rect, 0.22 circle | Fraction of the window spent opening the portal before the flight |
| `into` | thickest stroke | Override the point the camera flies into (must be inside a letter) |
| `depth` | 1.22 | The incoming shot starts this much larger inside the portal and settles to 1 |

Choose a word and colors so the incoming shot is legible inside the letters against the outgoing shot. The camera path is computed from the rendered glyphs after the font loads.

### `expand`

| Option | Default | Meaning |
|---|---|---|
| `source` | 140 px square at center | `{x, y, width, height, radius}` of the element the new shot grows out of, usually the control that was just clicked |
| `shape` | `'rect'` | `'circle'` grows a circle from the source center |
| `color` | none | Fill of the source element. The window starts in this color and dissolves into the incoming shot |
| `colorHold` | 0 | Fraction of the window the color stays solid first: a ball that grows into a full field of color, then opens onto the next shot |
| `push` | 1.08 | Scale the outgoing shot moves to. Above 1 pushes toward the camera (like a home screen as an app opens); below 1 recedes |
| `dim` / `defocus` | 0.4 / 8 | Darkening and depth blur of the outgoing shot |
| `bounce` | 0 | 0 settles without overshoot; up to 1 overshoots about 8 % for playful styles |

Match `source` and `color` to the element's position and color at the moment of the click, and put the click just before the window starts (`align: 'start'`).

### `slice`

| Option | Default | Meaning |
|---|---|---|
| `orientation` | `'horizontal'` | Horizontal bands travel left/right; vertical bands travel up/down |
| `bands` | 5 | Number of bands |
| `direction` | `'left'` / `'up'` | Where the outgoing shot leaves |
| `alternate` | false | Alternate the direction band by band |
| `stagger` | 0.07 | Delay between bands as a fraction of the window |
| `order` | `'sequence'` | `'reverse'`, `'center'`, or `'random'` (seeded) |
| `lead`, `leadWidth` | none, 150 | Solid color bars that run ahead of the incoming shot, first color leading |
| `seed` | 11 | Order for `'random'` |

Each band carries a directional blur matched to its speed.

### `glitch`

| Option | Default | Meaning |
|---|---|---|
| `intensity` | 0.75 | Overall strength |
| `cut` | 0.5 | Where the hard cut falls inside the window |
| `rate` | 24 | Pattern changes per second, independent of the film's fps |
| `split` | 34 | Largest RGB split in logical pixels |
| `color` | white | Flickering block color (drawn in difference mode) |
| `stutter` | true | Briefly repeat earlier instants of each shot |
| `seed` | 7 | Pattern seed |

Keep it short and rare, and make sure the incoming shot is already composed at the cut, so the hit reveals a finished frame.

### `stack`

| Option | Default | Meaning |
|---|---|---|
| `side` | `'bottom'` | Side the new card enters from |
| `recede`, `dim`, `defocus` | 0.9, 0.45, 6 | How far the current shot sinks back, darkens, and blurs |
| `radius` | 44 | Corner radius of the card while it travels; it flattens as it lands |
| `bounce` | 0 | Overshoot on landing |

Good for step-by-step stories: each step arrives on top of the last.

### `tiles`

| Option | Default | Meaning |
|---|---|---|
| `columns` | 12 (7 in portrait) | Tiles across; rows follow so tiles stay square |
| `pattern` | `'diagonal'` | `'radial'` (from `origin`), `'rows'`, `'columns'`, or `'random'` (seeded) |
| `spread` | 0.55 | Fraction of the window between the first and last tile starting |
| `round` | 0.6 | Tile shape while shrinking: 0 square, 1 dot |
| `rotate` | 0 | Degrees each tile turns as it shrinks (45 gives diamonds) |
| `depth` | 1.08 | The incoming shot settles from this scale |

### `split`

| Option | Default | Meaning |
|---|---|---|
| `angle` | 90 | Angle of the split: 90 vertical doors, 0 horizontal, 20 a diagonal tear |
| `at` | stage center | A point on the split line |
| `depth` | 0.3 | How far the camera moves in through the opening: the halves grow by this much and soften as they pass it, and the next shot comes forward from behind them |
| `seam`, `seamColor` | 0.7, white | A line of light along the split before it opens |

### `focus`

| Option | Default | Meaning |
|---|---|---|
| `blur` | 28 | Peak blur in logical pixels |
| `scale` | 1.06 | Scale the outgoing shot drifts to; the incoming settles from it |
| `bloom` | 0.22 | Light blooming at the blend |

The swap happens only while both shots are deep out of focus, so no sharp double image ever shows.

### `liquid`

| Option | Default | Meaning |
|---|---|---|
| `amount` | 150 | Peak displacement in logical pixels |
| `frequency` | 0.0045 | Size of the ripples; smaller is broader |
| `flow` | 320 | How fast the ripples travel, in logical pixels per second |
| `seed` | 3 | Noise pattern |

### `tilt`

| Option | Default | Meaning |
|---|---|---|
| `direction` | `'up'` | Where the new shot comes from: `'up'` rises from below; also `'down'`, `'left'`, `'right'` |
| `angle` | 40 | Degrees the planes tilt |
| `depth` | 900 | How far the outgoing plane falls back, in logical pixels |
| `perspective` | 1500 | Camera distance |
| `radius` | 40 | Corner radius of the planes in flight |

### `cards`

| Option | Default | Meaning |
|---|---|---|
| `direction` | `'left'` | Direction the strip moves; `'left'` brings the next card in from the right |
| `scale` | 0.66 | Size of the shots while they are cards |
| `gap` | 80 | Space between the cards, in logical pixels at card size |
| `radius` | 44 | Corner radius of the cards |
| `backdrop` | near black | Color behind the cards; match it to the shots |

Shrink, slide, and grow overlap, so the move reads as one gesture. The cards keep a constant gap at any size, so they never overlap.

### `grid`

| Option | Default | Meaning |
|---|---|---|
| `tiles` | none | Other shots for the grid, as full-stage React scenes; they are drawn small and stay live |
| `columns`, `rows` | 3, 3 | Grid size. Cells keep the stage's aspect ratio, so a cell scaled up fills the frame exactly |
| `fromCell`, `toCell` | middle, next | Cells (row by row) of the outgoing and incoming shots |
| `gap`, `radius` | 26, 22 | Space between cells and their corners at grid size |
| `hold` | 0.3 | Fraction of the window spent on the whole grid |
| `backdrop` | near black | Color behind the cells; make it a step lighter than dark shots so they read as cards |

Every tile renders its shot live, so a large grid of heavy shots is slow to render. Six to nine light shots work well.

### `divide`

| Option | Default | Meaning |
|---|---|---|
| `side` | `'right'` | Side the new shot enters from |
| `hold` | 0.4 | Fraction of the window the two shots share the screen |
| `split` | 0.5 | Where the divider rests, as a fraction of the width |
| `line`, `lineColor` | 2, white | Divider width and color |

Each panel shows the middle of its shot, so both stay composed while the divider moves.

## Motion blur elsewhere

`MotionBlur` gives the same temporal blur to any fast move inside a shot, such as a whip pan of the camera or a slam of type:

```tsx
<MotionBlur shutter={.5} samples={12}>
  {time => <MyShot time={time}/>}
</MotionBlur>
```

The render function receives each sample time and must draw a complete opaque picture. Everything below that reads `useTime()` is shifted to the sample time automatically. Blur only the frames that move fast; `samplesForStreak(pixels)` returns a sensible count, and 1 means no blur. Inside a `SpeedRamp`, the shutter spans the ramp's shot time, so slow motion blurs less, as a real camera would.

## Performance and checks

A transition frame renders both shots, and motion blur renders them up to `quality` times. Most frames of a film are unaffected. Keep shots reasonably light (no thousands of DOM nodes).

Scene transitions are composited by the browser, so they render many times faster with hardware graphics. Use `--gl angle` for films built from React shots; keep the default software renderer (`swangle`) only when the film also uses Taleframe shader transitions or effects and their exact repeatability matters. On the test Mac the 22-second reel took minutes with `angle` and over twenty with `swangle`.

Render stills at the start, middle, and end of every window before a long export, and run the transition check:

```sh
npm run stills -- Scene-Transitions --gl angle --times 1.6,4.9,5.6,9.0,12.8,15.7,19.6 --out out/scene-transition-stills
npm run check:scenes -- --gl angle   # all 17 windows of Scene-Transitions, Motion-Showcase, and Motion-Reel
npm run render -- Scene-Transitions --gl angle --out out/scene-transitions.mp4
```

The first and last frames of each window equal the two shots exactly. Everything derives from frame time and fixed seeds, so direct seeks and repeated renders give the same pixels.
