"""Step 2: a depth map for every held frame (Depth Anything V2).

  <work>/depth/f####.png      16-bit gray at half the analysis size, 1 = near, normalised over the whole shot
  <work>/depth-preview.jpg    the middle held frame beside its depth, to choose the plane bands

The maps are normalised per shot, not per frame, so a band like [0.46, 0.56] means the same distance on every
frame. Footage is also stabilised: each frame's scale and shift are fitted to a running reference, so the depth of
a moving shot does not breathe. The printed percentiles help you choose band edges.

Job settings ("depth" object): variant ("small", the default, Apache-2.0; "base" and "large" are sharper but
CC BY-NC 4.0, non-commercial), res (network input short side, default 770; 518 is faster).

  .venv/bin/python tools/depth/depthmaps.py JOB.json [--force]
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import cv2
import numpy as np

from common import Job, load_job_arg, write_gray16, write_jpeg


def run(job: Job, force: bool = False) -> None:
    frames = job.frames()
    if not force and all(job.depth_path(f).exists() for f in frames):
        print(f"{job.name}: depth exists ({len(frames)} frames)")
        return
    from depth import Depth, Stabilizer  # loads torch and the model only when there is work

    opts = job.data.get("depth", {})
    model = Depth(opts.get("variant", "small"))
    res = int(opts.get("res", 770))
    aw, ah = job.analysis_size
    stab = Stabilizer(alpha=float(opts.get("stabilize", .6))) if job.kind == "footage" else None
    raw = []
    for i, f in enumerate(frames):
        d = model(job.rgb(f), res=res, out_size=(ah // 2, aw // 2))
        raw.append(stab(d) if stab else d)
        print(f"\r{job.name}: depth {i + 1}/{len(frames)}", end="", flush=True)
    print()
    stack = np.stack(raw)
    lo, hi = np.percentile(stack[::4, ::4, ::4], [.5, 99.5])
    for f, d in zip(frames, raw):
        write_gray16(job.depth_path(f), (d - lo) / max(hi - lo, 1e-6))
    mid = frames[len(frames) // 2]
    dn = np.clip((raw[len(frames) // 2] - lo) / max(hi - lo, 1e-6), 0, 1)
    vis = cv2.applyColorMap((dn * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    pic = cv2.resize(job.analysis(mid), (aw // 2, ah // 2), interpolation=cv2.INTER_AREA)
    write_jpeg(job.work / "depth-preview.jpg", np.hstack([pic, vis]), 88)
    q = np.percentile(dn, [5, 25, 50, 75, 95])
    print(f"{job.name}: depth percentiles 5/25/50/75/95 = {' / '.join(f'{v:.2f}' for v in q)}; "
          f"preview {job.work / 'depth-preview.jpg'}")


if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    run(job, force="--force" in rest)
