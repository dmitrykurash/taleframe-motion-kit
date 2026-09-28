import assert from 'node:assert/strict';
import test from 'node:test';
import {apply, invert} from '../src/kit/depth/affine';
import {anchorAt, anchorOnScreen, anchorPoint, blendPlacement, trackLookup} from '../src/kit/depth/anchors';
import {DEPTH_CONFIG, depthConfig, heldTime, outputScale, outputSize} from '../src/kit/depth/config';
import {depthFilmFrames, depthFrameAt, piecewise, validateDepthFilm, type DepthFilmSpec} from '../src/kit/depth/film';
import {focusEllipses, keyedEllipse, trackedEllipse} from '../src/kit/depth/focus';
import {heldFrame, heldFrames, heldStill, onTwos} from '../src/kit/depth/held';
import {peripheryWeight} from '../src/kit/depth/mask';
import {cameraPath, matchCamera, monotoneCurve, passage} from '../src/kit/depth/path';
import {asWatercolor, planePaintSettings} from '../src/kit/depth/planes';
import {footagePlanes, stillPlanes} from '../src/kit/depth/sources';
import {coveredPlate, coverScale, defocusBlur, planeMatrix, planeToScreen, REST_DEPTH_CAMERA, type DepthCamera, type PlaneDraw} from '../src/kit/depth/stage';
import {checkSafeArea, inkCorners, inkLayout, inkWordMatrix, inkWordPose, inkPlacement, safeArea, safeAreaViolations, type InkLine, type InkMeasure} from '../src/kit/depth/type';
import {fitRect, uiFocus, uiLook, uiPresence, type DepthUILayer} from '../src/kit/depth/ui';
// frames.json as tools/depth/frames.py wrote it for a 2-second clip (first 49, last 72, offset 0.5 s, hold 2, handle 12).
import footage from './fixtures/depth-footage-frames.json';

const config = DEPTH_CONFIG;
const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test('depth config validates and derives the output scale from the composition', () => {
  assert.deepEqual(depthConfig(), {width: 1920, height: 1080, fps: 24, hold: 2});
  assert.throws(() => depthConfig({width: 10}), /width/);
  assert.throws(() => depthConfig({hold: 0}), /hold/);
  assert.equal(outputScale(config, 3840, 2160), 2);
  assert.equal(outputScale(config, 1280, 720), 2 / 3);
  assert.throws(() => outputScale(config, 1080, 1920), /aspect ratio/);
  assert.deepEqual(outputSize(config, 2), {width: 3840, height: 2160});
});

test('camera paths pass through their keys, stay monotone between them, and never overshoot', () => {
  const path = cameraPath([{t: 0, z: 0, x: 0}, {t: 1, z: .1}, {t: 2.5, z: .45, x: -120}, {t: 3, z: .6}, {t: 4, z: .62}]);
  for (const [t, z] of [[0, 0], [1, .1], [2.5, .45], [3, .6], [4, .62]]) assert.ok(close(path(t).z, z), `z at ${t}`);
  let last = -Infinity;
  for (let t = -.5; t <= 4.5; t += 1 / 96) {
    const z = path(t).z;
    assert.ok(z >= last - 1e-12, `z decreased at t=${t.toFixed(3)}`);
    assert.ok(z >= 0 && z <= .62 + 1e-12, 'no overshoot');
    last = z;
  }
  // Fields without keys keep the base camera; x follows its own two keys.
  assert.equal(path(2).roll, 0);
  assert.equal(path(2).fx, .5);
  assert.ok(path(1.2).x < 0 && path(1.2).x > -120);
  assert.throws(() => cameraPath([{t: 1, z: 0}, {t: 1, z: 1}]), /share/);
  // A flat stretch between equal values stays flat.
  assert.equal(monotoneCurve(1.5, [{t: 0, v: 0}, {t: 1, v: 1}, {t: 2, v: 1}, {t: 3, v: 2}]), 1);
});

test('plane projection: planeToScreen and planeMatrix agree, and the matrix inverts back to the plane', () => {
  const cams: DepthCamera[] = [REST_DEPTH_CAMERA, {z: .3, x: -60, y: 25, roll: .08, fx: .6, fy: .4}, {z: .7, x: 120, y: -40, roll: -.2, fx: .45, fy: .55}];
  for (const cam of cams) for (const depth of [1, .8, .5]) {
    const m = planeMatrix(cam, {depth}, config);
    for (const [px, py] of [[0, 0], [960, 540], [1700, 200], [300, 1000]]) {
      const a = planeToScreen(px, py, depth, cam, config), b = apply(m, px, py);
      assert.ok(close(a.x, b.x, 1e-6) && close(a.y, b.y, 1e-6), 'same screen point');
      const back = apply(invert(m), b.x, b.y);
      assert.ok(close(back.x, px, 1e-6) && close(back.y, py, 1e-6), 'round trip');
    }
  }
  // Nearer planes grow faster as the camera travels forward.
  const cam = {...REST_DEPTH_CAMERA, z: .3};
  assert.ok(planeToScreen(0, 0, .5, cam, config).scale > planeToScreen(0, 0, 1, cam, config).scale);
});

test('cover scale keeps a plate over the whole frame under roll, sideways travel and pull-back', () => {
  const cams: DepthCamera[] = [
    {z: 0, x: 0, y: 0, roll: .12, fx: .5, fy: .5},
    {z: .1, x: -300, y: 140, roll: -.05, fx: .3, fy: .7},
    {z: -.2, x: 80, y: 0, roll: 0, fx: .5, fy: .5},
    {z: .4, x: 400, y: -200, roll: .3, fx: .8, fy: .2},
  ];
  for (const cam of cams) {
    const draw = coveredPlate(cam, {depth: 1}, config);
    const inv = invert(planeMatrix(cam, draw, config));
    for (const [x, y] of [[0, 0], [config.width, 0], [0, config.height], [config.width, config.height]]) {
      const q = apply(inv, x, y);
      assert.ok(q.x >= -1e-6 && q.x <= config.width + 1e-6 && q.y >= -1e-6 && q.y <= config.height + 1e-6, `corner ${x},${y} shows the plate`);
    }
  }
  assert.ok(close(coverScale(REST_DEPTH_CAMERA, {depth: 1}, config), 1.004), 'at rest only the hair of margin');
  assert.equal(coverScale({...REST_DEPTH_CAMERA, z: .1}, {depth: 1}, config), 1, 'no overscan when the push already covers');
});

const coversFrame = (cam: DepthCamera, draw: PlaneDraw) => {
  const inv = invert(planeMatrix(cam, draw, config));
  return [[0, 0], [config.width, 0], [0, config.height], [config.width, config.height]].every(([x, y]) => {
    const q = apply(inv, x, y);
    return q.x >= -1e-6 && q.x <= config.width + 1e-6 && q.y >= -1e-6 && q.y <= config.height + 1e-6;
  });
};

test('cover scale is continuous: a plate never pops when it starts to need overscan', () => {
  // A slight push that covers a small sideways drift, then stops covering as the drift grows.
  const values = Array.from({length: 401}, (_, i) => coverScale({...REST_DEPTH_CAMERA, z: .01, x: i / 10}, {depth: 1}, config));
  assert.equal(values[0], 1);
  assert.ok(values[400] > 1.01, 'needs overscan by the end');
  for (let i = 1; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i - 1]) < 2e-4, `jump at x=${i / 10}`);
});

test('a covered plate keeps its own look: anchor, grow below 1 and turn stay covered and in place', () => {
  const cam: DepthCamera = {z: .05, x: -120, y: 60, roll: .04, fx: .45, fy: .55};
  const look: PlaneDraw = {depth: 1, grow: 1.08, anchorX: 300, anchorY: 200, turn: .03};
  const draw = coveredPlate(cam, look, config);
  assert.ok(draw.cover! > 1);
  assert.equal(draw.grow, 1.08);
  assert.equal(draw.anchorX, 300);
  assert.equal(draw.anchorY, 200);
  assert.ok(coversFrame(cam, draw));
  // Overscan scales the picture about its centre before the look, so the look's own motion is unchanged there: the
  // picture's centre lands where it would without overscan.
  const a = apply(planeMatrix(cam, draw, config), config.width / 2, config.height / 2);
  const b = apply(planeMatrix(cam, look, config), config.width / 2, config.height / 2);
  assert.ok(close(a.x, b.x) && close(a.y, b.y));
  // A plate that shrinks by itself (grow < 1) or turns still covers the frame, even with a still camera.
  for (const shrink of [{depth: 1, grow: .9}, {depth: 1, grow: .85, anchorX: 200, anchorY: 900}, {depth: 1, turn: .1}] as PlaneDraw[]) {
    assert.ok(!coversFrame(REST_DEPTH_CAMERA, shrink), 'uncovered without overscan');
    assert.ok(coversFrame(REST_DEPTH_CAMERA, coveredPlate(REST_DEPTH_CAMERA, shrink, config)), `covered: ${JSON.stringify(shrink)}`);
  }
});

test('depth of field grows with |1/d − 1/f| and is zero on the focus plane', () => {
  assert.equal(defocusBlur(.6, .6, .1, 4), 0);
  assert.ok(defocusBlur(.3, .6, 0, 4) > defocusBlur(.45, .6, 0, 4));
  assert.ok(close(defocusBlur(.5, 1, 0, 4), 4 * (1 / .5 - 1)));
  assert.equal(defocusBlur(.2, 1, 0, 4, 3), 3, 'capped');
});

test('match cuts put the incoming anchor on the outgoing one, radius for radius', () => {
  const target = {x: 1240, y: 420, r: 90}, anchor = {x: 900, y: 610, r: 60};
  const cam = matchCamera(target, anchor, .5, config);
  const p = planeToScreen(anchor.x, anchor.y, .5, cam, config);
  assert.ok(close(p.x, target.x, 1e-6) && close(p.y, target.y, 1e-6));
  assert.ok(close(anchor.r * p.scale, target.r, 1e-6));
  // The passage opens pushed in at its point and eases back to the base camera.
  const base = cameraPath([{t: 0, z: 0}, {t: 4, z: .2}]);
  const cam2 = passage(base, {open: {at: 1, from: {x: .3, y: .7}}, dive: {at: 3, to: () => ({x: .8, y: .2})}});
  assert.ok(close(cam2(1).fx, .3) && close(cam2(1).z, base(1).z + .32));
  assert.ok(close(cam2(2.2).fx, .5) && close(cam2(2.2).z, base(2.2).z));
  assert.ok(close(cam2(3.8).fx, .8) && close(cam2(3.8).z, base(3.8).z + .36));
});

test('held frames: on twos, latest picture at or before the frame, stills hold frame 0', () => {
  assert.deepEqual(onTwos(10, 17), [10, 12, 14, 16]);
  const held = heldFrames([30, 10, 14, 12, 12]);
  assert.equal(held(0), 10);
  assert.equal(held(13), 12);
  assert.equal(held(14), 14);
  assert.equal(held(99), 30);
  assert.equal(heldFrame([4], 2), 4);
  assert.equal(heldStill(), 0);
  assert.throws(() => heldFrames([]), /non-empty/);
  assert.equal(heldTime(7, config), 6 / 24);
  assert.equal(heldTime(6, config), 6 / 24);
  assert.equal(heldTime(7, {...config, hold: 1}), 7 / 24);
});

test('anchor tracks: exact hits, the nearest measured frame otherwise, nulls skipped, fallback when empty', () => {
  const track = {'10': {x: 1, y: 1}, '14': null, '20': {x: 2, y: 2}, '30': {x: 3, y: 3}};
  const at = trackLookup(track);
  assert.deepEqual(at(10), {x: 1, y: 1});
  assert.deepEqual(at(14), {x: 1, y: 1}, 'null frame falls back to the nearest measured one (tie: earlier)');
  assert.deepEqual(at(16), {x: 2, y: 2});
  assert.deepEqual(at(-5), {x: 1, y: 1});
  assert.deepEqual(at(99), {x: 3, y: 3});
  assert.deepEqual(anchorAt({}, 3, {x: 9, y: 9}), {x: 9, y: 9});
  assert.equal(trackLookup(track), at, 'built once per track');
  // Tracks are in frame fractions (r of the height); anchors on screen follow the camera.
  const lamp = anchorPoint({'0': {x: .25, y: .5, r: .02}}, 0, config, {x: .5, y: .5});
  assert.deepEqual(lamp, {x: 480, y: 540, r: 21.6});
  assert.deepEqual(anchorOnScreen(lamp, .6, REST_DEPTH_CAMERA, config), {x: .25, y: .5});
  const pushed = anchorOnScreen(lamp, .6, {...REST_DEPTH_CAMERA, z: .3}, config);
  assert.ok(pushed.x < .25, 'a point left of the focus of expansion moves outward as the camera travels in');
});

test('blendPlacement moves the pivot in a straight line and scale in log space', () => {
  const m0 = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}, m1 = {a: 4, b: 0, c: 0, d: 4, e: 100, f: -50};
  const mid = blendPlacement(m0, m1, .5, 200, 100);
  assert.ok(close(Math.hypot(mid.a, mid.b), 2));
  const p = apply(mid, 200, 100), p0 = apply(m0, 200, 100), p1 = apply(m1, 200, 100);
  assert.ok(close(p.x, (p0.x + p1.x) / 2) && close(p.y, (p0.y + p1.y) / 2));
  assert.equal(blendPlacement(m0, m1, 0, 0, 0), m0);
  assert.equal(blendPlacement(m0, m1, 1, 0, 0), m1);
});

test('focus ellipses interpolate keyed ellipses, follow tracks and keep at most four', () => {
  const keys: [number, number, number, number, number][] = [[0, .2, .2, .1, .1], [10, .4, .2, .1, .3]];
  assert.deepEqual(keyedEllipse(keys, 5), [.30000000000000004, .2, .1, .2]);
  assert.deepEqual(keyedEllipse(keys, 99), [.4, .2, .1, .3]);
  assert.deepEqual(trackedEllipse({'0': {x: .5, y: .5, r: .1}}, 0, config, .5), [.5, .5, .05 * 1080 / 1920, .05]);
  const five = focusEllipses([.1, .1, .1, .1], [.2, .2, .1, .1], [.3, .3, .1, .1], keys, [.5, .5, .1, .1]);
  assert.equal(five(0).length, 4);
});

test('plane paint settings add the plane seed and brush, keep oil focus, and fall back to watercolor', () => {
  const oil = {enabled: true, brushSize: .5, seed: 100, style: 'oil' as const, strokeScale: 2, looseness: 2.4};
  const s = planePaintSettings(oil, {seed: 7, brush: .8, focus: [[.5, .5, .1, .1], [.2, .2, .05, .05]]});
  assert.equal(s.seed, 107);
  assert.ok(close(s.brushSize!, .4));
  assert.deepEqual(s.focus, [.5, .5, .1, .1, .2, .2, .05, .05]);
  const w = asWatercolor(s);
  assert.equal(w.style, undefined);
  assert.equal(w.focus, undefined);
  assert.equal(w.strokeScale, undefined);
  assert.equal(w.seed, 107);
  const plain = {enabled: true, brushSize: .5};
  assert.equal(asWatercolor(plain), plain);
  assert.equal(planePaintSettings(plain, {focus: [[.5, .5, .1, .1]]}).focus, undefined, 'focus is oil only');
});

test('plane sources follow the preparation tools\' folder layout', () => {
  const still = stillPlanes('demo/lake');
  assert.equal(still.plate().color(0), 'demo/lake/color.jpg');
  assert.equal(still.plate({fill: true}).fillMask!(0), 'demo/lake/fillmask.png');
  assert.equal(still.plane('boat').mask!(0), 'demo/lake/boat.png');
  const clip = footagePlanes('footage/street');
  assert.equal(clip.plane('lamp').mask!(96), 'footage/street/planes/lamp/f0096.png');
  assert.equal(clip.plate({fill: true}).fill!(8), 'footage/street/fill/f0008.jpg');
});

test('a tools-written frames.json drives heldFrames and footagePlanes: on twos, the odd first frame, the handles', () => {
  const held = heldFrames(footage.frames);
  const clip = footagePlanes('footage/pan');
  const {first, last} = footage;
  // The first frame on screen is odd and has its own picture; the frames after it are held on twos.
  assert.equal(first % 2, 1);
  assert.equal(held(first), first);
  assert.equal(held(first + 1), first + 1);
  assert.equal(held(first + 2), first + 1);
  assert.equal(held(last), last);
  // The handles: frames before `first` and after `last`, for the travel-through cuts, have pictures too.
  const lo = footage.frames[0], hi = footage.frames[footage.frames.length - 1];
  assert.ok(lo < first && hi > last);
  assert.equal(held(lo + 1), lo);
  // Every film frame from the first handle to the last shows an extracted picture, never one from a later moment.
  const source = footage.sourceFrames as Record<string, number>;
  for (let f = lo; f <= hi; f++) {
    const h = held(f);
    assert.ok(footage.frames.includes(h) && h <= f && f - h < footage.hold, `frame ${f}`);
    assert.ok(Number.isInteger(source[String(h)]), `frame ${f} has a source frame`);
  }
  // Paths match what the tools write: frames/, planes/<plane>/, fill/, fillmask/, four-digit frame numbers.
  const f = held(first + 2);
  assert.equal(clip.plate().color(f), 'footage/pan/frames/f0050.jpg');
  assert.equal(clip.plate({fill: true}).fill!(f), 'footage/pan/fill/f0050.jpg');
  assert.equal(clip.plate({fill: true}).fillMask!(f), 'footage/pan/fillmask/f0050.png');
  assert.equal(clip.plane('boat').mask!(held(lo)), 'footage/pan/planes/boat/f0038.png');
  assert.equal(clip.plane('boat').color(held(first)), 'footage/pan/frames/f0049.jpg');
});

// A stand-in for canvas text metrics: half an em per character, caps 0.7 em, descenders 0.2 em.
const fakeMeasure: InkMeasure = (text, font) => {
  const size = Number(/([\d.]+)px/.exec(font)![1]);
  const width = text.length * size * .5;
  return {width, left: 0, right: width, ascent: .7 * size, descent: /[gjpqy,]/.test(text) ? .2 * size : 0};
};

test('the safe-area check passes boxes inside the 10% border and catches boxes that cross it', () => {
  const area = safeArea(config);
  assert.deepEqual(area, {x0: 192, y0: 108, x1: 1728, y1: 972});
  assert.ok(checkSafeArea([{x: 192, y: 108}, {x: 1728, y: 972}], area));
  assert.ok(!checkSafeArea([{x: 191, y: 500}], area));
  assert.ok(!checkSafeArea([{x: 900, y: 975}], area));
});

test('ink groups are checked with their real ink box over their whole life, growth and pivot included', () => {
  const o = {config, measure: fakeMeasure};
  const inside: InkLine = {start: 0, end: 3, groups: [{text: 'a quiet harbour', x: 960, y: 560, size: 90, growth: 1.1}]};
  assert.deepEqual(safeAreaViolations([inside], o), []);
  // Set against the left border: growing about its centre pushes the left edge out; growing away from it does not.
  // (14 px of room: the lift exit grows each word by up to 5 % about its own centre while it fades.)
  const edge = (pivot?: 'left'): InkLine => ({start: 0, end: 3, groups: [{text: 'Morning', x: 206, y: 400, size: 100, align: 'left', growth: 1.12, pivot}]});
  assert.ok(safeAreaViolations([edge()], o).length > 0);
  assert.deepEqual(safeAreaViolations([edge('left')], o), []);
  // A rush past the lens is exempt while it leaves, and a group can opt out explicitly.
  const rush: InkLine = {start: 0, end: 2, groups: [{text: 'onward', x: 960, y: 540, size: 120, exit: 'rush', growth: 1}]};
  assert.deepEqual(safeAreaViolations([rush], o), []);
  const off: InkLine = {start: 0, end: 1, groups: [{text: 'far', x: 40, y: 60, size: 80, safeArea: false}]};
  assert.deepEqual(safeAreaViolations([off], o), []);
  // Once settled, the words' ink reaches the cap top of the first row and the descender of the last.
  const two: InkLine = {start: 0, end: 4, groups: [{text: ['Tall', 'deep'], x: 960, y: 500, size: 100, lineHeight: 1, growth: 1}]};
  const L = inkLayout(two, two.groups[0], o);
  const c = inkCorners(two, two.groups[0], L, 2, config);
  assert.equal(c.length, 8, 'four corners per visible word');
  assert.ok(close(Math.min(...c.map(p => p.y)), 500 - 70) && close(Math.max(...c.map(p => p.y)), 600 + 20));
  assert.deepEqual(inkCorners(two, two.groups[0], L, 0, config), [], 'nothing visible before the first word inks in');
});

test('the safe-area check follows each word\'s own gesture: a flight near the top, a stamp and a slide near the sides', () => {
  const o = {config, measure: fakeMeasure};
  // Settled, the word's cap top is 22 px inside the border; rising in its flight exit it crosses it. A lift exit, in
  // the same place, stays inside.
  const top = (exit: 'flight' | 'lift'): InkLine => ({start: 0, end: 3, groups: [{text: 'rising', x: 960, y: 200, size: 100, growth: 1, exit}]});
  const flight = safeAreaViolations([top('flight')], o);
  assert.ok(flight.length > 0);
  assert.ok(flight.every(v => v.t > 2), 'only while it leaves');
  assert.deepEqual(safeAreaViolations([top('lift')], o), []);
  // Set 8 px inside the left border: a stamp lands from 1.45× about the word's centre and crosses it; an ink reveal
  // surfaces smaller and does not.
  const left = (reveal: 'stamp' | 'ink'): InkLine => ({start: 0, end: 3, groups: [{text: 'Stamp', x: 200, y: 500, size: 100, align: 'left', pivot: 'left', growth: 1, reveal}]});
  const stamp = safeAreaViolations([left('stamp')], o);
  assert.ok(stamp.length > 0 && stamp.every(v => v.t < .5), 'while it lands');
  assert.deepEqual(safeAreaViolations([left('ink')], o), []);
  // Arriving from the right against the right border slides the words in from outside it.
  const right: InkLine = {start: 0, end: 3, groups: [{text: 'from the right', x: 1720, y: 500, size: 100, align: 'right', pivot: 'right', growth: 1, arrive: 'right'}]};
  assert.ok(safeAreaViolations([right], o).length > 0);
  assert.deepEqual(safeAreaViolations([{...right, groups: [{...right.groups[0], arrive: 'depth'}]}], o), []);
});

test('word poses: faint words are skipped, and the matrix is the word\'s motion inside the group\'s approach', () => {
  const o = {config, measure: fakeMeasure};
  const line: InkLine = {start: 0, end: 3, groups: [{text: 'far shore', x: 960, y: 540, size: 100, growth: 1.2, reveal: 'stamp'}]};
  const g = line.groups[0], L = inkLayout(line, g, o);
  // The second word starts 0.12 s after the first: at 0.05 s only the first one is there.
  assert.equal(inkWordPose(line, g, L, L.words[1], .05, config), null);
  const first = inkWordPose(line, g, L, L.words[0], .05, config)!;
  assert.ok(first.scale > 1.3 && first.alpha > .05, 'a stamp lands from near the lens');
  // In its first hundredth of a second the word is there but too faint to read: the safe area ignores it.
  assert.ok(inkWordPose(line, g, L, L.words[0], .01, config)!.alpha < .05);
  assert.deepEqual(inkCorners(line, g, L, .01, config), []);
  const settled = inkWordPose(line, g, L, L.words[0], 1.5, config)!;
  assert.equal(settled.scale, 1);
  assert.equal(settled.alpha, 1);
  // Settled, the matrix is the group's approach alone: the pivot stays put, and the word scales by k about it.
  const P = inkPlacement(line, g, L, 1.5), m = inkWordMatrix(P, settled);
  const pivot = apply(m, P.px, P.py);
  assert.ok(close(pivot.x, P.px) && close(pivot.y, P.py));
  assert.ok(close(m.a, P.k) && close(m.d, P.k));
  // Past its exit a word is gone.
  assert.equal(inkWordPose(line, g, L, L.words[0], 3, config), null);
});

test('UI layers arrive from depth, dive through their anchor, and pull focus while present', () => {
  const layer: DepthUILayer = {
    source: {draw: () => undefined, pose: () => ({x: 0, y: 0, scale: 1, anchorX: 1400, anchorY: 300})},
    window: [1, 5], enter: {at: 1, dur: .5}, exit: {at: 4, dur: .8, kind: 'dive'},
  };
  const arriving = uiLook(layer, 1.1, config), settled = uiLook(layer, 2.5, config), diving = uiLook(layer, 4.6, config);
  assert.ok(arriving.scale < 1 && arriving.blur > 0 && arriving.alpha < 1);
  assert.equal(settled.scale, 1);
  assert.equal(settled.blur, 0);
  assert.ok(diving.scale > 2 && diving.ax === 1400 && diving.ay === 300);
  assert.equal(uiPresence([layer], .5), 0);
  assert.equal(uiPresence([layer], 3), 1);
  const focus = uiFocus([layer], {scene: 1, ui: .3});
  assert.equal(focus(.5), 1);
  assert.ok(close(focus(3), .3));
});

test('UI sequences honour fit: cover and contain keep the aspect ratio, centred; stretch fills', () => {
  assert.deepEqual(fitRect('cover', 1920, 1080, 1920, 1080), {x: 0, y: 0, width: 1920, height: 1080});
  assert.deepEqual(fitRect('cover', 1000, 1000, 1920, 1080), {x: 0, y: -420, width: 1920, height: 1920});
  assert.deepEqual(fitRect('contain', 1000, 1000, 1920, 1080), {x: 420, y: 0, width: 1080, height: 1080});
  assert.deepEqual(fitRect('stretch', 1000, 1000, 1920, 1080), {x: 0, y: 0, width: 1920, height: 1080});
});

test('depth films validate their structure and find the shot or cut of a moment', () => {
  const plate = {id: 'plate', source: stillPlanes('demo/a').plate(), depth: 1};
  const film: DepthFilmSpec = {
    config,
    shots: [
      {id: 'a', window: [0, 4], layers: [plate], camera: () => REST_DEPTH_CAMERA},
      {id: 'b', window: [3, 8], layers: [plate, {id: 'near', source: stillPlanes('demo/b').plane('near'), depth: .5}], camera: () => REST_DEPTH_CAMERA,
        guests: [{shot: 'a', layer: 'plate', window: [3, 4], after: 0}]},
    ],
    cuts: [{from: 'a', to: 'b', window: [3, 4], shader: [3.2, 3.9], mix: {kind: 'watercolor', duration: .7}}],
  };
  assert.equal(validateDepthFilm(film).config.hold, 2);
  assert.equal(depthFilmFrames(film), 192);
  assert.ok('shot' in depthFrameAt(film, 1) && (depthFrameAt(film, 1) as {shot: {id: string}}).shot.id === 'a');
  assert.ok('cut' in depthFrameAt(film, 3.5));
  assert.equal((depthFrameAt(film, 20) as {shot: {id: string}}).shot.id, 'b', 'the last shot holds after the end');
  assert.throws(() => validateDepthFilm({...film, cuts: [{...film.cuts![0], to: 'c'}]}), /unknown shot/);
  assert.throws(() => validateDepthFilm({...film, cuts: [{...film.cuts![0], shader: [2, 3.5]}]}), /inside/);
  // A cut on an anchor needs a shader with a centre; waterspill enters from an edge.
  const center = () => ({x: .5, y: .5});
  assert.equal(validateDepthFilm({...film, cuts: [{...film.cuts![0], center}]}).cuts![0].center, center);
  assert.throws(() => validateDepthFilm({...film, cuts: [{...film.cuts![0], center, mix: {kind: 'waterspill', duration: .7}}]}), /no centre/);
  assert.throws(() => validateDepthFilm({...film, cuts: [{...film.cuts![0], mix: {kind: 'splash', duration: .7}}]}), /unknown transition/);
  assert.throws(() => validateDepthFilm({...film, shots: [film.shots[0], {...film.shots[0]}]}), /Two shots/);
  const guestless = {...film.shots[1], guests: [{shot: 'a', layer: 'boat', window: [3, 4] as [number, number], after: 0}]};
  assert.throws(() => validateDepthFilm({...film, shots: [film.shots[0], guestless]}), /unknown layer/);
});

test('helpers: piecewise anchor paths and the periphery weight', () => {
  const x = piecewise([[0, 100], [2, 300], [4, 300]]);
  assert.equal(x(-1), 100);
  assert.equal(x(1), 200);
  assert.equal(x(9), 300);
  assert.equal(peripheryWeight(.5, .5), 0);
  assert.equal(peripheryWeight(0, 0), 1);
});
