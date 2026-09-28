// A master rendered in frame-range chunks, for long films and nearly full disks.
// A single render keeps every frame as an image until it encodes (about 4 MB per 4K frame). Here each chunk is
// encoded and its frames deleted before the next one starts, all from one bundle. The chunks are joined without
// re-encoding, the soundtrack is added once, and the joins are checked. A finished chunk is kept, so an
// interrupted run continues where it stopped. OUT.mp4.chunks/manifest.json records what the chunks come from (the
// composition, props, frame ranges, settings and a fingerprint of src/ and public/): a run in which any of it changed
// stops instead of joining old chunks to new ones (--restart discards them).
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mediaTool, toolEnv} from './media-tools.mjs';

const usage = `Usage: node scripts/master-chunked.mjs COMPOSITION OUT.mp4 [options]
  --chunks N          frame-range chunks (default 5)
  --concurrency N     browser tabs per chunk (default 3)
  --props FILE.json   input props
  --audio FILE|render soundtrack: the first audio stream of FILE (copied), or the composition's own audio rendered
                      once; without it the master is silent
  --gl angle|swangle  WebGL backend (default angle, the hardware one; long films need it)
  --crf N             H.264 quality (default 15)
  --preset NAME       x264 preset (default medium)
  --image-format jpeg|png   intermediate frames (default jpeg at quality 96: a quarter of the disk)
  --restart           discard the chunks of an earlier run that rendered something else
  --keep-bundle       keep the bundle's temporary copy of public/`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.length < 2) {console.log(usage); process.exit(args.includes('--help') ? 0 : 1);}
const [id, outArg, ...flags] = args;
const options = {chunks: '5', concurrency: '3', gl: 'angle', crf: '15', preset: 'medium', 'image-format': 'jpeg'};
for (let i = 0; i < flags.length; i++) {
  const flag = flags[i];
  if (flag === '--keep-bundle' || flag === '--restart') {options[flag.slice(2)] = true; continue;}
  const key = flag.replace(/^--/, '');
  if (!/^--(chunks|concurrency|props|audio|gl|crf|preset|image-format)$/.test(flag) || flags[i + 1] === undefined) {
    throw new Error(`Invalid option: ${flag}\n${usage}`);
  }
  options[key] = flags[++i];
}
const out = path.resolve(outArg);
if (!out.endsWith('.mp4')) throw new Error('The master must be an .mp4 file.');
const chunks = Number(options.chunks), concurrency = Number(options.concurrency), crf = Number(options.crf);
if (!Number.isInteger(chunks) || chunks < 1 || chunks > 200) throw new Error('--chunks must be 1–200.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('--concurrency must be 1–32.');
if (!Number.isInteger(crf) || crf < 0 || crf > 51) throw new Error('--crf must be 0–51.');
if (!['angle', 'swangle'].includes(options.gl)) throw new Error('--gl must be angle or swangle.');
if (!['jpeg', 'png'].includes(options['image-format'])) throw new Error('--image-format must be jpeg or png.');
const inputProps = options.props ? JSON.parse(await fs.readFile(path.resolve(options.props), 'utf8')) : {};
const chromiumOptions = {gl: options.gl};
const ffmpeg = mediaTool('ffmpeg'), ffprobe = mediaTool('ffprobe');
const run = (bin, argv) => execFileSync(bin, argv, {encoding: 'utf8', env: toolEnv(bin), stdio: ['ignore', 'pipe', 'inherit']});
const countFrames = file => Number(run(ffprobe, ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
  '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).trim());
const exists = file => fs.stat(file).then(s => s.size > 0, () => false);

/** What the chunks are rendered from: src/ by content, public/ by name, size and modification time (it can hold
 * gigabytes of footage planes), and the locked dependencies. Hidden files are left out. */
async function sourceFingerprint() {
  const hash = crypto.createHash('sha256');
  const walk = async (dir, byContent) => {
    const entries = await fs.readdir(dir, {withFileTypes: true}).catch(() => []);
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const file = path.join(dir, e.name);
      if (e.isDirectory()) {await walk(file, byContent); continue;}
      if (!e.isFile()) continue;
      hash.update(`${path.relative(root, file)}\0`);
      if (byContent) hash.update(await fs.readFile(file));
      else {const s = await fs.stat(file); hash.update(`${s.size}:${s.mtimeMs}`);}
      hash.update('\0');
    }
  };
  await walk(path.join(root, 'src'), true);
  await walk(path.join(root, 'public'), false);
  for (const file of ['package.json', 'package-lock.json']) hash.update(await fs.readFile(path.join(root, file)).catch(() => ''));
  return hash.digest('hex').slice(0, 24);
}

const t0 = Date.now();
const minutes = () => ((Date.now() - t0) / 60000).toFixed(1);
await fs.mkdir(path.dirname(out), {recursive: true});
const dir = `${out}.chunks`;
await fs.mkdir(dir, {recursive: true});
console.log(`Bundling (gl ${options.gl}, ${chunks} chunks, concurrency ${concurrency})`);
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.tsx'), publicDir: path.join(root, 'public')});
try {
  const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions});
  const total = composition.durationInFrames;
  if (chunks > total) throw new Error(`${id} has only ${total} frames; use fewer chunks.`);
  const ranges = Array.from({length: chunks}, (_, i) => [Math.floor(total * i / chunks), Math.floor(total * (i + 1) / chunks) - 1]);

  // Resume only what this very render made: the same composition, props, ranges, settings and sources.
  const manifest = {composition: id, props: inputProps, width: composition.width, height: composition.height, fps: composition.fps,
    frames: total, ranges, gl: options.gl, crf, preset: options.preset, imageFormat: options['image-format'],
    audio: options.audio ? (options.audio === 'render' ? 'render' : path.resolve(options.audio)) : null,
    source: await sourceFingerprint()};
  const manifestFile = path.join(dir, 'manifest.json');
  const kept = JSON.parse(await fs.readFile(manifestFile, 'utf8').catch(() => 'null'));
  const leftovers = (await fs.readdir(dir)).filter(name => /\.(mp4|m4a)$/.test(name));
  const changed = kept ? Object.keys(manifest).filter(key => JSON.stringify(kept[key]) !== JSON.stringify(manifest[key]))
    : leftovers.length ? ['no manifest'] : [];
  if (changed.length) {
    const what = changed.map(key => key === 'source' ? 'src/ or public/' : key).join(', ');
    if (!options.restart) throw new Error(`${dir} holds chunks of a different render (${what} changed). Pass --restart to discard them, or delete the folder.`);
    console.log(`Discarding the chunks of a different render (${what} changed)`);
    await fs.rm(dir, {recursive: true, force: true});
    await fs.mkdir(dir, {recursive: true});
  }
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');

  const files = [];
  for (const [i, [a, b]] of ranges.entries()) {
    // Named by frame range, so a chunk can only ever stand for its own frames.
    const file = path.join(dir, `chunk-${String(a).padStart(6, '0')}-${String(b).padStart(6, '0')}.mp4`);
    files.push(file);
    if (await exists(file)) {
      let got = NaN;
      try {got = countFrames(file);} catch {}
      if (got === b - a + 1) {console.log(`chunk ${i + 1}/${chunks} (frames ${a}–${b}) exists, kept`); continue;}
      console.log(`chunk ${i + 1}/${chunks} ${Number.isNaN(got) ? 'is unreadable' : `has ${got} frames, expected ${b - a + 1}`}: rendering it again`);
      await fs.rm(file, {force: true});
    }
    const part = file.replace(/\.mp4$/, '.part.mp4');
    let step = -1;
    await renderMedia({serveUrl, composition, inputProps, chromiumOptions, outputLocation: part, codec: 'h264', crf,
      x264Preset: options.preset, pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: options['image-format'],
      ...(options['image-format'] === 'jpeg' ? {jpegQuality: 96} : {}), scale: 1, muted: true, concurrency,
      frameRange: [a, b], timeoutInMilliseconds: 600000,
      // Page errors reach the log, including the depth film's SAFEAREA reports (count them with scripts/qa.mjs).
      onBrowserLog: log => {if (log.type === 'error' || log.type === 'warning') console.log(`[browser ${log.type}] ${log.text}`);},
      onProgress: ({progress}) => {
        const p = Math.floor(progress * 10);
        if (p !== step) {step = p; console.log(`chunk ${i + 1}/${chunks} frames ${a}–${b} ${p * 10}% ${minutes()} min`);}
      }});
    const got = countFrames(part);
    if (got !== b - a + 1) throw new Error(`chunk ${i + 1} has ${got} frames, expected ${b - a + 1}`);
    await fs.rename(part, file);
  }

  let audio = null;
  if (options.audio === 'render') {
    audio = path.join(dir, 'audio.m4a');
    if (!(await exists(audio))) {
      console.log('Rendering the soundtrack once');
      await renderMedia({serveUrl, composition, inputProps, chromiumOptions, outputLocation: audio, codec: 'aac',
        audioBitrate: '320k', concurrency, timeoutInMilliseconds: 600000});
    }
  } else if (options.audio) {
    audio = path.resolve(options.audio);
    await fs.access(audio);
  }

  const list = path.join(dir, 'list.txt');
  await fs.writeFile(list, files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const muxArgs = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  // The soundtrack is cut to the film's length; never -shortest, which drops video frames when the audio ends early.
  if (audio) muxArgs.push('-t', String(total / composition.fps), '-i', audio, '-map', '0:v:0', '-map', '1:a:0');
  muxArgs.push('-c', 'copy', '-movflags', '+faststart', out);
  run(ffmpeg, muxArgs);

  // The joins: the master must have the expected number of frames (each chunk was counted before it was kept).
  const frames = countFrames(out);
  if (frames !== total) throw new Error(`The joined master has ${frames} frames, expected ${total}. Chunks kept in ${dir}.`);
  const report = {composition: id, width: composition.width, height: composition.height, fps: composition.fps,
    durationInFrames: total, durationSeconds: total / composition.fps, props: composition.props, output: out,
    renderedAt: new Date().toISOString(), gl: options.gl, chunks: ranges, audio: audio ? (options.audio === 'render' ? 'rendered' : path.basename(audio)) : null,
    minutes: Number(minutes())};
  await fs.writeFile(`${out}.render.json`, JSON.stringify(report, null, 2) + '\n');
  await fs.rm(dir, {recursive: true, force: true});
  const shown = path.relative(process.cwd(), out).startsWith('..') ? out : path.relative(process.cwd(), out);
  console.log(`${out}: ${total} frames in ${minutes()} min. Check it with npm run verify -- ${shown}`);
} finally {
  // Each bundle copies public/ into a temporary folder: do not leave it behind.
  if (!options['keep-bundle']) await fs.rm(serveUrl, {recursive: true, force: true});
}
