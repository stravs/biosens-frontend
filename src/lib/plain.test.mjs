import test from 'node:test';
import assert from 'node:assert/strict';
import { describe, eventText } from './plain.mjs';

test('turbidity follows everyday clarity bands', () => {
  assert.equal(describe('turbidity', 0.4).answer, 'Bistra');
  assert.equal(describe('turbidity', 3.4).answer, 'Rahlo motna');
  assert.equal(describe('turbidity', 5).answer, 'Motna');
  assert.equal(describe('turbidity', 120).answer, 'Zelo motna');
});

test('temperature is shown as a number; conductivity uses bands', () => {
  assert.equal(describe('temperature', 18.2).answer, null);
  assert.equal(describe('temperature', 18.2).position, null);
  assert.equal(describe('conductivity', 450).answer, 'Zmerno');
  assert.equal(describe('conductivity', 50000).answer, 'Zelo veliko');
});

test('scale position is ordered and clamped to 0..1', () => {
  const values = [-5, 0, 0.5, 1, 3, 5, 20, 50, 80, 500];
  const positions = values.map(v => describe('turbidity', v).position);
  positions.forEach((p, i) => {
    assert.ok(p >= 0 && p <= 1);
    if (i) assert.ok(p >= positions[i - 1]);
  });
  assert.equal(describe('turbidity', 1).position, 0.25);
});

test('fluorescence is only compared with the normal range', () => {
  const rule = { min: 1.8, max: 2.3 };
  assert.equal(describe('fluorescenceRaw', 2.1, rule).answer, 'Kot običajno');
  assert.equal(describe('fluorescenceRaw', 2.4, rule).answer, 'Več kot običajno');
  assert.equal(describe('fluorescenceRaw', 1.7, rule).answer, 'Manj kot običajno');
  assert.equal(describe('fluorescenceRaw', 2.1).answer, 'Ni primerjave');
  assert.ok(Math.abs(describe('fluorescenceRaw', 2.05, rule).position - 0.5) < 1e-9);
});

test('missing values are reported plainly', () => {
  assert.equal(describe('turbidity', NaN).answer, 'Ni podatka');
});

test('events read as plain sentences', () => {
  assert.equal(eventText({ key: 'turbidity', type: 'change', direction: 1 }), 'Bistrost se je hitro zmanjšala');
  assert.equal(eventText({ key: 'temperature', type: 'range', direction: -1 }), 'Temperatura je bila nižja kot običajno');
});
