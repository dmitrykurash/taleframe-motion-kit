# Demo paintings for depth films

Three paintings made for this kit, each cut into planes with the kit's own tools. They show no people, animals, text or logos. Each generated picture was checked by eye for people, faces, lettering and logos before it was used.

| Scene | Folder | Planes (far to near) | Job |
|---|---|---|---|
| A mountain lake at dawn | `lake/` | trees, mist, moorings, reeds | [`tools/depth/examples/lake.json`](../../../tools/depth/examples/lake.json) |
| A quiet sitting room with a window onto a garden | `room/` | table, fern, chair | [`tools/depth/examples/room.json`](../../../tools/depth/examples/room.json) |
| A harbour lighthouse in sea mist | `harbour/` | mist, headland, boat, near | [`tools/depth/examples/harbour.json`](../../../tools/depth/examples/harbour.json) |

`anchors.json` lists each scene's planes and its anchors (lamps, the window, the boats) in frame fractions.

## How the paintings were made

- **Tool:** OpenAI image generation, called through the Codex command-line tool that ships with the ChatGPT desktop app. Each call asked for one image.
- **Output:** 1672 × 941 PNG, cover-scaled to 1920 × 1080 (Lanczos) and saved as `color.jpg` at JPEG quality 90. The original PNGs are not kept.
- **Planes:** `.venv/bin/python tools/depth/prepare.py tools/depth/examples/<scene>.json`: Depth Anything V2 Small depth maps, SAM 2.1 Small and BiRefNet mattes, push-pull fills. The plane PNGs are white with the plane as alpha; `fill.jpg` and `fillmask.png` are the plate with its cut-out planes filled in.

Every prompt began with the same instruction to the tool: "Use your built-in image generation tool exactly once to create the image described below, then reply with only the saved file path."

### lake

> Create a wide 16:9 landscape image: a painterly illustration of a still mountain lake at dawn, in the style of a classic hand-painted storybook, rich oil and gouache brushwork, soft warm light. Clear layers of depth from front to back: in the lower foreground, dark reeds and a short weathered wooden jetty on the left with a small empty wooden rowing boat moored to it; in the middle distance, two or three separate soft banks of white morning mist drifting low over the calm water, one behind the other; behind them, a forested shoreline with dark pine trees; far away, a layered blue mountain ridge; above it, a pale sky with a warm golden glow where the sun is about to rise, reflected in the water. Calm, spacious composition with open sky in the upper third. No people, no animals, no birds, no buildings, no text, no letters, no numbers, no logos, no signature, no watermark, no frame or border.

### room

> Create a wide 16:9 image: a painterly illustration of a quiet, empty sitting room in late afternoon, in the style of a classic hand-painted storybook, rich oil and gouache brushwork. Plain warm plastered walls, bare of decoration. Clear layers of depth from front to back: in the lower left foreground, the rounded arm and back of a soft upholstered armchair in a single plain colour; in the lower right foreground, a large leafy potted fern; in the middle, a small round wooden table with a lit brass reading lamp with a warm glowing fabric shade, a plain white cup and a small potted plant; behind it, a tall open window in the back wall, slightly right of centre, with thin pale curtains, opening onto a green garden of round shrubs and tall trees on an open lawn under a bright sky with soft clouds. Warm lamp light inside, cool daylight outside, a bare wooden floor. No people, no animals, no books, no text, no letters or writing anywhere, no logos, no signature, no watermark, no frame or border.

### harbour

> Create a wide 16:9 image: a painterly illustration of a small harbour at dusk in sea mist, in the style of a classic hand-painted storybook, rich oil and gouache brushwork, cool blue-grey palette with warm lights. Clear layers of depth from front to back: in the lower left foreground, dark wet rocks and the end of a stone harbour wall with an iron mooring post; in the middle distance, a small wooden fishing boat with a furled sail moored on calm water, soft banks of sea mist drifting across the water; on a rocky headland at the right third, a tall white lighthouse with its lamp lit, a warm glowing light at the top with soft rays in the mist; far behind, faint cliffs fading into the mist under an overcast evening sky. Open misty sky in the upper left. No people, no animals, no birds, no text, no letters, no numbers, no flags, no logos, no signature, no watermark, no frame or border.
