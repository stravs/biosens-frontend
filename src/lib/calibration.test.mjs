import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALIBRATION_ROWS as rows, CALIBRATION_COLORS as colors } from './calibration.mjs';
import { WAVELENGTHS } from './app.mjs';

test('calibration fixture retains all eleven complete serial measurements', () => {
  assert.equal(rows.length, 11);
  assert.equal(colors.length, rows.length);
  for (const row of rows) {
    assert.equal(row.length, 25);
    assert.ok(row.every(Number.isFinite));
    assert.equal(row.slice(7).length, WAVELENGTHS.length);
  }
  assert.equal(rows[0][0], 2.1582);
  assert.equal(rows[0][7], 982.6);
  assert.equal(rows[2][6], 27.13);
  assert.equal(rows[3][6], 640.37);
  assert.equal(rows[4].at(-1), 826.5);
  assert.equal(rows[5][6], 638.98);
  assert.equal(rows[6][6], 28.54);
  assert.equal(rows[10][0], 2.1936);
  assert.equal(rows[10].at(-1), 933.1);
});
