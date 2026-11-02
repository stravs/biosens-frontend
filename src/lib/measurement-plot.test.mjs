import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLES } from '../data/measurements.mjs';
import { fiveReadings, measurementSeries, renderMeasurementChart, renderMeasurementReadout, readingAt, PLOT_FIELDS, calibratedFluorescence, spectrumSeries, renderSpectrumChart, spectrumX, spectrumChannelAt, renderSpectrumReadout } from './measurement-plot.mjs';

const samples = fiveReadings(SAMPLES);

test('spectrum hover snaps to channels and shows selected samples sorted by value', () => {
  for (let channel = 0; channel < 18; channel++) {
    assert.equal(spectrumChannelAt(spectrumX(channel)), channel);
    const expected = spectrumSeries(samples).sort((a, b) => b.points[channel].y - a.points[channel].y);
    const html = renderSpectrumReadout(samples, channel);
    const positions = expected.map(s => html.indexOf(s.label));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  }
  assert.equal(spectrumChannelAt(-100), 0);
  assert.equal(spectrumChannelAt(1000), 17);
  assert.equal(spectrumChannelAt((spectrumX(8) + spectrumX(9)) / 2 + 1), 9);
  const html = renderSpectrumReadout(samples.slice(0, 1), 0);
  assert.match(html, /410 nm · A/);
  assert.match(html, /Vodovodna voda/);
  assert.doesNotMatch(html, /Aronja/);
  assert.ok(!renderSpectrumReadout([{ ...samples[0], label: '<script>' }], 0).includes('<script>'));
  const chart = renderSpectrumChart(samples);
  assert.match(chart, /tabindex="0"/);
  assert.match(chart, /aria-describedby="spectrum-tooltip"/);
  assert.match(chart, /data-crosshair/);
  assert.equal((chart.match(/data-reading=/g) ?? []).length, 90);
});

test('full spectrum averages all 18 channels for each visible sample', () => {
  const series = spectrumSeries(samples);
  assert.equal(series.length, 5);
  series.forEach((s, i) => {
    assert.equal(s.points.length, 18);
    assert.equal(s.points[0].x, 410);
    assert.equal(s.points.at(-1).x, 940);
    s.points.forEach((point, channel) => {
      assert.equal(point.y, samples[i].rows.reduce((sum, r) => sum + r.values[channel + 7], 0) / 5);
    });
  });
  const html = renderSpectrumChart(samples);
  assert.equal((html.match(/<polyline /g) ?? []).length, 5);
  assert.equal((html.match(/<circle /g) ?? []).length, 90);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.equal((renderSpectrumChart(samples.slice(0, 1)).match(/<polyline /g) ?? []).length, 1);
  assert.match(renderSpectrumChart([]), /role="status"/);
  assert.match(renderSpectrumChart([{ ...samples[0], rows: [] }]), /role="status"/);
  assert.ok(!renderSpectrumChart([{ ...samples[0], label: '<script>' }]).includes('<script>'));
});

test('one chart uses exactly the first five valid readings of each sample', () => {
  assert.equal(samples.length, 5);
  assert.ok(samples.every(s => s.rows.length === 5));
  assert.deepEqual(samples[0].rows.map(r => r.index), [2, 3, 4, 5, 6]);
  assert.ok(samples.slice(1).every(s => s.rows.map(r => r.index).join(',') === '1,2,3,4,5'));
  assert.equal(samples[0].rows[0].values[0], 2.1655);
  assert.equal(samples[3].rows[4].values[2], 28.160);
});

test('selector contains five water measurements and 18 spectrometer channels', () => {
  assert.deepEqual(PLOT_FIELDS.slice(0, 5).map(f => f.label), [
    'Temperatura (°C)', 'Motnost (NTU)', 'Prevodnost (µS/cm)', 'Fluorescenca (V)', 'Umerjena fluorescenca',
  ]);
  assert.equal(PLOT_FIELDS.length, 23);
  assert.equal(PLOT_FIELDS[5].label, 'Spektrometer · 410 nm (A)');
  assert.equal(PLOT_FIELDS.at(-1).label, 'Spektrometer · 940 nm (L)');
  for (let i = 0; i < 18; i++) {
    const series = measurementSeries(samples, String(i + 7));
    series.forEach((s, j) => s.points.forEach((p, k) => {
      assert.equal(p.y, samples[j].rows[k].values[i + 7]);
    }));
  }
  assert.match(renderMeasurementChart(samples), /aria-label="Temperatura/);
});

test('all fields overlay five samples at reading numbers 1–5', () => {
  for (const field of PLOT_FIELDS) {
    const series = measurementSeries(samples, field.key);
    assert.equal(series.length, 5);
    assert.ok(series.every(s => s.points.length === 5));
    assert.deepEqual(series[0].points.map(p => p.x), [1, 2, 3, 4, 5]);
    const html = renderMeasurementChart(samples, field.key);
    assert.equal((html.match(/<svg /g) ?? []).length, 1);
    assert.equal((html.match(/<polyline /g) ?? []).length, 5);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('calculated fluorescence matches firmware defaults without LoRa clipping', () => {
  assert.equal(calibratedFluorescence(0), 38.766);
  assert.ok(Math.abs(calibratedFluorescence(2) - 6.2766) < 1e-10);
  const series = measurementSeries(samples, 'fluorescence');
  assert.equal(series[0].points[0].y, 38.766 - 16.2447 * 2.1655);
  assert.ok(series[1].points[0].y < 0); // Firmware calculation can be negative; do not silently clamp.
  assert.match(renderMeasurementChart(samples, 'fluorescence'), /privzetimi koeficienti/);
});

test('hover snaps to the nearest reading and clamps chart edges', () => {
  assert.equal(readingAt(85), 1);
  assert.equal(readingAt(85 + 785 / 4), 2);
  assert.equal(readingAt(85 + 785 / 2), 3);
  assert.equal(readingAt(870), 5);
  assert.equal(readingAt(-100), 1);
  assert.equal(readingAt(1000), 5);
});

test('hover readout includes only selected samples with exact values, units and source index', () => {
  const html = renderMeasurementReadout(samples.slice(0, 1), '0', 1);
  assert.match(html, /Meritev 1/);
  assert.match(html, /Vodovodna voda/);
  assert.match(html, /2,1655 V/);
  assert.match(html, /Izvorni odčitek 2/);
  assert.doesNotMatch(html, /Aronja/);
  const derived = renderMeasurementReadout(samples, 'fluorescence', 5);
  assert.match(derived, /privzetimi koeficienti/);
  assert.ok(!renderMeasurementReadout([{ ...samples[0], label: '<script>' }], '1', 1).includes('<script>'));
});

test('hover readout follows graph order from highest to lowest at each reading', () => {
  for (const field of PLOT_FIELDS) {
    for (let reading = 1; reading <= 5; reading++) {
      const expected = measurementSeries(samples, field.key)
        .sort((a, b) => b.points[reading - 1].y - a.points[reading - 1].y);
      const html = renderMeasurementReadout(samples, field.key, reading);
      const positions = expected.map(s => html.indexOf(s.label));
      assert.ok(positions.every(p => p >= 0));
      assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    }
  }
  // Equal values preserve sample order; selecting a subset still sorts by graph height.
  const tied = samples.slice(0, 2).map(s => ({ ...s, rows: [{ index: 1, values: samples[0].rows[0].values }] }));
  const html = renderMeasurementReadout(tied, '1', 1);
  assert.ok(html.indexOf(tied[0].label) < html.indexOf(tied[1].label));
  const subset = renderMeasurementReadout(samples.slice(0, 2), '0', 1);
  assert.ok(subset.indexOf('Aronja') < subset.indexOf('Vodovodna voda'));
});

test('chart has keyboard focus, crosshair and a reading identifier on every point', () => {
  const html = renderMeasurementChart(samples);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /aria-describedby="measurement-tooltip"/);
  assert.match(html, /data-crosshair/);
  assert.equal((html.match(/data-reading=/g) ?? []).length, 25);
});

test('sample selection, empty state, invalid field and escaped labels', () => {
  const html = renderMeasurementChart(samples.slice(0, 1));
  assert.equal((html.match(/<polyline /g) ?? []).length, 1);
  assert.match(renderMeasurementChart([], '1'), /role="status"/);
  assert.throws(() => renderMeasurementChart(samples, 'unknown'));
  assert.ok(!renderMeasurementChart([{ ...samples[0], label: '<script>' }]).includes('<script>'));
});
