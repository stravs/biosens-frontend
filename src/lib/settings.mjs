// User settings: normal ranges per measurement plus device-health limits. Stored per browser.
import { validateRules } from './monitoring.mjs';
import { ALERT_KEYS } from './spectrum.mjs';

export const STORAGE_KEY = 'settings';

// OK intervals widened 30% about their midpoint; water temperature minimum then set to 0 °C.
// EC25 ceiling adjusted to 235 for the current sample (observed valid peak 227.2 on 2026-11-03).
// Change and one-sided spectral thresholds increased 30%; device-health limits unchanged.
// UI monitoring preferences, not validated water-safety limits. Saved overrides are preserved.
export function defaultSettings() {
  return {
    rules: {
      temperature: { min: 0, max: 31.05, change: 1.3 },
      turbidity: { min: 25.7, max: 28.3, change: 0.91 },
      conductivity: { min: 168.25, max: 235, change: 45.5 },
      fluorescenceRaw: { min: 2.085, max: 2.215, change: 0.065 },
      brown: { max: 1.95 },
      algae: { max: 1.3 },
      cyano: { max: 1.3 },
    },
    offlineMinutes: 15, rssiGood: -90, rssiWeak: -105,
  };
}

export function validateSettings(s) {
  validateRules(s.rules);
  for (const key of ALERT_KEYS) {
    const max = s.rules[key]?.max;
    if (max != null && !(Number.isFinite(max) && max > 0)) throw new Error('Meja za spektrometer mora biti večja od nič ali prazna.');
  }
  if (!Number.isFinite(s.offlineMinutes) || s.offlineMinutes <= 0) throw new Error('Čas brez povezave mora biti večji od nič.');
  if (!Number.isFinite(s.rssiGood) || !Number.isFinite(s.rssiWeak)) throw new Error('Vnesite meji signala.');
  if (s.rssiWeak >= s.rssiGood) throw new Error('Meja za slab signal mora biti nižja od meje za dober signal.');
  return s;
}

// Saved settings, or defaults when nothing is saved or the saved copy is broken.
export function loadSettings(raw) {
  try {
    const saved = JSON.parse(raw);
    // Rules merged per measurement, so settings saved before a new measurement existed still get its default.
    if (saved) return validateSettings({ ...defaultSettings(), ...saved, rules: { ...defaultSettings().rules, ...saved.rules } });
  } catch {}
  return defaultSettings();
}
