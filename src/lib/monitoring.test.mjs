import test from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_FIELDS, INTERVAL_MS, validateRules, hourChange, assessPoint, currentStatus, detectEvents, eventsInRange } from './monitoring.mjs';

// Arbitrary fixtures for algorithm tests only; these are NOT suggested operating limits.
const base = Date.parse('2026-10-22T00:00:00Z');
const series = values => values.map((value, i) => ({ receivedAt: base + i * INTERVAL_MS, temperature: value, turbidity: 10, conductivity: 10, fluorescenceRaw: 10 }));
const fullRules = () => Object.fromEntries(MAIN_FIELDS.map(key => [key, { min: 0, max: 20 }]));

test('without ranges or rules, no normal status or events are invented', () => {
  const rows = series([1, 10, 100, 1000]);
  assert.equal(currentStatus(rows).status, 'unknown');
  assert.deepEqual(detectEvents(rows), []);
  assert.equal(currentStatus([]).status, 'unknown');
});

test('normal requires all four reference ranges; partial coverage stays unknown', () => {
  assert.deepEqual(currentStatus(series([10]), fullRules()), { status: 'normal', covered: 4 });
  assert.equal(currentStatus(series([10]), { temperature: { min: 0, max: 20 } }).status, 'unknown');
  const rows = series([10]); rows[0].turbidity = NaN;
  assert.equal(currentStatus(rows, fullRules()).status, 'unknown');
});

test('values outside the normal range are unusual; equality stays in range', () => {
  const rules = fullRules(); rules.temperature = { min: 0, max: 20 };
  assert.equal(currentStatus(series([20]), rules).status, 'normal');
  assert.equal(currentStatus(series([21]), rules).status, 'unusual');
  assert.equal(currentStatus(series([-11]), rules).status, 'unusual');
  assert.equal(assessPoint(series([30]), 0, 'temperature', rules.temperature).severity, 'unusual');
});

test('change is an absolute one-hour difference and needs contiguous valid samples', () => {
  const rows = series(Array.from({ length: 13 }, (_, i) => i));
  assert.equal(hourChange(rows, 12, 'temperature'), 12);
  assert.equal(hourChange(rows, 11, 'temperature'), null);
  assert.equal(assessPoint(rows, 12, 'temperature', { change: 12 }).changed, true);
  assert.equal(currentStatus(rows, { temperature: { change: 12 } }).status, 'unusual');
  rows[6].temperature = NaN;
  assert.equal(hourChange(rows, 12, 'temperature'), null);
  rows[6].temperature = 6; rows[6].receivedAt += INTERVAL_MS;
  assert.equal(hourChange(rows, 12, 'temperature'), null);
});

test('change events record absolute one-hour magnitude without inventing a baseline', () => {
  const rows = series([...Array.from({ length: 13 }, (_, i) => i), 0]);
  const events = detectEvents(rows, { temperature: { change: 12 } });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'change');
  assert.equal(events[0].start, base + 12 * INTERVAL_MS);
  assert.equal(events[0].end, base + 13 * INTERVAL_MS);
  assert.equal(events[0].magnitude, 12);
  assert.equal(events[0].ongoing, false);
});

test('range excursions record observed start, return time, magnitude and peak', () => {
  const rows = series([10, 21, 25, 10]);
  const events = detectEvents(rows, { temperature: { min: 0, max: 20 } });
  assert.equal(events.length, 1);
  assert.equal(events[0].start, base + INTERVAL_MS);
  assert.equal(events[0].end, base + 3 * INTERVAL_MS);
  assert.equal(events[0].magnitude, 5);
  assert.equal(events[0].peak, base + 2 * INTERVAL_MS);
  assert.equal(events[0].ongoing, false);
  assert.equal(events[0].clippedStart, false);
});

test('ongoing excursions have no invented end, and initial excursions mark clipped onset', () => {
  const rows = series([25, 26]);
  const [event] = detectEvents(rows, { temperature: { min: 0, max: 20 } });
  assert.equal(event.ongoing, true);
  assert.equal(event.end, rows.at(-1).receivedAt);
  assert.equal(event.clippedStart, true);
});

test('data gaps do not join excursions or imply a measured duration through the gap', () => {
  const rows = series([25, 26, 27]); rows[2].receivedAt += INTERVAL_MS;
  const events = detectEvents(rows, { temperature: { min: 0, max: 20 } });
  assert.equal(events.length, 2);
  const interrupted = events.find(event => event.interrupted);
  assert.equal(interrupted.end, rows[1].receivedAt);
});

test('missing values interrupt events rather than count as valid readings', () => {
  const events = detectEvents(series([25, NaN, 26]), { temperature: { min: 0, max: 20 } });
  assert.equal(events.length, 2);
  assert.equal(events.find(event => event.interrupted).end, base);
});

test('direction changes form separate chronological events', () => {
  const events = detectEvents(series([10, 21, 31, -1, 10]), { temperature: { min: 0, max: 20 } });
  assert.equal(events.length, 2);
  assert.equal(events[0].direction, -1);
  assert.equal(events[1].direction, 1);
  assert.ok(events[0].start > events[1].start);
});

test('range filtering preserves the actual onset of events overlapping the window', () => {
  const event = { start: base, end: base + 8 * 3600000 };
  assert.deepEqual(eventsInRange([event], base + 10 * 3600000, 6), [event]);
  assert.equal(eventsInRange([event], base + 20 * 3600000, 6).length, 0);
});

test('rule validation rejects incomplete, non-finite, inverted and nested-invalid limits', () => {
  for (const rule of [{ min: 1 }, { min: 2, max: 1 }, { change: 0 }, { change: -1 }, { change: Infinity }]) {
    assert.throws(() => validateRules({ temperature: rule }));
  }
  assert.doesNotThrow(() => validateRules({}));
  assert.doesNotThrow(() => validateRules({ temperature: { min: 0, max: 20, change: 1 } }));
});
