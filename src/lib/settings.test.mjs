import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, validateSettings } from './settings.mjs';

test('defaults match the configured operating ranges and are valid', () => {
  assert.deepEqual(defaultSettings(), {
    rules: {
      temperature: { min: 0, max: 27, change: 1 },
      turbidity: { min: 26, max: 28, change: 0.7 },
      conductivity: { min: 175, max: 220, change: 35 },
      fluorescenceRaw: { min: 2.1, max: 2.2, change: 0.05 },
      brown: { max: 1.5 }, algae: { max: 1 }, cyano: { max: 1 },
    },
    offlineMinutes: 15, rssiGood: -90, rssiWeak: -105,
  });
  assert.doesNotThrow(() => validateSettings(defaultSettings()));
});

test('missing or broken saved settings fall back to defaults', () => {
  assert.deepEqual(loadSettings(null), defaultSettings());
  assert.deepEqual(loadSettings('not json'), defaultSettings());
  const bad = { ...defaultSettings(), rssiGood: -110 };
  assert.deepEqual(loadSettings(JSON.stringify(bad)), defaultSettings());
});

test('saved settings are used, including cleared ranges', () => {
  const s = defaultSettings();
  s.offlineMinutes = 30;
  s.rules.turbidity = { min: null, max: null, change: null };
  const loaded = loadSettings(JSON.stringify(s));
  assert.equal(loaded.offlineMinutes, 30);
  assert.deepEqual(loaded.rules.turbidity, { min: null, max: null, change: null });
});

test('rejects bad device limits', () => {
  assert.throws(() => validateSettings({ ...defaultSettings(), offlineMinutes: 0 }));
  assert.throws(() => validateSettings({ ...defaultSettings(), rssiWeak: -80 }));
});

test('spectrometer limits: empty or above zero', () => {
  const s = defaultSettings();
  s.rules.brown = { max: null };
  assert.doesNotThrow(() => validateSettings(s));
  s.rules.brown = { max: 0 };
  assert.throws(() => validateSettings(s));
});

test('settings saved before spectrometer limits existed get the defaults', () => {
  const old = defaultSettings();
  delete old.rules.cyano;
  assert.deepEqual(loadSettings(JSON.stringify(old)).rules.cyano, defaultSettings().rules.cyano);
});
