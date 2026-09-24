import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sequenceFrameAt, validateImageSequenceOptions} from '../src/kit/imageSequence';

const clip = {directory: 'footage/sample', frameCount: 90, fps: 30};

test('sequence samples source seconds, independent of output frame rate, and clamps endpoints', () => {
  assert.equal(sequenceFrameAt(-1, clip), 0);
  assert.equal(sequenceFrameAt(0, clip), 0);
  assert.equal(sequenceFrameAt(1 / 60, clip), 0);
  assert.equal(sequenceFrameAt(2 / 60, clip), 1);
  assert.equal(sequenceFrameAt(29 / 30, clip), 29);
  assert.equal(sequenceFrameAt(3, clip), 89);
  assert.equal(sequenceFrameAt(300, clip), 89);
  assert.equal(sequenceFrameAt(.999 / 30, clip), 0);
});

test('trim offset and looping repeat only the remaining source range', () => {
  const trimmed = {...clip, startFrame: 60};
  assert.equal(sequenceFrameAt(-2, trimmed), 60);
  assert.equal(sequenceFrameAt(.5, trimmed), 75);
  assert.equal(sequenceFrameAt(1, trimmed), 89);
  assert.equal(sequenceFrameAt(1, {...trimmed, loop: true}), 60);
  assert.equal(sequenceFrameAt(1.5, {...trimmed, loop: true}), 75);
  assert.equal(sequenceFrameAt(100, {...clip, frameCount: 1, loop: true}), 0);
});

test('sequence settings reject missing ranges, invalid rates, unsafe directories, and malformed modes', () => {
  assert.deepEqual(validateImageSequenceOptions({...clip, directory: 'footage\\sample/'}),
    {...clip, startFrame: 0, fit: 'cover', loop: false});
  for (const directory of ['', '../clip', '/clip', 'file:///clip', 'C:\\clip', 'clip/../another', 'clip//another']) {
    assert.throws(() => validateImageSequenceOptions({...clip, directory}));
  }
  for (const fps of [0, -1, NaN, Infinity, 241]) assert.throws(() => validateImageSequenceOptions({...clip, fps}));
  for (const frameCount of [0, -1, 2.5, 1_000_001]) assert.throws(() => validateImageSequenceOptions({...clip, frameCount}));
  for (const startFrame of [-1, .5, 90]) assert.throws(() => validateImageSequenceOptions({...clip, startFrame}));
  assert.throws(() => sequenceFrameAt(NaN, clip));
  assert.throws(() => validateImageSequenceOptions({...clip, fit: 'crop' as 'cover'}));
  assert.throws(() => validateImageSequenceOptions({...clip, loop: 'yes' as unknown as boolean}));
});

test('extraction CLI validates settings before opening inputs or writing output', () => {
  const script = fileURLToPath(new URL('../scripts/sequence.mjs', import.meta.url));
  for (const flags of [['--fps', '0'], ['--fps', 'NaN'], ['--width', '-1'], ['--height', '1.5'], ['--fps', '30', '--fps', '60'], ['--unknown', '1']]) {
    const result = spawnSync(process.execPath, [script, 'missing-video.mp4', 'unused-output', ...flags], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be|Invalid or repeated option/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
  }
});
