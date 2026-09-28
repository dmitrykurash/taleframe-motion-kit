"""Step 3: subject mattes for every held frame.

  <work>/matte/<subject>/f####.png   8-bit alpha at the analysis size

Each entry of the job's "subjects" object is one subject, in frame fractions:

  {"points": [[u, v], ...], "negatives": [[u, v], ...]}   tracked: SAM 2.1 follows the subject from the first held
                                                           frame; BiRefNet on a crop around it gives the edges
  {"box": [u0, v0, u1, v1]}                                tracked, prompted with a box instead of points
  "later": {"<film frame>": {"points": [...]}}             re-prompt a subject SAM starts to lose (it keeps the
                                                           negatives)
  {"salient": [u0, v0, u1, v1]}                            no tracking: BiRefNet's salient object inside the box,
                                                           frame by frame (a still, or a subject that stays put)

Put a positive point on every distinct part of the subject: SAM drops the parts it was not shown. Negatives go on
the neighbours it tends to swallow. The tracker keeps a sliding window of frames, so memory stays bounded on long
shots (a plain streaming session keeps every frame on the GPU and swaps within a few hundred frames).

A subject whose frames all exist is skipped; a tracked subject that stopped half way starts again.

  .venv/bin/python tools/depth/mattes.py JOB.json [subject ...] [--force]
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the kit

import numpy as np

from common import Job, fail, load_job_arg, write_gray8


def prompts_of(job: Job, name: str, s: dict, frames: list[int]) -> dict[int, list[dict]]:
    negatives = [job.px(p) for p in s.get("negatives", [])]

    def prompt(o: dict) -> dict:
        p: dict = {"obj": 1}
        if "box" in o:
            p["box"] = list(job.box_px(o["box"]))
        pts = [job.px(q) for q in o.get("points", [])]
        if pts or negatives:
            p["points"] = pts + negatives
            p["labels"] = [1] * len(pts) + [0] * len(negatives)
        if "box" not in p and not pts:
            fail(f"{job.path}: subject {name} needs points, a box or a salient box")
        return p

    schedule = {0: [prompt(s)]}
    for film_frame, o in s.get("later", {}).items():
        i = int(np.argmin([abs(f - int(film_frame)) for f in frames]))
        schedule[i] = [prompt(o)]
    return schedule


def run(job: Job, only: list[str] | None = None, force: bool = False) -> None:
    subjects = {k: v for k, v in job.subjects.items() if not only or k in only}
    if only and set(only) - set(subjects):
        fail(f"{job.name}: no subject named {', '.join(sorted(set(only) - set(subjects)))}")
    frames = job.frames()
    todo = [k for k in subjects if force or not all(job.matte_path(k, f).exists() for f in frames)]
    if not todo:
        print(f"{job.name}: mattes exist ({', '.join(subjects) or 'no subjects'})")
        return
    import mlcommon
    from matte import BiRefNet, Sam2Tracker, tracked_alpha

    net, tracker = BiRefNet(), None
    for name in todo:
        s = subjects[name]
        if "salient" in s:
            box = job.box_px(s["salient"])
            for i, f in enumerate(frames):
                write_gray8(job.matte_path(name, f), net.box(job.rgb(f), box))
                print(f"\r{job.name}: matte {name} {i + 1}/{len(frames)}", end="", flush=True)
            print()
            continue
        if tracker is None:
            tracker = Sam2Tracker(str(job.data.get("sam", "small")))
        buf: list[tuple[int, np.ndarray]] = []

        def feed():
            for f in frames:
                rgb = job.rgb(f)
                buf.append((f, rgb))
                yield rgb

        for i, masks in tracker.track(feed(), prompts_of(job, name, s, frames)):
            f, rgb = buf.pop(0)
            write_gray8(job.matte_path(name, f), tracked_alpha(net, rgb, masks[1]))
            print(f"\r{job.name}: matte {name} {i + 1}/{len(frames)}", end="", flush=True)
        print()
        mlcommon.free_memory(tracker.dev)


if __name__ == "__main__":
    job, rest = load_job_arg(sys.argv[1:], __doc__)
    run(job, [a for a in rest if not a.startswith("--")], force="--force" in rest)
