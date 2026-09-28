"""Monocular depth with Depth Anything V2 (through transformers), on Apple MPS, CUDA or the CPU.

The output is relative inverse depth ("disparity"): larger is closer to the camera. Normalise it per clip, not per
frame, or it flickers.

Library use:
    from depth import Depth, Stabilizer
    d = Depth("small")                    # "small" (25M, ~100 MB) | "base" (98M, ~390 MB) | "large" (~1.3 GB)
    disp = d(rgb_uint8_HxWx3, res=770)    # float32 HxW on the CPU, at the input size (or out_size=(h, w))

CLI:
    python depth.py image in.png out.png [--variant small] [--res 770]
    python depth.py video in.mp4 out.mkv [--start 3 --dur 2] [--width 1920] [--stabilize]
        -> 16-bit gray FFV1 .mkv (lossless), or a PNG sequence when out ends in .png

Licences: the Small model is Apache-2.0. Base and Large are CC BY-NC 4.0 (non-commercial); choose them only when
that fits your project.

Notes:
  * The cost depends on `res` (the network's short-side input), not on the frame size. 518 is the model's native
    size; 770-1036 gives crisper silhouettes at about 2-4x the cost.
  * `guided=True` (a guided filter against the picture) makes halos where a subject and its background have similar
    brightness. For crisp occlusion edges use a matte (matte.py); use depth for haze, parallax and plane bands.
  * `Stabilizer` aligns each frame's scale and shift to a running reference, then smooths it: the depth of a moving
    shot stops breathing.
  * On a small object floating on black, the model invents a bowl-shaped gradient in the black. Isolate such objects
    with a matte, not with a depth threshold.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import mlcommon  # noqa: E402  (sets HF_HOME before transformers is imported)
import numpy as np  # noqa: E402
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402

MODELS = {
    "small": "depth-anything/Depth-Anything-V2-Small-hf",  # Apache-2.0
    "base": "depth-anything/Depth-Anything-V2-Base-hf",    # CC BY-NC 4.0
    "large": "depth-anything/Depth-Anything-V2-Large-hf",  # CC BY-NC 4.0
}
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def guided_filter(guide: torch.Tensor, src: torch.Tensor, r: int = 8, eps: float = 1e-3) -> torch.Tensor:
    """He et al. guided filter with a gray guide, on the device. guide, src: (1, 1, H, W) float 0..1."""
    def box(x):
        return F.avg_pool2d(x, 2 * r + 1, stride=1, padding=r, count_include_pad=False)

    mI, mp = box(guide), box(src)
    cov = box(guide * src) - mI * mp
    var = box(guide * guide) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return box(a) * guide + box(b)


class Depth:
    def __init__(self, variant: str = "small", dev=None, fp16: bool = True):
        from transformers import AutoModelForDepthEstimation

        self.dev = dev or mlcommon.device()
        self.dtype = torch.float16 if (fp16 and self.dev.type in ("mps", "cuda")) else torch.float32
        self.model = AutoModelForDepthEstimation.from_pretrained(MODELS[variant]).to(self.dev, self.dtype).eval()
        self.mean, self.std = MEAN.to(self.dev), STD.to(self.dev)

    @torch.inference_mode()
    def raw(self, rgb: np.ndarray, res: int = 518) -> torch.Tensor:
        """Disparity at the network's resolution, on the device, shape (1, 1, h14, w14)."""
        H, W = rgb.shape[:2]
        x = torch.from_numpy(np.ascontiguousarray(rgb)).to(self.dev).permute(2, 0, 1)[None].float() / 255.0
        s = res / min(H, W)
        h14, w14 = max(14, round(H * s / 14) * 14), max(14, round(W * s / 14) * 14)
        x = F.interpolate(x, (h14, w14), mode="bicubic", align_corners=False, antialias=True)
        x = ((x - self.mean) / self.std).to(self.dtype)
        d = self.model(pixel_values=x).predicted_depth  # (1, h14, w14)
        return d[:, None].float()

    @torch.inference_mode()
    def __call__(self, rgb: np.ndarray, res: int = 518, guided: bool = False, out_size=None) -> np.ndarray:
        H, W = out_size or rgb.shape[:2]
        d = F.interpolate(self.raw(rgb, res), (H, W), mode="bicubic", align_corners=False)
        if guided:
            g = torch.from_numpy(np.ascontiguousarray(rgb)).to(self.dev).float().mean(-1)[None, None] / 255.0
            if g.shape[-2:] != (H, W):
                g = F.interpolate(g, (H, W), mode="area")
            lo, hi = d.amin(), d.amax()
            dn = (d - lo) / (hi - lo + 1e-6)
            r = max(2, round(min(H, W) / 270))  # ~4 px at 1080p
            d = guided_filter(g, dn, r=r, eps=1e-4) * (hi - lo) + lo
        return d[0, 0].cpu().numpy()


class Stabilizer:
    """Temporal consistency for per-frame depth: a least-squares scale and shift aligns each frame to an exponential
    running reference, which is then updated. alpha=1 disables the smoothing."""

    def __init__(self, alpha: float = 0.6):
        self.ref = None
        self.alpha = alpha

    def __call__(self, d: np.ndarray) -> np.ndarray:
        if self.ref is None:
            self.ref = d.astype(np.float32)
            return self.ref.copy()
        sub = (slice(None, None, 8), slice(None, None, 8))
        x, y = d[sub].ravel(), self.ref[sub].ravel()
        A = np.stack([x, np.ones_like(x)], 1)
        (s, t), *_ = np.linalg.lstsq(A, y, rcond=None)
        aligned = d * s + t
        self.ref = self.alpha * aligned + (1 - self.alpha) * self.ref
        return self.ref.copy()


def save_gray16(path, arr01) -> None:
    import cv2

    cv2.imwrite(str(path), (np.clip(arr01, 0, 1) * 65535 + .5).astype(np.uint16))


def main():
    ap = argparse.ArgumentParser(description="Depth Anything V2 on an image or a video.")
    ap.add_argument("mode", choices=["image", "video"])
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--variant", default="small", choices=list(MODELS))
    ap.add_argument("--res", type=int, default=518)
    ap.add_argument("--guided", action="store_true")
    ap.add_argument("--stabilize", action="store_true")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--dur", type=float, default=None)
    ap.add_argument("--width", type=int, default=None, help="decode width (e.g. 1920); default native")
    ap.add_argument("--fps", type=float, default=24)
    a = ap.parse_args()

    model = Depth(a.variant)
    if a.mode == "image":
        import cv2

        rgb = cv2.cvtColor(cv2.imread(a.inp), cv2.COLOR_BGR2RGB)
        d = model(rgb, a.res, a.guided)
        save_gray16(a.out, (d - d.min()) / (d.max() - d.min() + 1e-6))
        return

    # One pass: normalise with the first frame's robust range widened by 10 % (a shot's range changes slowly).
    stab = Stabilizer() if a.stabilize else None
    writer, lo, hi = None, None, None
    seq = a.out.endswith(".png")
    for i, rgb in enumerate(mlcommon.read_frames(a.inp, a.start, a.dur, a.fps, a.width)):
        d = model(rgb, a.res, a.guided)
        if stab:
            d = stab(d)
        if lo is None:
            p1, p99 = np.percentile(d, [0.5, 99.5])
            lo, hi = p1 - 0.1 * (p99 - p1), p99 + 0.1 * (p99 - p1)
        dn = np.clip((d - lo) / (hi - lo), 0, 1)
        if seq:
            save_gray16(a.out % i if "%" in a.out else a.out.replace(".png", f"_{i:05d}.png"), dn)
        else:
            if writer is None:
                writer = mlcommon.Writer(a.out, dn.shape[1], dn.shape[0], a.fps, "gray16le", "gray16")
            writer.write((dn * 65535).astype("<u2"))
        print(f"\rframe {i}", end="", flush=True)
    if writer:
        writer.close()
    print()


if __name__ == "__main__":
    main()
