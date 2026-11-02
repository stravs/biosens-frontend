import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasurements, summarizeMeasurements, MEASUREMENT_FIELDS } from './measurements.mjs';
import { SAMPLES, BENCH } from '../data/measurements.mjs';

const row = [2.1, 13, 180, 15, 14, 13, 27, ...Array(18).fill(900)];
const record = values => `Measurement started\n${values.join(', ')}\nMeasurement ended\n`;

test('parser ignores boot output, preserves invalid rows and counts incomplete cycles', () => {
  const invalid = [1.1792, -255.9375, -303.617, 0, 0, 0, -20.98, ...Array(18).fill(0)];
  const parsed = parseMeasurements(`CRC check ERROR\n${record(invalid)}Measurement started\nreset\n${record(row)}Measurement started\n`);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.interrupted, 2);
  assert.equal(parsed.crcErrors, 1);
  assert.match(parsed.rows[0].reason, /Temperatura/);
  assert.equal(parsed.rows[1].index, 2);
  assert.equal(parsed.rows[1].reason, '');
  assert.equal(summarizeMeasurements(parsed.rows)[1].mean, 13);
});

test('parser rejects malformed numeric records instead of silently dropping values', () => {
  for (const values of [row.slice(1), [...row.slice(0, 24), ''], [...row.slice(0, 24), 'bad']]) {
    assert.throws(() => parseMeasurements(record(values)), /Neveljavna/);
  }
});

test('statistics use valid rows only, with sample standard deviation', () => {
  const rows = [row, row.map(v => v + 2)].map(values => ({ values, reason: '' }));
  const stats = summarizeMeasurements(rows);
  assert.equal(stats[1].mean, 14);
  assert.equal(stats[1].min, 13);
  assert.equal(stats[1].max, 15);
  assert.ok(Math.abs(stats[1].sd - Math.sqrt(2)) < 1e-12);
  assert.equal(summarizeMeasurements([]), null);
  assert.equal(summarizeMeasurements([{ values: row, reason: 'invalid' }]), null);
});

test('all five original logs load with known row counts and diagnostics', () => {
  assert.equal(MEASUREMENT_FIELDS.length, 7);
  assert.deepEqual(SAMPLES.map(s => s.rows.length), [12, 5, 7, 7, 8]);
  assert.equal(SAMPLES.reduce((sum, s) => sum + s.rows.filter(r => !r.reason).length, 0), 38);
  assert.equal(SAMPLES[0].crcErrors, 3);
  assert.equal(SAMPLES[0].interrupted, 1);
  assert.equal(SAMPLES[3].interrupted, 1);
  assert.equal(SAMPLES[0].rows.filter(r => r.reason).length, 1);
  assert.ok(Math.abs(SAMPLES[1].stats[2].mean - 346.411) < 1e-9);
  assert.equal(SAMPLES[3].rows.at(-1).values[2], 28.053);
  for (const s of SAMPLES) {
    assert.equal(s.stats.length, 25);
    assert.ok(s.rows.every(r => r.values.length === 25 && r.values.every(Number.isFinite)));
  }
  assert.equal(BENCH.rows.length, 11);
});
