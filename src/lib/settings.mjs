// User settings: normal ranges per measurement plus device-health limits. Stored per browser.
import { createDemoRules } from './demo-rules.mjs';
import { validateRules } from './monitoring.mjs';

export const STORAGE_KEY = 'settings';

export function defaultSettings() {
  return { rules: createDemoRules(), offlineMinutes: 15, rssiGood: -90, rssiWeak: -105 };
}

export function validateSettings(s) {
  validateRules(s.rules);
  if (!Number.isFinite(s.offlineMinutes) || s.offlineMinutes <= 0) throw new Error('Čas brez povezave mora biti večji od nič.');
  if (!Number.isFinite(s.rssiGood) || !Number.isFinite(s.rssiWeak)) throw new Error('Vnesite meji signala.');
  if (s.rssiWeak >= s.rssiGood) throw new Error('Meja za slab signal mora biti nižja od meje za dober signal.');
  return s;
}

// Saved settings, or defaults when nothing is saved or the saved copy is broken.
export function loadSettings(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved) return validateSettings({ ...defaultSettings(), ...saved });
  } catch {}
  return defaultSettings();
}
