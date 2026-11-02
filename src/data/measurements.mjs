// Build-time loading: source logs stay in Git; no duplicate transcription of measurements.
import { readFileSync } from 'node:fs';
import { parseMeasurements, summarizeMeasurements } from '../lib/measurements.mjs';
import { CALIBRATION_ROWS } from '../lib/calibration.mjs';

const sources = [
  ['tap', 'Vodovodna voda', 'meritev tap.txt', '#2563eb'],
  ['aronja', 'Aronja', 'meritev_aronja.txt', '#a855f7'],
  ['sava', 'Sava', 'meritev_sava.txt', '#0891b2'],
  ['sod', 'Deževnica v sodu', 'meritev_sod.txt', '#ea580c'],
  ['jezero', 'Jezero', 'meritve_jezer.txt', '#16a34a'],
];
export const SAMPLES = sources.map(([id, label, file, color]) => {
  const source = `meritve/2_11_2026/${file}`;
  // npm dev/build/test run from the repository root; bundling relocates import.meta.url.
  const raw = readFileSync(source, 'utf8');
  const parsed = parseMeasurements(raw);
  return { id, label, source, color, raw, ...parsed, stats: summarizeMeasurements(parsed.rows) };
});

// Preserve the original bench sequence separately: it has no sample labels or timestamps.
const benchRows = CALIBRATION_ROWS.map((values, i) => ({ index: i + 1, values, reason: '' }));
export const BENCH = {
  id: 'preizkus', label: 'Prejšnji preizkus polnjenja', source: 'Prejšnji serijski izpis iz pogovora',
  color: '#6366f1', rows: benchRows, interrupted: 0, crcErrors: 0,
  stats: summarizeMeasurements(benchRows), raw: null,
};
