"""Prepare a shot for a depth film: every step in order, or the ones you name.

  .venv/bin/python tools/depth/prepare.py JOB.json                     frames, depth, mattes, planes, tracks
  .venv/bin/python tools/depth/prepare.py JOB.json planes tracks       only these steps
  .venv/bin/python tools/depth/prepare.py JOB.json --force             redo every step's outputs (frames: extract every
                                                             frame again, after changing the footage settings)

Every step skips what already exists, so you can stop a long run and start it again. The model steps (depth,
mattes) load one model at a time; run one prepare at a time on a laptop GPU.
"""
from __future__ import annotations

import sys
import time

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import depthmaps  # noqa: E402
import frames  # noqa: E402
import mattes  # noqa: E402
import planes  # noqa: E402
import tracks  # noqa: E402
from common import load_job_arg  # noqa: E402

STEPS = {
    "frames": lambda job, force: frames.run(job, force),
    "depth": lambda job, force: depthmaps.run(job, force),
    "mattes": lambda job, force: mattes.run(job, force=force),
    "planes": lambda job, force: planes.run(job, force),
    "tracks": lambda job, force: tracks.run(job),
}

if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    force = "--force" in rest
    names = [a for a in rest if not a.startswith("--")] or list(STEPS)
    unknown = [n for n in names if n not in STEPS]
    if unknown:
        raise SystemExit(f"Unknown step {', '.join(unknown)}; the steps are {', '.join(STEPS)}")
    for name in names:
        t0 = time.time()
        STEPS[name](job, force)
        print(f"{job.name}: {name} done in {time.time() - t0:.1f} s", flush=True)
