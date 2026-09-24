import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {mediaTool, toolEnv} from './media-tools.mjs';

const [source, ...rest] = process.argv.slice(2);
if (!source || rest.length) {console.log('Usage: npm run verify -- VIDEO.mp4'); process.exit(1);}
const input = path.resolve(source);
const probe = mediaTool('ffprobe'), ffmpeg = mediaTool('ffmpeg');
const metadata = JSON.parse(execFileSync(probe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', input], {encoding: 'utf8', env: toolEnv(probe)}));
const video = metadata.streams.find(s => s.codec_type === 'video');
if (!video) throw new Error('No video stream.');
execFileSync(ffmpeg, ['-v', 'error', '-xerror', '-i', input, '-map', '0:v:0', '-c:v', 'rawvideo', '-f', 'null', '-'], {stdio: 'inherit', env: toolEnv(ffmpeg)});
let expected;
try {expected = JSON.parse(await fs.readFile(`${input}.render.json`, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
if (expected) {
  const [num, den] = video.avg_frame_rate.split('/').map(Number);
  if (video.width !== expected.width || video.height !== expected.height || Math.abs(num / den - expected.fps) > .001 || Number(video.nb_read_frames) !== expected.durationInFrames)
    throw new Error('Encoded dimensions, frame rate, or frame count differ from the render manifest.');
}
const report = {file: input, decode: 'passed', checkedAgainstRenderManifest: !!expected, codec: video.codec_name,
  width: video.width, height: video.height, fps: video.avg_frame_rate, frames: Number(video.nb_read_frames),
  seconds: Number(video.duration || metadata.format.duration), pixelFormat: video.pix_fmt, colorSpace: video.color_space,
  audioStreams: metadata.streams.filter(s => s.codec_type === 'audio').length};
await fs.writeFile(`${input}.verify.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
