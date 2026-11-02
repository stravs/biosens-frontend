import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL_MAX, spectrumBuckets, spectrumScale, viridis } from './spectrum-view.mjs';

const row = (receivedAt, value) => ({ receivedAt, spectrum: [{ wavelength: 410, value }] });

test('Viridis endpoints and clamping', () => {
  assert.equal(viridis(0), 'rgb(68, 1, 84)');
  assert.equal(viridis(1), 'rgb(253, 231, 37)');
  assert.equal(viridis(-1), viridis(0));
  assert.equal(viridis(2), viridis(1));
});

test('measured scale is rounded and relative scale includes 100 percent', () => {
  assert.deepEqual(spectrumScale([row(0, 1100)], null), { lo: 0, hi: 1500 });
  assert.deepEqual(spectrumScale([row(0, 1000)], [1000], true), { lo: 0, hi: 125 });
  assert.deepEqual(spectrumScale([row(0, NaN)], null), { lo: 0, hi: 500 });
  assert.equal(CHANNEL_MAX, 6553.5);
});

test('time buckets preserve gaps and include the last reading', () => {
  const first = row(0, 100), last = row(1000, 200);
  const buckets = spectrumBuckets([first, last], 10);
  assert.equal(buckets.length, 10);
  assert.deepEqual(buckets[0].rows, [first]);
  assert.deepEqual(buckets[9].rows, [last]);
  assert.ok(buckets.slice(1, 9).every(b => !b.rows.length));
});

test('single reading has one nonzero-duration bucket', () => {
  const buckets = spectrumBuckets([row(100, 50)]);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].rows.length, 1);
  assert.ok(buckets[0].to > buckets[0].from);
});
