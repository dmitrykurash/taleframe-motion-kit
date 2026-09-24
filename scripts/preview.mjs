import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {mediaTool, toolEnv} from './media-tools.mjs';

const [source, destination, ...rest] = process.argv.slice(2);
if (!source || !destination || rest.length) {console.log('Usage: npm run preview -- INPUT.mp4 OUTPUT.mp4'); process.exit(1);}
const input = path.resolve(source), output = path.resolve(destination);
if (input === output) throw new Error('Input and output must be different.');
await fs.access(input);
await fs.mkdir(path.dirname(output), {recursive: true});
const ffmpeg = mediaTool('ffmpeg');
// Derive previews from the master: changing Chromium device scale can change product layout.
execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', input, '-vf', "scale='min(1920,iw)':-2:flags=lanczos",
  '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', output],
  {stdio: 'inherit', env: toolEnv(ffmpeg)});
console.log(output);
