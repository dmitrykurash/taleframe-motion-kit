import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'out/effects-qa');
await fs.mkdir(output, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(root, 'tests/browser-effects.tsx'), publicDir: path.join(root, 'public')});
const chromiumOptions = {gl: process.env.REMOTION_GL || 'swangle'};
let report;
const onBrowserLog = ({text}) => {
  if (text.startsWith('EFFECTS_QA_REPORT:')) report = JSON.parse(text.slice('EFFECTS_QA_REPORT:'.length));
};
const composition = await selectComposition({serveUrl, id: 'Effects-QA', chromiumOptions});
await renderStill({serveUrl, composition, chromiumOptions, frame: 0, imageFormat: 'png', output: path.join(output, 'all-effects.png'), onBrowserLog});
if (!report) throw new Error('GPU checks returned no report.');
const errorComposition = await selectComposition({serveUrl, id: 'Effects-Error-QA', chromiumOptions});
let errorSurfaced = false;
try {
  await renderStill({serveUrl, composition: errorComposition, chromiumOptions, frame: 0, imageFormat: 'png', output: path.join(output, 'expected-error.png')});
} catch (error) {
  errorSurfaced = String(error).includes('Cannot load effects image:');
  if (!errorSurfaced) throw error;
}
if (!errorSurfaced) throw new Error('A missing image should cancel the render.');
const fullReport = {...report, missingSourceErrorSurfaced: errorSurfaced, graphicsMode: chromiumOptions.gl};
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(fullReport, null, 2) + '\n');
console.log(JSON.stringify(fullReport, null, 2));
