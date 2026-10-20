import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_REFERENCE, indicators, transmission, wavelengthColor } from './spectrum.mjs';
import { buildDemoData } from './app.mjs';

const WL = [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940];
const spectrumFrom = factors => WL.map((wavelength, i) => ({ wavelength, value: DEMO_REFERENCE[i] * factors(wavelength) }));

test('clean water is 100 % on every channel and has no indicator signal', () => {
  const clean = spectrumFrom(() => 1);
  assert.ok(transmission(clean).every(c => Math.abs(c.value - 100) < 1e-9));
  const { overall, blue, algae } = indicators(clean);
  assert.ok(Math.abs(overall) < 1e-9 && Math.abs(blue) < 1e-9 && Math.abs(algae) < 1e-9);
});

test('mud dims all channels evenly: overall rises, algae stays zero', () => {
  const i = indicators(spectrumFrom(() => 0.9));
  assert.ok(Math.abs(i.overall - 10) < 1e-9);
  assert.ok(Math.abs(i.blue - 10) < 1e-9);
  assert.ok(Math.abs(i.algae) < 1e-9);
});

test('a dip at 680 nm shows up as algae only', () => {
  const i = indicators(spectrumFrom(nm => (nm === 680 ? 0.95 : 1)));
  assert.ok(Math.abs(i.algae - 5) < 1e-9);
  assert.ok(Math.abs(i.blue) < 1e-9);
});

test('blue-end loss shows up in the blue indicator', () => {
  const i = indicators(spectrumFrom(nm => (nm <= 435 ? 0.92 : 1)));
  assert.ok(Math.abs(i.blue - 8) < 1e-9);
});

test('wavelength colours: visible are coloured, near-infrared grey', () => {
  assert.notEqual(wavelengthColor(450), wavelengthColor(650));
  assert.equal(wavelengthColor(860), '#9aa3ad');
});

test('demo spectra stay near clean water (90-101 %)', () => {
  const rows = buildDemoData(1, Date.parse('2026-10-22T12:03:00Z'));
  for (const row of [rows[0], rows.at(-1)]) {
    transmission(row.spectrum).forEach(c => assert.ok(c.value > 90 && c.value <= 101, `${c.wavelength}: ${c.value}`));
  }
});
