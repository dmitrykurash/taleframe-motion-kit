import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeEffects} from '../src/taleframe/effects/adapter';
import {DEFAULT_WATERCOLOR, normalizeWatercolor} from '../src/taleframe/effects/native/paint/model';
import {brushGrid, OIL_LEVELS} from '../src/taleframe/effects/native/paint/brushGrid';
import {OIL_BRUSH_DIR, OIL_BRUSH_FILES, oilFocus, oilStyle} from '../src/kit/oil';
import {LOOSE_OIL, looseOil, paintEffects, WATERCOLOR_BROAD, WATERCOLOR_FINE} from '../src/kit/looks';

const REFERENCE: [number, number] = [1920, 1080];

test('watercolor settings normalise exactly as before when style is absent', () => {
  const plain = normalizeWatercolor({...WATERCOLOR_BROAD});
  assert.equal(plain.style, undefined);
  assert.deepEqual(Object.keys(plain).sort(), Object.keys(DEFAULT_WATERCOLOR).sort());
  // Oil-only controls are ignored without the oil style.
  const stray = normalizeWatercolor({...WATERCOLOR_BROAD, focus: [.5, .5, .1, .1], strokeScale: 2, looseness: 3});
  assert.deepEqual(stray, plain);
  // A watercolor that is already normal comes back as the same object.
  assert.equal(normalizeWatercolor(plain), plain);
});

test('the oil style is kept with its controls', () => {
  const oil = normalizeWatercolor({...WATERCOLOR_BROAD, style: 'oil', strokeScale: 2, looseness: 2.4, focus: [.5, .4, .1, .2]});
  assert.equal(oil.style, 'oil');
  assert.equal(oil.strokeScale, 2);
  assert.equal(oil.looseness, 2.4);
  assert.deepEqual(oil.focus, [.5, .4, .1, .2]);
  assert.equal(oil.brushSize, WATERCOLOR_BROAD.brushSize);
  assert.equal(normalizeEffects({watercolor: {enabled: true, style: 'oil'}}).watercolor.style, 'oil');
  assert.equal(normalizeWatercolor({style: 'acrylic'}).style, undefined);
});

test('focus is trimmed to whole ellipses, at most four, finite only', () => {
  const focus = (value: unknown) => normalizeWatercolor({style: 'oil', focus: value}).focus;
  assert.deepEqual(focus([.1, .2, .3, .4, .5, .6]), [.1, .2, .3, .4]);
  assert.equal(focus(Array.from({length: 20}, (_, i) => i / 20))!.length, 16);
  assert.equal(focus([.1, .2, .3]), undefined);
  assert.equal(focus([.1, .2, NaN, .4]), undefined);
  assert.equal(focus('face'), undefined);
});

test('strokeScale and looseness are clamped', () => {
  const oil = (extra: object) => normalizeWatercolor({style: 'oil', ...extra});
  assert.equal(oil({strokeScale: 20}).strokeScale, 8);
  assert.equal(oil({strokeScale: .01}).strokeScale, .25);
  assert.equal(oil({strokeScale: 0}).strokeScale, undefined);
  assert.equal(oil({strokeScale: -1}).strokeScale, undefined);
  assert.equal(oil({strokeScale: Infinity}).strokeScale, undefined);
  assert.equal(oil({looseness: 20}).looseness, 8);
  assert.equal(oil({looseness: .5}).looseness, 1);
  assert.equal(oil({looseness: NaN}).looseness, undefined);
});

test('oilStyle flattens focus tuples and keeps the watercolor untouched', () => {
  const base = {...WATERCOLOR_FINE};
  const oil = oilStyle(base, {strokeScale: 1.5, focus: [[.5, .3, .08, .12], [.2, .7, .1, .1]]});
  assert.deepEqual(base, WATERCOLOR_FINE);
  assert.equal(oil.style, 'oil');
  assert.equal(oil.strokeScale, 1.5);
  assert.equal('looseness' in oil, false);
  assert.deepEqual(oil.focus, [.5, .3, .08, .12, .2, .7, .1, .1]);
  assert.deepEqual(oilFocus([.1, .2, .3, .4, .5]), [.1, .2, .3, .4]);
  assert.deepEqual(oilFocus(Array.from({length: 6}, () => [.5, .5, .1, .1] as const)).length, 16);
  assert.deepEqual(oilFocus([[.5, NaN, .1, .1]]), []);
  assert.equal('focus' in oilStyle(base), false);
  // The helper output survives normalisation unchanged.
  const normal = normalizeWatercolor(oil);
  assert.deepEqual({style: normal.style, strokeScale: normal.strokeScale, focus: normal.focus}, {style: 'oil', strokeScale: 1.5, focus: oil.focus});
});

test('the loose oil look applies its defaults and optional focus', () => {
  const oil = looseOil(WATERCOLOR_BROAD, [[.5, .5, .2, .2]]);
  assert.equal(oil.strokeScale, LOOSE_OIL.strokeScale);
  assert.equal(oil.looseness, LOOSE_OIL.looseness);
  assert.deepEqual(oil.focus, [.5, .5, .2, .2]);
  assert.equal('focus' in looseOil(), false);
  assert.deepEqual(paintEffects(oil).order, ['watercolor']);
});

test('the oil lattice scales with strokeScale at every level', () => {
  assert.deepEqual(OIL_LEVELS, [1, .45, .2, .1]);
  for (let level = 0; level < OIL_LEVELS.length; level++) {
    const one = brushGrid(REFERENCE, 1920, 1080, .51, level, undefined, 0, true, 1);
    const two = brushGrid(REFERENCE, 1920, 1080, .51, level, undefined, 0, true, 2);
    assert.equal(one.segments, 1);
    assert.ok(Math.abs(two.spacing / one.spacing - 2) < 1e-9, `level ${level}: ${one.spacing} -> ${two.spacing}`);
    assert.ok(two.columns * two.rows < one.columns * one.rows);
  }
  // Coarse to fine: each oil level is a finer lattice than the one before.
  const spacing = OIL_LEVELS.map((_, level) => brushGrid(REFERENCE, 1920, 1080, .51, level, undefined, 0, true, 1).spacing);
  for (let i = 1; i < spacing.length; i++) assert.ok(spacing[i] < spacing[i - 1]);
});

test('the watercolor lattice ignores the oil scale', () => {
  for (let level = 0; level < 3; level++) {
    const plain = brushGrid(REFERENCE, 1920, 1080, .6, level);
    const scaled = brushGrid(REFERENCE, 1920, 1080, .6, level, undefined, 0, false, 3);
    assert.deepEqual(scaled, plain);
    assert.equal(plain.segments, [6, 4, 1][level]);
  }
});

test('the paint engine files match their recorded hashes, and the brushes are in public/', () => {
  const base = new URL('../src/taleframe/effects/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('PROVENANCE.json', base), 'utf8')) as {files: {destination: string; vendoredSha256: string}[]};
  const paint = provenance.files.filter(entry => /^native\/paint\/(model|render|brushGrid|painterly)\.ts$/.test(entry.destination));
  assert.equal(paint.length, 4);
  for (const entry of paint) {
    const hash = createHash('sha256').update(readFileSync(new URL(entry.destination, base))).digest('hex');
    assert.equal(hash, entry.vendoredSha256, entry.destination);
  }
  for (const file of Object.values(OIL_BRUSH_FILES))
    assert.ok(existsSync(new URL(`../public/${OIL_BRUSH_DIR}/${file}`, import.meta.url)), file);
});
