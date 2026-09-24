# Production decisions

## Find the story

Record a compact brief beside the project. Useful fields are audience, subject, purpose, useful task, required copy, UI evidence, assets, brand, **style signals and references**, duration, aspect ratio, fps, audio and tempo, and outputs. Preserve established choices and requested review points.

Choose a structure to fit the film:

| Film | Useful starting structure |
|---|---|
| Product launch | Promise (type) → proof (UI) → benefit (type) → proof (UI) → claim or number (type) → brand moment |
| UI demonstration | Recognizable task → visible actions → readable result, with short type beats between chapters |
| Motion reel | Related visual ideas → controlled changes of pace → resolved ending |
| Insert in a longer edit | Begin directly with the needed material; leave usable cut points |

These are suggestions, not required storyboards. A feature deserves a shot when the viewer can understand its value. Avoid arbitrary typing prompts; use a task the audience recognizes.

## Write the style sheet

Before building, turn the brief into a style sheet using the families in [film language](../../../../docs/film-language.md#2-read-the-style-and-commit-to-it). Name the family (or the dominant one of two), then fix:

- palette with roles (ground, ink, accent, UI surfaces);
- display and UI typefaces, weights, tracking;
- motion character: curves, speed, overshoot or none;
- transition vocabulary: hard cuts plus two or three scene transitions;
- pacing: average shot length, the beat grid if there is music;
- finish: grain, glow, blur, texture, or none.

Keep the sheet in the brief so later edits stay consistent. Named references describe traits to emulate; never copy their logos, typefaces, footage, or music.

## Write the shot list

For a new film, write a table with time, shot type (TYPE, UI, PRODUCT, BRAND), message, visible content, action, camera target, background, and how the shot arrives (default: cut). Then check:

- Type and UI alternate. Consecutive UI shots are one continuous task; consecutive type shots are a deliberate rapid sequence.
- No UI shot carries a headline or caption unless the brief asks for it or a short attached label is needed to understand the UI.
- Each type shot holds one idea of one to six words, large enough to read at a glance.
- Count entry, reveal, reading hold, and exit within each shot's duration. Keep a useful state visible after its final change.
- Shot lengths follow the style and vary on purpose. Cuts land on actions or beats.
- The film opens in motion and ends on a designed brand moment with an intentional last frame.

## Choose evidence and assets

For each product action, identify its source component, screenshot, or recording. Record what is actual behavior and what is staged data. Claims about privacy, device boundaries, approvals, or verification need product support; similar-sounding claims may describe different architectures.

Use original logo geometry and actual UI typography. A separate display font can carry the type shots. Adapt the visual direction to the brand: palette, imagery, spacing, type scale, and texture should feel related across shots without every shot being identical.

Keep backgrounds quiet where the viewer needs to read UI. Put loud color in the type shots. Place stronger details toward the edges, simplify the image, or soften the source when appropriate. If painting an already blurred source, apply the blur before the painted treatment so the brush detail remains intact.

If generating assets, use the tools available in the agent's environment or supplied files. Store final assets in the project and record prompts/settings when useful. Rendering supplied assets does not depend on an image-generation service.

## Choose motion and transitions

Give each move a reason: follow a line of text, guide the eye to a control, reveal a result, or connect shots. Let the audience reach the target before the next important change. Accelerate hard and settle long; blur fast moves.

Default to hard cuts. Use a scene transition where it carries meaning (click → `expand`, word → `portal`, element → `zoom`, section → `slice`, technical hit → `glitch`), limit a film to two or three kinds, and never repeat a kind back to back. The busiest phase of a transition should not obscure essential copy. Treat grain, paint, halftone, and similar treatments as deliberate style choices, not a required stack.

## Judge the film

- Does the first frame establish an intentional subject rather than a blank wait?
- Would any shot pass for a slide? Is any headline small, centered, and alone on an empty frame?
- Is there text over UI that the brief did not ask for?
- Does the typography fit with the actual font and copy? Is the final revealed line held long enough to read?
- Are typing intervals varied and camera follow continuous?
- Does the cursor tip land inside its target at the action frame? Do hover, press, selection, and save appear in the right order?
- Does the background move consistently with the foreground and cover the frame throughout the camera path?
- Does every designed transition carry motion, with no accidental flashes, stale textures, empty edges, or obscured controls?
- Does a direct seek show the same state as sequential playback?
- Does the encoded file have the requested dimensions, duration, fps, and clean playback?

Deliver enough information for another editor to find the shots, props, style sheet, assets, and render command. Keep the final handoff focused on output files, editable locations, and material limitations.
