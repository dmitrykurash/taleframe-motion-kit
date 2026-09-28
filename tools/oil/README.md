# Oil brushes

`brushes.py` draws the bristle brushes that the oil style of the paint engine uses. They are procedural and our own. No third-party brush image is used.

```sh
.venv/bin/python tools/oil/brushes.py                  # writes public/taleframe/oil/brushes/
.venv/bin/python tools/oil/brushes.py --out DIR --no-mips
```

You need Python 3 with `numpy` and `opencv-python-headless`; the kit's `.venv` from the [depth tools](../depth/README.md#set-up) has both. `npm run oil:brushes` runs the first command through `python3`, so activate the environment first (`source .venv/bin/activate`). The output is deterministic: the same seeds give the same pixels, so you only need to run it after you change the brush code.

| File | What it is |
| --- | --- |
| `0_small_h.png`, `2_large_h.png` | The two brushes the engine draws: small and large, bristles along x |
| `1_small_v.png`, `3_large_v.png` | The same brushes transposed, for an offline renderer that wants them |
| `*_m<k>.png` | Box-filtered mip levels, for an offline renderer that must match a mip pyramid exactly |
| `brushes.json` | Sizes, files, mean luminance and coverage of each brush |

Each PNG stores the bristle luminance in red and the coverage mask in green. The engine builds its own mipmaps on the GPU, so it only reads the two full-size horizontal brushes.

The brush design: clumped bristles with ragged ends, a loaded start and a drier end, soft tips. There are no dry-brush holes (over darker paint they read as dark specks) and no dark rim (under the soft mask edge, the luminance is bled to the stroke's mean). See [effects](../../docs/effects.md#paint-in-oil) for how the stroke uses them.
