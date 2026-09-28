"""Register marked screenshots to a render: where in the video, and where in the frame, is each screenshot?

A reviewer marks screenshots of a render with red text ("this line here, this big"). To place type from them,
first find each screenshot's frame and its mapping into the frame: SIFT features (away from the red text and from
player controls) matched against frames of the render, and a similarity transform (scale, rotation, shift)
fitted with RANSAC (OpenCV estimateAffinePartial2D). The frame with the most inliers wins.

  .venv/bin/python tools/depth/wireframe/register.py RENDER.mp4 SHOT.png [SHOT.png@12.5-14 ...] [--out register.json]
         [--step 0.25] [--ignore-bottom 0.12] [--width 1920]

SHOT.png@A-B limits the search to seconds A..B of the render (faster, and safer when scenes repeat).
--ignore-bottom drops features in the bottom fraction of the screenshot (a video player's controls).

register.json: {"<screenshot>": {"t": seconds, "inliers": n, "scale": s, "rotation": degrees, "tx": px, "ty": px,
"frame": [W, H]}}; a screenshot pixel (x, y) lands at (scale·x + tx, scale·y + ty) in frame pixels (rotation ≈ 0
for a screenshot). Check "inliers": below ~30 the match is doubtful.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ml"))
import mlcommon  # noqa: E402


def red_mask(bgr: np.ndarray, lo: int = 150, hi: int = 100) -> np.ndarray:
    b, g, r = (bgr[..., i].astype(int) for i in range(3))
    return ((r > lo) & (g < hi) & (b < hi)).astype(np.uint8)


def parse_shot(arg: str, duration: float):
    if "@" in arg:
        path, span = arg.rsplit("@", 1)
        a, b = (float(v) for v in span.split("-"))
        return Path(path), a, b
    return Path(arg), 0.0, duration


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("shots", nargs="+")
    ap.add_argument("--out", default="register.json")
    ap.add_argument("--step", type=float, default=0.25, help="seconds between the frames compared")
    ap.add_argument("--ignore-bottom", type=float, default=0.0)
    ap.add_argument("--width", type=int, default=1920, help="decode width for matching (results are in full frame px)")
    a = ap.parse_args()

    info = mlcommon.probe(a.video)
    W, H = info["w"], info["h"]
    dw = min(a.width, W)
    k = W / dw  # decoded px -> frame px
    sift = cv2.SIFT_create(nfeatures=4000)
    out = {}
    for arg in a.shots:
        path, t0, t1 = parse_shot(arg, info["duration"] or 1e9)
        shot = cv2.imread(str(path))
        if shot is None:
            raise SystemExit(f"Cannot read {path}")
        keep = (cv2.dilate(red_mask(shot), np.ones((25, 25), np.uint8)) == 0).astype(np.uint8) * 255
        if a.ignore_bottom > 0:
            keep[int(shot.shape[0] * (1 - a.ignore_bottom)):] = 0
        k1, d1 = sift.detectAndCompute(cv2.cvtColor(shot, cv2.COLOR_BGR2GRAY), keep)
        if d1 is None:
            raise SystemExit(f"{path}: no features outside the red marks")
        best = None
        # Decode every frame (exact times; the fps filter would shift them by up to half a step) and compare every
        # n-th one.
        every = max(1, round(a.step * info["fps"]))
        frames = mlcommon.read_frames(a.video, t0, t1 - t0, None, dw)
        for i, rgb in enumerate(frames):
            if i % every:
                continue
            t = t0 + i / info["fps"]
            k2, d2 = sift.detectAndCompute(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), None)
            if d2 is None:
                continue
            pairs = cv2.BFMatcher(cv2.NORM_L2).knnMatch(d1, d2, k=2)
            good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < .75 * p[1].distance]
            if len(good) < 12:
                continue
            src = np.float32([k1[g.queryIdx].pt for g in good])
            dst = np.float32([k2[g.trainIdx].pt for g in good])
            M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
            if M is None:
                continue
            n = int(inliers.sum())
            if best is None or n > best[0]:
                best = (n, t, M)
        if best is None:
            print(f"{path.name}: no match", flush=True)
            out[path.name] = None
            continue
        n, t, M = best
        out[path.name] = {"t": round(t, 3), "inliers": n, "scale": float(np.hypot(M[0, 0], M[1, 0])) * k,
                          "rotation": round(float(np.degrees(np.arctan2(M[1, 0], M[0, 0]))), 3),
                          "tx": float(M[0, 2]) * k, "ty": float(M[1, 2]) * k, "frame": [W, H],
                          "image": str(path)}
        print(path.name, json.dumps(out[path.name]), flush=True)
    Path(a.out).write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
