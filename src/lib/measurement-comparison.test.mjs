import { test } from 'node:test';
import assert from 'node:assert/strict';
import marcel from '../data/marcel.json' with { type: 'json' };
import { summarizeLive, formatComparison } from './measurement-comparison.mjs';
const row = (receivedAt, extras = {}) => ({ receivedAt, temperature: 15, conductivity: 200,
  fluorescenceRaw: 2.1, turbidity: 27, spectrum: Array.from({ length: 18 }, (_, i) => ({ wavelength: i === 17 ? 940 : 410 + i, value: 900 })), ...extras });
test('Marcel uses only valid campaigns, no copied old-sample rows or failed December 2 data', () => {
  assert.equal(marcel.length, 18);
  assert.deepEqual([...new Set(marcel.map(r => r.date))], ['2021-10-29', '2021-12-09']);
  assert.equal(marcel.filter(r => r.group === 'river').length, 12);
  assert.equal(marcel.filter(r => r.values[4] === null).length, 1);
  assert.equal(marcel[0].values[1], 215.49);
});
test('latest and last five sorted readings, EC25 reversed at each temperature', () => {
  const rows = [6, 2, 4, 1, 5, 3].map(t => row(t));
  const s = summarizeLive(rows);
  assert.equal(s.latest.receivedAt, 6);
  assert.equal(s.count, 5);
  assert.equal(s.from, 2);
  assert.equal(s.values[1], 160);
  assert.equal(s.mean[1], 160);
  assert.equal(s.values[4], 900);
});
test('empty, zero/clipped/invalid records never become valid data', () => {
  assert.equal(summarizeLive([]), null);
  for (const extras of [{ conductivity: 0 }, { temperature: -256 }, { turbidity: 655.35 },
    { fluorescenceRaw: null }, { spectrum: [] }, { spectrum: row(1).spectrum.map(c => ({ ...c, value: 0 })) }]) {
    const result = summarizeLive([row(1, extras), row(2)]);
    assert.equal(result.excluded, 1);
    assert.equal(result.count, 1);
  }
  assert.equal(formatComparison(null), '—');
});
