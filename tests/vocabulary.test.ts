import assert from 'node:assert/strict';
import test from 'node:test';
import {LANDSCAPE, STAGES} from '../src/kit/camera';
import {arc, gridDelay, impact, moveCamera, rampRate, rampTime, shake, spring, springCurve, staggerRank} from '../src/kit/moves';
import {PRESET_NAMES, poseAt, poseStyle, preset, unitOf, type Pose} from '../src/kit/presets';
import {SCENE_TRANSITIONS} from '../src/kit/scene/SceneTransition';
import {cardsPose, cardsSettings} from '../src/kit/scene/cards';
import {focusPose, focusSettings} from '../src/kit/scene/focus';
import {liquidPose, liquidSettings} from '../src/kit/scene/liquid';
import {splitGeometry, splitOpen, splitSettings} from '../src/kit/scene/split';
import {stackPose, stackSettings} from '../src/kit/scene/stack';
import {tileShrink, tilesSettings} from '../src/kit/scene/tiles';
import {tiltPose} from '../src/kit/scene/tilt';
import {whipRate, whipTravel} from '../src/kit/scene/whip';
import {depthOf, camera3DAt} from '../src/kit/choreography';

const near = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

test('springs start at rest, settle on 1, and bounce only when asked', () => {
  assert.equal(spring(0), 0);
  assert.ok(near(spring(3, {duration: .6, bounce: .3}), 1, 1e-4));
  const samples = (bounce: number) => Array.from({length: 200}, (_, i) => spring(i / 100, {duration: .6, bounce}));
  assert.ok(Math.max(...samples(0)) <= 1 + 1e-9, 'no overshoot without bounce');
  assert.ok(Math.max(...samples(.5)) > 1.05, 'a bouncy spring overshoots');
  for (const bounce of [0, .25, .45, .6, .8]) {
    const curve = springCurve(bounce);
    assert.equal(curve(0), 0);
    assert.equal(curve(1), 1);
    assert.ok(near(curve(.999), 1, .006), `springCurve(${bounce}) has settled before its end`);
  }
  assert.throws(() => spring(.1, {duration: 0}));
});

test('handheld noise and hits are smooth, repeatable, and quiet outside their moment', () => {
  assert.deepEqual(shake(2.37, {seed: 4}), shake(2.37, {seed: 4}));
  assert.notDeepEqual(shake(2.37, {seed: 4}), shake(2.37, {seed: 5}));
  const a = shake(1, {amount: 6}), b = shake(1 + 1 / 240, {amount: 6});
  assert.ok(Math.abs(a.x - b.x) < .5, 'no jumps between neighboring instants');
  assert.deepEqual(impact(.9, 1), {x: 0, y: 0, rotate: 0, scale: 1});
  const hit = impact(1.01, 1, {amount: 30});
  assert.ok(Math.hypot(hit.x, hit.y) > 10 && Math.hypot(impact(2, 1).x, impact(2, 1).y) < .1);
});

test('arcs meet their ends and bow sideways; staggers and grid waves order pieces', () => {
  const a = {x: 0, y: 0}, b = {x: 100, y: 0};
  assert.deepEqual(arc(0, a, b, .3), a);
  assert.deepEqual(arc(1, a, b, .3), b);
  assert.ok(arc(.5, a, b, .3).y > 10 && arc(.5, a, b, -.3).y < -10);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => staggerRank(i, 5, 'center')), [2, 1, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3, 4].map(i => staggerRank(i, 5, 'edges')), [0, 1, 2, 1, 0]);
  assert.deepEqual([0, 1, 2].map(i => staggerRank(i, 3, 'end')), [2, 1, 0]);
  const random = [0, 1, 2, 3, 4, 5].map(i => staggerRank(i, 6, 'random', 9));
  assert.deepEqual([...random].sort(), [0, 1, 2, 3, 4, 5]);
  assert.throws(() => staggerRank(5, 5));
  assert.equal(gridDelay(0, 0, 8, 4, 'diagonal'), 0);
  assert.equal(gridDelay(7, 3, 8, 4, 'diagonal'), 1);
  assert.equal(gridDelay(3.5, 1.5, 8, 4, 'radial'), 0);
  for (const pattern of ['diagonal', 'radial', 'rows', 'columns', 'random'] as const)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {const d = gridDelay(c, r, 8, 4, pattern); assert.ok(d >= 0 && d <= 1, `${pattern} ${c},${r}`);}
});

test('speed ramps integrate exactly, keep time continuous, and report their rate', () => {
  const keys = [{at: 1, rate: 1}, {at: 2, rate: .2}, {at: 3, rate: .2}, {at: 3.5, rate: 2}];
  assert.equal(rampTime(.5, keys), .5, 'before the first key time runs normally');
  assert.ok(near(rampTime(2, keys), 1 + (1 + .2) / 2));
  assert.ok(near(rampTime(3, keys), 1.6 + .2));
  assert.ok(near(rampTime(4, keys), 1.8 + .5 * 1.1 + .5 * 2));
  let previous = -Infinity;
  for (let t = 0; t <= 5; t += .01) {const s = rampTime(t, keys); assert.ok(s >= previous - 1e-12); previous = s;}
  assert.equal(rampRate(2.5, keys), .2);
  assert.ok(near(rampRate(3.25, keys), 1.1));
  assert.throws(() => rampTime(1, [{at: 1, rate: 1}, {at: 1, rate: 2}]));
});

test('camera moves start and end on their framings', () => {
  const from = {x: 0, y: 0, scale: 1}, to = {x: -300, y: 120, scale: 2};
  for (const move of ['glide', 'whip', 'crash', 'spring', 'drift'] as const) {
    assert.deepEqual(moveCamera(0, from, to, 1, .5, move), from);
    const end = moveCamera(1.5, from, to, 1, .5, move);
    assert.ok(near(end.x, -300) && near(end.y, 120) && near(end.scale, 2), move);
  }
});

const hidden = (pose: Pose, mask: boolean) => (pose.opacity ?? 1) <= .001 || (mask && Math.abs(pose.y ?? 0) >= 1) || (pose.wipe ?? 0) >= 1 || (pose.wipe ?? 0) <= -1;
const atRest = (pose: Pose) => (pose.x ?? 0) === 0 && (pose.y ?? 0) === 0 && (pose.rotate ?? 0) === 0 && (pose.rotateX ?? 0) === 0
  && (pose.rotateY ?? 0) === 0 && (pose.skewX ?? 0) === 0 && (pose.blur ?? 0) === 0 && (pose.opacity ?? 1) === 1
  && (pose.scale ?? 1) === 1 && (pose.scaleX ?? 1) === 1 && (pose.scaleY ?? 1) === 1 && (pose.weight ?? 1) === 1
  && !(pose.tracking ?? 0) && !(pose.wipe ?? 0) && !(pose.split ?? 0);

test('every motion preset starts hidden, lands exactly at rest, and leaves completely', () => {
  assert.equal(PRESET_NAMES.length, 18);
  for (const name of PRESET_NAMES) {
    const p = preset(name);
    for (const index of [0, 3, 7]) {
      const u = unitOf(index, 9, 2);
      assert.ok(hidden(p.enter(0, u), !!p.mask), `${name} is hidden before it enters`);
      assert.ok(atRest(p.enter(1, u)), `${name} lands at rest`);
      assert.ok(atRest(p.exit(0, u)), `${name} leaves from rest`);
      assert.ok(hidden(p.exit(1, u), !!p.mask), `${name} is gone after it leaves`);
    }
    assert.ok(p.look.length > 20 && p.duration > 0, `${name} documents itself`);
  }
  // Before its start a piece shows its hidden pose; exits take over at exitAt.
  const u = unitOf(0, 1);
  assert.equal(poseAt(0, u, {enter: 'pop', start: 1}).pose.scale, 0);
  assert.equal(poseAt(5, u, {enter: 'pop', start: 1, exitAt: 5}).phase, 'exit');
  assert.deepEqual(unitOf(4, 9, 3), unitOf(4, 9, 3));
  assert.equal(poseStyle({}, 100).transform, undefined);
  assert.match(String(poseStyle({rotateX: -40, y: .5}, 100).transform), /^perspective\(600px\) translate\(0\.00px, 50\.00px\) rotateX/);
});

test('the eight new transitions start on the outgoing shot and end exactly on the incoming one', () => {
  for (const kind of ['whip', 'stack', 'tiles', 'split', 'focus', 'liquid', 'tilt', 'cards'] as const) assert.ok(SCENE_TRANSITIONS[kind].duration > 0);
  // Whip: a continuous strip, fastest at the middle.
  assert.equal(whipTravel(0), 0);
  assert.ok(near(whipTravel(1), 1));
  assert.ok(near(whipTravel(.5 - 1e-6), whipTravel(.5 + 1e-6), 1e-4));
  assert.ok(whipRate(.5) > 5 && whipRate(0) < .05 && whipRate(1) < .05);
  // Stack: the card starts off frame and lands flat.
  const st = stackSettings({}), s0 = stackPose(0, st), s1 = stackPose(1, st);
  assert.ok(s0.offset >= LANDSCAPE.height && s1.offset === 0 && s1.radius === 0 && s1.cardScale === 1);
  // Tiles: all whole at the start and all gone at the end, in portrait too.
  for (const stage of [LANDSCAPE, STAGES.portrait]) {
    const ts = tilesSettings({pattern: 'radial'}, stage);
    assert.ok(ts.columns * ts.cell >= stage.width - 1e-9 && ts.rows * ts.cell >= stage.height - 1e-9, 'tiles cover the frame');
    assert.ok(tileShrink(0, ts).flat().every(k => k === 0) && tileShrink(1, ts).flat().every(k => k === 1));
  }
  // Split: the halves clear the frame at any angle.
  for (const angle of [90, 0, 25]) {
    const ss = splitSettings({angle}), g = splitGeometry(ss);
    assert.equal(splitOpen(0, g.travel), 0);
    assert.equal(splitOpen(1, g.travel), g.travel);
    for (const [x, y] of [[0, 0], [1920, 0], [0, 1080], [1920, 1080]]) assert.ok(Math.abs((x - 960) * g.n.x + (y - 540) * g.n.y) < g.travel);
  }
  // Focus and liquid: sharp, undistorted ends; the swap happens in the middle.
  const f = focusSettings({}), l = liquidSettings({});
  assert.ok(focusPose(0, f).outBlur === 0 && focusPose(0, f).alpha === 0 && focusPose(1, f).inBlur === 0 && focusPose(1, f).alpha === 1 && focusPose(1, f).inScale === 1);
  assert.ok(liquidPose(0, l).displace === 0 && liquidPose(1, l).displace < 1e-9 && liquidPose(1, l).alpha === 1 && liquidPose(.5, l).displace === l.amount);
  // Tilt: planes rest at both ends.
  assert.deepEqual(tiltPose(0), {away: 0, arrive: 0});
  assert.deepEqual(tiltPose(1), {away: 1, arrive: 1});
  // Cards: full frame at both ends, and the two cards never overlap in between.
  const cs = cardsSettings({}), c0 = cardsPose(0, cs), c1 = cardsPose(1, cs);
  assert.ok(c0.scale === 1 && c0.outgoing === 0 && c1.scale === 1 && c1.incoming === 0 && c1.corner === 0);
  for (let p = 0; p <= 1; p += .01) {
    const c = cardsPose(p, cs);
    assert.ok(c.incoming - c.outgoing >= 1920 * c.scale - 1e-6, `cards overlap at ${p.toFixed(2)}`);
  }
});

test('3D cameras interpolate keys and measure depth from the camera', () => {
  const cam = camera3DAt(1.5, [{time: 1, yaw: -20, distance: 2000}, {time: 2, yaw: 20, distance: 1800}]);
  assert.ok(near(cam.yaw ?? NaN, 0) && near(cam.distance ?? NaN, 1900));
  const space = {target: {x: 960, y: 540, z: 0}, yaw: 0, pitch: 0, distance: 2000};
  assert.equal(depthOf({x: 960, y: 540, z: 0}, space), 2000);
  assert.equal(depthOf({x: 960, y: 540, z: 300}, space), 1700, 'planes toward the viewer are nearer');
  assert.ok(near(depthOf({x: 1260, y: 540, z: 0}, {...space, yaw: 90}), 2000 - 300, 1e-6), 'orbiting brings the side nearer');
  assert.throws(() => camera3DAt(0, [{time: 1}, {time: 1}]));
});
