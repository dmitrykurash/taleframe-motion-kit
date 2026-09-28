"""Held-frame steadiness of a render, per shot, alone or against a reference render.

A film held on twos shows a new picture every second frame. Between two held pictures, the paint should change
only as much as the subject and the camera do: strokes that jump around read as boiling. This measures, per shot,
the mean absolute change between consecutive held pictures (frames i and i + hold, on a small copy of the frame)
and the share of pixels that "pop" (change by more than 0.12). Against a reference render of the same edit (an
earlier version, or the same film in another style) the ratio isolates what you changed: about 1.0 means the new
version is as steady as the reference.

  .venv/bin/python tools/qa/steadiness.py RENDER.mp4 [--reference REF.mp4] [--shots "lake:0-118,room:158-222"]
                                [--hold 2] [--size 480x270] [--json out.json]

--shots names frame ranges (inclusive) between the cuts: leave transitions out, they change on every frame by
design. Without --shots the whole render is one shot. Needs ffmpeg on PATH (or FFMPEG_BIN) and numpy.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess

import numpy as np


def ffmpeg() -> str:
    found = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg")
    if not found:
        raise SystemExit("ffmpeg not found: install FFmpeg or set FFMPEG_BIN")
    return found


def probe(path: str) -> tuple[float, int]:
    probe_bin = os.environ.get("FFPROBE_BIN") or shutil.which("ffprobe")
    if not probe_bin:
        raise SystemExit("ffprobe not found: install FFmpeg or set FFPROBE_BIN")
    out = json.loads(subprocess.check_output([probe_bin, "-v", "error", "-select_streams", "v:0", "-count_packets",
                                              "-show_entries", "stream=r_frame_rate,nb_read_packets", "-of", "json",
                                              path]))["streams"][0]
    num, den = out["r_frame_rate"].split("/")
    return float(num) / float(den), int(out["nb_read_packets"])


def frames(path: str, a: int, b: int, fps: float, w: int, h: int) -> np.ndarray:
    """Frames a..b (inclusive) as float32 RGB 0..1 at w x h."""
    raw = subprocess.run([ffmpeg(), "-v", "error", "-ss", f"{a / fps:.6f}", "-i", path, "-frames:v", str(b - a + 1),
                          "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32) / 255


def change(F: np.ndarray, hold: int, pop: float = .12) -> tuple[float, float]:
    d = [np.abs(F[i + hold] - F[i]) for i in range(0, len(F) - hold, hold)]
    if not d:
        raise SystemExit("A shot needs more frames than the hold")
    return float(np.mean([x.mean() for x in d])), float(np.mean([(x.mean(-1) > pop).mean() for x in d]))


def parse_shots(spec: str | None, total: int) -> list[tuple[str, int, int]]:
    if not spec:
        return [("all", 0, total - 1)]
    shots = []
    for part in spec.split(","):
        name, span = part.split(":")
        a, b = (int(v) for v in span.split("-"))
        shots.append((name.strip(), a, b))
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("render")
    ap.add_argument("--reference")
    ap.add_argument("--shots")
    ap.add_argument("--hold", type=int, default=2)
    ap.add_argument("--size", default="480x270")
    ap.add_argument("--json")
    a = ap.parse_args()
    w, h = (int(v) for v in a.size.split("x"))
    fps, total = probe(a.render)
    rows = []
    for name, s0, s1 in parse_shots(a.shots, total):
        c, p = change(frames(a.render, s0, s1, fps, w, h), a.hold)
        row = {"shot": name, "frames": f"{s0}-{s1}", "change": round(c, 4), "pop": round(p, 4)}
        if a.reference:
            rc, rp = change(frames(a.reference, s0, s1, fps, w, h), a.hold)
            row.update({"referenceChange": round(rc, 4), "referencePop": round(rp, 4),
                        "ratio": round(c / rc, 3) if rc > 0 else None})
        rows.append(row)
        print(json.dumps(row), flush=True)
    summary: dict = {"shots": rows}
    ratios = [r["ratio"] for r in rows if r.get("ratio") is not None]
    if ratios:
        summary.update({"medianRatio": float(np.median(ratios)), "maxRatio": max(ratios)})
        print(json.dumps({"medianRatio": summary["medianRatio"], "maxRatio": summary["maxRatio"]}))
    if a.json:
        with open(a.json, "w") as f:
            json.dump(summary, f, indent=1)
            f.write("\n")


if __name__ == "__main__":
    main()
