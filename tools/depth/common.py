"""Shared pieces of the depth tools: the job file, where every file goes, and the image maths.

A job is one shot, described by a JSON file (see README.md): either a still painting (`"still"`) or a stretch of
footage (`"footage"`). Relative paths in a job resolve against the folder you run the tools from (the kit root).
Positions in a job are frame fractions (u, v from the top left), so a job does not depend on the picture size.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "ml"))
import mlcommon  # noqa: E402,F401  (keeps the model cache inside the kit; import before transformers)
import cv2  # noqa: E402
import numpy as np  # noqa: E402

ANALYSIS_WIDTH = 1920  # the models, masks and fills work at most this wide; colour frames keep the output size


def fail(message: str):
    raise SystemExit(message)


class Job:
    """One shot to prepare. Every path the tools read or write comes from here."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        try:
            data = json.loads(self.path.read_text())
        except FileNotFoundError:
            fail(f"No job file at {self.path}")
        except json.JSONDecodeError as error:
            fail(f"{self.path} is not valid JSON: {error}")
        if ("still" in data) == ("footage" in data):
            fail(f"{self.path}: give exactly one of \"still\" (an image) or \"footage\" (a video)")
        if "out" not in data:
            fail(f"{self.path}: \"out\" (the folder under public/ that the renderer reads) is required")
        self.data = data
        self.name = str(data.get("name") or self.path.stem)
        self.kind = "still" if "still" in data else "footage"
        self.out = Path(data["out"])
        self.work = Path(data.get("work") or Path(".cache/depth") / self.name)
        size = data.get("size", [1920, 1080])
        if len(size) != 2 or not all(isinstance(v, int) and 16 <= v <= 16384 for v in size):
            fail(f"{self.path}: \"size\" must be [width, height] in whole pixels")
        self.size = (int(size[0]), int(size[1]))
        aw = min(self.size[0], ANALYSIS_WIDTH)
        self.analysis_size = (aw, round(self.size[1] * aw / self.size[0] / 2) * 2)
        self.fps = float(data.get("fps", 24))
        self.subjects: dict = data.get("subjects", {})
        self.planes: list = data.get("planes", [])
        self.fill: dict = data.get("fill", {})
        self.tracks: dict = data.get("tracks", {})
        names = [p.get("name") for p in self.planes]
        if any(not n for n in names) or len(set(names)) != len(names):
            fail(f"{self.path}: every plane needs a unique \"name\"")

    # --- units -------------------------------------------------------------------------------------------------
    @property
    def unit(self) -> float:
        """Analysis pixels per 1080p pixel (1 for a 1920-wide analysis)."""
        return self.analysis_size[1] / 1080

    def px(self, uv) -> list[float]:
        """Frame fractions [u, v] -> analysis pixels."""
        return [float(uv[0]) * self.analysis_size[0], float(uv[1]) * self.analysis_size[1]]

    def box_px(self, box) -> tuple[int, int, int, int]:
        w, h = self.analysis_size
        x0, y0, x1, y1 = (float(v) for v in box[:4])
        return (max(0, int(x0 * w)), max(0, int(y0 * h)), min(w, int(np.ceil(x1 * w))), min(h, int(np.ceil(y1 * h))))

    # --- frames ------------------------------------------------------------------------------------------------
    def frames(self) -> list[int]:
        """The held film frames of the shot: [0] for a still, the extracted frames for footage."""
        if self.kind == "still":
            return [0]
        index = self.out / "frames.json"
        if not index.exists():
            fail(f"{self.name}: no {index}; run the frames step first")
        return list(json.loads(index.read_text())["frames"])

    @staticmethod
    def tag(f: int) -> str:
        return f"f{f:04d}"

    def color_path(self, f: int) -> Path:
        return self.out / "color.jpg" if self.kind == "still" else self.out / "frames" / f"{self.tag(f)}.jpg"

    def proxy_path(self, f: int) -> Path:
        return self.work / "proxy" / f"{self.tag(f)}.jpg"

    def depth_path(self, f: int) -> Path:
        return self.work / "depth" / f"{self.tag(f)}.png"

    def matte_path(self, subject: str, f: int) -> Path:
        return self.work / "matte" / subject / f"{self.tag(f)}.png"

    def plane_path(self, plane: str, f: int) -> Path:
        return self.out / f"{plane}.png" if self.kind == "still" else self.out / "planes" / plane / f"{self.tag(f)}.png"

    def fill_path(self, f: int) -> Path:
        return self.out / "fill.jpg" if self.kind == "still" else self.out / "fill" / f"{self.tag(f)}.jpg"

    def fillmask_path(self, f: int) -> Path:
        return self.out / "fillmask.png" if self.kind == "still" else self.out / "fillmask" / f"{self.tag(f)}.png"

    def analysis(self, f: int) -> np.ndarray:
        """The held frame as BGR uint8 at the analysis size."""
        for p in (self.proxy_path(f), self.color_path(f)):
            if p.exists():
                bgr = cv2.imread(str(p), cv2.IMREAD_COLOR)
                if bgr is None:
                    fail(f"Cannot read {p}")
                if (bgr.shape[1], bgr.shape[0]) != self.analysis_size:
                    bgr = cv2.resize(bgr, self.analysis_size, interpolation=cv2.INTER_AREA)
                return bgr
        fail(f"{self.name}: no picture for held frame {f}; run the frames step first")

    def rgb(self, f: int) -> np.ndarray:
        return cv2.cvtColor(self.analysis(f), cv2.COLOR_BGR2RGB)

    def depth(self, f: int) -> np.ndarray:
        """Normalised depth (1 = near) at the analysis size."""
        p = self.depth_path(f)
        d = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if d is None:
            fail(f"{self.name}: no depth map {p}; run the depth step first")
        return cv2.resize(d.astype(np.float32) / 65535, self.analysis_size, interpolation=cv2.INTER_CUBIC)

    def matte(self, subject: str, f: int) -> np.ndarray:
        p = self.matte_path(subject, f)
        m = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
        if m is None:
            fail(f"{self.name}: no matte {p}; run the mattes step first (is \"{subject}\" in \"subjects\"?)")
        return m.astype(np.float32) / 255


# --- image maths -----------------------------------------------------------------------------------------------
def smoothstep(e0: float, e1: float, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def luma(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255


def guided(guide: np.ndarray, src: np.ndarray, r: int = 8, eps: float = 1e-3) -> np.ndarray:
    """He et al. guided filter (float32, box filters through OpenCV): snaps a soft mask to the picture's edges."""
    def box(x):
        return cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1), normalize=True, borderType=cv2.BORDER_REFLECT)
    mI, mp = box(guide), box(src)
    a = (box(guide * src) - mI * mp) / (box(guide * guide) - mI * mI + eps)
    b = mp - a * mI
    return box(a) * guide + box(b)


def ellipse(r: float) -> np.ndarray:
    k = max(1, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))


def soft_region(size: tuple[int, int], box, feather: float = 0.03) -> np.ndarray:
    """A soft rectangle: box = [u0, v0, u1, v1] in frame fractions, feather in fractions of the frame height."""
    w, h = size
    m = np.zeros((h, w), np.float32)
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(np.ceil(box[2] * w)), int(np.ceil(box[3] * h))
    m[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = 1
    if feather > 0:
        m = cv2.GaussianBlur(m, (0, 0), feather * h)
    return m


def firm(matte: np.ndarray, unit: float = 1.0) -> np.ndarray:
    """A subject matte with its weak interior firmed up (a matte model sometimes leaves thin parts at 30-50 %
    alpha, which reads as a ghost once the plane moves); the edge stays soft."""
    return cv2.GaussianBlur(smoothstep(.06, .5, matte), (0, 0), .8 * unit)


def pushpull(img: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """Fill low-weight pixels from their surroundings with a pull-push pyramid: a soft wash of the nearby colours,
    with no streaks (Telea-style inpainting smears boundary colours into long wedges across large holes)."""
    levels = []
    c = img * weight[..., None]
    w = weight.copy()
    while min(w.shape) > 3:
        levels.append((c, w))
        c = cv2.resize(c, (max(1, c.shape[1] // 2), max(1, c.shape[0] // 2)), interpolation=cv2.INTER_AREA)
        w = cv2.resize(w, (max(1, w.shape[1] // 2), max(1, w.shape[0] // 2)), interpolation=cv2.INTER_AREA)
    out = c / np.maximum(w, 1e-6)[..., None]
    for c, w in reversed(levels):
        up = cv2.resize(out, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
        own = c / np.maximum(w, 1e-6)[..., None]
        k = np.clip(w * 2.0, 0, 1)[..., None]
        out = own * k + up * (1 - k)
    return out


def fill_region(bgr: np.ndarray, region: np.ndarray, unit: float = 1.0):
    """The plate with `region` replaced by a push-pull wash of its surroundings (computed at half size), and the
    soft mask of where the wash applies. The region grows by ~15 px first so no subject edge survives in the plate."""
    h, w = region.shape
    grow = cv2.dilate((region > .06).astype(np.uint8), ellipse(15 * unit))
    small = cv2.resize(bgr, (w // 2, h // 2), interpolation=cv2.INTER_AREA).astype(np.float32)
    valid = 1 - cv2.resize(grow.astype(np.float32), (w // 2, h // 2), interpolation=cv2.INTER_AREA)
    valid = np.clip((valid - .5) * 2, 0, 1)
    painted = pushpull(small, valid)
    big = cv2.resize(np.clip(painted, 0, 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_CUBIC)
    soft = cv2.GaussianBlur(grow.astype(np.float32), (0, 0), 7 * unit)
    return big, np.clip(soft * 1.5, 0, 1)


def write_alpha(path: Path, a: np.ndarray) -> None:
    """An alpha-only plane: white RGB and the mask as alpha (the renderer multiplies the colour picture by it)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    out = np.empty((*a.shape, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (np.clip(a, 0, 1) * 255 + .5).astype(np.uint8)
    cv2.imwrite(str(path), out, [cv2.IMWRITE_PNG_COMPRESSION, 9])


def read_alpha(path: Path) -> np.ndarray | None:
    im = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if im is None:
        return None
    return (im[..., 3] if im.ndim == 3 and im.shape[2] == 4 else im).astype(np.float32) / 255


def write_gray16(path: Path, a01: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), (np.clip(a01, 0, 1) * 65535 + .5).astype(np.uint16))


def write_gray8(path: Path, a01: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), (np.clip(a01, 0, 1) * 255 + .5).astype(np.uint8))


def write_jpeg(path: Path, bgr: np.ndarray, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])


def overlay(bgr: np.ndarray, layers: dict[str, np.ndarray], width: int = 960) -> np.ndarray:
    """A review picture: each layer tinted over the darkened frame, with its name."""
    colours = [(60, 60, 255), (255, 120, 40), (60, 220, 60), (255, 60, 255), (40, 220, 255), (255, 255, 60)]
    vis = bgr.astype(np.float32) * .45
    for (name, a), c in zip(layers.items(), colours * 4):
        vis = vis * (1 - a[..., None] * .6) + np.array(c, np.float32) * a[..., None] * .6
    h = round(bgr.shape[0] * width / bgr.shape[1])
    small = cv2.resize(np.clip(vis, 0, 255).astype(np.uint8), (width, h), interpolation=cv2.INTER_AREA)
    for i, ((name, _), c) in enumerate(zip(layers.items(), colours * 4)):
        cv2.putText(small, name, (12, 28 + 26 * i), cv2.FONT_HERSHEY_SIMPLEX, .7, c, 2, cv2.LINE_AA)
    return small


def load_job_arg(argv: list[str], usage: str) -> tuple[Job, list[str]]:
    if not argv or argv[0] in ("-h", "--help"):
        print(usage)
        raise SystemExit(0 if argv else 1)
    return Job(argv[0]), argv[1:]
