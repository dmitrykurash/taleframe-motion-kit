# Production decisions

## Find the story

Record a compact brief beside the project. Useful fields are audience, subject, purpose, useful task, required copy, UI evidence, assets, brand, reference direction, duration, aspect ratio, fps, audio, and outputs. Preserve established choices and requested review points.

Choose a structure to fit the film:

| Film | Useful starting structure |
|---|---|
| Product launch | Promise → a few concrete benefits → product proof → closing |
| UI demonstration | Recognizable task → visible actions → readable result |
| Motion reel | Related visual ideas → controlled changes of pace → resolved ending |
| Insert in a longer edit | Begin directly with the needed material; leave usable cut points |

These are suggestions, not required storyboards. A feature deserves a scene when the viewer can understand its value. Avoid arbitrary typing prompts; use a task the audience recognizes.

For a new film, write a short scene table with time, message, visible content, action, camera target, background, and exit. Count entry, reveal, reading hold, and exit within the scene's duration. Keep a useful state visible after its final change.

## Choose evidence and assets

For each product action, identify its source component, screenshot, or recording. Record what is actual behavior and what is staged data. Claims about privacy, device boundaries, approvals, or verification need product support; similar-sounding claims may describe different architectures.

Use original logo geometry and actual UI typography. A separate display font can help editorial copy. Adapt the visual direction to the brand: palette, imagery, spacing, type scale, and texture should feel related across scenes without every scene being identical.

Keep backgrounds quiet where the viewer needs to read. Place stronger details toward the edges, simplify the image, or soften the source when appropriate. If painting an already blurred source, apply the blur before the painted treatment so the brush detail remains intact.

If generating assets, use the tools available in the agent's environment or supplied files. Store final assets in the project and record prompts/settings when useful. Rendering supplied assets does not depend on an image-generation service.

## Choose motion and effects

Give each move a reason: follow a line of text, guide the eye to a control, reveal a result, or connect scenes. Let the audience reach the target before the next important change. A transition should suit both neighboring scenes, and its busiest phase should not obscure essential copy.

Treat grain, paint, halftone, blur, and similar treatments as deliberate choices. They are available tools, not a required stack. UI legibility usually matters more than applying an effect uniformly to every layer. See the effect documentation for what can be processed and where the wrapper belongs.

## Judge the film

- Does the first frame establish an intentional subject rather than a leftover blank wait?
- Does the typography fit with the actual font and copy? Is the final revealed line held long enough to read?
- Are typing intervals varied and camera follow continuous?
- Does the cursor tip land inside its target at the action frame? Do hover, press, selection, and save appear in the right order?
- Does the background move consistently with the foreground and cover the frame throughout the camera path?
- Are transitions and effects coherent, without accidental flashes, stale textures, or obscured controls?
- Does a direct seek show the same state as sequential playback?
- Does the encoded file have the requested dimensions, duration, fps, and clean playback?

Deliver enough information for another editor to find the scene, props, assets, and render command. Keep the final handoff focused on output files, editable locations, and material limitations.
