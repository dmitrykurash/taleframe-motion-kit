import {bundle} from '@remotion/bundler';
import {selectComposition, renderMedia, renderStill} from '@remotion/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.length < 2) {
  console.log('Usage: npm run render -- COMPOSITION [--props FILE.json] [--out FILE.mp4] [--gl angle|swangle] [--concurrency N]\n       npm run stills -- COMPOSITION [--props FILE.json] [--times 0.5,2,4] [--out DIRECTORY]');
  process.exit(args.includes('--help') ? 0 : 1);
}
const [mode, id, ...flags] = args;
if (!['video', 'stills'].includes(mode)) throw new Error('Mode must be video or stills.');
const options = {};
for (let i = 0; i < flags.length; i += 2) {
  if (!/^--(props|out|times|gl|concurrency)$/.test(flags[i]) || !flags[i + 1]) throw new Error(`Invalid option: ${flags[i]}`);
  options[flags[i].slice(2)] = flags[i + 1];
}
if (options.times && mode !== 'stills') throw new Error('--times applies only to stills.');
if (options.gl && !['angle', 'swangle'].includes(options.gl)) throw new Error('--gl must be angle or swangle.');
const concurrency = Number(options.concurrency || 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('--concurrency must be 1–32.');
const inputProps = options.props ? JSON.parse(await fs.readFile(path.resolve(options.props), 'utf8')) : {};
if (!inputProps || Array.isArray(inputProps) || typeof inputProps !== 'object') throw new Error('Props must be a JSON object.');
const chromiumOptions = {gl: options.gl || 'swangle'};
// Browser errors reach the log (depth films report type outside the safe area as SAFEAREA errors).
const onBrowserLog = log => {if (log.type === 'error') console.log(`[browser error] ${log.text}`);};
if (!options.gl) console.log('Using software WebGL (--gl swangle) for repeatable shader output. Films built from React shots and scene transitions, without Taleframe shaders or effects, render many times faster with --gl angle.');
const output = path.resolve(options.out || (mode === 'video' ? `out/${id}.mp4` : `out/${id}-stills`));
if (mode === 'video' && !output.endsWith('.mp4')) throw new Error('Video output must end in .mp4.');
await fs.mkdir(mode === 'video' ? path.dirname(output) : output, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.tsx'), publicDir: path.join(root, 'public')});
try {
  const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions});
  const report = {composition: id, width: composition.width, height: composition.height, fps: composition.fps,
    durationInFrames: composition.durationInFrames, durationSeconds: composition.durationInFrames / composition.fps,
    props: composition.props, output, renderedAt: new Date().toISOString(), gl: chromiumOptions.gl};
  if (mode === 'stills') {
    const duration = composition.durationInFrames / composition.fps;
    const times = options.times ? options.times.split(',').map(Number) : [.05, .2, .4, .6, .8, .95].map(p => duration * p);
    if (!times.length || times.some(t => !Number.isFinite(t) || t < 0 || Math.round(t * composition.fps) >= composition.durationInFrames))
      throw new Error(`Still times must resolve to frames within 0–${composition.durationInFrames - 1}.`);
    const frames = [];
    for (const time of times) {
      const frame = Math.round(time * composition.fps), filename = `frame-${String(frame).padStart(5, '0')}.png`;
      await renderStill({serveUrl, composition, inputProps, chromiumOptions, onBrowserLog, frame, output: path.join(output, filename), imageFormat: 'png', scale: 1});
      frames.push({requestedSeconds: time, frame, file: filename});
      console.log(`Still ${time}s → ${filename}`);
    }
    await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({...report, frames}, null, 2) + '\n');
    // Local contact sheet needs no extra imaging dependency; the full-resolution PNGs remain beside it.
    const cards = frames.map(f => `<figure><img src="${f.file}"><figcaption>${f.frame} · ${(f.frame / composition.fps).toFixed(2)}s</figcaption></figure>`).join('\n');
    await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Frame review</title><style>body{margin:24px;background:#eee;font:16px system-ui}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px}</style><main>${cards}</main>`);
  } else {
    let step = -1;
    await renderMedia({serveUrl, composition, inputProps, chromiumOptions, onBrowserLog, outputLocation: output,
      codec: 'h264', crf: 15, pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: 'png',
      scale: 1, concurrency, x264Preset: 'medium',
      onProgress: ({progress}) => {const next = Math.floor(progress * 20); if (next !== step) {step = next; console.log(`${Math.round(progress * 100)}%`);}},
    });
    await fs.writeFile(`${output}.render.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(output);
  }
} finally {
  // Each bundle copies public/ into a temporary folder: do not leave it behind, even when the render fails.
  await fs.rm(serveUrl, {recursive: true, force: true});
}
