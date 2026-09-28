"""A font's vertical metrics in em, and the advance width of phrases.

Type in a depth film is placed by its real ink box: the cap (or ascender) top and the descender bottom. The cap
height turns a measured letter height into a font size (size = cap height in px / cap height in em), and the
advance widths tell you how wide a line will set before you render it.

  .venv/bin/python tools/depth/measure_font.py FONT [phrase ...]
  .venv/bin/python tools/depth/measure_font.py node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff "A quiet harbour"

FONT is .ttf, .otf, .woff or .woff2 (woff2 needs the brotli package). The metrics come from the letters' outlines
(H for the cap height, x for the x-height, the tallest ascender and deepest descender of a-z), not from the font's
declared values, which some fonts set loosely. Widths ignore kerning.
"""
from __future__ import annotations

import json
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont


def main(argv: list[str]) -> None:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        raise SystemExit(0 if argv else 1)
    try:
        font = TTFont(argv[0])
    except ImportError as error:
        raise SystemExit(f"{argv[0]}: {error}. Install brotli (pip install brotli) or use the .woff file.")
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]

    def bounds(ch: str):
        name = cmap.get(ord(ch))
        if name is None:
            return None
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        return pen.bounds  # (xMin, yMin, xMax, yMax) or None

    def top(ch):
        b = bounds(ch)
        return b[3] / upm if b else None

    lower = [bounds(c) for c in "abcdefghijklmnopqrstuvwxyz"]
    metrics = {
        "unitsPerEm": upm,
        "capHeight": top("H"),
        "xHeight": top("x"),
        "ascender": max(b[3] for b in lower if b) / upm,
        "descender": min(b[1] for b in lower if b) / upm,
    }
    os2 = font["OS/2"] if "OS/2" in font else None
    if os2 is not None:
        metrics["declared"] = {"capHeight": getattr(os2, "sCapHeight", 0) / upm or None,
                               "ascender": os2.sTypoAscender / upm, "descender": os2.sTypoDescender / upm}
    print(json.dumps({k: (round(v, 4) if isinstance(v, float) else v) for k, v in metrics.items()}, indent=1))

    def width(s: str) -> float:
        return sum(hmtx[cmap[ord(c)]][0] if ord(c) in cmap else 0 for c in s) / upm

    for phrase in argv[1:]:
        missing = sorted({c for c in phrase if ord(c) not in cmap})
        note = f"  (not in the font: {''.join(missing)})" if missing else ""
        print(f"{width(phrase):7.3f} em  {phrase!r}{note}")


if __name__ == "__main__":
    main(sys.argv[1:])
