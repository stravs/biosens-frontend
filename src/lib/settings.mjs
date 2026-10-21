// User settings: normal ranges per measurement plus device-health limits. Stored per browser.
import { createDemoRules } from './demo-rules.mjs';
import { validateRules } from './monitoring.mjs';
import { ALERT_KEYS } from './spectrum.mjs';

export const STORAGE_KEY = 'settings';

export function defaultSettings() {
  return { rules: createDemoRules(), offlineMinutes: 15, rssiGood: -90, rssiWeak: -105 };
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
    if (saved) return validateSettings({ ...defaultSettings(), ...saved, rules: { ...createDemoRules(), ...saved.rules } });
  } catch {}
  return defaultSettings();
}
