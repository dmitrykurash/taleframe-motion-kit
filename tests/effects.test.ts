import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {effectFrame, normalizeEffects} from '../src/taleframe/effects/adapter';
import {postEffectPasses} from '../src/taleframe/effects/native/passes';
import {processPixels} from '../src/taleframe/effects/native/cpu';
import {grainTick} from '../src/taleframe/effects/native/model';
import {stopmotionVisualState} from '../src/taleframe/effects/native/stopmotion/visual';

test('all effects are opt in and zero-strength passes bypass', () => {
  assert.deepEqual(postEffectPasses(normalizeEffects()), []);
  assert.deepEqual(postEffectPasses(normalizeEffects({watercolor: {enabled: true, amount: 0}, grain: {enabled: true, amount: 0}})), []);
});

test('partial settings get native defaults; order is repaired and obeyed', () => {
  const settings = normalizeEffects({watercolor: {enabled: true}, grain: {enabled: true}, order: ['grain', 'watercolor', 'grain']});
  assert.equal(settings.watercolor.seed, 17);
  assert.deepEqual(postEffectPasses(settings), ['grain', 'watercolor']);
});

test('stopmotion holds the source draw frame, without changing output frame', () => {
  const settings = {stopmotion: {enabled: true, fps: 12, jitter: 0, texture: 0, rotation: 0, boil: 0}};
  const samples = Array.from({length: 11}, (_, i) => effectFrame(i, 60, 1920, 1080, settings));
  assert.deepEqual(samples.map(s => s.frame), [0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 10]);
  assert.deepEqual(samples.map(s => s.outputFrame), Array.from({length: 11}, (_, i) => i));
  assert.equal(effectFrame(19, 60, 1920, 1080).frame, 19);
});

test('arbitrary seeks produce identical grain and handmade states', () => {
  const e = normalizeEffects({grain: {enabled: true}, stopmotion: {enabled: true}});
  const first = stopmotionVisualState(e.stopmotion, 48000);
  stopmotionVisualState(e.stopmotion, 1234567);
  assert.deepEqual(stopmotionVisualState(e.stopmotion, 48000), first);
  const input = new Uint8ClampedArray([80, 130, 180, 255, 200, 80, 20, 255, 70, 10, 90, 255, 220, 180, 140, 255]);
  const grain = normalizeEffects({grain: {enabled: true, amount: .5}});
  const tick = grainTick(grain, 48000, {num: 60, den: 1});
  const firstPixels = processPixels(input, 2, 2, 2, 2, grain, tick, null);
  assert.deepEqual(processPixels(input, 2, 2, 2, 2, grain, tick, null), firstPixels);
  assert.notDeepEqual(firstPixels, input);
});

test('duotone maps black and white to the selected endpoint colors', () => {
  const settings = normalizeEffects({duotone: {enabled: true, shadows: '#123456', highlights: '#fedcba'}});
  const output = processPixels(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1, 2, 1, settings, 0, null);
  assert.deepEqual([...output], [0x12, 0x34, 0x56, 255, 0xfe, 0xdc, 0xba, 255]);
});
