"""Procedural bristle brushes for the oil style of the Taleframe paint engine.

These brushes are our own, drawn from code. No third-party brush image is used or shipped.

Four brushes, as in the oil renderer of Stylized Neural Painting (Zou et al., CVPR 2021): small and large, each
horizontal and vertical. Each is a PNG with R = bristle luminance L and G = coverage mask M (soft edges), B = 0.
Horizontal brushes lay their bristles along the texture's x axis; vertical ones are the same brush transposed.
A transparent margin keeps every box-filtered mip level zero at the border, so a renderer can clamp to the edge.

The engine uses the two horizontal brushes and builds its own mip chain on the GPU. The mip files
(level k = 2 x 2 box average of level k - 1) are for an offline renderer that must sample exactly the same pyramid;
skip them with --no-mips.

The output is deterministic: the same seeds give the same pixels.

  .venv/bin/python tools/oil/brushes.py                  -> public/taleframe/oil/brushes/<id>.png, <id>_m<k>.png, brushes.json
  .venv/bin/python tools/oil/brushes.py --out DIR --no-mips
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public" / "taleframe" / "oil" / "brushes"
SIZES = {"small": (512, 256), "large": (1024, 1024)}  # width x height of the horizontal variant
MARGIN = {"small": 32, "large": 64}
BRUSHES = [("0_small_h", "small", False, 11), ("1_small_v", "small", True, 12),
           ("2_large_h", "large", False, 21), ("3_large_v", "large", True, 22)]


def smooth_noise(n, period, rng):
    """1-D value noise with the given period (texels), values in [0, 1]."""
    k = max(2, int(np.ceil(n / period)) + 2)
    pts = rng.random(k)
    x = np.arange(n) / period
    i = np.floor(x).astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return pts[i] * (1 - f) + pts[i + 1] * f


def bristles(W, H, margin, seed):
    """Bristles along x: returns (L, M) float32 [H, W].

    Bristles come in clumps (shared tone and end positions, as a loaded brush parts), each bristle 1-4 texels thick
    (scaled with the brush). The stroke starts loaded (brighter, solid) and runs drier towards its end, where the
    bristles thin out. There are no dry-brush holes: over darker paint they read as dark specks."""
    rng = np.random.default_rng(seed)
    L = np.zeros((H, W), np.float32)
    M = np.zeros((H, W), np.float32)
    x = np.arange(W, dtype=np.float32)
    inner_w, inner_h = W - 2 * margin, H - 2 * margin
    u = np.clip((x - margin) / inner_w, 0, 1)                     # 0 at the stroke's start, 1 at its end
    k = max(1, int(round(inner_h / 320)))                          # bristle scale (texels) for this brush size
    y = margin
    while y < H - margin:
        n = int(rng.integers(2, 6))
        tone_c = rng.uniform(.9, 1.0)
        a0_c, a1_c = rng.uniform(0, .06), rng.uniform(0, .10)
        for _ in range(n):
            if y >= H - margin:
                break
            th = int(rng.integers(1, 4)) * k
            y1 = min(H - margin, y + th)
            v = (y + y1) / 2 - margin
            edge = min(v, inner_h - v) / inner_h                   # 0 at the stroke's sides, .5 in the middle
            side = np.clip(edge / .18, 0, 1)
            x0 = margin + (1 - side) * rng.uniform(.05, .18) * W + (a0_c + rng.uniform(0, .015)) * W
            x1 = W - margin - (1 - side) * rng.uniform(.05, .2) * W - (a1_c + rng.uniform(0, .025)) * W
            ramp = rng.uniform(.03, .07) * W
            env = np.clip((x - x0) / ramp, 0, 1) * np.clip((x1 - x) / ramp, 0, 1)
            tone = tone_c * rng.uniform(.97, 1.0) * (1 - .04 * smooth_noise(W, W / 2.5, rng))
            presence = (.6 + .4 * side) * rng.uniform(.9, 1.0)
            L[y:y1] = np.maximum(L[y:y1], (tone * env)[None, :])
            M[y:y1] = np.maximum(M[y:y1], (env * presence)[None, :])
            y = y1
        y += k if rng.random() < .2 else 0                        # an occasional parting between clumps
    # Paint load: solid and a touch brighter where the stroke starts, thinner towards its end.
    L *= (1.03 - .07 * u)[None, :]
    M *= (1.0 - .22 * u ** 3)[None, :]
    # The body fills in between the bristles. The texture lives in the luminance, never in a dark rim: where the
    # mask fades out, the luminance is the stroke's own mean (a fading edge must not read as an outline).
    body = cv2.GaussianBlur(M, (0, 0), 2.2 * k)
    M = np.clip(np.maximum(M, body * 1.3), 0, 1)
    M = cv2.GaussianBlur(M, (0, 0), sigmaX=1.2 * k, sigmaY=2.2 * k)   # soft alpha: bristle tips merge into a ragged edge
    Lf = np.maximum(L, cv2.GaussianBlur(L, (0, 0), 1.5 * k) * .985)
    mean = float((Lf * (M > .5)).sum() / max((M > .5).sum(), 1))
    w = np.clip((M - .15) / .55, 0, 1)
    # Outside the mask the luminance is bled to the mean too: filtering (mips, bilinear taps) then never pulls a dark
    # fringe into the stroke's soft edge.
    L = np.where(M > .02, Lf * w + mean * (1 - w), mean).astype(np.float32)
    # Guarantee the transparent margin.
    M[:margin], M[-margin:], M[:, :margin], M[:, -margin:] = 0, 0, 0, 0
    return L.astype(np.float32), M.astype(np.float32)


def mips(img):
    out = [img]
    while min(out[-1].shape[:2]) > 1:
        a = out[-1]
        h, w = a.shape[:2]
        a = a[: h - h % 2, : w - w % 2]
        out.append(a.reshape(h // 2, 2, w // 2, 2, *a.shape[2:]).mean((1, 3)))
    return out


def write_png(path, rg):
    """R = luminance, G = mask, B = 0 (cv2 writes BGR). Maximum PNG compression keeps the files small."""
    h, w = rg.shape[:2]
    px = np.zeros((h, w, 3), np.uint8)
    px[..., 2] = np.clip(rg[..., 0] * 255 + .5, 0, 255)
    px[..., 1] = np.clip(rg[..., 1] * 255 + .5, 0, 255)
    if not cv2.imwrite(str(path), px, [cv2.IMWRITE_PNG_COMPRESSION, 9]):
        raise SystemExit(f"cannot write {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help="output folder (default: public/taleframe/oil/brushes in the kit)")
    parser.add_argument("--no-mips", action="store_true", help="write only the full-size brushes")
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    meta = []
    for name, kind, vertical, seed in BRUSHES:
        W, H = SIZES[kind]
        L, M = bristles(W, H, MARGIN[kind], seed)
        if vertical:
            L, M = L.T.copy(), M.T.copy()
        rg = np.dstack([L, M]).astype(np.float32)
        levels = [rg] if args.no_mips else mips(rg)
        files = []
        for k, lv in enumerate(levels):
            f = f"{name}.png" if k == 0 else f"{name}_m{k}.png"
            write_png(out / f, lv)
            files.append(f)
        meta.append({"id": name, "size": [int(rg.shape[1]), int(rg.shape[0])], "mips": files,
                     "meanL": round(float((L * M).sum() / max(M.sum(), 1e-6)), 6),
                     "coverage": round(float(M.mean()), 6)})
        print(name, rg.shape[1], "x", rg.shape[0], "files", len(files), "mean L", round(meta[-1]["meanL"], 3))
    (out / "brushes.json").write_text(json.dumps({"version": 1, "brushes": meta}, indent=1) + "\n")
    print("wrote", out)


if __name__ == "__main__":
    main()
