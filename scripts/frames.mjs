import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {mediaTool, toolEnv} from './media-tools.mjs';

const [source, destination, timestamps, ...rest] = process.argv.slice(2);
if (!source || !destination || !timestamps || rest.length) {
  console.log('Usage: npm run frames -- VIDEO.mp4 OUTPUT_DIRECTORY 1,4,8');
  process.exit(1);
}
const input = path.resolve(source), output = path.resolve(destination);
const ffprobe = mediaTool('ffprobe'), ffmpeg = mediaTool('ffmpeg');
const metadata = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input],
  {encoding: 'utf8', env: toolEnv(ffprobe)}));
const video = metadata.streams.find(s => s.codec_type === 'video');
if (!video) throw new Error('No video stream.');
const duration = Number(video.duration || metadata.format.duration);
const [num, den] = video.avg_frame_rate.split('/').map(Number), fps = num / den;
const times = timestamps.split(',').map(Number);
if (!times.length || times.some(t => !Number.isFinite(t) || t < 0 || t >= duration)) throw new Error(`Timestamps must be within 0–${duration}s.`);
await fs.mkdir(output, {recursive: true});
const frames = [];
for (const [index, time] of times.entries()) {
  const file = `encoded-${String(index + 1).padStart(2, '0')}-${time}s.png`;
  // Repeated accurate seeks work with Remotion's trimmed FFmpeg build (no select filter).
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', String(time), '-i', input,
    '-map', '0:v:0', '-frames:v', '1', path.join(output, file)], {env: toolEnv(ffmpeg)});
  frames.push({seconds: time, file});
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({input, width: video.width, height: video.height, fps, frames}, null, 2) + '\n');
const cards = frames.map(({file, seconds}) => `<figure><img src="${file}"><figcaption>${seconds}s</figcaption></figure>`).join('\n');
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Encoded frame review</title><style>body{margin:24px;background:#eee;font:16px system-ui}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px}</style><main>${cards}</main>`);
console.log(path.join(output, 'index.html'));
