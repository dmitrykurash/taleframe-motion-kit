import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {listTransitions, resolveParams, getTransitionModule, LEGACY_TRANSITION_IDS} from '../src/taleframe/transitions/registry';
import {imagePlacement, transitionFrame} from '../src/taleframe/transitions/adapter';
import {TRANSITION_CATALOG} from '../src/taleframe/transitions/catalog';

test('all 15 current and five legacy native transitions are available', () => {
  assert.equal(listTransitions().length, 15);
  assert.equal(listTransitions(true).length, 20);
  assert.equal(new Set(listTransitions(true).map((mod) => mod.meta.id)).size, 20);
  assert.deepEqual([...TRANSITION_CATALOG.map((m) => m.id)].sort(), listTransitions(true).map((m) => m.meta.id).sort());
  assert.deepEqual(LEGACY_TRANSITION_IDS, ['fold', 'halftone', 'signal', 'ribbon', 'frost']);
});

test('native transition modules match the recorded source snapshot byte for byte', () => {
  const base = new URL('../src/taleframe/transitions/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('PROVENANCE.json', base), 'utf8'));
  for (const [name, entry] of Object.entries(provenance.files) as [string, {mode: string; sourceSha256: string; vendoredSha256: string}][]) {
    const hash = createHash('sha256').update(readFileSync(new URL(name, base))).digest('hex');
    assert.equal(hash, entry.vendoredSha256, name);
    if (entry.mode === 'exact') assert.equal(hash, entry.sourceSha256, name);
  }
});

test('native parameter defaults and clamp rules keep authored settings valid', () => {
  for (const module of listTransitions(true)) {
    const resolved = resolveParams(module.params, {});
    for (const param of module.params) assert.deepEqual(resolved[param.id], param.default, `${module.meta.id}.${param.id}`);
  }
  const values = resolveParams('watercolor', {count: 99, seed: 21.9, water: '18', center: {x: .25, y: .4}, missing: 2});
  assert.equal(values.count, 12);
  assert.equal(values.seed, 22);
  assert.equal(values.water, 18);
  assert.deepEqual(values.center, {x: .25, y: .4});
  assert.equal(values.missing, undefined);
  assert.equal(resolveParams('watercolor', {count: NaN}).count, 7);
});

test('frame evaluation is independent of seek history and keeps exact endpoints', () => {
  for (const {meta} of listTransitions(true)) {
    const at = (frame: number) => transitionFrame(frame, 30, 61, 60, meta.id, {seed: 7});
    const middle = at(60);
    for (const frame of [90, 31, 5, 79, 120, 30]) at(frame);
    assert.deepEqual(at(60), middle);
    assert.equal(at(0).progress, 0);
    assert.equal(at(30).eased, 0);
    assert.equal(at(90).eased, 1);
    assert.equal(at(500).progress, 1);
    assert.equal(at(60).progress, .5);
  }
});

test('bad transition names, durations and curves fail loudly', () => {
  assert.throws(() => transitionFrame(0, 0, 20, 60, 'typo'), /Unknown transition/);
  for (const length of [0, 1, 2.5, NaN]) assert.throws(() => transitionFrame(0, 0, length, 60, 'watercolor'));
  assert.throws(() => transitionFrame(0, 0, 20, 0, 'watercolor'));
  assert.throws(() => transitionFrame(0, 0, 20, 60, 'watercolor', {}, [2, 0, 1, 1]), /easing/);
  assert.equal(getTransitionModule('watercolor').meta.id, 'watercolor');
});

test('image staging preserves aspect ratio for cover and contain', () => {
  assert.deepEqual(imagePlacement(800, 800, 1920, 1080, 'cover'), {x: 0, y: -420, width: 1920, height: 1920});
  assert.deepEqual(imagePlacement(800, 800, 1920, 1080, 'contain'), {x: 420, y: 0, width: 1080, height: 1080});
  assert.deepEqual(imagePlacement(800, 800, 1920, 1080, 'stretch'), {x: 0, y: 0, width: 1920, height: 1080});
  assert.throws(() => imagePlacement(0, 800, 1920, 1080, 'cover'));
});
