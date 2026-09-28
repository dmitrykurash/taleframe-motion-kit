"""Step 5: anchor tracks, the points transitions centre on and match cuts line up on.

  <out>/tracks.json   {"<anchor>": {"<film frame>": {...} | null}}  (null where nothing was found)

Every value is in frame fractions: x and w of the width, y and h of the height, r and length of the height, angle
in radians. The renderer's anchor lookup returns the nearest measured frame.

Each entry of the job's "tracks" object measures one anchor inside a plane, a subject's matte or a region:

  {"plane": "boat"}                              pose: centroid, principal angle, length and bounding size
  {"matte": "lantern", "measure": "bright"}      the brightest blob (a lamp, a lit window): centre and radius
  {"region": [u0, v0, u1, v1], "measure": "bright"}
  {"plane": "sail", "measure": "color", "hsv": [[h0, h1], [s0, s1], [v0, v1]]}
                                                 the largest blob of a colour (OpenCV HSV: hue 0-179)

"bright" takes the pixels above the given percentile of luminance ("percentile", default 99.5) inside the area.

  .venv/bin/python tools/depth/tracks.py JOB.json
"""
from __future__ import annotations

import json
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import cv2
import numpy as np

from common import Job, fail, load_job_arg, luma, read_alpha, soft_region


def area_of(job: Job, spec: dict, f: int) -> np.ndarray:
    a = np.ones(job.analysis_size[::-1], np.float32)
    if "plane" in spec:
        p = read_alpha(job.plane_path(spec["plane"], f))
        if p is None:
            fail(f"{job.name}: no plane {spec['plane']} on frame {f}; run the planes step first")
        a *= cv2.resize(p, job.analysis_size) if p.shape[::-1] != job.analysis_size else p
    if "matte" in spec:
        a *= job.matte(spec["matte"], f)
    if "region" in spec:
        a *= soft_region(job.analysis_size, spec["region"], 0)
    return a


def pose(job: Job, a: np.ndarray) -> dict | None:
    ys, xs = np.nonzero(a > .5)
    if len(xs) < 50:
        return None
    w, h = job.analysis_size
    pts = np.stack([xs, ys], 1).astype(np.float64)
    c = pts.mean(0)
    vals, vecs = np.linalg.eigh(np.cov((pts - c).T))
    axis = vecs[:, int(np.argmax(vals))]
    if axis[0] < 0:
        axis = -axis
    proj = (pts - c) @ axis
    length = np.percentile(proj, 99.5) - np.percentile(proj, .5)
    return {"x": round(float(c[0]) / w, 5), "y": round(float(c[1]) / h, 5), "angle": round(float(np.arctan2(axis[1], axis[0])), 4),
            "length": round(float(length) / h, 5), "w": round(float(xs.max() - xs.min()) / w, 5),
            "h": round(float(ys.max() - ys.min()) / h, 5)}


def blob(job: Job, hit: np.ndarray) -> dict | None:
    hit = cv2.morphologyEx(hit.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, _, stats, cent = cv2.connectedComponentsWithStats(hit)
    if n <= 1:
        return None
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    w, h = job.analysis_size
    r = np.sqrt(stats[k, cv2.CC_STAT_AREA] / np.pi)
    return {"x": round(float(cent[k][0]) / w, 5), "y": round(float(cent[k][1]) / h, 5), "r": round(float(r) / h, 5)}


def measure(job: Job, spec: dict, f: int) -> dict | None:
    a = area_of(job, spec, f)
    kind = spec.get("measure", "pose")
    if kind == "pose":
        return pose(job, a)
    bgr = job.analysis(f)
    inside = a > .5
    if not inside.any():
        return None
    if kind == "bright":
        grey = cv2.GaussianBlur(luma(bgr), (0, 0), 2 * job.unit)
        level = np.percentile(grey[inside], float(spec.get("percentile", 99.5)))
        return blob(job, (grey >= level) & inside)
    if kind == "color":
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(int)
        (h0, h1), (s0, s1), (v0, v1) = spec["hsv"]
        hue = (hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) if h0 <= h1 else (hsv[..., 0] >= h0) | (hsv[..., 0] <= h1)
        hit = hue & (hsv[..., 1] >= s0) & (hsv[..., 1] <= s1) & (hsv[..., 2] >= v0) & (hsv[..., 2] <= v1) & inside
        return blob(job, hit)
    fail(f"{job.path}: measure must be pose, bright or color, not {kind!r}")


def run(job: Job) -> None:
    if not job.tracks:
        print(f"{job.name}: no tracks in the job")
        return
    frames = job.frames()
    out = {name: {str(f): measure(job, spec, f) for f in frames} for name, spec in job.tracks.items()}
    (job.out / "tracks.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
    for name, values in out.items():
        found = [v for v in values.values() if v]
        print(f"{job.name}: track {name}: {len(found)}/{len(frames)} frames" + (f", first {found[0]}" if found else ""))


if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    run(job)
