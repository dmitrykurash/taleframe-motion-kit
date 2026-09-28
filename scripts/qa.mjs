// QA of a finished render: specs, loudness, a contact sheet, and the SAFEAREA count from a render log.
// Usage: node scripts/qa.mjs VIDEO.mp4 [--log RENDER.log] [--sheet OUT.jpg] [--tiles 24] [--columns 6] [--target -14]
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {mediaTool, toolEnv} from './media-tools.mjs';

const usage = `Usage: node scripts/qa.mjs VIDEO.mp4 [options]
  --log FILE      a render log: counts the SAFEAREA reports (type that left the 10 % border) and lists the first ones;
                  without it the safe area is not checked
  --sheet FILE    the contact sheet (default: VIDEO-sheet.jpg beside the video)
  --tiles N       frames on the sheet, evenly spaced (default 24)
  --columns N     sheet columns (default 6)
  --target LUFS   integrated loudness target (default -14); a film more than 1 LU away is flagged`;
const args = process.argv.slice(2);
if (args.includes('--help') || !args.length) {console.log(usage); process.exit(args.length ? 0 : 1);}
const [source, ...flags] = args;
const options = {tiles: '24', columns: '6', target: '-14'};
for (let i = 0; i < flags.length; i += 2) {
  if (!/^--(log|sheet|tiles|columns|target)$/.test(flags[i]) || flags[i + 1] === undefined) throw new Error(`Invalid option: ${flags[i]}\n${usage}`);
  options[flags[i].slice(2)] = flags[i + 1];
}
const input = path.resolve(source);
await fs.access(input);
const ffmpeg = mediaTool('ffmpeg'), ffprobe = mediaTool('ffprobe');
const tiles = Number(options.tiles), columns = Number(options.columns), target = Number(options.target);
if (!Number.isInteger(tiles) || tiles < 1 || tiles > 400) throw new Error('--tiles must be 1–400.');
if (!Number.isInteger(columns) || columns < 1 || columns > tiles) throw new Error('--columns must be 1–tiles.');

// Specs.
const meta = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', input],
  {encoding: 'utf8', env: toolEnv(ffprobe)}));
const video = meta.streams.find(s => s.codec_type === 'video');
if (!video) throw new Error('No video stream.');
const audio = meta.streams.find(s => s.codec_type === 'audio');
const seconds = Number(video.duration || meta.format.duration);
// Paths in the report are relative to the folder you run from, so a shared report does not reveal your checkout.
const shown = file => path.relative(process.cwd(), file) || '.';
const report = {file: shown(input), codec: video.codec_name, width: video.width, height: video.height, fps: video.avg_frame_rate,
  frames: Number(video.nb_read_frames), seconds, pixelFormat: video.pix_fmt, colorSpace: video.color_space ?? null,
  bitrateMbps: Math.round(Number(meta.format.bit_rate) / 1e4) / 100, sizeMB: Math.round(Number(meta.format.size) / 1e4) / 100,
  audio: audio ? {codec: audio.codec_name, sampleRate: Number(audio.sample_rate), channels: audio.channels} : null};

// Loudness (EBU R 128) with the loudnorm filter's analysis: integrated loudness, loudness range and true peak.
// (The FFmpeg that Remotion ships has loudnorm but not ebur128, select or tile; this script needs only what it has.)
if (audio) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', input, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
    {encoding: 'utf8', env: toolEnv(ffmpeg), maxBuffer: 256 * 1024 * 1024});
  const text = r.stderr || '';
  const json = text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1);
  let m = null;
  try {m = JSON.parse(json);} catch {throw new Error(`Could not read the loudness analysis:\n${text.slice(-800)}`);}
  const integrated = Number(m.input_i), range = Number(m.input_lra), peak = Number(m.input_tp);
  report.loudness = Number.isFinite(integrated)
    ? {integratedLUFS: integrated, rangeLU: range, truePeakDBTP: peak, target, ok: Math.abs(integrated - target) <= 1 && peak <= -1}
    : 'silent audio track';
} else {
  report.loudness = 'silent';
}

// Contact sheet: `tiles` frames spread evenly over the film (the middle of each equal stretch), 384 px wide each.
// Remotion's FFmpeg has no raw-video or tiling support, so the tiles come out as PNG and are laid out here.
const sheet = path.resolve(options.sheet || input.replace(/\.[^.]+$/, '') + '-sheet.jpg');
const tw = 384, th = Math.round(tw * video.height / video.width / 2) * 2, rows = Math.ceil(tiles / columns);
const gap = 4, W = tw * columns + gap * (columns - 1), H = th * rows + gap * (rows - 1), canvas = Buffer.alloc(W * H * 3, 16);
const times = Array.from({length: tiles}, (_, k) => (k + .5) * seconds / tiles);
for (const [k, t] of times.entries()) {
  const png = execFileSync(ffmpeg, ['-v', 'error', '-ss', t.toFixed(3), '-i', input, '-frames:v', '1', '-vf', `scale=${tw}:${th}`,
    '-pix_fmt', 'rgb24', '-c:v', 'png', '-f', 'image2pipe', '-'], {env: toolEnv(ffmpeg), maxBuffer: 64 * 1024 * 1024});
  if (!png.length) continue;
  const tile = decodePng(png);
  const x0 = (k % columns) * (tw + gap), y0 = Math.floor(k / columns) * (th + gap);
  for (let y = 0; y < Math.min(th, tile.height); y++) {
    for (let x = 0; x < Math.min(tw, tile.width); x++) {
      const s = (y * tile.width + x) * tile.channels, d = ((y0 + y) * W + x0 + x) * 3;
      canvas[d] = tile.data[s]; canvas[d + 1] = tile.data[s + 1]; canvas[d + 2] = tile.data[s + 2];
    }
  }
}
const sheetPng = sheet.replace(/\.jpe?g$/i, '') + '.tmp.png';
await fs.writeFile(sheetPng, encodePng(W, H, canvas));
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', sheetPng, '-frames:v', '1', '-q:v', '3', '-pix_fmt', 'yuvj420p', sheet], {env: toolEnv(ffmpeg)});
await fs.rm(sheetPng, {force: true});
report.sheet = shown(sheet);
report.sheetSeconds = times.map(t => Math.round(t * 100) / 100);

// SAFEAREA: the depth film's type engine logs every line whose ink box leaves the 10 % border.
if (options.log) {
  const lines = (await fs.readFile(path.resolve(options.log), 'utf8')).split('\n')
    // Remotion also echoes each browser message as '[Tab N, file] …': count each report once.
    .filter(l => l.includes('SAFEAREA') && !/^\[Tab \d+/.test(l.trim()));
  report.safeArea = {count: lines.length, first: lines.slice(0, 10).map(l => l.trim())};
} else {
  report.safeArea = 'not checked';
}

await fs.writeFile(`${input}.qa.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
const problems = [];
if (typeof report.loudness === 'object' && !report.loudness.ok) problems.push(`loudness ${report.loudness.integratedLUFS} LUFS, true peak ${report.loudness.truePeakDBTP} dBTP (target ${target} LUFS, peak at most -1 dBTP)`);
if (report.safeArea?.count) problems.push(`${report.safeArea.count} SAFEAREA reports`);
if (!options.log) console.log('SAFEAREA not checked (pass --log RENDER.log)');
if (problems.length) {console.log(`Check: ${problems.join('; ')}`); process.exitCode = 2;}

// Minimal PNG reading and writing (8-bit, non-interlaced) for the contact sheet.
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, channels = 3;
  const idat = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0) throw new Error('Only 8-bit, non-interlaced PNG tiles are supported.');
      channels = {0: 1, 2: 3, 4: 2, 6: 4}[body[9]];
      if (!channels) throw new Error(`Unsupported PNG colour type ${body[9]}.`);
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * channels, data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0, b = y ? data[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? data[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;}
      data[y * stride + x] = v & 255;
    }
  }
  if (channels === 1 || channels === 2) {
    const rgb = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) rgb.fill(data[i * channels], i * 3, i * 3 + 3);
    return {width, height, channels: 3, data: rgb};
  }
  return {width, height, channels, data};
}

function encodePng(width, height, rgb) {
  const crcTable = Array.from({length: 256}, (_, n) => {let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;});
  const crc = b => {let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;};
  const chunk = (type, body) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
