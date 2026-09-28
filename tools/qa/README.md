# QA tools

## Held-frame steadiness

`steadiness.py` measures how much a painted film boils. A film held on twos shows a new picture every second frame. Between two held pictures, the paint should change only as much as the subject and the camera do.

```sh
.venv/bin/python tools/qa/steadiness.py out/my-film.mp4 --shots "lake:0-118,room:158-222"
.venv/bin/python tools/qa/steadiness.py out/my-film.mp4 --reference out/previous.mp4 --shots "lake:0-118,room:158-222" --json out/steadiness.json
```

It needs Python 3 with `numpy` (the kit's `.venv` from the [depth tools](../depth/README.md#set-up) has it), and FFmpeg on your `PATH` (or `FFMPEG_BIN` and `FFPROBE_BIN`). With the environment active (`source .venv/bin/activate`), `npm run steadiness -- …` runs the same script.

For each shot it reports:

| Field | Meaning |
|---|---|
| `change` | Mean absolute change between consecutive held pictures, on a 480 × 270 copy (0–1) |
| `pop` | Share of pixels that change by more than 0.12 between held pictures |
| `ratio` | `change` divided by the reference render's, when you pass `--reference` |

Name the stretches between cuts in `--shots` (inclusive film frames). Leave the transitions out: they change on every frame by design. Pass `--hold 1` for a film that is not held.

Read the numbers against a reference, not on their own. A camera push or drifting mist raises `change` in any style. Render the same edit twice, for example once in watercolor and once in oil, or before and after a change, and compare. A ratio near 1.0 means the new version is as steady as the reference. A ratio above about 1.2 on a shot means its strokes jump between held pictures: look at that shot's frames side by side.

In `Painted-Depth`, oil measured 0.99–1.05 per shot against a watercolor render of the same edit, because its strokes sit on a seeded lattice in plane space and hold their positions across held frames. See [effects](../../docs/effects.md).
