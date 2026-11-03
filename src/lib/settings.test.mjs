import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, loadSettings, validateSettings } from './settings.mjs';
import { assessPoint, currentStatus } from './monitoring.mjs';

test('defaults match the configured operating ranges and are valid', () => {
  assert.deepEqual(defaultSettings(), {
    rules: {
      temperature: { min: 0, max: 31.05, change: 1.3 },
      turbidity: { min: 25.7, max: 28.3, change: 0.91 },
      conductivity: { min: 168.25, max: 235, change: 45.5 },
      fluorescenceRaw: { min: 2.085, max: 2.215, change: 0.065 },
      brown: { max: 1.95 }, algae: { max: 1.3 }, cyano: { max: 1.3 },
    },
    offlineMinutes: 15, rssiGood: -90, rssiWeak: -105,
  });
  assert.doesNotThrow(() => validateSettings(defaultSettings()));
});

test('widened defaults preserve temperature floor and current-sample EC25 headroom', () => {
  const before = {
    temperature: [0, 27, 1], turbidity: [26, 28, 0.7],
    conductivity: [175, 220, 35], fluorescenceRaw: [2.1, 2.2, 0.05],
  };
  for (const [key, [min, max, change]] of Object.entries(before)) {
    const next = defaultSettings().rules[key];
    if (key === 'temperature') {
      assert.equal(next.min, 0);
      assert.equal(next.max, 31.05);
    } else if (key === 'conductivity') {
      assert.equal(next.min, 168.25);
      assert.equal(next.max, 235);
    } else {
      assert.ok(Math.abs((next.max - next.min) - (max - min) * 1.3) < 1e-10);
      assert.ok(Math.abs((next.max + next.min) - (max + min)) < 1e-10);
    }
    assert.ok(Math.abs(next.change - change * 1.3) < 1e-10);
  }
  const custom = defaultSettings();
  custom.rules.temperature = { min: 0, max: 27, change: 1 };
  assert.deepEqual(loadSettings(JSON.stringify(custom)).rules.temperature, custom.rules.temperature);
});

// Bounds observed in the public API on 2026-11-03; not water-safety reference limits.
test('current sample extrema stay in range, but the temperature-fault EC25 spike does not', () => {
  const rules = defaultSettings().rules;
  const extrema = {
    temperature: [9.125, 12.812], turbidity: [26.43, 27.48],
    conductivity: [215.9, 227.2], fluorescenceRaw: [2.1423, 2.1728],
    brown: [-1.4728, 0.6463], algae: [-0.2361, 0.3015], cyano: [-0.4795, 0.6532],
  };
  for (const [key, values] of Object.entries(extrema)) {
    for (const value of values) {
      assert.equal(assessPoint([{ receivedAt: 0, [key]: value }], 0, key, rules[key]).severity, null);
    }
  }
  const sample = { receivedAt: 0, temperature: 9.125, conductivity: 227.2,
    turbidity: 26.76, fluorescenceRaw: 2.1423, brown: 0.6114, algae: -0.0969, cyano: -0.4794 };
  assert.equal(currentStatus([sample], rules, ['brown', 'algae', 'cyano']).status, 'normal');
  assert.equal(currentStatus([{ ...sample, temperature: 0, conductivity: 321.4 }], rules).status, 'unusual');
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
