import assert from 'node:assert/strict';
import test from 'node:test';
import {samplesForStreak, shutterOffsets} from '../src/kit/MotionBlur';
import {curves, extended, overshoot} from '../src/kit/scene/curves';
import {expandContent, expandSettings, expandWindow} from '../src/kit/scene/expand';
import {glitchFrame, glitchSettings} from '../src/kit/scene/glitch';
import {coverZoom, deepestPoint, insideDistance} from '../src/kit/scene/glyphs';
import {portalTiming, shapeGeometry} from '../src/kit/scene/portal';
import {activeWindow, planShots, shotIndexAt} from '../src/kit/scene/Shots';
import {SCENE_TRANSITIONS} from '../src/kit/scene/SceneTransition';
import {bandDelays, bandTravel, sliceSettings} from '../src/kit/scene/slice';
import {zoomPose, zoomSettings, zoomSpeed} from '../src/kit/scene/zoom';

const shot = (until?: number, enter?: Parameters<typeof planShots>[0][number]['enter']) => ({until, content: null, enter});

test('shots cut where they say, and transition windows sit on the cut by alignment', () => {
  const {cuts, windows} = planShots([shot(2), shot(5, {kind: 'zoom', duration: .6}), shot(8, {kind: 'expand', duration: .8}),
    shot(undefined, {kind: 'glitch', duration: .4, align: 'end'})]);
  assert.deepEqual(cuts, [2, 5, 8]);
  assert.deepEqual(windows.map(w => [w.index, +w.start.toFixed(9), +w.end.toFixed(9)]), [[1, 1.7, 2.3], [2, 5, 5.8], [3, 7.6, 8]]);
  const defaults = planShots([shot(3), shot(undefined, {kind: 'portal'})]).windows[0];
  assert.equal(defaults.start, 3);
  assert.ok(Math.abs(defaults.end - defaults.start - SCENE_TRANSITIONS.portal.duration) < 1e-9);
});

test('a window that starts on its cut opens on the outgoing shot, and each frame belongs to one shot', () => {
  const {cuts, windows} = planShots([shot(4.3), shot(6.9, {kind: 'portal', duration: 1.5, align: 'start'}), shot()]);
  assert.equal(activeWindow(windows, 129 / 30)?.index, 1, 'the cut frame is inside the window (progress 0 = outgoing shot)');
  assert.equal(activeWindow(windows, 4.3 + 1.5), undefined);
  assert.equal(shotIndexAt(cuts, 4.29), 0);
  assert.equal(shotIndexAt(cuts, 5.8), 1);
  assert.equal(shotIndexAt(cuts, 7), 2);
});

test('shot plans reject overlaps, missing cuts, and transitions that do not fit', () => {
  assert.throws(() => planShots([]), /at least one/);
  assert.throws(() => planShots([shot(), shot()]), /needs `until`/);
  assert.throws(() => planShots([shot(3), shot(2), shot()]), /before the previous cut/);
  assert.throws(() => planShots([shot(2, {kind: 'zoom'}), shot()]), /nothing to transition from/);
  assert.throws(() => planShots([shot(.2), shot(undefined, {kind: 'zoom', duration: 1})]), /before the previous shot/);
  assert.throws(() => planShots([shot(2), shot(2.3, {kind: 'expand', duration: .6}), shot()]), /after that shot already cut away/);
  assert.throws(() => planShots([shot(2), shot(undefined, {kind: 'whirl'} as never)]), /unknown transition/);
});

test('motion-blur samples are centered, stratified, and never ghost with only a few copies', () => {
  const offsets = shutterOffsets(8, .5, 30);
  assert.equal(offsets.length, 8);
  assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0)) < 1e-12);
  assert.ok(Math.max(...offsets.map(Math.abs)) < .5 / 30 / 2);
  assert.deepEqual(shutterOffsets(8, 0, 30), [0]);
  assert.throws(() => shutterOffsets(4, -1, 30));
  assert.equal(samplesForStreak(4), 1);
  assert.equal(samplesForStreak(7), 6);
  assert.equal(samplesForStreak(300, 24), 24);
  assert.equal(samplesForStreak(Number.NaN), 1);
});

test('curves hit their ends, and extended curves keep moving past them', () => {
  for (const curve of Object.values(curves)) {
    assert.ok(Math.abs(curve(0)) < 1e-9 && Math.abs(curve(1) - 1) < 1e-9);
  }
  const push = extended(curves.punchIn);
  assert.ok(push(1.05) > push(1) && push(1) > push(.95));
  assert.ok(Math.abs(overshoot(1)(1) - 1) < 1e-9);
  assert.ok(Math.max(...Array.from({length: 99}, (_, i) => overshoot(1)((i + 1) / 100))) > 1.02);
});

test('zoom starts and ends at rest, pushes in before the cut and settles after it', () => {
  const s = zoomSettings({push: 2.4, land: 1.6, roll: 4});
  assert.deepEqual(zoomPose(0, s).outgoing, {scale: 1, roll: 0});
  assert.ok(Math.abs(zoomPose(1, s).incoming.scale - 1) < 1e-9 && Math.abs(zoomPose(1, s).incoming.roll) < 1e-9);
  assert.ok(Math.abs(zoomPose(s.cut, s).outgoing.scale - 2.4) < 1e-9);
  assert.ok(zoomPose(s.cut + .02, s).outgoing.scale > 2.4, 'samples past the cut keep accelerating');
  assert.ok(zoomPose(.6, s).incoming.scale > zoomPose(.8, s).incoming.scale);
  assert.ok(zoomSpeed(0, s, .5, 30) < .5, 'at rest the fastest point moves less than half a pixel per frame');
  assert.ok(zoomSpeed(.45, s, .5, 30) > zoomSpeed(.2, s, .5, 30));
});

test('a portal rect becomes exactly the frame, and circle portals cover every corner', () => {
  const rect = {x: 1236, y: 60, width: 624, height: 351};
  const {scale, fixed} = coverZoom(rect);
  assert.ok(Math.abs(fixed.x + scale * (rect.x + rect.width / 2 - fixed.x) - 960) < 1e-6);
  assert.ok(Math.abs(fixed.y + scale * (rect.y + rect.height / 2 - fixed.y) - 540) < 1e-6);
  assert.ok(rect.width * scale >= 1920 - 1e-6 && rect.height * scale >= 1080 - 1e-6);
  const circle = shapeGeometry({circle: {x: 300, y: 200, radius: 40}})!;
  assert.ok(circle.scale * 40 >= Math.hypot(1920 - 300, 1080 - 200));
  assert.equal(portalTiming({}, 'text').reveal, .38);
  assert.throws(() => coverZoom({x: 0, y: 0, width: 0, height: 10}));
});

test('the deepest point of a shape is its inscribed-circle center', () => {
  const width = 60, height = 40, inside = new Uint8Array(width * height);
  for (let y = 10; y < 30; y++) for (let x = 5; x < 55; x++) inside[y * width + x] = 1;
  const deep = deepestPoint(inside, width, height);
  assert.ok(Math.abs(deep.y - 20) <= 1 && deep.x > 14 && deep.x < 46);
  assert.ok(Math.abs(deep.radius - 10) <= 1);
  assert.equal(insideDistance(inside, width, height)[0], 0);
  assert.throws(() => deepestPoint(new Uint8Array(4), 2, 2), /no filled pixels/);
});

test('expand grows from the source element past the frame, and the new shot lands exactly', () => {
  const s = expandSettings({source: {x: 1352, y: 578, width: 210, height: 76, radius: 38}});
  const start = expandWindow(0, s), end = expandWindow(1, s);
  assert.deepEqual(start.kind === 'rect' && [start.x, start.y, start.width, start.height, start.radius], [1352, 578, 210, 76, 38]);
  assert.ok(end.kind === 'rect' && end.x < 0 && end.y < 0 && end.x + end.width > 1920 && end.y + end.height > 1080 && end.radius === 0);
  assert.equal(expandContent(start.kind === 'rect' ? start : {x: 0, y: 0, width: 1, height: 1}),
    `translate(1457px, 616px) scale(${210 / 1920}) translate(-960px, -540px)`);
  assert.equal(expandContent({x: -40, y: -40, width: 2000, height: 1160}), 'translate(960px, 540px) scale(1) translate(-960px, -540px)');
  // The window covers the frame before the end, while it is still moving.
  const covered = Array.from({length: 101}, (_, i) => i / 100).find(p => {const w = expandWindow(p, s); return w.kind === 'rect' && w.x <= 0 && w.y <= 0 && w.x + w.width >= 1920 && w.y + w.height >= 1080;});
  assert.ok(covered !== undefined && covered < .8);
  const round = expandWindow(1, expandSettings({shape: 'circle', source: {x: 100, y: 100, width: 50, height: 50}}));
  assert.ok(round.radius >= Math.hypot(1920 - 125, 1080 - 125));
});

test('slice bands are scheduled deterministically and rest at both ends', () => {
  const s = sliceSettings({bands: 5, stagger: .06});
  assert.deepEqual(bandDelays(s).map(d => +d.toFixed(2)), [0, .06, .12, .18, .24]);
  assert.deepEqual(bandDelays(sliceSettings({bands: 5, stagger: .06, order: 'reverse'})).map(d => +d.toFixed(2)), [.24, .18, .12, .06, 0]);
  const random = sliceSettings({bands: 6, order: 'random', seed: 3});
  assert.deepEqual(bandDelays(random), bandDelays(random));
  for (const delay of bandDelays(s)) {
    assert.equal(bandTravel(0, delay, s), 0);
    assert.equal(bandTravel(1, delay, s), 1);
  }
  assert.throws(() => sliceSettings({orientation: 'vertical', direction: 'left'}), /does not match/);
});

test('glitch patterns are repeatable, quiet at both ends, and switch shots at the cut', () => {
  const s = glitchSettings({intensity: .9, seed: 5});
  assert.equal(glitchFrame(10, 10, .5, s).energy, 0);
  assert.ok(glitchFrame(10.5, 10, .5, s).energy < 1e-9);
  assert.deepEqual(glitchFrame(10.23, 10, .5, s), glitchFrame(10.23, 10, .5, s));
  assert.equal(glitchFrame(10.2, 10, .5, s).incoming, false);
  assert.equal(glitchFrame(10.3, 10, .5, s).incoming, true);
  const a = glitchFrame(10.21, 10, .5, s), b = glitchFrame(10.21 + 1 / 120, 10, .5, s);
  assert.deepEqual(a.bands, b.bands, 'the pattern only changes at the glitch rate, not every render frame');
});
