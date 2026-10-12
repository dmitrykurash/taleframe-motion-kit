import assert from 'node:assert/strict';
import test from 'node:test';
import {graphemes, keystrokeSchedule, trackedWidth, typedAt} from '../src/kit/typing';
import {backgroundCoversFrame, cameraAt, focusCamera, parallaxCamera} from '../src/kit/camera';
import {cursorAt} from '../src/kit/Cursor';
import {progress} from '../src/kit/motion';
import {defaultStarterProps, validateStarterProps} from '../src/examples/StarterFilm';

test('typing preserves combined Unicode characters and empty/single-character boundaries', () => {
  assert.deepEqual(graphemes('A👨‍👩‍👦é'), ['A', '👨‍👩‍👦', 'é']);
  assert.deepEqual(keystrokeSchedule('', 0, 1), []);
  assert.deepEqual(keystrokeSchedule('👨‍👩‍👦', .2, 1), [.2]);
  const schedule = keystrokeSchedule('A👨‍👩‍👦é', .2, 2);
  assert.equal(typedAt('A👨‍👩‍👦é', schedule, schedule[1]), 'A👨‍👩‍👦');
  assert.equal(typedAt('A👨‍👩‍👦é', schedule, 2), 'A👨‍👩‍👦é');
  assert.throws(() => keystrokeSchedule('test', 3, 2));
});

test('typing is reproducible, uneven, and ends exactly at the requested time', () => {
  const a = keystrokeSchedule('A launch, ready to review.', .3, 4);
  assert.deepEqual(a, keystrokeSchedule('A launch, ready to review.', .3, 4));
  assert.notDeepEqual(a, keystrokeSchedule('A launch, ready to review.', .3, 4, 1));
  assert.equal(a.at(-1), 4);
  assert.ok(a.every((value, i) => i === 0 || value > a[i - 1]));
  assert.ok(new Set(a.slice(1).map((value, i) => Math.round((value - a[i]) * 1000))).size > 5);
});

test('tracked camera width is smooth, bounded, and converges after the final key', () => {
  const times = [.1, .3, .5], widths = [0, 20, 37, 55];
  assert.equal(trackedWidth(0, times, widths), 0);
  let previous = 0;
  for (let t = 0; t < 2; t += .01) {
    const width = trackedWidth(t, times, widths);
    assert.ok(width >= previous && width <= 55);
    previous = width;
  }
  assert.ok(Math.abs(trackedWidth(3, times, widths) - 55) < .001);
  assert.throws(() => trackedWidth(0, [.1], [0]));
});

test('camera target lands at the requested screen point, parallax retains direction and coverage', () => {
  const target = {x: 1200, y: 750}, screen = {x: 1000, y: 550};
  const camera = focusCamera(target, 2, screen);
  assert.equal(960 + (target.x - 960) * camera.scale + camera.x, screen.x);
  assert.equal(540 + (target.y - 540) * camera.scale + camera.y, screen.y);
  const background = parallaxCamera(camera, .1, 1.3);
  assert.equal(Math.sign(background.x), Math.sign(camera.x));
  assert.ok(Math.abs(background.x) < Math.abs(camera.x));
  assert.ok(backgroundCoversFrame(background));
});

test('camera/cursor endpoint holds and midpoint are deterministic', () => {
  const keys = [{time: 0, x: 0, y: 0, scale: 1}, {time: 1, x: 100, y: 80, scale: 2}];
  assert.deepEqual(cameraAt(-1, keys), keys[0]);
  assert.deepEqual(cameraAt(4, keys), keys[1]);
  const a = cameraAt(.5, keys);
  assert.ok(a.x > 0 && a.x < 100);
  assert.deepEqual(a, cameraAt(.5, keys));
  assert.equal(cursorAt(2, keys).x, 100);
  assert.equal(progress(0, 0, 0), 1);
});

test('starter rejects invalid geometry, unsupported fields, and overflowing text', () => {
  assert.equal(validateStarterProps(defaultStarterProps).appName, 'Relay');
  assert.throws(() => validateStarterProps({...defaultStarterProps, output: {width: 1080, height: 1920, fps: 60}}));
  assert.throws(() => validateStarterProps({...defaultStarterProps, typo: true}));
  assert.throws(() => validateStarterProps({...defaultStarterProps, prompt: 'x'.repeat(101)}));
  assert.throws(() => validateStarterProps({...defaultStarterProps, accent: 'red'}));
});

test('motion blur passes: every sample once, no pass over its share', async () => {
  const {blurPasses, shutterOffsets} = await import('../src/kit/MotionBlur');
  for (let n = 6; n <= 32; n++) {
    const {passes, own} = blurPasses(n, 4);
    assert.ok(own <= Math.max(1, n / 4) && passes * own >= n && passes <= 7, `n=${n}`);
    const all = Array.from({length: passes}, (_, k) => shutterOffsets(own, .5, 60, (k + .5) / passes)).flat().sort((a, b) => a - b);
    const direct = shutterOffsets(passes * own, .5, 60);
    all.forEach((v, i) => assert.ok(Math.abs(v - direct[i]) < 1e-12));
  }
  assert.deepEqual(blurPasses(1), {passes: 1, own: 1});
  assert.deepEqual(shutterOffsets(1, .5, 60), [0]);
});
