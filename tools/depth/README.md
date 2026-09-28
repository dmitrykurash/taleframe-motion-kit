# Depth tools

These tools cut pictures into planes for a [depth film](../../docs/depth-films.md). You give them a still painting or a stretch of footage. They write the files the renderer reads: the colour pictures, one alpha mask per plane, the plate with its cut-out subjects filled in, and anchor tracks for the transitions.

Everything runs on your machine. Apple silicon uses the GPU through MPS, an NVIDIA card through CUDA, and anything else the CPU.

## Set up

You need Python 3.10 or newer and FFmpeg on your `PATH`. Use a full FFmpeg build (Homebrew's is fine), not the trimmed one that Remotion ships: the tools need its `select` and `fps` filters. Set `FFMPEG_BIN` and `FFPROBE_BIN` to use another build.

```sh
python3 -m venv .venv
.venv/bin/pip install -r tools/depth/requirements.txt
```

Run the tools from the kit root. The models download on first use into `.cache/models/` inside the kit, which git ignores. Set `HF_HOME` to reuse a model cache you already have.

| Model | Used for | Size | Licence |
|---|---|---|---|
| Depth Anything V2 Small | depth maps (the default) | ~100 MB | Apache-2.0 |
| Depth Anything V2 Base or Large | sharper depth maps, `"depth": {"variant": "base"}` | 390 MB / 1.3 GB | CC BY-NC 4.0, non-commercial |
| SAM 2.1 Hiera Small | tracking a subject through footage | ~180 MB | Apache-2.0 |
| BiRefNet | fine subject edges | ~450 MB | MIT |

The licences are the upstream projects'. BiRefNet runs code from its model repository, so its revision is pinned in `ml/matte.py`.

## Prepare a still painting

```sh
.venv/bin/python tools/depth/prepare.py tools/depth/examples/lake.json
```

This runs five steps in order and writes `public/demo/depth/lake/`. Each step skips what already exists, so you can stop and start again. Name steps to run only those, and add `--force` to redo them:

```sh
.venv/bin/python tools/depth/prepare.py tools/depth/examples/lake.json planes tracks --force
```

| Step | Script | Writes |
|---|---|---|
| `frames` | `frames.py` | the colour pictures at the output size (footage: only the held frames the edit shows) |
| `depth` | `depthmaps.py` | a depth map per held frame, normalised over the whole shot, and `depth-preview.jpg` |
| `mattes` | `mattes.py` | a matte per subject and held frame |
| `planes` | `planes.py` | the plane masks, the filled plate, its fill mask, and `planes-preview.jpg` |
| `tracks` | `tracks.py` | `tracks.json`: anchor positions per held frame |

Depth maps, mattes and previews go to the job's work folder (default `.cache/depth/<name>/`). The renderer does not read them.

Work the way the examples were made. Run `frames depth` first. Open `depth-preview.jpg` and read the printed percentiles to choose band edges. Add subjects and planes to the job. Run `mattes planes`, open `planes-preview.jpg`, adjust, and run `planes --force` until each plane holds exactly its subject.

## The job file

A job is one shot, as JSON. Relative paths resolve against the folder you run from. Positions are frame fractions (u, v from the top left), so a job does not depend on the picture size.

```json
{
  "name": "harbour",
  "still": "pictures/harbour.png",
  "out": "public/depth/harbour",
  "size": [1920, 1080],
  "subjects": {
    "boat": {"points": [[0.37, 0.62], [0.39, 0.56], [0.35, 0.44]], "negatives": [[0.5, 0.68]]},
    "wall": {"points": [[0.12, 0.53], [0.08, 0.64]]}
  },
  "planes": [
    {"name": "headland", "depth": [0.04, 0.055], "region": [0.6, 0, 1, 0.56], "feather": 0.02},
    {"name": "mist", "luma": "bright", "region": [0, 0.3, 1, 0.82]},
    {"name": "boat", "matte": "boat"},
    {"name": "rocks", "depth": [0.34, 0.4], "region": [0, 0.55, 0.66, 1], "write": false},
    {"name": "near", "matte": "wall", "plus": ["rocks"]}
  ],
  "fill": {"cut": ["headland", "boat", "near"]},
  "tracks": {"lamp": {"region": [0.74, 0.03, 0.82, 0.16], "measure": "bright"}}
}
```

| Field | What it does |
|---|---|
| `still` or `footage` | The source: an image, or `{"file", "first", "last", "offset", "hold", "handle"}` (below) |
| `out` | The folder under `public/` that the renderer reads |
| `work` | Depth maps, mattes and previews (default `.cache/depth/<name>`) |
| `size` | Output size of the colour pictures (default 1920 × 1080). Masks and fills stay at 1920 wide at most; the renderer stretches them |
| `depth` | `variant` (`small`, `base`, `large`) and `res`, the network's input size (default 770; 518 is faster) |
| `subjects` | Subjects to matte: tracked from `points` or a `box`, or a `salient` box for BiRefNet alone |
| `planes` | How each plane is built, far or near, in any order; a plane can use planes listed before it |
| `fill` | `cut`: planes removed from the plate and filled. `keep`: planes or subjects that stay in the plate |
| `tracks` | Anchors to measure: `pose` of a plane, the `bright`est blob (a lamp), or a `color` blob |

### Planes

A plane multiplies the factors you give it. Use at least one.

| Factor | Meaning |
|---|---|
| `"matte": "boat"` | A subject's matte, with its weak interior firmed up so it does not read as a ghost once it moves |
| `"depth": [lo, hi]` | Nearer than: 0 below `lo`, 1 above `hi` (depth 1 is near), snapped to the picture's edges |
| `"until": [lo, hi]` | And not nearer than this: a band, such as a far treeline |
| `"luma": "bright"` or `"dark"` | A soft key against the local surroundings: mist and haze banks, or dark cloud bodies |
| `"region": [u0, v0, u1, v1]` | A soft rectangle; `feather` is in fractions of the frame height |

Then `plus` adds other planes, `minus` cuts out nearer ones, and `"write": false` keeps a helper plane out of the output. See the top of `planes.py` for every option.

Use depth bands for broad things with clear depth: reeds, rocks, a headland, a chair. Use mattes for subjects that sit at the same depth as their surroundings: a boat on water, a lamp against a wall. Use luminance keys for mist and haze. Several soft haze banks, each its own plane, give the camera something to pass one after another.

### Subjects

Put a positive point on every distinct part of the subject: SAM drops the parts it was not shown. Put negatives on the neighbours it tends to swallow. When SAM starts to lose a subject in footage, re-prompt it on a later film frame with `"later": {"96": {"points": [...]}}`.

A `salient` subject skips tracking: BiRefNet takes the salient object inside the box on each frame. It suits stills and subjects that stay put.

The tracked matte combines both models. SAM follows the subject; its masks are blobby. BiRefNet, run on a crop around SAM's mask, gives the fine edges. SAM's mask, snapped to the picture's edges and pulled a few pixels inside, restores parts BiRefNet drops.

### Fill

The plate's cut-out planes are filled with a push-pull wash of their surroundings, so parallax never reveals a hole or a ghost of the subject. The wash is soft on purpose: it only shows at the edges of moving planes. Inpainting that smears boundary colours inward (Telea) leaves long wedges across large holes.

Cut honestly. Do not cut out a subject whose matte is imperfect (a spinning wheel, smoke, wisps of hair against the sky) or whose parallax would be negligible because it sits at the sky's depth. The cut leaves a ghost of the subject and a blurry filled patch that viewers notice. Leave it in the plate. If a nearby cut plane's fill would still cover it, list it in `fill.keep` (`keepGrow` widens it, default 0.04 of the frame height). Still paintings behind UI often read best uncut, as one plate that moves as a piece.

## Prepare footage

```json
{
  "name": "shore",
  "footage": {"file": "footage/shore.mp4", "first": 48, "last": 142, "offset": 1.5, "hold": 2, "handle": 26},
  "out": "public/depth/shore",
  "size": [3840, 2160],
  "subjects": {"boat": {"points": [[0.45, 0.6], [0.5, 0.52]], "negatives": [[0.2, 0.8]]}},
  "planes": [{"name": "boat", "matte": "boat"}, {"name": "near", "depth": [0.5, 0.6], "minus": ["boat"]}],
  "fill": {"cut": ["boat", "near"]},
  "tracks": {"boat": {"plane": "boat"}}
}
```

`first` and `last` are the film frames on which the shot is on screen. `offset` is the source second shown on `first`. The frames step extracts only the pictures the edit shows: film frames that are multiples of `hold` (on twos by default), plus `first`, plus `handle` frames on both sides for the travel-through transitions. It writes `frames.json` with the list; pass it to `heldFrames` in the renderer.

For a 4K film, set `size` to 3840 × 2160. The colour frames are 4K; the analysis runs on 1920-wide copies. Analysis at 4K costs about four times as much for no visible gain.

Depth for footage is normalised over the whole shot and stabilised (each frame's scale and shift fitted to a running reference), so it does not breathe.

The tracker keeps a sliding window. A plain SAM 2 streaming session keeps every frame on the GPU; on an 18 GB Mac it reached 8 GB and swapped within a few hundred frames. SAM attends only to its prompted frames and its last few, so older ones are dropped, and memory stays flat (about 0.2 GB for a 192-frame test). When you change the tracker, pass each frame's index to the model: transformers numbers a streamed frame by the count of stored frames, which pruning keeps small, and the mask freezes.

## What the renderer reads

| Picture | Files | Source helper in `src/kit/depth` |
|---|---|---|
| A still painting | `<out>/color.jpg`, `<out>/<plane>.png`, `<out>/fill.jpg`, `<out>/fillmask.png`, `<out>/tracks.json` | `stillPlanes(dir)` |
| Footage | `<out>/frames/f0048.jpg`, `<out>/planes/<plane>/f0048.png`, `<out>/fill/f0048.jpg`, `<out>/fillmask/f0048.png`, `<out>/frames.json`, `<out>/tracks.json` | `footagePlanes(dir)` and `heldFrames` |

Plane masks and fill masks are white with the mask as alpha. `tracks.json` holds `{"<anchor>": {"<film frame>": {...}}}` in frame fractions: `x`, `y`, and `w`, `h`, `r`, `length`, `angle` depending on the measure. `trackLookup` and `anchorAt` read it.

## Place type from a marked wireframe

When a reviewer marks screenshots of a render with red text, place the type from them:

```sh
.venv/bin/python tools/depth/measure_font.py node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff
.venv/bin/python tools/depth/wireframe/register.py out/my-film.mp4 review/1.png review/2.png@14-18 --ignore-bottom 0.12
.venv/bin/python tools/depth/wireframe/measure.py register.json --cap-height 0.72
```

`register.py` finds each screenshot's frame and its mapping into the frame (SIFT features away from the red marks, a similarity transform fitted with `estimateAffinePartial2D`). `SHOT.png@A-B` limits the search to seconds A to B. On a pure pan or a still, neighbouring frames match equally well, so give a narrow window. `measure.py` groups the red letters into lines and maps each line's edges, top and baseline into the frame. Size = (baseline − top) ÷ cap height in em. It nudges any line inside the 10 % border just inside it.

`measure_font.py` prints a font's cap height, x-height, ascender and descender in em, measured from the letter outlines, and the advance width of any phrase you pass.

## The demo pictures

`public/demo/depth/` holds three generated paintings, each cut into planes with these tools from the jobs in `examples/`. `anchors.json` lists each scene's planes far to near and its anchors (lamps, a window, boats) with ellipses for oil focus and transitions. `PROVENANCE.md` records how the paintings were made.

## Check the result

After a render, measure held-frame steadiness per shot with [`tools/qa/steadiness.py`](../qa/README.md), and run `npm run qa -- out/my-film.mp4 --log out/my-film.log` for specs, loudness, a contact sheet and the SAFEAREA count from the render log.

## Machine limits

- Run one model job at a time. Two GPU jobs on a laptop slow each other down and can run out of memory.
- Try a new job on a short range or a crop first.
- Start long jobs as detached processes and let them resume: every step skips finished frames.
