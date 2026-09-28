"""Shared helpers for the model wrappers (depth.py, matte.py).

- Keeps downloaded models inside the kit, in the git-ignored `.cache/models/`, unless `HF_HOME` is already set.
- Picks CUDA or Apple's MPS when available, the CPU otherwise.
- Streams video frames in and out through ffmpeg pipes, so no frame dumps land on disk.

Import this module before `transformers`: it sets the cache variables the library reads when it loads.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

KIT = Path(__file__).resolve().parents[3]
CACHE = KIT / ".cache" / "models"
os.environ.setdefault("HF_HOME", str(CACHE))
os.environ.setdefault("TORCH_HOME", str(Path(os.environ["HF_HOME"]) / "torch"))
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")  # the odd unsupported op falls back to the CPU
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import numpy as np  # noqa: E402


def tool(name: str) -> str:
    """ffmpeg or ffprobe: FFMPEG_BIN / FFPROBE_BIN when set, else the one on PATH. The tools need a full build
    (the select, fps and scale filters), not the trimmed one Remotion bundles."""
    found = os.environ.get(f"{name.upper()}_BIN") or shutil.which(name)
    if not found:
        raise SystemExit(f"{name} not found: install FFmpeg or set {name.upper()}_BIN")
    return found


def device():
    import torch

    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def free_memory(dev) -> None:
    import torch

    if dev.type == "mps":
        torch.mps.empty_cache()
    elif dev.type == "cuda":
        torch.cuda.empty_cache()


def probe(path: str | Path) -> dict:
    out = subprocess.check_output([
        tool("ffprobe"), "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration:format=duration", "-of", "json", str(path),
    ])
    data = json.loads(out)
    s = data["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    duration = float(s.get("duration") or data.get("format", {}).get("duration") or 0)
    return {"w": int(s["width"]), "h": int(s["height"]), "fps": float(num) / float(den),
            "frames": int(s.get("nb_frames", 0) or 0), "duration": duration}


def read_frames(path: str | Path, start: float = 0.0, dur: float | None = None, fps: float | None = 24,
                width: int | None = None, height: int | None = None, max_frames: int | None = None):
    """Yield RGB uint8 frames (H, W, 3) decoded by ffmpeg. `fps` resamples the clip."""
    info = probe(path)
    w, h = info["w"], info["h"]
    vf = []
    if fps:
        vf.append(f"fps={fps}")
    if width or height:
        tw = width or round(w * height / h / 2) * 2
        th = height or round(h * width / w / 2) * 2
        vf.append(f"scale={tw}:{th}:flags=lanczos")
        w, h = tw, th
    cmd = [tool("ffmpeg"), "-v", "error", "-ss", f"{start}", "-i", str(path)]
    if dur is not None:
        cmd += ["-t", f"{dur}"]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    if max_frames:
        cmd += ["-frames:v", str(max_frames)]
    cmd += ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=w * h * 3 * 2)
    n = 0
    try:
        while True:
            buf = p.stdout.read(w * h * 3)
            if len(buf) < w * h * 3:
                break
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            n += 1
            if max_frames and n >= max_frames:
                break
    finally:
        p.stdout.close()
        p.kill()
        p.wait()


class Writer:
    """Pipe raw frames into ffmpeg: gray uint8/uint16 or RGB/RGBA uint8.

    codec presets:
      'gray16' -> FFV1 lossless 16-bit gray (depth, mattes)   .mkv
      'prores' -> ProRes 4444 with alpha                      .mov
      'png'    -> PNG sequence (the path contains %05d)
      other    -> passed to ffmpeg as the video codec
    """

    def __init__(self, path, w, h, fps=24, pix_in="rgb24", codec="gray16"):
        cmd = [tool("ffmpeg"), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", pix_in,
               "-s", f"{w}x{h}", "-r", f"{fps}", "-i", "-"]
        if codec == "gray16":
            cmd += ["-c:v", "ffv1", "-level", "3", "-pix_fmt", "gray16le"]
        elif codec == "prores":
            cmd += ["-c:v", "prores_ks", "-profile:v", "4444",
                    "-pix_fmt", "yuva444p10le" if pix_in in ("rgba", "bgra") else "yuv444p10le"]
        elif codec == "png":
            cmd += ["-c:v", "png"]
        else:
            cmd += ["-c:v", codec]
        cmd += [str(path)]
        self.p = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    def write(self, arr: np.ndarray) -> None:
        self.p.stdin.write(np.ascontiguousarray(arr).tobytes())

    def close(self) -> None:
        self.p.stdin.close()
        self.p.wait()
