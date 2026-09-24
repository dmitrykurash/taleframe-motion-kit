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

**Avoid** typewriter headlines, letter-by-letter fades on long sentences, spinning or extruded 3D text, glows, bevels, drop shadows, rainbow gradients, text sliding in from the frame edge at a constant speed, and small centered lines floating on an empty frame.

## Recipes by style

| Style | Recipe |
|---|---|
| Minimal premium | `MaskReveal` by word, 180–260 px, weight 700–800, slow push on the card, long holds; brand name with `TrackIn` |
| Loud, hype | `WordSequence` on beats with palette flips, `Slam` at 300+ px weight 1000, `zoom` into the next shot |
| Friendly | `MaskReveal` with `tilt` 6–10°, rounded face, bright grounds, `expand` with `bounce` |
| Editorial | Serif `MaskReveal` by line, generous margins, one muted accent word via `WordRoll` |
| Technical | `Scramble` for labels and names, `Counter` for metrics, mono accents beside a grotesk headline |
| Cinematic | `TrackIn` titles in small caps or an elegant serif, slow fades only here, long holds |

The **Scene-Transitions** composition uses `MaskReveal`, `WordRoll`, and `Counter` between UI shots. **Product-Explainer**, **Product-Launch**, and **Kit-Reel** use every component above. Each pairs a grotesk with one serif-italic line, and Kit-Reel gives each idea its own face: Inter, Instrument Serif, Geist Mono, and DM Sans Black.
