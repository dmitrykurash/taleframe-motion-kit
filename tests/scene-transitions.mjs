// Renders every scene transition of the Scene-Transitions reel at the start, middle, and end of its
// window, checks that a revisited frame repeats pixel for pixel after other seeks, and writes a
// contact sheet to out/scene-transition-qa/. Usage: npm run check:scenes -- [--gl angle|swangle]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'out/scene-transition-qa');
const glIndex = process.argv.indexOf('--gl');
const chromiumOptions = {gl: glIndex > 0 ? process.argv[glIndex + 1] : 'swangle'};
// Windows of the reel (seconds): [label, start, end].
const windows = [['zoom', 1.44, 1.96], ['portal-word', 4.3, 5.65], ['expand', 8.88, 9.68], ['slice', 12.59, 13.21],
  ['portal-card', 15.2, 16.25], ['glitch', 19.37, 19.83]];
await fs.mkdir(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.tsx'), publicDir: path.join(root, 'public')});
const browser = await openBrowser('chrome', {chromiumOptions});
// Remotion's PNG encoder is deterministic, so identical pixels produce identical files.
const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
try {
  const composition = await selectComposition({serveUrl, id: 'Scene-Transitions', chromiumOptions, puppeteerInstance: browser,
    inputProps: {labelled: false}});
  const still = async (frame, name) => {
    const file = path.join(out, name);
    const started = Date.now();
    await renderStill({serveUrl, composition, frame, output: file, chromiumOptions, puppeteerInstance: browser, inputProps: {labelled: false}});
    return {file, ms: Date.now() - started};
  };
  const report = [];
  for (const [label, start, end] of windows) {
    const frames = [.15, .5, .85].map(p => Math.round((start + (end - start) * p) * composition.fps));
    const shots = [];
    for (const frame of frames) shots.push({frame, ...(await still(frame, `${label}-${frame}.png`))});
    // Revisit the middle frame after rendering others: the image must be identical.
    const again = await still(frames[1], `${label}-${frames[1]}-repeat.png`);
    const repeats = await digest(shots[1].file) === await digest(again.file);
    report.push({label, frames, renderMs: shots.map(s => s.ms), repeatsExactly: repeats});
    console.log(`${label}: frames ${frames.join(', ')} · ${shots.map(s => s.ms).join('/')} ms · repeat ${repeats ? 'identical' : 'DIFFERENT'}`);
    await fs.rm(again.file);
    if (!repeats) throw new Error(`${label} did not repeat after seeking; compare ${shots[1].file} with a fresh render.`);
  }
  const cards = report.flatMap(r => r.frames.map(f => `<figure><img src="${r.label}-${f}.png"><figcaption>${r.label} · frame ${f}</figcaption></figure>`)).join('\n');
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Scene transitions</title><style>body{margin:24px;background:#eee;font:15px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%;display:block}figcaption{padding:6px 0}</style><main>${cards}</main>`);
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({date: new Date().toISOString(), gl: chromiumOptions.gl, report}, null, 2) + '\n');
  console.log(`All ${report.length} scene transitions rendered and repeated exactly. ${path.join(out, 'index.html')}`);
} finally {
  await browser.close({silent: true});
}
