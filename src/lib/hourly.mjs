// Hourly sums of every measurement, kept next to the raw uplinks so long periods stay cheap to read:
// a year is ~8,800 hourly rows instead of ~105,000 readings. The page gets averages per bucket.
import { CHANNELS, WAVELENGTHS } from './app.mjs';

export const HOUR = 3600000;
// At most this many points per chart; buckets are whole hours.
export const MAX_POINTS = 1000;
const MEASURES = ['temperature', 'conductivity', 'turbidity', 'fluorescenceRaw', 'fluorescence'];
const COLUMNS = [...MEASURES, ...CHANNELS.map((_, i) => `s${i}`)];

export const HOURS_TABLE = `CREATE TABLE IF NOT EXISTS hours (hour INTEGER PRIMARY KEY, n INTEGER NOT NULL, ${COLUMNS.map(c => `${c} REAL NOT NULL`).join(', ')})`;

// Adds one decoded reading to its hour. Bind: hourStart(time), ...hourlyValues(reading).
export const ADD_TO_HOUR = `INSERT INTO hours (hour, n, ${COLUMNS.join(', ')}) VALUES (?, 1, ${COLUMNS.map(() => '?').join(', ')})
  ON CONFLICT (hour) DO UPDATE SET n = n + 1, ${COLUMNS.map(c => `${c} = ${c} + excluded.${c}`).join(', ')}`;

export const hourStart = ms => Math.floor(ms / HOUR) * HOUR;
export const hourlyValues = reading => [...MEASURES.map(key => reading[key]), ...reading.spectrum.map(c => c.value)];

// Whole hours, so that from-to fits in MAX_POINTS buckets.
export const bucketSize = (from, to) => Math.max(1, Math.ceil((to - from) / MAX_POINTS / HOUR)) * HOUR;

// Bind: from (start of an hour), bucket size, to. Bucket number b starts at from + b * bucket.
export const SUM_BUCKETS = `SELECT CAST((hour - ?1) / ?2 AS INTEGER) AS b, SUM(n) AS n, ${COLUMNS.map(c => `SUM(${c}) AS ${c}`).join(', ')}
  FROM hours WHERE hour BETWEEN ?1 AND ?3 GROUP BY b ORDER BY b`;

// One bucket of sums → one page row of averages, same shape as a reading, plus how many readings it averages.
export function rowFromBucket(record, from, bucket) {
  const avg = key => record[key] / record.n;
  return {
    receivedAt: from + record.b * bucket, count: record.n,
    ...Object.fromEntries(MEASURES.map(key => [key, avg(key)])),
    spectrum: CHANNELS.map((channel, i) => ({ channel, wavelength: WAVELENGTHS[i], value: avg(`s${i}`) })),
  };
}
