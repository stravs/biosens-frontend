import test from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_KEYS, baseline, indicators, transmission, wavelengthColor } from './spectrum.mjs';
import { buildDemoData } from './app.mjs';
import { createDemoRules } from './demo-rules.mjs';
import { detectEvents } from './monitoring.mjs';

const WL = [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940];
const NORMAL = WL.map((_, i) => 20000 + i * 1000); // any per-channel normal works
const spectrumFrom = factors => WL.map((wavelength, i) => ({ wavelength, value: NORMAL[i] * factors(wavelength) }));
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('baseline is the per-channel median', () => {
  const rows = [0.9, 1, 1.2].map(f => ({ spectrum: spectrumFrom(() => f) }));
  assert.deepEqual(baseline(rows), NORMAL);
});

test('a normal reading is 100 % on every channel and every indicator is 0', () => {
  const normal = spectrumFrom(() => 1);
  assert.ok(transmission(normal, NORMAL).every(c => near(c.value, 100)));
  for (const [name, value] of Object.entries(indicators(normal, NORMAL))) assert.ok(near(value, 0), name);
});

test('more mud dims all channels evenly: only mud rises', () => {
  const i = indicators(spectrumFrom(() => 0.9), NORMAL);
  assert.ok(near(i.mud, 10));
  for (const key of ALERT_KEYS) assert.ok(near(i[key], 0), key);
});

test('a dip at 680 nm is algae, at 610 nm blue-green algae', () => {
  const algae = indicators(spectrumFrom(nm => (nm === 680 ? 0.95 : 1)), NORMAL);
  assert.ok(near(algae.algae, 5) && near(algae.cyano, 0) && near(algae.brown, 0));
  const cyano = indicators(spectrumFrom(nm => (nm === 610 ? 0.96 : 1)), NORMAL);
  assert.ok(near(cyano.cyano, 4) && near(cyano.algae, 0) && near(cyano.brown, 0));
});

test('brown follows blue-end loss and ignores mud', () => {
  const brown = indicators(spectrumFrom(nm => (nm <= 435 ? 0.95 : 1)), NORMAL);
  const muddyBrown = indicators(spectrumFrom(nm => 0.9 * (nm <= 435 ? 0.95 : 1)), NORMAL);
  assert.ok(near(brown.brown, 5));
  assert.ok(near(muddyBrown.brown, 4.5)); // mud also dims the brown part a little
});

test('cleaner than normal gives negative values', () => {
  assert.ok(indicators(spectrumFrom(() => 1.05), NORMAL).mud < 0);
});

test('wavelength colours: visible are coloured, near-infrared grey', () => {
  assert.notEqual(wavelengthColor(450), wavelengthColor(650));
  assert.equal(wavelengthColor(860), '#9aa3ad');
});

test('demo week: a brown event shows up against the normal, and readings stay close to normal', () => {
  const raw = buildDemoData(1, Date.parse('2026-10-22T12:03:00Z'));
  const reference = baseline(raw);
  const rows = raw.map(r => ({ ...r, ...indicators(r.spectrum, reference) }));
  transmission(rows.at(-1).spectrum, reference).forEach(c => assert.ok(c.value > 90 && c.value < 110, `${c.wavelength}: ${c.value}`));
  const events = detectEvents(rows, createDemoRules(), ALERT_KEYS);
  assert.ok(events.some(e => e.key === 'brown'));
});
