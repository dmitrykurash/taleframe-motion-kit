# A high-resolution film from its motion-blur passes (docs/high-resolution.md).
#   python3 -B tools/hires/average.py PLAN.json OUT.mp4 PASS0 PASS1 [PASS2 …] [--first 0] [--crf 12]      (PASSk: a video or a list of parts)
# At --scale 2 a moving frame's motion-blur samples are spread over several renders (`PassedMotionBlur`, `blurPasses`).
# PLAN.json: {"groups": [passes needed by frame 0, frame 1, …], "cut": optional first frame from which only pass 0 counts}.
# This takes, frame by frame, the mean of the passes the plan names: a frame of one pass is pass 0's picture as it is.
# A pass a frame does not need must be black and a pass it needs must not be: if a picture disagrees with the plan this
# stops, and nothing is written over OUT.
# PASSk is a video, or a text file listing the parts of the pass in order (ffmpeg's concat list: file '/path/part.mp4').
# The mean is taken on the decoded Y, U and V planes (a linear mix, as the browser's own average of the samples is),
# rounded to nearest. --first: the film frame that is frame 0 of the passes (a stretch rendered with --range).
import json, os, subprocess, sys
import numpy as np

argv, opt, args = sys.argv[1:], {}, []
i = 0
while i < len(argv):
    if argv[i].startswith('--'): opt[argv[i][2:]] = argv[i + 1]; i += 2
    else: args.append(argv[i]); i += 1
if len(args) < 4: sys.exit('usage: average.py PLAN.json OUT.mp4 PASS0 PASS1 [PASS2 …] [--first 0] [--crf 12]')
plan, out, files = json.load(open(args[0])), args[1], args[2:]
first, crf = int(opt.get('first', 0)), str(opt.get('crf', 12))
cut = plan.get('cut', 10 ** 9)      # from this frame on only pass 0 counts: what the other passes hold there is not looked at
P = len(files)

def parts_of(f):                     # a pass: one video, or the videos its list names, in order
    return [l.split("'")[1] for l in open(f) if l.startswith('file ')] if f.endswith('.txt') else [f]
def first_part(f): return parts_of(f)[0]
class Pass:
    """The frames of a pass, one after another across its parts. Each part is decoded by itself: parts that were not
    made by the same encoder (a black stretch that was not rendered) do not join in one decoder (ffmpeg's concat list
    stopped at the first of them)."""
    def __init__(self, f): self.parts, self.at, self.p = parts_of(f), 0, None
    def read(self, size):
        while True:
            if self.p is None:
                if self.at >= len(self.parts): return b''
                self.p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', self.parts[self.at], '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], stdout=subprocess.PIPE, bufsize=size)
                self.at += 1
            raw = self.p.stdout.read(size)
            if len(raw) == size: return raw
            self.p.stdout.close(); self.p.wait(); self.p = None
            if raw: return raw          # a broken part: the caller sees the short frame
    def kill(self):
        if self.p is not None: self.p.kill()
def probe(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,pix_fmt', '-of', 'json', first_part(f)],
                       capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return s['width'], s['height'], int(n) / int(d), s['pix_fmt']
info = [probe(f) for f in files]
w, h, fps, pix = info[0]
if any(v != info[0] for v in info): sys.exit(f'the passes differ: {info}')
if pix != 'yuv420p': sys.exit(f'expected yuv420p passes, got {pix}')
groups = plan['groups'][first:]
if max(groups) > P: sys.exit(f'the plan needs {max(groups)} passes; {P} were given')
size, luma = w * h * 3 // 2, w * h
dec = [Pass(f) for f in files]
tmp = out + '.part.mp4'
# The planes are bt709, tv range, and must reach the encoder as they are: told so on the way in (setparams only labels
# the frames). Asked for bt709 on the way out alone, ffmpeg takes unlabelled planes for another matrix and converts them
# (measured: the picture came out 1.2 levels darker).
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{w}x{h}', '-r', f'{fps:g}', *TAGS, '-i', '-',
                        '-vf', 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
                        '-c:v', 'libx264', '-crf', crf, '-preset', 'medium', '-pix_fmt', 'yuv420p', *TAGS, '-movflags', '+faststart', tmp], stdin=subprocess.PIPE)
def stop(message):
    for p in dec: p.kill()
    enc.stdin.close(); enc.wait()
    if os.path.exists(tmp): os.remove(tmp)
    sys.exit(message)
mixed, done = {}, 0
for i, g in enumerate(groups):
    bufs = [p.read(size) for p in dec]
    if all(len(b) == 0 for b in bufs): break                 # the passes end here (a stretch)
    if any(len(b) != size for b in bufs): stop(f'frame {first + i}: a pass ended early')
    for k in range(1, P):
        black = float(np.frombuffer(bufs[k], np.uint8, count=luma)[::499].mean()) < 17.5
        if black != (k >= g) and not (first + i >= cut and k >= g): stop(f'frame {first + i}: the plan gives it {g} pass(es), but pass {k} is {"black" if black else "a picture"}')
    if g == 1: enc.stdin.write(bufs[0])
    else:
        acc = np.zeros(size, np.uint16)
        for k in range(g): acc += np.frombuffer(bufs[k], np.uint8)
        enc.stdin.write(((acc + g // 2) // g).astype(np.uint8).tobytes())
    mixed[g] = mixed.get(g, 0) + 1; done += 1
    if done % 600 == 0: print(f'  {done} frames', flush=True)
for p in dec: p.kill()
enc.stdin.close()
if enc.wait() != 0: stop('the encoder failed')
if done == 0: stop('no frames')
os.replace(tmp, out)
print(f'{done} frames (film frames {first}–{first + done - 1}), {w} x {h}: ' + ', '.join(f'{n} from {g} pass{"es" if g > 1 else ""}' for g, n in sorted(mixed.items())) + f' → {out}')
