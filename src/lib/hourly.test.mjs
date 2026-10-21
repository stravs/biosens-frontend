import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ADD_TO_HOUR, HOUR, HOURS_TABLE, MAX_POINTS, SUM_BUCKETS, bucketSize, hourStart, hourlyValues, rowFromBucket } from './hourly.mjs';

const t0 = Date.parse('2026-10-01T00:00:00Z');
const reading = (temperature, s0) => ({ temperature, conductivity: 400, turbidity: 3, fluorescenceRaw: 2, fluorescence: 4,
  spectrum: Array.from({ length: 18 }, (_, i) => ({ value: i ? 1000 : s0 })) });

// The same SQL the Worker runs, on SQLite (D1 is SQLite too).
function db(readings) {
  const d = new DatabaseSync(':memory:');
  d.exec(HOURS_TABLE);
  const add = d.prepare(ADD_TO_HOUR);
  for (const [ms, r] of readings) add.run(hourStart(ms), ...hourlyValues(r));
  return d;
}
const buckets = (d, from, to) => {
  const bucket = bucketSize(from, to);
  return d.prepare(SUM_BUCKETS).all(from, bucket, to).map(r => rowFromBucket(r, from, bucket));
};

test('readings in the same hour add up; the page gets their average', () => {
  const d = db([[t0 + 60000, reading(10, 100)], [t0 + 30 * 60000, reading(12, 300)], [t0 + HOUR + 1, reading(20, 500)]]);
  const rows = buckets(d, t0, t0 + 2 * HOUR);
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].receivedAt, rows[0].count, rows[0].temperature, rows[0].spectrum[0].value], [t0, 2, 11, 200]);
  assert.deepEqual([rows[1].receivedAt, rows[1].count, rows[1].temperature], [t0 + HOUR, 1, 20]);
  assert.equal(rows[0].spectrum[17].wavelength, 940);
});

test('long periods are grouped into whole-hour buckets, at most MAX_POINTS', () => {
  assert.equal(bucketSize(t0, t0 + 7 * 24 * HOUR), HOUR);
  assert.equal(bucketSize(t0, t0 + 365 * 24 * HOUR), 9 * HOUR);
  const year = Array.from({ length: 365 * 24 }, (_, h) => [t0 + h * HOUR, reading(h % 24, 1000)]);
  const rows = buckets(db(year), t0, t0 + 365 * 24 * HOUR);
  assert.ok(rows.length <= MAX_POINTS);
  assert.equal(rows[1].receivedAt - rows[0].receivedAt, 9 * HOUR);
  assert.equal(rows[0].count, 9);
  assert.equal(rows[0].temperature, 4); // average of hours 0..8
});

test('empty hours are missing, so the chart shows a gap', () => {
  const d = db([[t0, reading(1, 1)], [t0 + 5 * HOUR, reading(2, 2)]]);
  assert.deepEqual(buckets(d, t0, t0 + 6 * HOUR).map(r => r.receivedAt), [t0, t0 + 5 * HOUR]);
});
