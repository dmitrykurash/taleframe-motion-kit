#!/usr/bin/env node
import {bundle} from '@remotion/bundler';
import {selectComposition, renderStill} from '@remotion/renderer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mediaTool, toolEnv} from '../../scripts/media-tools.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help') || args.length < 2) {
  console.log('Usage: npm run watercolor -- INPUT OUTPUT.png [--width N --height N] [--blur PX] [--settings JSON] [--gl angle|swangle]');
  console.log('Native dimensions by default. Cover framing; blur before watercolor. No separate grain or stop-motion effects.');
  process.exit(args.includes('--help') ? 0 : 1);
}
const [inputArg, outputArg, ...flags] = args;
const options = {};
for (let i = 0; i < flags.length; i += 2) {
  if (!/^--(width|height|blur|settings|gl)$/.test(flags[i]) || flags[i + 1] === undefined)
    throw new Error(`Invalid or incomplete option: ${flags[i]}`);
  options[flags[i].slice(2)] = flags[i + 1];
}
const input = path.resolve(inputArg), output = path.resolve(outputArg);
await fs.access(input);
if (input === output) throw new Error('Input and output must be different paths.');
if (path.extname(output).toLowerCase() !== '.png') throw new Error('Output must be a PNG.');
if (!!options.width !== !!options.height) throw new Error('Pass both --width and --height, or omit both for native dimensions.');
if (options.gl && !['angle', 'swangle'].includes(options.gl)) throw new Error('--gl must be angle or swangle.');
let native;
if (!options.width) {
  const ffprobe = mediaTool('ffprobe');
  const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', input],
    {encoding: 'utf8', env: toolEnv(ffprobe)}));
  native = probe.streams?.[0];
  if (!native?.width || !native?.height) throw new Error('Cannot read input dimensions; pass --width and --height explicitly.');
}
const width = Number(options.width ?? native.width), height = Number(options.height ?? native.height), blur = Number(options.blur ?? 0);
if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || !Number.isFinite(blur) || blur < 0 || blur > 128)
  throw new Error('Dimensions must be integers 1–8192 and blur must be 0–128 output pixels.');
const settings = JSON.parse(options.settings || '{}');
if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw new Error('--settings must be a JSON object.');
const allowed = ['amount', 'wetness', 'detail', 'brushSize', 'strokes', 'edgeScale', 'paper', 'seed'];
for (const [key, value] of Object.entries(settings)) {
  if (!allowed.includes(key) || typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`Invalid watercolor setting: ${key}. Allowed numeric settings: ${allowed.join(', ')}.`);
}
await fs.mkdir(path.dirname(output), {recursive: true});
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'framecraft-watercolor-'));
const source = `source${path.extname(input)}`;
let effectiveSettings;
const browserLog = ({text}) => {
  if (text.startsWith('WATERCOLOR_SETTINGS ')) effectiveSettings = JSON.parse(text.slice(20));
};
try {
  await fs.copyFile(input, path.join(scratch, source));
  const serveUrl = await bundle({entryPoint: path.join(here, 'watercolor.tsx'), publicDir: scratch});
  const inputProps = {source, width, height, blur, settings};
  const chromiumOptions = {gl: options.gl || 'swangle'};
  const composition = await selectComposition({serveUrl, id: 'Watercolor', inputProps, chromiumOptions});
  await renderStill({serveUrl, composition, inputProps, frame: 0, output, imageFormat: 'png', scale: 1,
    chromiumOptions, timeoutInMilliseconds: 120000, onBrowserLog: browserLog});
  if (!effectiveSettings) throw new Error('The renderer did not report effective settings; output cannot be verified.');
  const report = {input: path.basename(input), output: path.basename(output),
    inputSha256: createHash('sha256').update(await fs.readFile(input)).digest('hex'),
    width, height, blurBeforeWatercolorPx: blur, watercolor: effectiveSettings,
    source: 'tools/watercolor/paint/render.ts', sourceSnapshot: 'tools/watercolor/PROVENANCE.json',
    otherEffects: [], rendering: 'One static watercolor reconstruction; cover framing with blur overscan; no temporal processing.'};
  await fs.writeFile(output.replace(/\.png$/i, '.watercolor.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fs.rm(scratch, {recursive: true, force: true});
}
