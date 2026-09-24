import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mediaTool, toolEnv} from './media-tools.mjs';

const usage = 'Usage: node scripts/sequence.mjs INPUT_VIDEO OUTPUT_DIRECTORY [--fps 30] [--width PIXELS] [--height PIXELS]\nCreates frame-000000.png onward and manifest.json. OUTPUT_DIRECTORY must be absent or empty.';

export function parseSequenceArgs(args) {
  if (args.length < 2) throw new Error(usage);
  const [input, output, ...flags] = args;
  if (input.startsWith('--') || output.startsWith('--')) throw new Error(usage);
  const options = {input, output, fps: 30};
  const seen = new Set();
  for (let i = 0; i < flags.length; i += 2) {
    const flag = flags[i], raw = flags[i + 1];
    if (!['--fps', '--width', '--height'].includes(flag) || !raw || seen.has(flag)) throw new Error(`Invalid or repeated option: ${flag}\n${usage}`);
    seen.add(flag);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`${flag} must be a finite number.`);
    if (flag === '--fps' && (value <= 0 || value > 240)) throw new Error('--fps must be greater than 0 and at most 240.');
    if (flag !== '--fps' && (!Number.isInteger(value) || value < 1 || value > 16384)) throw new Error(`${flag} must be an integer from 1 to 16384.`);
    options[flag.slice(2)] = value;
  }
  return options;
}

function run(binary, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {env: toolEnv(binary), stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout?.on('data', data => {stdout += data;});
    child.stderr.on('data', data => {stderr = (stderr + data).slice(-12000);});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`${path.basename(binary)} exited with ${code}:\n${stderr}`)));
  });
}

export async function extractSequence(options) {
  const input = await fs.realpath(path.resolve(options.input));
  const requestedOutput = path.resolve(options.output);
  const stat = await fs.stat(input);
  if (!stat.isFile()) throw new Error('Input must be a local video file.');
  if (input === requestedOutput) throw new Error('Output must not overwrite the source video.');
  const existing = await fs.lstat(requestedOutput).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new Error('Output must be a real directory, not a file or symlink.');
  if (existing && (await fs.readdir(requestedOutput)).length) throw new Error('Output directory is not empty. Choose a new directory; existing files will not be overwritten.');
  await fs.mkdir(path.dirname(requestedOutput), {recursive: true});
  const parent = await fs.realpath(path.dirname(requestedOutput));
  const output = path.join(parent, path.basename(requestedOutput));
  if (input === output) throw new Error('Output must not overwrite the source video.');
  const ffprobe = mediaTool('ffprobe'), ffmpeg = mediaTool('ffmpeg');
  const metadata = JSON.parse(await run(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_streams', '-show_format', '-of', 'json', input], true));
  const video = metadata.streams?.[0];
  if (!video || !(video.width > 0 && video.height > 0)) throw new Error('No usable video stream found.');
  const sourceDurationSeconds = Number(video.duration || metadata.format?.duration);
  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) throw new Error('The source must report a finite video duration.');
  const expectedFrames = Math.ceil(sourceDurationSeconds * options.fps - 1e-7);
  if (expectedFrames < 1 || expectedFrames > 1_000_000) throw new Error('The requested sequence must contain 1–1000000 frames.');
  const staging = await fs.mkdtemp(path.join(parent, `.${path.basename(output)}-extract-`));
  try {
    const filters = [];
    if (options.width !== undefined || options.height !== undefined) {
      // -1 preserves aspect ratio when only one dimension is supplied. Both dimensions deliberately resize.
      filters.push(`scale=${options.width ?? -1}:${options.height ?? -1}`);
    }
    // The bundled FFmpeg omits the fps filter, while -r/CFR can add endpoint
    // duplicates. Explicit accurate seeks keep samples at i/fps and duration exact
    // to one source-sample interval. Two workers bound memory and process count.
    let next = 0, failure = null;
    const worker = async () => {
      while (next < expectedFrames && !failure) {
        const index = next++;
        const args = ['-v', 'error', '-nostdin', '-n', '-ss', String(index / options.fps), '-i', input,
          '-map', '0:v:0', '-an', '-sn', '-dn', '-frames:v', '1'];
        if (filters.length) args.push('-vf', filters.join(','));
        args.push(path.join(staging, `frame-${String(index).padStart(6, '0')}.png`));
        try {await run(ffmpeg, args);} catch (error) {failure = error;}
      }
    };
    await Promise.all([worker(), worker()]);
    if (failure) throw failure;
    const frames = (await fs.readdir(staging)).filter(name => /^frame-\d+\.png$/.test(name)).sort();
    if (frames.length !== expectedFrames) throw new Error(`Expected ${expectedFrames} frames but decoded ${frames.length}. Check the source duration or trim it before extraction.`);
    if (frames.some((file, i) => file !== `frame-${String(i).padStart(6, '0')}.png`)) throw new Error('Extracted sequence contains a gap.');
    const first = JSON.parse(await run(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', path.join(staging, frames[0])], true)).streams[0];
    const manifest = {version: 1, pattern: 'frame-%06d.png', startNumber: 0, fps: options.fps,
      frameCount: frames.length, width: first.width, height: first.height,
      durationSeconds: frames.length / options.fps, sourceDurationSeconds,
      sourceFile: path.basename(input), sampling: 'accurate-seek', audio: false};
    await fs.writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {flag: 'wx'});
    // Recheck before committing: never replace contents another process added during extraction.
    const atCommit = await fs.lstat(output).catch(error => {if (error.code === 'ENOENT') return null; throw error;});
    if (atCommit) {
      if (!atCommit.isDirectory() || atCommit.isSymbolicLink() || (await fs.readdir(output)).length) throw new Error('Output changed during extraction; refusing to overwrite it.');
      await fs.rmdir(output); // Removes only an empty directory; it fails if another file arrives.
    }
    await fs.rename(staging, output);
    console.log(`${frames.length} frames · ${manifest.width}×${manifest.height} · ${options.fps} fps\n${path.join(output, 'manifest.json')}`);
    return manifest;
  } catch (error) {
    await fs.rm(staging, {recursive: true, force: true}); // Only this invocation's private temporary directory.
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).includes('--help')) console.log(usage);
  else extractSequence(parseSequenceArgs(process.argv.slice(2))).catch(error => {console.error(error.message); process.exitCode = 1;});
}
