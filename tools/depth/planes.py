"""Step 4: plane masks and the filled plate, for every held frame.

Still:   <out>/<plane>.png      Footage: <out>/planes/<plane>/f####.png    white RGB + the plane's alpha
         <out>/fill.jpg                  <out>/fill/f####.jpg              the plate with the cut-out planes filled
         <out>/fillmask.png              <out>/fillmask/f####.png          where the fill replaces the picture
         <work>/planes-preview.jpg       the planes tinted over the middle held frame

The job's "planes" list builds each plane from factors that multiply (at least one):

  "matte": "boat"               a subject from the mattes step (its weak interior firmed up)
  "depth": [lo, hi]             nearer than: 0 below lo, 1 above hi (depth 1 = near), snapped to the picture's edges
  "until": [lo, hi]             and not nearer than this (a band: a mist bank, a far treeline)
  "luma": "bright" | "dark"     a soft luminance key against the local surroundings: mist and haze banks ("bright")
                                or dark cloud bodies ("dark"); tune with "contrast" [a, b], "level" [a, b], "local"
                                (px at 1080p, default 60)
  "region": [u0, v0, u1, v1]    a soft rectangle; "feather" in fractions of the frame height (default 0.03)

then "plus": [planes] (union), "minus": [planes] (cut out nearer planes), "snap": guided-filter radius for depth
(px at 1080p, default 10), and "write": false for a helper plane that other planes use but the renderer does not.
Planes may only refer to planes listed before them.

The job's "fill" object:

  "cut":  [planes]    removed from the plate and filled with a push-pull wash of their surroundings, so parallax
                      never reveals a hole or a ghost of the subject
  "keep": [planes or subjects]    stay in the plate even where a cut plane's fill would cover them (a subject whose
                      matte is imperfect, or one that sits at the sky's depth); "keepGrow" widens them
                      (fraction of the frame height, default 0.04)

A frame that is done is skipped (a marker in <work>/planes-done/); delete it, or pass --force, to rebuild.

  .venv/bin/python tools/depth/planes.py JOB.json [--force]
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import cv2
import numpy as np

from common import (Job, fail, fill_region, firm, guided, load_job_arg, luma, overlay, smoothstep, soft_region,
                    write_alpha, write_jpeg)


def depth_band(job: Job, f: int, lo: float, hi: float, grey: np.ndarray, snap: float) -> np.ndarray:
    a = smoothstep(lo, hi, job.depth(f))
    if snap > 0:
        a = guided(grey, a, r=max(1, round(snap * job.unit)), eps=2e-3)
    return np.clip(smoothstep(.2, .8, a), 0, 1)


def luma_key(grey: np.ndarray, spec: dict, unit: float) -> np.ndarray:
    key = spec["luma"]
    base = cv2.GaussianBlur(grey, (0, 0), 3 * unit)
    local = cv2.GaussianBlur(grey, (0, 0), float(spec.get("local", 60)) * unit)
    if key == "dark":
        c0, c1 = spec.get("contrast", [.06, -.12])
        l0, l1 = spec.get("level", [.72, .38])
        a = smoothstep(c0, c1, base - local * .92) * smoothstep(l0, l1, base)
    elif key == "bright":
        c0, c1 = spec.get("contrast", [-.01, .08])
        l0, l1 = spec.get("level", [.42, .72])
        a = smoothstep(c0, c1, base - local) * smoothstep(l0, l1, base)
    else:
        fail(f"luma must be \"bright\" or \"dark\", not {key!r}")
    return cv2.GaussianBlur(a, (0, 0), 2.5 * unit)


def build_plane(job: Job, spec: dict, f: int, bgr: np.ndarray, grey: np.ndarray, done: dict) -> np.ndarray:
    name = spec["name"]
    a, factors = np.ones(grey.shape, np.float32), 0
    if "matte" in spec:
        a *= firm(job.matte(spec["matte"], f), job.unit)
        factors += 1
    if "depth" in spec:
        a *= depth_band(job, f, *spec["depth"], grey, float(spec.get("snap", 10)))
        factors += 1
    if "until" in spec:
        a *= 1 - depth_band(job, f, *spec["until"], grey, float(spec.get("snap", 10)))
        factors += 1
    if "luma" in spec:
        a *= luma_key(grey, spec, job.unit)
        factors += 1
    if "region" in spec:
        a *= soft_region(job.analysis_size, spec["region"], float(spec.get("feather", .03)))
        factors += 1
    if not factors:
        fail(f"{job.path}: plane {name} needs matte, depth, until, luma or region")

    def other(n: str) -> np.ndarray:
        if n not in done:
            fail(f"{job.path}: plane {name} refers to {n}, which is not a plane listed before it")
        return done[n]

    for n in spec.get("plus", []):
        a = np.maximum(a, other(n))
    for n in spec.get("minus", []):
        a = a * (1 - other(n))
    return np.clip(a, 0, 1).astype(np.float32)


def keep_region(job: Job, names: list[str], f: int, planes: dict) -> np.ndarray:
    region = np.zeros(job.analysis_size[::-1], np.float32)
    for n in names:
        if n in planes:
            a = planes[n]
        elif n in job.subjects:
            a = job.matte(n, f)
        else:
            fail(f"{job.path}: fill.keep names {n}, which is neither a plane nor a subject")
        region = np.maximum(region, a)
    grow = float(job.fill.get("keepGrow", .04)) * job.analysis_size[1]
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * round(grow) + 1,) * 2)
    region = cv2.dilate((region > .03).astype(np.float32), k)
    return np.clip(cv2.GaussianBlur(region, (0, 0), max(1., grow / 7)), 0, 1)


def run(job: Job, force: bool = False) -> None:
    frames = job.frames()
    cut, keep = list(job.fill.get("cut", [])), list(job.fill.get("keep", []))
    unknown = set(cut) - {p["name"] for p in job.planes}
    if unknown:
        fail(f"{job.path}: fill.cut names {', '.join(sorted(unknown))}, which are not planes")
    written = [p["name"] for p in job.planes if p.get("write", True)]
    preview_frame = frames[len(frames) // 2]
    built = 0
    for f in frames:
        marker = job.work / "planes-done" / job.tag(f)
        done = marker.exists() and not force
        if done and f != preview_frame:
            continue
        bgr = job.analysis(f)
        grey = luma(bgr)
        planes: dict[str, np.ndarray] = {}
        for spec in job.planes:
            planes[spec["name"]] = build_plane(job, spec, f, bgr, grey, planes)
        if f == preview_frame:
            write_jpeg(job.work / "planes-preview.jpg", overlay(bgr, {n: planes[n] for n in written}))
        if done:
            continue
        for name in written:
            write_alpha(job.plane_path(name, f), planes[name])
        if cut:
            region = np.max(np.stack([planes[n] for n in cut]), 0)
            img, mask = fill_region(bgr, region, job.unit)
            if keep:
                mask = mask * (1 - keep_region(job, keep, f, planes))
            write_jpeg(job.fill_path(f), img, int(job.data.get("fillQuality", 88)))
            write_alpha(job.fillmask_path(f), mask)
        marker.parent.mkdir(parents=True, exist_ok=True)
        marker.touch()
        built += 1
        if len(frames) > 1:
            print(f"\r{job.name}: planes {built} frames", end="", flush=True)
    if built and len(frames) > 1:
        print()
    print(f"{job.name}: planes for {len(frames)} held frames ({built} built); preview {job.work / 'planes-preview.jpg'}")


if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    run(job, force="--force" in rest)
