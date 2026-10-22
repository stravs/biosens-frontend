// Names, units and order of what the pages show. Used at build time (Astro) and in the browser.
import { FIELDS, fieldsForView } from './app.mjs';
import { MAIN_FIELDS } from './monitoring.mjs';
import { ALERT_KEYS } from './spectrum.mjs';

// The four cards on Voda and the rules in Nastavitve.
export const MAIN = {
  temperature: { name: 'Temperatura', digits: 1 },
  turbidity: { name: 'Motnost', digits: 1 },
  conductivity: { name: 'Prevodnost', digits: 0 },
  fluorescenceRaw: { name: 'Fluorescenca', digits: 2 },
};
// Chart and table names on Podatki: plain measurement names.
export const LABEL = { temperature: 'Temperatura', turbidity: 'Motnost', conductivity: 'Prevodnost',
  fluorescenceRaw: 'Fluorescenca', fluorescence: 'Umerjena fluorescenca' };
export const AXIS_DIGITS = { temperature: 1, turbidity: 1, conductivity: 0, fluorescenceRaw: 2, fluorescence: 1 };
// Charts on Podatki, same order as the cards on Voda.
export const LINES = ['temperature', 'turbidity', 'conductivity', 'fluorescenceRaw', 'fluorescence'];
// Table columns: the charted measurements first (same order and names), then the 18 spectral channels.
export const SAMPLE = [...LINES.map(key => [key, FIELDS[key]]), ...fieldsForView('sample').filter(([key]) => !LINES.includes(key))];

// Spectrometer indicators: % more light lost than this device's normal (0 = as usual).
export const SPEC = [
  { key: 'mud', title: 'Mulj in delci', hint: 'vsi kanali' },
  { key: 'brown', title: 'Rjava barva', hint: 'modri del, brez vpliva mulja' },
  { key: 'algae', title: 'Alge', hint: '680 nm' },
  { key: 'cyano', title: 'Modrozelene alge', hint: '610 nm' },
];
export const SPEC_BY_KEY = Object.fromEntries(SPEC.map(s => [s.key, s]));

// Everything that can raise an event, and its name, unit and digits.
export const EVENT_KEYS = [...MAIN_FIELDS, ...ALERT_KEYS];
export const info = key => SPEC_BY_KEY[key] ? { name: SPEC_BY_KEY[key].title, unit: '%', digits: 1 }
  : { name: LABEL[key], unit: FIELDS[key].unit, digits: MAIN[key].digits };
