import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_SPAN, PRESETS, clamp, fromInputValue, fromQuery, resolve, shift, snapToPreset, toInputValue, toQuery, zoomOut } from './timerange.mjs';

const H = 3600000;
const bounds = { start: 0, end: 168 * H };

test('presets follow the newest data; long presets are cut to the available data', () => {
  assert.deepEqual(resolve({ preset: '24h' }, bounds), { from: 144 * H, to: 168 * H, preset: '24h' });
  assert.equal(resolve({ preset: '7d' }, { start: 100 * H, end: 168 * H }).from, 100 * H);
  assert.equal(resolve({ preset: 'nonsense' }, bounds).preset, '24h');
  assert.equal(resolve(null, bounds).preset, '24h');
  assert.equal(PRESETS.length, 7);
  assert.deepEqual(resolve({ preset: 'vse' }, bounds), { from: 0, to: 168 * H, preset: 'vse' });
});

test('fixed ranges are kept inside the data and at least 30 minutes long', () => {
  assert.deepEqual(clamp({ from: 10 * H, to: 12 * H }, bounds), { from: 10 * H, to: 12 * H });
  assert.deepEqual(clamp({ from: 12 * H, to: 10 * H }, bounds), { from: 10 * H, to: 12 * H });
  assert.equal(clamp({ from: 5 * H, to: 5 * H + 1000 }, bounds).to - 5 * H, MIN_SPAN);
  assert.deepEqual(clamp({ from: -5 * H, to: H }, bounds), { from: 0, to: 6 * H });
  assert.deepEqual(clamp({ from: 167 * H, to: 170 * H }, bounds), { from: 165 * H, to: 168 * H });
  const r = resolve({ from: 10 * H, to: 20 * H }, bounds);
  assert.equal(r.preset, null);
});

test('zoom out doubles around the middle, never past the data', () => {
  assert.deepEqual(zoomOut({ from: 10 * H, to: 20 * H }, bounds), { from: 5 * H, to: 25 * H });
  assert.deepEqual(zoomOut({ from: 0, to: 168 * H }, bounds), { from: 0, to: 168 * H });
  assert.deepEqual(zoomOut({ from: 160 * H, to: 168 * H }, bounds), { from: 152 * H, to: 168 * H });
});

test('shift moves by half the range and stops at the ends', () => {
  assert.deepEqual(shift({ from: 10 * H, to: 20 * H }, -1, bounds), { from: 5 * H, to: 15 * H });
  assert.deepEqual(shift({ from: 10 * H, to: 20 * H }, 1, bounds), { from: 15 * H, to: 25 * H });
  assert.deepEqual(shift({ from: 160 * H, to: 168 * H }, 1, bounds), { from: 160 * H, to: 168 * H });
});

test('a range ending now with a preset length snaps back to the preset', () => {
  assert.deepEqual(snapToPreset({ from: 162 * H, to: 168 * H }, bounds), { preset: '6h' });
  assert.deepEqual(snapToPreset({ from: 0, to: 168 * H }, bounds), { preset: '7d' });
  assert.deepEqual(snapToPreset({ from: 160 * H, to: 166 * H }, bounds), { from: 160 * H, to: 166 * H });
  assert.deepEqual(snapToPreset({ from: 165 * H, to: 168 * H }, bounds), { from: 165 * H, to: 168 * H });
});

test('URL round trip for presets and fixed ranges; junk is ignored', () => {
  assert.equal(toQuery({ preset: '6h' }), 'obdobje=6h');
  assert.deepEqual(fromQuery('?obdobje=6h'), { preset: '6h' });
  const q = toQuery({ from: 10 * H, to: 20 * H, preset: null });
  assert.deepEqual(fromQuery(`?${q}`), { from: 10 * H, to: 20 * H });
  assert.equal(fromQuery('?obdobje=99y'), null);
  assert.equal(fromQuery('?od=x&do=y'), null);
  assert.equal(fromQuery(''), null);
});

test('datetime-local values round trip to the minute', () => {
  const ms = Date.parse('2026-10-20T13:05:00Z');
  assert.equal(fromInputValue(toInputValue(ms)), ms);
  assert.ok(Number.isNaN(fromInputValue('')));
});
