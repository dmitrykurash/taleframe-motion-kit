# Two renders of the same film, compared frame by frame (docs/high-resolution.md).
#   python3 -B tools/qa/compare.py A.mp4 B.mp4 [--a0 N] [--b0 M] [--n K]
# Frame a0 + i of A against frame b0 + i of B, both read at 480 x 270 (area-averaged). Per frame: the mean absolute
# difference, the largest mean difference of a 15 x 15 block, and how much brighter or darker A is than B.
# Sharper text at a higher resolution is a small, steady block difference. A frame that is many levels darker in one
# render has lost pieces of its picture (a browser out of tile memory leaves tiles out without an error).
import subprocess, sys
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: int(sys.argv[i + 1]) for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
args = [a for a in args if not a.isdigit()]
if len(args) != 2: sys.exit('usage: compare.py A.mp4 B.mp4 [--a0 N] [--b0 M] [--n K]')
a0, b0, n = opt.get('a0', 0), opt.get('b0', 0), opt.get('n', 10 ** 9)
W, H = 480, 270
def reader(f, skip):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-i', f, '-vf', f"select='gte(n\\,{skip})',scale={W}:{H}:flags=area", '-vsync', '0',
                             '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
pa, pb = reader(args[0], a0), reader(args[1], b0)
rows = []
while len(rows) < n:
    ra, rb = pa.stdout.read(W * H), pb.stdout.read(W * H)
    if len(ra) < W * H or len(rb) < W * H: break
    x = np.frombuffer(ra, np.uint8).astype(np.float32).reshape(H, W); y = np.frombuffer(rb, np.uint8).astype(np.float32).reshape(H, W)
    d = np.abs(x - y); blocks = d.reshape(H // 15, 15, W // 15, 15).mean(axis=(1, 3))
    rows.append((d.mean(), blocks.max(), x.mean() - y.mean()))
pa.kill(); pb.kill()
if not rows: sys.exit('no frames to compare')
r = np.array(rows)
print(f'{len(r)} frames: mean difference {r[:, 0].mean():.2f} levels (worst frame {r[:, 0].max():.2f}); '
      f'largest block difference: median {np.median(r[:, 1]):.1f}, worst {r[:, 1].max():.1f}')
suspect = [i for i in range(len(r)) if abs(r[i, 2]) > 2.5 or r[i, 1] > 35]
print(f'{len(suspect)} frames to look at (a block over 35 levels apart, or the whole frame over 2.5 levels brighter or darker):')
for i in suspect[:40]: print(f'  A frame {a0 + i}: block {r[i, 1]:.0f}, A - B {r[i, 2]:+.1f}')
sys.exit(1 if suspect else 0)
