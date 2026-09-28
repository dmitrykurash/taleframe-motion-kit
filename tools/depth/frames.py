"""Step 1: the pictures a shot shows.

Still:   <out>/color.jpg              the painting, cover-scaled and centre-cropped to "size"
Footage: <out>/frames/f####.jpg       the held source frame shown on each film frame (on twos by default), at "size"
         <out>/frames.json            {"first", "last", "hold", "frames": [film frames], "sourceFrames": {film: source}}
         <work>/proxy/f####.jpg       1920-wide copies for the analysis steps, when "size" is wider

Footage settings (the "footage" object of the job):
  file     the clip
  first    the film frame on which the shot starts (on screen), last: the last film frame on screen
  offset   source seconds shown on film frame `first` (default 0)
  hold     film frames per held picture (2 = on twos; the renderer holds frames that are multiples of it)
  handle   extra film frames on both sides for the travel-through transitions (default 26, about a second)

Only the film frames the edit shows get a picture: multiples of `hold`, plus `first` when it is not one. A frame that
already exists is kept, so an interrupted run continues where it stopped. After changing `offset` or `size`, run with
--force: it deletes the extracted frames and their proxies and extracts every frame again (a run without it stops
when the settings no longer match the frames on disk).

  .venv/bin/python tools/depth/frames.py JOB.json [--force]
"""
from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import cv2
import numpy as np

from common import Job, fail, load_job_arg, mlcommon, write_jpeg


def cover(bgr: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    """Scale to cover `size`, then crop the centre."""
    w, h = size
    s = max(w / bgr.shape[1], h / bgr.shape[0])
    sw, sh = max(w, round(bgr.shape[1] * s)), max(h, round(bgr.shape[0] * s))
    interp = cv2.INTER_AREA if s < 1 else cv2.INTER_LANCZOS4
    big = cv2.resize(bgr, (sw, sh), interpolation=interp)
    x, y = (sw - w) // 2, (sh - h) // 2
    return big[y:y + h, x:x + w]


def still(job: Job) -> None:
    src = job.data["still"]
    out = job.color_path(0)
    bgr = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if bgr is None:
        fail(f"Cannot read the still {src}")
    if out.resolve() == Path(src).resolve():
        if (bgr.shape[1], bgr.shape[0]) != job.size:
            fail(f"{job.name}: the still is the output file but not {job.size[0]}x{job.size[1]}; point \"still\" at "
                 "the original picture")
        print(f"{job.name}: {out} is the source and already {job.size[0]}x{job.size[1]}")
        return
    write_jpeg(out, cover(bgr, job.size), int(job.data.get("quality", 90)))
    print(f"{job.name}: {out}")


def count_frames(path: str) -> int:
    info = mlcommon.probe(path)
    if info["frames"]:
        return info["frames"]
    out = subprocess.check_output([mlcommon.tool("ffprobe"), "-v", "error", "-select_streams", "v:0", "-count_packets",
                                   "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", str(path)])
    return int(out.strip())


def plan(job: Job) -> tuple[dict, list[tuple[int, int]]]:
    ft = job.data["footage"]
    for key in ("file", "first", "last"):
        if key not in ft:
            fail(f"{job.path}: footage.{key} is required")
    first, last = int(ft["first"]), int(ft["last"])
    hold, handle, offset = int(ft.get("hold", 2)), int(ft.get("handle", 26)), float(ft.get("offset", 0))
    if last < first or hold < 1 or handle < 0:
        fail(f"{job.path}: footage needs first <= last, hold >= 1 and handle >= 0")
    info = mlcommon.probe(ft["file"])
    n = count_frames(ft["file"])

    def source(f: int) -> int:
        return math.floor((offset + (f - first) / job.fps) * info["fps"] + 1e-6)

    lo, hi = max(0, first - handle), last + handle
    pairs = [(f, source(f)) for f in range(lo, hi + 1) if (f % hold == 0 or f == first) and 0 <= source(f) < n]
    if not pairs:
        fail(f"{job.name}: no source frames fall inside the clip; check footage.offset and the clip length")
    meta = {"first": first, "last": last, "hold": hold, "frames": [f for f, _ in pairs],
            "sourceFrames": {str(f): k for f, k in pairs}, "sourceFps": info["fps"], "size": list(job.size)}
    return meta, pairs


def runs(uniq: list[int]) -> list[str]:
    """Sorted source frame numbers as select terms; arithmetic runs become between()*not(mod())."""
    terms, i = [], 0
    while i < len(uniq):
        j = i + 1
        if j < len(uniq):
            step = uniq[j] - uniq[i]
            while j + 1 < len(uniq) and uniq[j + 1] - uniq[j] == step:
                j += 1
            if j - i >= 3 and step > 0:
                terms.append(f"between(n\\,{uniq[i]}\\,{uniq[j]})*not(mod(n-{uniq[i]}\\,{step}))")
                i = j + 1
                continue
        terms.append(f"eq(n\\,{uniq[i]})")
        i += 1
    return terms


def footage(job: Job, force: bool = False) -> None:
    meta, pairs = plan(job)
    index = job.out / "frames.json"
    if force:
        # Start again from the clip: frames from another offset, size or hold must not survive.
        shutil.rmtree(job.out / "frames", ignore_errors=True)
        shutil.rmtree(job.work / "proxy", ignore_errors=True)
    elif index.exists():
        old = json.loads(index.read_text())
        moved = [f for f, k in pairs if str(f) in old.get("sourceFrames", {}) and old["sourceFrames"][str(f)] != k]
        if old.get("size") != meta["size"] or moved:
            fail(f"{job.name}: the footage settings changed since the frames were extracted; run the frames step with "
                 "--force (and redo the later steps)")
    todo = [(f, k) for f, k in pairs if not job.color_path(f).exists()]
    if todo:
        uniq = sorted(set(k for _, k in todo))
        tmp = job.work / "extract"
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
        w, h = job.size
        vf = f"select='{'+'.join(runs(uniq))}',scale={w}:{h}:flags=lanczos:force_original_aspect_ratio=increase,crop={w}:{h}"
        subprocess.check_call([mlcommon.tool("ffmpeg"), "-v", "error", "-y", "-i", str(job.data["footage"]["file"]),
                               "-vf", vf, "-fps_mode", "passthrough", "-q:v", "2", str(tmp / "%05d.jpg")])
        got = sorted(tmp.glob("*.jpg"))
        if len(got) != len(uniq):
            fail(f"{job.name}: expected {len(uniq)} source frames, ffmpeg wrote {len(got)}")
        by_source = dict(zip(uniq, got))
        for f, k in todo:
            dst = job.color_path(f)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(by_source[k], dst)
        shutil.rmtree(tmp, ignore_errors=True)
    if job.analysis_size != job.size:
        for f, _ in pairs:
            p = job.proxy_path(f)
            if not p.exists():
                write_jpeg(p, cv2.resize(cv2.imread(str(job.color_path(f))), job.analysis_size,
                                         interpolation=cv2.INTER_AREA), 95)
    index.write_text(json.dumps(meta, indent=1) + "\n")
    print(f"{job.name}: {len(pairs)} held frames {pairs[0][0]}..{pairs[-1][0]} ({len(todo)} new)")


def run(job: Job, force: bool = False) -> None:
    """A still is always written again from its source; footage keeps its frames unless `force`."""
    job.out.mkdir(parents=True, exist_ok=True)
    if job.kind == "still":
        still(job)
    else:
        footage(job, force)


if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    run(job, force="--force" in rest)
