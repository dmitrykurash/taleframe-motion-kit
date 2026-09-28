"""Measure the red text on registered screenshots: where each marked line goes in the frame, and how big.

Run register.py first. Each red line's letters are grouped into a line; its left and right edges, its top (the
tallest letter) and its baseline (the median letter bottom) are mapped into frame pixels. The type size follows
from the font's cap height:

    size = (baseline - top) / capHeight        (capHeight in em, from measure_font.py)

A line whose tallest letter is an ascender (l, d, h) rather than a capital should use the ascender height instead
(--cap-height). Any box inside the 10 % border is nudged just inside it and marked "nudged".

  .venv/bin/python tools/depth/wireframe/measure.py register.json --cap-height 0.66 [--out lines.json] [--safe 0.1]

lines.json: {"<screenshot>": [{"x0", "x1", "top", "baseline", "size", "u0", "v0", "u1", "v1", "nudged"}, ...]}
in frame pixels, plus the box in frame fractions (u, v).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def red_mask(bgr: np.ndarray) -> np.ndarray:
    b, g, r = (bgr[..., i].astype(int) for i in range(3))
    red = ((r > 150) & (g < 100) & (b < 100)).astype(np.uint8)
    return cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def lines_of(red: np.ndarray, min_area: int = 25, min_ink: int = 2000) -> list[dict]:
    n, _, st, _ = cv2.connectedComponentsWithStats(red, 8)
    comps = [dict(x0=st[k, 0], y0=st[k, 1], x1=st[k, 0] + st[k, 2], y1=st[k, 1] + st[k, 3], a=st[k, 4])
             for k in range(1, n) if st[k, 4] > min_area]
    comps.sort(key=lambda c: (c["y0"] + c["y1"]) / 2)
    lines: list[dict] = []
    for c in comps:
        cy = (c["y0"] + c["y1"]) / 2
        for L in lines:
            c0, c1 = L["core"]
            reach = 3.5 * (c1 - c0)
            if c0 - 8 <= cy <= c1 + 8 and c["x0"] < L["x1"] + reach and c["x1"] > L["x0"] - reach:
                L["c"].append(c)
                L["x0"], L["x1"] = min(L["x0"], c["x0"]), max(L["x1"], c["x1"])
                break
        else:
            lines.append({"c": [c], "x0": c["x0"], "x1": c["x1"], "core": (c["y0"], c["y1"])})
        for L in lines:  # the core band: median top to median bottom of the larger letters
            big = [q for q in L["c"] if q["a"] > 200] or L["c"]
            L["core"] = (float(np.median([q["y0"] for q in big])), float(np.median([q["y1"] for q in big])))
    out = []
    for L in sorted(lines, key=lambda L: (L["core"][0], L["x0"])):
        cs = L["c"]
        if sum(q["a"] for q in cs) < min_ink:
            continue
        letters = [q["y1"] for q in cs if q["a"] > 150] or [q["y1"] for q in cs]
        out.append({"x0": L["x0"], "x1": L["x1"], "top": min(q["y0"] for q in cs), "baseline": float(np.median(letters))})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("register")
    ap.add_argument("--cap-height", type=float, required=True, help="the font's cap height in em")
    ap.add_argument("--out", default="lines.json")
    ap.add_argument("--safe", type=float, default=0.1, help="type-free border, fraction of the frame")
    a = ap.parse_args()
    reg = json.loads(Path(a.register).read_text())
    out = {}
    for name, R in reg.items():
        if not R:
            continue
        shot = cv2.imread(R["image"])
        if shot is None:
            raise SystemExit(f"Cannot read {R['image']}")
        s, tx, ty = R["scale"], R["tx"], R["ty"]
        W, H = R["frame"]
        res = []
        for L in lines_of(red_mask(shot)):
            x0, x1 = L["x0"] * s + tx, L["x1"] * s + tx
            top, base = L["top"] * s + ty, L["baseline"] * s + ty
            size = (base - top) / a.cap_height
            # Keep the whole ink box (cap top to a descender below the baseline) inside the border.
            bottom = base + .25 * size
            dx = max(0, a.safe * W - x0) - max(0, x1 - (1 - a.safe) * W)
            dy = max(0, a.safe * H - top) - max(0, bottom - (1 - a.safe) * H)
            x0, x1, top, base = x0 + dx, x1 + dx, top + dy, base + dy
            res.append({"x0": round(x0), "x1": round(x1), "top": round(top), "baseline": round(base),
                        "size": round(float(size), 1), "u0": round(float(x0) / W, 4), "v0": round(float(top) / H, 4),
                        "u1": round(float(x1) / W, 4), "v1": round(float(base + .25 * size) / H, 4),
                        "nudged": [round(dx), round(dy)] if dx or dy else None})
        out[name] = res
        print(name, f"t={R['t']}")
        for L in res:
            print("   ", L)
    Path(a.out).write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
