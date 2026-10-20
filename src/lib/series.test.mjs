import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSpans, segments, ticks } from './series.mjs';

const t0 = Date.parse('2026-10-20T00:00:00Z'), step = 300000;
const rows = values => values.map((v, i) => ({ receivedAt: t0 + i * step, v }));

test('continuous data is one run', () => {
  assert.deepEqual(segments(rows([1, 2, 3]), r => r.v), [[0, 1, 2]]);
});

test('missing values and missing samples break the line', () => {
  assert.deepEqual(segments(rows([1, NaN, 3, 4]), r => r.v), [[0], [2, 3]]);
  const data = rows([1, 2, 3, 4]);
  data[2].receivedAt += 3 * step; data[3].receivedAt += 3 * step;
  assert.deepEqual(segments(data, r => r.v), [[0, 1], [2, 3]]);
});

test('no valid values gives no runs', () => {
  assert.deepEqual(segments(rows([NaN, NaN]), r => r.v), []);
  assert.deepEqual(segments([], r => r.v), []);
});

test('overlapping spans merge, separate spans stay apart', () => {
  assert.deepEqual(mergeSpans([{ start: 5, end: 8 }, { start: 0, end: 6 }, { start: 10, end: 12 }]),
    [{ start: 0, end: 8 }, { start: 10, end: 12 }]);
  assert.deepEqual(mergeSpans([]), []);
});

test('ticks are low, middle, high; flat ranges are widened', () => {
  assert.deepEqual(ticks(0, 10), [0, 5, 10]);
  const [lo, , hi] = ticks(4, 4);
  assert.ok(lo < 4 && hi > 4);
  assert.deepEqual(ticks(NaN, 1), []);
});
