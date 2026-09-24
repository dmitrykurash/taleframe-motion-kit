import assert from 'node:assert/strict';
import test from 'node:test';
import {LANDSCAPE, STAGES, focusCamera, stageFor} from '../src/kit/camera';
import {expandContent, expandSettings, expandWindow} from '../src/kit/scene/expand';
import {coverZoom} from '../src/kit/scene/glyphs';
import {planShots} from '../src/kit/scene/Shots';
import {zoomSettings} from '../src/kit/scene/zoom';
import {KIT_REEL_SECONDS, kitReelShots} from '../src/examples/KitReel';
import {EXPLAINER_SECONDS, explainerShots} from '../src/examples/ProductExplainer';
import {LAUNCH_SECONDS, launchShots} from '../src/examples/ProductLaunch';

test('each output aspect ratio gets its own logical stage', () => {
  assert.deepEqual(stageFor(1920, 1080), LANDSCAPE);
  assert.deepEqual(stageFor(3840, 2160), LANDSCAPE);
  assert.deepEqual(stageFor(1080, 1920), STAGES.portrait);
  assert.deepEqual(stageFor(2160, 3840), STAGES.portrait);
  assert.deepEqual(stageFor(1080, 1080), STAGES.square);
  assert.deepEqual(stageFor(1080, 1350), STAGES.feed);
  assert.throws(() => stageFor(1000, 700), /Use 16:9, 9:16, 1:1, or 4:5/);
});

test('focusCamera puts a target on the requested screen point of a portrait stage', () => {
  const stage = STAGES.portrait, target = {x: 822, y: 950}, screen = {x: 540, y: 1000};
  const camera = focusCamera(target, 1.5, screen, stage);
  // CameraLayer scales around the stage center, then translates.
  const place = (value: number, center: number, shift: number) => center + (value - center) * camera.scale + shift;
  assert.ok(Math.abs(place(target.x, stage.width / 2, camera.x) - screen.x) < 1e-9);
  assert.ok(Math.abs(place(target.y, stage.height / 2, camera.y) - screen.y) < 1e-9);
  assert.deepEqual(focusCamera({x: 540, y: 960}, 2, undefined, stage), {scale: 2, x: 0, y: 0});
});

test('scene transitions measure the portrait stage, not a landscape one', () => {
  const stage = STAGES.portrait;
  const center = expandSettings({}, stage).source;
  assert.deepEqual([center.x + center.width / 2, center.y + center.height / 2], [540, 960]);
  const dot = expandWindow(1, expandSettings({shape: 'circle', source: {x: 510, y: 1240, width: 60, height: 60}}, stage));
  assert.ok(dot.radius >= Math.hypot(540, 1270), 'a circle grown from low in the frame still covers the top corners');
  const card = expandWindow(1, expandSettings({source: {x: 100, y: 800, width: 200, height: 120}}, stage));
  assert.ok(card.kind === 'rect' && card.x < 0 && card.y < 0 && card.x + card.width > 1080 && card.y + card.height > 1920);
  assert.equal(expandContent({x: -10, y: -10, width: 1100, height: 1940}, stage), 'translate(540px, 960px) scale(1) translate(-540px, -960px)');
  assert.deepEqual(zoomSettings({}, stage).focus, {x: 540, y: 960});
  const {scale} = coverZoom({x: 90, y: 200, width: 300, height: 300}, stage);
  assert.ok(300 * scale >= 1920 - 1e-6, 'a portal rect fills the tall side of the frame');
});

test('the demo films plan cleanly and leave time on their last shot', () => {
  for (const [shots, seconds] of [[explainerShots, EXPLAINER_SECONDS], [launchShots, LAUNCH_SECONDS], [kitReelShots, KIT_REEL_SECONDS]] as const) {
    const {cuts, windows} = planShots(shots);
    assert.ok(cuts[cuts.length - 1] <= seconds - 3.5, 'the end card holds');
    assert.ok(windows.every(w => w.end <= seconds));
  }
  assert.deepEqual(kitReelShots.flatMap(shot => shot.enter ? [shot.enter.kind] : []), ['zoom', 'expand', 'slice', 'glitch', 'portal'],
    'the reel plays all five scene transitions, in the order it names them');
});
