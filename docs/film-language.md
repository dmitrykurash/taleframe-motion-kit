# Film language: a launch film, not a keynote

A launch film sells a feeling and proves it with the product. It borrows from title design, commercials, and motion graphics. It does not borrow from slide decks. These rules apply to every film made with the kit unless the brief explicitly asks for something else.

## The five rules

1. **Make a launch film, not a keynote.** No shot is a slide that fades in, waits, and fades out. Something is always arriving, holding for reading, or leaving, and the next shot is already on its way.
2. **Read the style, then commit to it.** Work out the requested style from the brief, write a short style sheet, and apply it to every shot.
3. **Type and UI take turns.** A type shot states the idea; a UI shot proves it. Do not lay headlines or captions over UI unless the task requires it or the brief asks for it.
4. **Type moves with intent.** Use big, short, kinetic typography: masks, slams, rolls, counters, rapid word sequences, motion presets, swaps, and type effects. Never centered small lines floating on an empty frame.
5. **Cut like an editor, transition like a motion designer.** Most cuts are hard cuts on action or on the beat. A designed transition is fast, carries momentum, and has a reason.

## 1. The keynote tells

These make a film look like a presentation. Remove them.

- A centered heading of 90–120 px fades in, holds, and fades out on an empty background, and the next scene repeats the pattern.
- Every scene enters with the same fade or small rise and leaves with a fade. Nothing continues across a cut.
- A dissolve or dip-to-color between every scene. Cube, a whole-frame flip, page curl, doorway, a flat tile mosaic, twirl, blinds, or a constant-speed push.
- The same move everywhere: every UI shot gets the same slow push, every word the same rise, every cut the same transition.
- Uniform pacing: every shot 3–5 seconds, every move the same speed and curve.
- Captions or titles over UI ("Now with sharing"), bullet lists, numbered feature cards, labels that explain the screen.
- Static screenshots that sit there while nothing happens.
- Empty frames before the first element appears or after the last one leaves.
- Fast moves without motion blur, which strobe.
- Decoration unrelated to the product, standing in for design.

What a modern launch film does instead:

- The frame always does one deliberate thing. Motion carries across cuts: the energy of an exit becomes the energy of the next entrance (match cut, cut on action, momentum through a transition).
- Type is big and graphic. UI is real, legible, and doing something.
- Rhythm has contrast: a run of fast beats, then a breath on a proof shot.
- Moves are physical: accelerate hard, settle long. Fast moves carry motion blur. Overshoot only where the style is playful.

## 2. Read the style and commit to it

1. **Collect the signals.** Named references ("like Apple's product films", "Nothing-style"), adjectives (calm, loud, premium, playful, technical, editorial, raw), the brand assets (logo, palette, typeface), the product and its audience, the music and its tempo, and where the film will play (social, website hero, event screen).
2. **Pick a style family** from the table below, or blend two with one clearly dominant.
3. **Write a style sheet** into the project brief before building (5–8 lines): palette with roles, display and UI type with weights and tracking, motion character (curves, speed, overshoot), transition vocabulary (hard cuts plus two or three kinds), pacing (average shot length, beat grid), finish (grain, glow, blur), and sound sync.
4. **Apply it everywhere.** Every shot should be recognizably from the same film. Deviations are deliberate and rare.
5. **When signals are missing or conflict,** infer from the brand assets and audience. Ask only when two plausible directions would produce very different films and the brief offers no way to choose.

A named company or film is a reference for traits, not assets. List three to five visible characteristics (for example "black field, huge centered grotesk, slow push-ins, one accent color, match cuts") and map them to the table. Do not copy another company's logo, typeface files, footage, or music.

| Family | Signals | Palette and type | Motion | Transitions | Shot length |
|---|---|---|---|---|---|
| Minimal premium | clean, premium, hardware, elegant | Black or white fields, one accent. Large grotesk, medium to bold, tight tracking | Slow push-ins, long settles, no overshoot, soft light | Hard and match cuts, `expand`, card `portal` | 2–3.5 s |
| Loud, hype | bold, drop, energetic, social, sport | Black, white, one electric color. Weight 900–1000, very tight, often caps | Slams on the beat, speed ramps, punches, short shakes on hits | `zoom`, `slice` with color leads, `glitch`, flashes | 0.4–1.2 s |
| Friendly, playful | fun, friendly, colorful, consumer, community | Bright saturated set, rounded shapes. Rounded or humanist sans | Springy overshoot, pops, squash and stretch | `expand` with `bounce`, circle `expand`, bright `slice` | 1–2 s |
| Editorial, refined | thoughtful, trusted, writing, finance | Paper, ink, one muted accent. Serif display with a small sans | Line-by-line mask reveals, slow parallax, precise holds | Hard cuts, word `portal`, restrained `expand` | 2–4 s |
| Technical, developer | developer, API, terminal, fast, dark mode | Near-black, grays, one neon accent, subtle glow. Grotesk with mono accents | Crisp snaps (0.3–0.5 s), typed commands, decode text, gliding camera | `slice`, `zoom`, card `portal`, occasional `glitch` | 1–2 s |
| Cinematic | cinematic, story, emotional, documentary | Graded footage, film grain. Tracked small caps or an elegant serif | Weighty, slow, long holds, `TrackIn` titles | Hard cuts, light leaks, dissolves (the one family where they belong) | 3–6 s |
| Handmade, painted | watercolor, oil, storybook, warm, paper, craft, painterly | Paper whites, pigment colors. Serif or lettered type, ink type set into the picture | Held poses (stop motion on twos), gentle drift, a camera traveling through painted planes ([section 9](#9-painted-films-in-depth)) | Taleframe shader transitions opened from something in the picture (watercolor, ink, engraving; prism, ripple or godrays for light), with paper paint, sand or waterspill for washes | 3–6 s |
| Retro, brutalist | Y2K, retro, brutalist, zine, raw, pixel | Primaries or harsh contrast. Extreme grotesk, mono, pixel faces | Stepped timing, hard cuts, halftone | `glitch`, `slice`, halftone and signal shaders | 0.5–1.5 s |
| Motion-design reel | showreel, motion designer, Dribbble, UI motion, "all code" | Near-black and warm paper, one or two electric accents. Medium grotesk, a variable-width face for type walls, mono labels | Springs with a touch of overshoot, one shape morphing through states, trails, fields, particles, everything on a beat grid | Hard cuts on beats, circle `expand`, `divide`, `grid` | 0.5–2 s |

Worked examples: `Product-Launch` is minimal premium in black, `Product-Explainer` is the same family in white with explainer pacing, `Kit-Reel` puts loud word beats inside a minimal 9:16 reel, `Motion-Reel` is a motion-design reel, `Launch-Film` is editorial, `Scene-Transitions` is technical, and `Painted-Depth` is handmade and painted, a depth film in oil. Each file opens with its style sheet; for `Painted-Depth` that file is `src/examples/depth/film.ts`, which holds its shots.

## 3. Structure: shots, turns, and beats

Write a shot list before building: time, shot type (TYPE, UI, PRODUCT, BRAND), message, motion, and how it arrives (default: cut).

- **Alternate TYPE and UI.** The type shot states one idea in one to six words; the next UI shot proves it. Two UI shots in a row are fine when they are one continuous task and the camera connects them. Two or more type shots in a row are fine as a rapid sequence on beats.
- **No text on UI by default.** Exceptions:
  - the brief asks for captions, labels, or text beside the product;
  - a short label is needed to understand the UI (for example, naming a setting that has no visible title). Attach it to the element, move it with the camera, keep it to four words or fewer, and remove it before the camera leaves;
  - a deliberately designed split layout (headline on one side, product on the other) that the brief or the chosen style calls for. The type is then part of the composition, not a caption.
- **Open in motion.** Something moves within the first six frames; the first readable idea lands by 1.5 seconds.
- **End on a designed brand moment** (name, mark, URL) as a type shot, with a 1.5–2.5 second hold and an intentional last frame.
- **Vary the pace.** Follow the style's shot length, and break it on purpose: three fast beats, then a longer proof.
- **Cut on the beat.** With a known tempo, a beat lasts 60 / BPM seconds (0.5 s at 120 BPM). Land type and cuts on beats, not after them.

## 4. Kinetic typography

Components and recipes are in the [kinetic type guide](kinetic-type.md). The rules:

- **Big.** Display lines of 160–420 logical pixels on the 1920 × 1080 stage (cap height at least a tenth of the frame). Secondary lines at least 48 px.
- **Short.** One to six words per card. Break lines by meaning, never by width.
- **Tight.** Display tracking −2 % to −6 %; stacked lines at 0.85–1.0 line height.
- **Motion that means something.** Words rise out of a baseline mask, slam on a beat, roll to replace a word, count up for numbers, decode for technical claims, track in for cinematic titles. One motion idea per card, two at most (for example a mask reveal and a slow push).
- **Readable.** After the last word lands, hold at least 0.4 s plus 0.06 s per character. Never start the exit while the line is still arriving.
- **Leave with direction.** Exit up and out, cut away, or hand off to a transition. Do not fade in place.
- **Blur only in motion.** Wrap fast type moves in `MotionBlur`; type at rest is crisp.
- **Clear of the edges.** Over pictures, and in cinematic or painted styles, keep type out of the outer 10 % of the frame for its whole life ([section 9](#9-painted-films-in-depth)). Full-frame type (a word sequence, a type wall, a marquee) and entrances from off screen are the exceptions.
- **Medium by default, always filled.** Set display type in a medium weight unless the style asks for heavier; never outline type unless the brief asks for it.
- **Avoid:** typewriter headlines (typing belongs to UI), letter-by-letter fades on long lines, extruded 3D text, spins outside playful styles, bevels, glows, drop shadows, rainbow gradients, and text that drifts in from the frame edge at constant speed.

## 5. Cutting and transitions

- **The default is a hard cut** on action or on the beat. Most cuts in a launch film are cuts.
- **Use a designed transition when it carries meaning or energy:** the click causes the next screen (`expand`), the word becomes the product (`portal` with text), the product accelerates into the claim (`zoom`), a section change on a beat (`slice`, `tiles`, `split`), a technical hit (`glitch`), a detail of the UI becomes its own screen (`portal` with a rect), two ideas compared or handed over (`divide`), a recap or a show of range (`grid`), the next step arrives on top of the last (`stack`), a calm change of scene (`focus`), shots that belong to one set (`cards`), a spatial reveal (`tilt`), an organic or dreamy change (`liquid`).
- **Budget:** two or three transition kinds per film, never the same kind twice in a row, and on average no more than one designed transition every four seconds.
- **Timing:** 0.3–0.8 s for most, up to 1.5 s for a word portal. Accelerate into the cut, land with a long settle, and keep motion blur on.
- **Continuity:** the outgoing shot is already moving toward the transition; the incoming shot is composed (or deliberately mid-entrance) when it is revealed and starts its own secondary motion as the transition lands.
- **Never** the presentation set: cube, a whole-frame flip around its center, page curl, doorway, a flat tile mosaic, twirl, static blinds, constant-speed pushes, or a crossfade between every shot. The kit's `tilt` and `tiles` avoid those tells on purpose (planes pass in depth with motion blur and a long settle; tiles shrink in a wave onto a shot that is already moving), and `focus` hides its blend inside the blur; still use them sparingly. Taleframe's painted shader transitions belong to the handmade family.

| From → to | Good choices |
|---|---|
| UI → type | hard cut, `zoom` into the element the claim is about, `slice`, `divide` |
| Type → UI | hard cut, `portal` through the word, `tilt` |
| Click → result | `expand` from the clicked control; `stack` for the next step of a flow |
| UI → another view of the product | `cards`, or one morphing shape inside a single shot (`Morph`) |
| Many shots → one | `grid`: pull back to all of them, push into the next |
| UI → closer UI | camera move within the shot, `portal` through the card |
| Section change | `slice`, `tiles`, or `split` on the beat |
| Calm change of scene | `focus` |
| Dreamy or organic | `liquid`, or the painted shaders for pictures |
| Technical hit | `glitch`, short and rare |
| Footage or stills | `TaleframeTransition` shaders chosen for the style, opened from something in the picture |
| Painting → painting in a depth film | Travel through an anchor (a lit window, a lamp), or a match cut on it ([section 9](#9-painted-films-in-depth)) |

See [scene transitions](scene-transitions.md) for the API.

## 6. UI shots

- Use the real product UI through an adapter, at its own proportions. Magnify with the camera.
- Each UI shot shows one action and its result: typing, a click, a state change, data arriving.
- Move the camera with purpose: push toward the action, drift slowly during holds, keep the background on a parallax plane, blur fast moves.
- Hold a readable state for at least one second. Keep text crisp at rest.
- Give depth with soft shadows and a quiet background, not with floating labels.
- Frame decisively: the whole window with a margin, or a close-up whose cut edges are clearly off frame. A sliver of a sidebar or panel at the frame edge reads as a mistake.
- In 9:16, set the product larger than on a desktop stage (a narrower window at 1.3–1.5×) so its type reads on a phone, and keep headlines in the middle band, clear of social captions.

## 7. Finish

- Motion blur (a 180° shutter, `shutter: .5`) on anything moving faster than about 30 logical pixels per frame.
- Shared curves: fast-out/long-settle for arrivals, accelerate for exits, strong in–out for pushes between two rests (`curves` in the kit).
- A limited palette. Background changes between shots are part of the rhythm (dark UI → bright type card → paper).
- Grain, glow, and texture only when the style sheet calls for them.

## 8. The keynote test

Run this on stills and on the encoded film before delivery.

- Could any shot be a slide: a static layout that fades in, holds, and fades out? Rework it.
- Is any headline smaller than a tenth of the frame height?
- Is there text over UI that the brief did not ask for and the viewer does not need?
- Does each designed transition carry motion from one shot into the next? Is any crossfade or dip there without a reason?
- Is there an empty frame longer than four frames?
- Do the cuts land on actions or beats? Does the pace change at least once?
- Do neighboring shots repeat a move: the same push, the same direction, the same transition? Change one.
- Would the style sheet be recognizable from any single shot?
- In a depth film: does every cut pass through something in the picture? Are headings and UI separate beats? Does the render log zero `SAFEAREA`?

## 9. Painted films in depth

A film made of pictures (paintings, stills, footage) can travel into them. A [depth film](depth-films.md) cuts each picture into painted planes, moves a camera through them, and passes from shot to shot through something in the picture. The rules above still hold, with the exceptions listed at the end of this section; these are the ones specific to it.

**Choose it** when the brief asks for a handmade, storybook, or painterly film, when the material is pictures rather than UI, or when a few UI beats need a painted world around them. For a UI-led launch, stay with React shots and [scene transitions](scene-transitions.md).

**Painted looks are one style family.** Watercolor and oil are two looks of one paint engine, chosen per film and switched by one flag, so an earlier look stays reproducible. The chain is fixed: a duotone tint per shot before the paint, the paint per plane, a swirl lens, then one painted finish over the frame (stopmotion at 12 fps, soft-light grain, a light duotone). Loose, bold oil keeps its detail where a focus ellipse puts it: a face, a hand, the one prop a scene is about. See [paint in oil](effects.md#paint-in-oil) and [named looks](effects.md#named-looks).

**Cut through the picture.** Every cut passes through something in the picture, on a beat: a lit window, a lantern, a lamp. A Taleframe shader that takes a centre (watercolor, ink or engraving; prism, ripple or godrays for light) opens from that anchor while the camera travels into it, and the next shot opens pushed in and pulls back. A match cut puts the incoming anchor exactly on the outgoing one. Behind UI, the camera dives through the element on screen (a button, a badge, a window) and the next painting opens from that point. Pictures hold on twos; the transition and the camera inside it run at the full frame rate. See [transitions](transitions.md#travel-through-the-picture).

**Compose type into the picture.** Set type in groups around the subject: big and small, together and apart, each drifting slowly toward the viewer and leaving upward. Give a few lines their own gesture (a stamp, a flight, a rush past the lens, a glint), not all of them. A soft, wide scrim darkens bright paper or sky behind a line so it reads. See [ink type](kinetic-type.md#ink-type-in-depth-films).

**Keep a 10 % type-free border.** Every word's real ink box (cap or ascender top to descender bottom) stays inside 10–90 % of the width and the height for its whole life, including the group's drift and growth and the word's own gesture (a stamp, a flight). Only a deliberate full-frame effect or an entrance from off screen may cross it. A group set against the border grows away from it. Depth films check this on every frame and log `SAFEAREA`; a delivered render logs none.

**Headings and UI are separate beats.** The heading, then the UI element, then the next scene. When a UI beat needs more time, take it from the neighboring shots; never overlap them.

**Cut out only what reads.** A subject with an imperfect matte (a spinning wheel, smoke, wisps of hair against the sky) or no real parallax (it sits at the sky's depth) stays in its plate: cutting it leaves a ghost of the subject and a blurry filled patch that viewers notice. A painting behind UI often reads best uncut, as one plate that moves as a piece.

**Exceptions in a depth film.** Its ink type and its cuts follow these rules where they differ from [section 4](#4-kinetic-typography), [section 5](#5-cutting-and-transitions) and the keynote test:

- **Size.** Compose groups big and small: display groups of about 100–160 px on the 1920 × 1080 stage, secondary groups at least 48 px. A painting needs room around its subject, so type frames it instead of filling the frame.
- **Tracking.** Set a serif at neutral tracking (the ink engine's default, 0), not the tight tracking of a grotesk. A small secondary line may open slightly (0.02 em).
- **Shadow and scrim.** The ink's soft legibility shadow and the wide `scrim` behind a group over bright paper or sky are allowed; they read as shade in the picture, not as a drop shadow on a slide.
- **Exits.** Groups lift off upward by default. A secondary group may `dissolve` in place while its heading lifts.
- **Cuts.** Every cut is a travel-through, a match cut on an anchor, or a dive through UI. A depth film has no hard cuts between pictures, and the transition budget above does not apply; still vary the shader from cut to cut.
