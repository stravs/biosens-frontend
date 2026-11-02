import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLES } from '../data/measurements.mjs';
import { measurementsCsv } from './measurements-csv.mjs';
import { GET } from '../pages/meritve.csv.js';

// Actual fixture metadata has no commas or newlines; escaping is checked separately below.
const csv = measurementsCsv(SAMPLES);
const [headers, ...rows] = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n').map(line => line.split(','));
const get = (row, key) => row[headers.indexOf(key)];

test('CSV includes all complete readings, all 25 source values and calculated fields', () => {
  assert.equal(rows.length, 39);
  assert.equal(headers.length, 39);
  assert.ok(rows.every(row => row.length === headers.length));
  assert.equal(rows.filter(r => get(r, 'series_type') === 'sample').length, 39);
  assert.equal(rows.filter(r => get(r, 'series_type') === 'bench').length, 0);
  assert.equal(rows.filter(r => get(r, 'in_five_reading_chart') === '1').length, 25);
  assert.equal(rows.filter(r => get(r, 'sample_id') === 'tap').length, 12);
  for (const [i, r] of SAMPLES.flatMap(s => s.rows).entries()) {
    assert.deepEqual(rows[i].slice(10, 35).map(Number), r.values);
  }
});

test('CSV retains invalid readings and source diagnostics without inventing incomplete rows', () => {
  const invalid = rows.find(r => get(r, 'valid') === '0');
  assert.ok(invalid);
  assert.equal(get(invalid, 'system_temperature_C'), '-255.9375');
  assert.equal(get(invalid, 'source_crc_errors'), '3');
  assert.equal(get(invalid, 'source_unfinished_cycles'), '1');
  assert.equal(get(invalid, 'in_five_reading_chart'), '0');
  assert.match(get(invalid, 'invalid_reason'), /Temperatura/);
  assert.equal(get(invalid, 'coefficient_basis'), 'compiled_defaults_confirmed_by_log');
  const rain = rows.find(r => get(r, 'sample_id') === 'sod');
  assert.equal(get(rain, 'sample_name'), 'Deževnica v sodu');
  assert.equal(get(rain, 'coefficient_basis'), 'compiled_defaults_assumed');
  assert.equal(get(rain, 'fluorescence_gain'), '-16.2447');
});

test('CSV uses UTF-8 BOM, CRLF and quotes commas, quotes and line breaks', () => {
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.endsWith('\r\n'));
  const escaped = measurementsCsv([{ ...SAMPLES[0], label: 'rain, "barrel"\nwater', rows: SAMPLES[0].rows.slice(0, 1) }]);
  assert.ok(escaped.includes('"rain, ""barrel""\nwater"'));
});

test('download endpoint returns the complete CSV with download headers', async () => {
  const response = GET();
  assert.equal(response.headers.get('Content-Type'), 'text/csv; charset=utf-8');
  assert.match(response.headers.get('Content-Disposition'), /attachment; filename="biosens_meritve_vse.csv"/);
  // Response.text() consumes the BOM; compare decoded content without it.
  assert.equal(await response.text(), csv.slice(1));
});
