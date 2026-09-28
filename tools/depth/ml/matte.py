"""Subject mattes on Apple MPS, CUDA or the CPU.

Two building blocks:

  BiRefNet     A prompt-free salient-object matte with very fine edges (hair, rope, leaves). 1024 x 1024 input,
               ~450 MB, about 1 s per frame in fp16 on an M-series Mac. On its own it chooses the subject, and may
               choose the wrong one: gate it with a tracker, or run it on a crop around the subject (`crop`).
  Sam2Tracker  The SAM 2.1 video tracker (transformers Sam2VideoModel, streaming, fp16 ~0.35 s per frame per
               object): prompt an object once with points or a box, and it follows that object through the shot.
               Its masks are 256 x 256 logits upsampled, so their edges are blobby: use it for identity and temporal
               coherence, not for edges. Put a positive point on every distinct part of the object; SAM drops the
               parts it was not shown.

The tracked fine matte combines them (`tracked_alpha`): BiRefNet on a crop around the tracked mask gives the edges,
SAM the identity, and the tracked mask snapped to the picture's edges, pulled 3 px inside, restores parts BiRefNet
drops.

  tracker = Sam2Tracker("small"); net = BiRefNet()
  for i, masks in tracker.track(frames, {0: [{"obj": 1, "points": [[x, y], ...], "labels": [1, ...]}]}):
      alpha = tracked_alpha(net, rgb, masks[1])

The tracker keeps a sliding window. A plain transformers streaming session keeps every frame's pixels and outputs
on the GPU; on an 18 GB Mac it reached 8 GB and swapped within a few hundred frames. SAM 2 attends only to its
prompted frames and its last few frames, so older ones are dropped (`keep`).

CLI:
  python matte.py birefnet in.mp4 out.mkv [--start 3 --dur 2] [--width 1920]
  python matte.py track    in.mp4 out.mkv --box 1100,120,1560,440 [--points "x,y,1;x,y,0"] [--start 3 --dur 2]
  out.mkv = 16-bit gray FFV1 alpha (lossless); out.mov = ProRes 4444 RGBA.

Licences: BiRefNet is MIT, SAM 2.1 is Apache-2.0. BiRefNet runs remote code from its model repository, so its
revision is pinned.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import mlcommon  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402

MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)

# repo, native square size, pinned revision (the model runs remote code, so pin it)
BIREFNET = {"general": ("ZhengPeng7/BiRefNet", 1024, "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4")}


class BiRefNet:
    def __init__(self, variant: str = "general", size: int | None = None, fp16: bool = True, dev=None):
        from transformers import AutoModelForImageSegmentation

        repo, native, rev = BIREFNET[variant]
        self.size = size or native
        self.dev = dev or mlcommon.device()
        self.dtype = torch.float16 if (fp16 and self.dev.type in ("mps", "cuda")) else torch.float32
        self.model = AutoModelForImageSegmentation.from_pretrained(repo, trust_remote_code=True, revision=rev)
        self.model = self.model.to(self.dev, self.dtype).eval()
        self.mean, self.std = MEAN.to(self.dev), STD.to(self.dev)

    @torch.inference_mode()
    def __call__(self, rgb: np.ndarray, size: int | tuple[int, int] | None = None) -> np.ndarray:
        """rgb uint8 HxWx3 -> alpha float32 HxW (0..1). size: a square side or (h, w), multiples of 32."""
        H, W = rgb.shape[:2]
        s = size or self.size
        hw = (s, s) if isinstance(s, int) else s
        x = torch.from_numpy(np.ascontiguousarray(rgb)).to(self.dev).permute(2, 0, 1)[None].float() / 255.0
        x = F.interpolate(x, hw, mode="bilinear", align_corners=False, antialias=True)
        x = ((x - self.mean) / self.std).to(self.dtype)
        y = self.model(x)[-1].float().sigmoid()
        y = F.interpolate(y, (H, W), mode="bilinear", align_corners=False)
        return y[0, 0].cpu().numpy()

    def crop(self, rgb: np.ndarray, mask01: np.ndarray, margin: float = 0.25, min_side: int = 256) -> np.ndarray:
        """BiRefNet on a square-ish crop around a coarse (tracked) mask -> full-frame alpha. The salient object inside
        the crop is the one you tracked, and the network's input is spent on the subject, so fine edges stay fine."""
        H, W = mask01.shape
        ys, xs = np.nonzero(mask01 > 0.5)
        out = np.zeros((H, W), np.float32)
        if len(xs) == 0:
            return out
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        side = max(x1 - x0, y1 - y0, min_side) * (1 + 2 * margin)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        X0, Y0 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
        X1, Y1 = int(min(W, cx + side / 2)), int(min(H, cy + side / 2))
        out[Y0:Y1, X0:X1] = self(rgb[Y0:Y1, X0:X1])
        return out

    def box(self, rgb: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
        """BiRefNet on the pixel box (x0, y0, x1, y1) -> full-frame alpha, zero outside the box."""
        H, W = rgb.shape[:2]
        x0, y0, x1, y1 = max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3])
        out = np.zeros((H, W), np.float32)
        if x1 > x0 and y1 > y0:
            out[y0:y1, x0:x1] = self(rgb[y0:y1, x0:x1])
        return out


class Sam2Tracker:
    """Streaming SAM 2.1 video object tracker (transformers >= 4.56) with a bounded memory window."""

    def __init__(self, variant: str = "small", dev=None, dtype=torch.float16):
        # fp16 on MPS: about twice as fast as fp32 with the same masks. tiny is about as fast as small.
        from transformers import Sam2VideoModel, Sam2VideoProcessor

        repo = f"facebook/sam2.1-hiera-{variant}"  # tiny | small | base-plus | large
        self.dev = dev or mlcommon.device()
        self.dtype = dtype if self.dev.type in ("mps", "cuda") else torch.float32
        self.model = Sam2VideoModel.from_pretrained(repo).to(self.dev, self.dtype).eval()
        self.proc = Sam2VideoProcessor.from_pretrained(repo)

    @torch.inference_mode()
    def track(self, frames, prompts: dict[int, list[dict]], keep: int = 16):
        """frames: an iterable of RGB uint8 HxWx3. prompts: {frame index: [{"obj": 1, "box": [x0, y0, x1, y1]},
        {"obj": 2, "points": [[x, y], ...], "labels": [1, 0, ...]}]} in pixels of the frames; a later entry
        re-prompts an object that drifted. Yields (frame index, {obj id: probability float32 HxW}).
        Memory stays bounded: unprompted frames older than `keep` are dropped from the session."""
        sess = self.proc.init_video_session(inference_device=self.dev, dtype=self.dtype)
        prompted = set()
        for i, rgb in enumerate(frames):
            inputs = self.proc(images=rgb, device=self.dev, return_tensors="pt")
            new_ids = []
            for p in prompts.get(i, []):
                kw = {}
                if "box" in p:
                    kw["input_boxes"] = [[list(map(float, p["box"]))]]
                if "points" in p:
                    kw["input_points"] = [[[list(map(float, q)) for q in p["points"]]]]
                    kw["input_labels"] = [[list(map(int, p["labels"]))]]
                self.proc.add_inputs_to_inference_session(
                    sess, frame_idx=i, obj_ids=p["obj"], original_size=inputs.original_sizes[0], **kw)
                new_ids.append(p["obj"])
            if new_ids:
                # Each add_inputs call replaces obj_with_new_inputs; with several objects only the last one would
                # count as prompted (and the first frame fails). Set the full list.
                sess.obj_with_new_inputs = list(dict.fromkeys(new_ids))
                prompted.add(i)
            # Pass the frame index: a streamed frame is otherwise numbered by the count of stored frames, which the
            # pruning below keeps small, so later frames would overwrite earlier slots and the mask would freeze.
            out = self.model(inference_session=sess, frame_idx=i, frame=inputs.pixel_values[0].to(self.dtype))
            masks = self.proc.post_process_masks([out.pred_masks], original_sizes=inputs.original_sizes,
                                                 binarize=False)[0]  # (n_obj, 1, H, W) logits
            probs = masks.float().sigmoid()[:, 0].cpu().numpy()
            yield i, {oid: probs[k] for k, oid in enumerate(sess.obj_ids)}
            if sess.processed_frames:
                for k in [k for k in sess.processed_frames if k < i - 1 and k not in prompted]:
                    del sess.processed_frames[k]
            for od in sess.output_dict_per_obj.values():
                nc = od["non_cond_frame_outputs"]
                for k in [k for k in nc if k < i - keep]:
                    del nc[k]
            if i % 8 == 7:
                mlcommon.free_memory(self.dev)


def combine(fine: np.ndarray, track: np.ndarray, grow: int = 24) -> np.ndarray:
    """Keep the fine (BiRefNet) alpha only where the tracked object is (dilated): the salient matte's edges, SAM's
    choice of object."""
    import cv2

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1))
    gate = cv2.dilate((track > 0.5).astype(np.uint8), k).astype(np.float32)
    gate = cv2.GaussianBlur(gate, (0, 0), grow / 2)
    return np.clip(fine * gate, 0, 1)


def guided(guide01: np.ndarray, src01: np.ndarray, r: int = 8, eps: float = 1e-3) -> np.ndarray:
    """He et al. guided filter, float32 numpy (box filters through OpenCV)."""
    import cv2

    def box(x):
        return cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1), normalize=True, borderType=cv2.BORDER_REFLECT)
    mI, mp = box(guide01), box(src01)
    a = (box(guide01 * src01) - mI * mp) / (box(guide01 * guide01) - mI * mI + eps)
    b = mp - a * mI
    return box(a) * guide01 + box(b)


def tracked_alpha(net: BiRefNet, rgb: np.ndarray, prob: np.ndarray) -> np.ndarray:
    """The tracked fine matte of one object on one frame: BiRefNet edges inside SAM's object, plus SAM's mask snapped
    to the picture's edges and pulled 3 px inside, which restores parts BiRefNet dropped."""
    import cv2

    fine = combine(net.crop(rgb, prob), prob)
    luma = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    t = np.clip((guided(luma, prob.astype(np.float32), r=8, eps=1e-3) - .35) / .3, 0, 1)
    snapped = t * t * (3 - 2 * t)
    inner = cv2.erode(snapped, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    return np.maximum(fine, inner)


def _parse_points(s):
    pts, lbl = [], []
    for tok in s.split(";"):
        x, y, label = tok.split(",")
        pts.append([float(x), float(y)])
        lbl.append(int(label))
    return pts, lbl


def main():
    ap = argparse.ArgumentParser(description="BiRefNet or tracked (SAM 2.1 + BiRefNet) mattes of a video.")
    ap.add_argument("mode", choices=["birefnet", "track"])
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--sam", default="small")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--dur", type=float, default=None)
    ap.add_argument("--width", type=int, default=None)
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--box", default=None, help="x0,y0,x1,y1 on the first frame (decoded pixels)")
    ap.add_argument("--points", default=None, help='"x,y,1;x,y,0" on the first frame (1 = object, 0 = not)')
    ap.add_argument("--refine", default="birefnet", choices=["birefnet", "none"])
    a = ap.parse_args()

    frames = mlcommon.read_frames(a.inp, a.start, a.dur, a.fps, a.width)
    writer = None

    def emit(rgb, alpha):
        nonlocal writer
        h, w = alpha.shape
        if a.out.endswith(".mov"):
            if writer is None:
                writer = mlcommon.Writer(a.out, w, h, a.fps, "rgba", "prores")
            writer.write(np.dstack([rgb, (alpha * 255 + 0.5).astype(np.uint8)]))
        else:
            if writer is None:
                writer = mlcommon.Writer(a.out, w, h, a.fps, "gray16le", "gray16")
            writer.write((np.clip(alpha, 0, 1) * 65535 + 0.5).astype("<u2"))

    if a.mode == "birefnet":
        net = BiRefNet()
        for i, rgb in enumerate(frames):
            emit(rgb, net(rgb))
            print(f"\rframe {i}", end="", flush=True)
    else:
        if not a.box and not a.points:
            sys.exit("track needs --box or --points")
        prompt = {"obj": 1}
        if a.box:
            prompt["box"] = [float(v) for v in a.box.split(",")]
        if a.points:
            prompt["points"], prompt["labels"] = _parse_points(a.points)
        tracker = Sam2Tracker(a.sam)
        net = BiRefNet() if a.refine == "birefnet" else None
        buf = []

        def tee():
            for f in frames:
                buf.append(f)
                yield f

        for i, masks in tracker.track(tee(), {0: [prompt]}):
            rgb = buf.pop(0)
            emit(rgb, tracked_alpha(net, rgb, masks[1]) if net else masks[1])
            print(f"\rframe {i}", end="", flush=True)
    if writer:
        writer.close()
    print()


if __name__ == "__main__":
    main()
