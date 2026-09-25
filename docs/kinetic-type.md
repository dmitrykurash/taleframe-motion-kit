# Kinetic typography

In a launch film, type shots carry the message between product shots. They are big, short, and move with a purpose. This guide covers the kit's kinetic components and how to use them well. The rules behind them are in [film language](film-language.md#4-kinetic-typography).

All components derive their state from time, work with direct seeks and motion blur, and take `fontFamily`, `fontSize` (logical px), `fontWeight`, `letterSpacing` (**em**, so tracking scales with size), and `color`. Load custom fonts first with `FontLoader`.

## Components

| Component | What it does | Good for |
|---|---|---|
| `MaskReveal` | Lines sit in masks; words, letters, or whole lines rise out from behind the baseline, then leave upward | The default headline move in almost every style |
| `WordRoll` | A slot where one word rolls into the next while the line width follows | "Built for designers / developers / everyone" |
| `Slam` | A word or short line hits the frame: fast scale into place with a speed blur | Loud beats, drops, one-word punches |
| `WordSequence` | One word per beat owns the whole frame, hard-cut to the next, optional color flips | Rapid-fire openings, manifestos, beat-synced cuts |
| `Counter` | A number counts with tabular figures | Stats and claims ("3.0×", "48,210") |
| `Scramble` | Characters cycle, then resolve left to right | Technical and developer films |
| `TrackIn` | Wide tracking tightens while the word sharpens | Cinematic titles and brand names |

The older `CharacterReveal`, `WordReveal`, and `TypedText` remain for quiet, editorial moments and UI text. Typing belongs inside UI, not in headlines.

```tsx
import {Counter, MaskReveal, WordRoll} from '../kit';

// A headline card: two lines, words rising out of their masks, leaving upward at 2.4 s.
<MaskReveal lines={['Ship on Friday.', 'Sleep on Friday.']} start={.1} exit={2.4}
  fontSize={180} fontWeight={900} letterSpacing={-.045} color="#fff"/>

// A rolling claim.
<WordRoll prefix="Built for " words={['designers.', 'developers.', 'everyone.']} at={[.2, .9, 1.6]}
  fontSize={150} fontWeight={900} rollColor="#d6ff3b"/>

// A stat that counts into place, with a label rising under it.
<Counter from={1} to={3} decimals={1} suffix="×" start={.05} fontSize={500} fontWeight={1000} letterSpacing={-.06}/>
```

Key options:

- `MaskReveal`: `lines`, `by` (`'word'`, `'character'`, `'line'`), `start`, `stagger` (s between units), `duration`, `exit`, `exitStagger`, `from` (`'below'`/`'above'`), `tilt` (degrees of entry rotation), `lineHeight`, `align`. A line is a string or a list of runs, `{text, fontFamily?, fontWeight?, fontStyle?, fontSize?, letterSpacing?, color?}`, for one italic serif word inside a sans headline: `[{text: 'Then get it '}, {text: 'done.', fontFamily: serif, fontStyle: 'italic'}]`.
- `WordRoll`: `words`, `at` (a landing time per word, the first is the entrance), `prefix`, `duration`, `exit` (the line leaves upward through its own mask), `rollColor`, `align`.
- `Slam`: `text`, `start`, `scaleFrom` (above 1 lands from the camera, below 1 pops out of the page), `duration`, `exit`, `smear`.
- `WordSequence`: `words`, `beat` or `times`, `palettes` (`[background, color]` pairs, cycled), `push`. It fills its container, so give it the whole stage.
- `Counter`: `to`, `from`, `start`, `duration`, `decimals`, `prefix`, `suffix`, `group`.
- `Scramble`: `text`, `start`, `duration`, `characters`, `rate`, `seed`. Monospace faces look best.
- `TrackIn`: `text`, `start`, `duration`, `trackFrom` (em), `exit`.

## Motion presets

`KineticText` applies any of 18 motion presets to lines, words, or letters, with a stagger order and a separate exit. The same presets move any element through `Enter` (see [motion direction](motion-direction.md#motion-vocabulary)). Every preset starts hidden and lands exactly at rest.

```tsx
import {KineticText} from '../kit';

// Letters flip up from the middle outward, hold, then blur away.
<KineticText lines={['Built to move.']} by="character" enter="flip" order="center" stagger={.03} start={.2}
  exit="blur" exitAt={2.4} fontSize={180} fontWeight={800} color="#fff"/>
```

Options: `lines` (strings or runs, as in `MaskReveal`), `by` (`'line'`, `'word'`, `'character'`), `enter`, `exit` (defaults to `enter`), `start`, `stagger` (seconds between pieces), `order`, `duration` (per piece; each preset has a default), `exitAt`, `exitDuration`, `exitStagger`, `exitOrder`, `lineHeight`, `align`, and `seed` for the seeded presets.

| Preset | Look | Suits |
|---|---|---|
| `rise` | Slides up from behind the baseline and leaves upward (masked) | Every style; the workhorse |
| `soft` | A short rise with a fade | Calm films, supporting lines |
| `blur` | Resolves out of focus while it settles in scale | Premium, cinematic |
| `track` | Pulls together from wide tracking while it sharpens (by line or word) | Titles and names |
| `weight` | Grows from a hairline to full weight on a variable font | Modern typographic |
| `wipe` | Revealed left to right by a moving edge | Editorial, explainers |
| `flip` | Flips up on its baseline in 3D, like a split-flap board | Technical, crisp |
| `turn` | Swings open around its left edge like a door | Editorial, spatial |
| `slide` | Sweeps in from the right with a lean | Energetic |
| `skew` | Shears into place from a hard italic lean | Sporty, fast |
| `zoom` | Flies in from the camera with a soft blur | Loud |
| `glitch` | Jitters in with a red and cyan split in stepped frames, then locks | Technical, digital |
| `drop` | Falls in from above and bounces once; leaves by falling with a tumble | Playful |
| `pop` | Scales up from nothing with a springy overshoot | Friendly |
| `wave` | Bobs up on a spring, so a stagger rolls through the line like a wave | Friendly, fun |
| `stretch` | Shoots up tall and thin, then squashes into place | Loud, fun |
| `spin` | Spins in from small while it grows | Playful only |
| `scatter` | Pieces fly in from seeded random places and assemble; they leave by bursting apart | Loud, playful |

**Stagger order** changes the character of the same preset: `'start'` reads like speech, `'end'` like a rewind, `'center'` like a burst, `'edges'` like something closing in, and `'random'` like sparkle. Letters suit short words; words suit lines; whole lines suit paragraphs and `track`.

## Type transitions

`TextSwap` replaces one text with the next in place: the old text leaves with one preset while the new one arrives with another, and the slot's width follows.

```tsx
import {KineticText, TextSwap} from '../kit';

<div style={{display: 'flex', alignItems: 'baseline'}}>
  <KineticText lines={['Make it\u00a0']} enter="soft" fontSize={190} fontWeight={700}/>
  <TextSwap texts={['fast.', 'simple.', 'yours.']} at={[.3, 1.1, 1.9]} enter="flip" by="character"
    fontSize={190} fontWeight={700} color="#2f63ff"/>
</div>
```

`flip` by letter makes a split-flap board, `blur` a soft morph, `scatter` a burst, `glitch` a digital swap, and `rise` a clean roll. `WordRoll` stays the lightest option for a masked roll after a prefix.

## Type effects

| Component | What it does | Good for |
|---|---|---|
| `Mark` | Draws emphasis onto marked runs: `'marker'`, `'underline'`, `'strike'`, `'box'`, or a hand-drawn `'circle'` | Explainers, before-and-after claims |
| `Echo` | Stacked repeats of a word that fold into it, fan out, or breathe; outlines optional | Loud, graphic, Y2K |
| `Marquee` | Endless rows of repeating type in alternating directions, optionally tilted and outlined | Loud, brutalist, event films |
| `Shine` | A sheen of light crossing the letters once | Premium titles, end cards |
| `CircleText` | Type set on a turning circle | Badges, seals, loops around a product |
| `SplitText` | A word cut along its middle: the halves slide in and lock, then part | Hype, reveals |
| `Breathe` | A weight wave running through a variable font | Modern typography, living holds |

- `Mark`: `lines` (runs with `mark: true`), `kind`, `at`, `duration`, `stagger` (between marks), `markColor`, `markedColor` (the marked text's color once the mark is down, e.g. white on a dark marker or gray under a strike).
- `Echo`: `text`, `copies`, `offset` (em between copies), `start`, `duration`, `mode` (`'collapse'`, `'expand'`, `'pulse'`), `outline`, `echoColor`.
- `Marquee`: `text`, `rows`, `speed` (logical px per second), `separator`, `angle`, `alternate`, `outlineRows`, `rowGap`. It fills its positioned parent.
- `Shine`: `text`, `at`, `duration`, `shineColor`, `width` (fraction of the text), `angle`.
- `CircleText`: `text` (repeat it to fill the circle), `radius`, `speed` (degrees per second), `rotate`.
- `SplitText`: `text`, `start`, `duration`, `distance` (em), `exitAt`, `exitDuration`.
- `Breathe`: `text`, `min` and `max` weights, `speed` (waves per second), `wavelength` (letters per wave).

Effects compose: wrap one in `Enter` for its entrance, or set a `KineticText` line beside it. Variable-weight moves need a variable font; Inter and DM Sans are variable here.

## Practice

**Size and weight.** Display lines are 160–420 px on the stage; a single word can go larger. Heavy weights (800–1000) read as confident and survive motion blur; light weights need slower motion. Secondary lines stay at least 48 px.

**One idea per card.** One to six words. Break lines by meaning ("Ship on Friday. / Sleep on Friday."). Left-aligned or deliberately placed type usually looks more designed than centered type; center only when the style calls for symmetry.

**Tracking and leading.** Tighten display tracking to −2 %…−6 % and stack lines at 0.85–1.0. Keep kerning intact: animate words or whole lines with `MaskReveal by="word"`; use `by="character"` for short words.

**Timing.**

| Move | Typical duration | Stagger |
|---|---|---|
| Word rising out of a mask | 0.6–0.9 s | 0.04–0.08 s per word |
| Letters of one short word | 0.6–0.8 s | 0.025–0.04 s per letter |
| Slam | 0.25–0.4 s | — |
| Word roll | 0.45–0.6 s | — |
| Exit (up and out) | 0.35–0.5 s | 0.02–0.04 s |

Hold at least 0.4 s plus 0.06 s per character after the last word lands, and time landings to beats when there is music.

**Motion that means something.** Rise for statements, slam for impact, roll for a changing subject, count for numbers, scramble for technical claims, track in for names. Combine at most two moves in one card, for example a mask reveal plus a slow 2–4 % push on the whole card.

**Color and ground.** Type shots are where the palette gets loud: a full-bleed accent field, black with an electric word, paper with ink. Change the ground between cards to create rhythm.

**Leaving.** Exit up and out, cut, or hand off to a scene transition (a word can become a `portal`). Do not fade in place and do not let the next shot start while the line is still arriving.

**Avoid** typewriter headlines, letter-by-letter fades on long sentences, extruded 3D text, glows, bevels, drop shadows, rainbow gradients, text sliding in from the frame edge at a constant speed, and small centered lines floating on an empty frame. `spin`, `scatter`, `stretch`, and `drop` are for playful and loud styles; keep them out of premium films.

## Recipes by style

| Style | Recipe |
|---|---|
| Minimal premium | `MaskReveal` or `KineticText` with `rise`, `soft`, or `blur` by word, 180–260 px, weight 700–800, slow push on the card, long holds; the name with `TrackIn` or `Shine` |
| Loud, hype | `WordSequence` on beats with palette flips, `Slam` or the `zoom` and `stretch` presets at 300+ px weight 1000, `Echo`, `SplitText`, `Marquee` |
| Friendly | `pop`, `wave`, and `drop` presets or `MaskReveal` with `tilt` 6–10°, rounded face, bright grounds, `CircleText` badges |
| Editorial | Serif lines by line with `rise` or `wipe`, generous margins, `Mark` underlines, one accent word via `TextSwap` or `WordRoll` |
| Technical | `Scramble` for labels and names, `glitch` and `flip` presets, `TextSwap` flip boards, `Counter` for metrics, mono accents |
| Cinematic | `TrackIn` titles in small caps or an elegant serif, `blur` by line, `Shine`, slow fades only here, long holds |
| Modern typographic | The `weight` preset and `Breathe` on a variable font, `turn` and `flip` in 3D, one face in several weights |

**Motion-Showcase** plays all 18 presets on two walls (each word is its preset's name), the stagger orders, `TextSwap`, and every type effect, each named by a label. The **Scene-Transitions** composition uses `MaskReveal`, `WordRoll`, and `Counter` between UI shots. **Product-Explainer**, **Product-Launch**, and **Kit-Reel** use every component above. Each pairs a grotesk with one serif-italic line, and Kit-Reel gives each idea its own face: Inter, Instrument Serif, Geist Mono, and DM Sans Black.
