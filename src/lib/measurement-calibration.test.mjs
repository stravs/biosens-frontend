import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CALIBRATION as defaults, FLASH_CALIBRATION as flash, recalibratedValue } from './measurement-calibration.mjs';
import { SAMPLES } from '../data/measurements.mjs';
import { fiveReadings, measurementSeries, renderMeasurementChart, renderMeasurementReadout } from './measurement-plot.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('recalibration recovers the positive raw branch with firmware EC /1000 factor', () => {
  for (const raw of [0, 100, 1500, 2500]) {
    const values = Array(25).fill(0);
    values[2] = defaults.conductivityGainSquare * raw * raw / 1000 + defaults.conductivityGain * raw + defaults.conductivityOffset;
    values[6] = defaults.turbidityGainSquare * raw * raw + defaults.turbidityGain * raw + defaults.turbidityOffset;
    close(recalibratedValue(values, '2', flash), flash.conductivityGainSquare * raw * raw / 1000 + flash.conductivityGain * raw + flash.conductivityOffset);
    close(recalibratedValue(values, '6', flash), flash.turbidityGainSquare * raw * raw + flash.turbidityGain * raw + flash.turbidityOffset);
    assert.equal(recalibratedValue(values, '2'), values[2]);
    assert.equal(recalibratedValue(values, '6'), values[6]);
  }
});
test('flash recalculation changes derived fields only, preserves negative values and source data', () => {
  const samples = fiveReadings(SAMPLES);
  const original = JSON.stringify(samples);
  for (const key of ['0', '1', '7', '24']) {
    assert.deepEqual(measurementSeries(samples, key, flash), measurementSeries(samples, key));
  }
  const values = samples[0].rows[0].values;
  close(recalibratedValue(values, 'fluorescence', flash), 47.179 - 20.683 * values[0]);
  assert.ok(recalibratedValue(values, '6', flash) < 0);
  for (const key of ['2', '6', 'fluorescence']) {
    assert.doesNotMatch(renderMeasurementChart(samples, key, flash), /NaN|Infinity/);
    assert.match(renderMeasurementReadout(samples, key, 1, flash), /CRC napaka/);
  }
  assert.equal(JSON.stringify(samples), original);
});
