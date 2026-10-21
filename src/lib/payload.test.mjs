import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePayload, parseUplink, rowFromRecord } from './payload.mjs';

// Same steps as compressor() in FW2: value x scale → uint16, little-endian; then chip temps and ID.
function encode(m) {
  const b = new Uint8Array(50);
  const u16 = (at, v) => { const x = Math.trunc(v) & 0xffff; b[at] = x & 0xff; b[at + 1] = x >> 8; };
  m.channels.forEach((v, i) => u16(2 * i, v * 10));
  [m.turbidity * 100, m.ec25 * 10, m.temperature * 1000, m.fluorescence * 10, m.fluorescenceRaw * 10000].forEach((v, i) => u16(36 + 2 * i, v));
  b.set([m.chip3, m.chip2, m.chip1, m.id], 46);
  return b;
}
const measured = {
  channels: Array.from({ length: 18 }, (_, i) => 1000 + i * 250.5), turbidity: 3.17, ec25: 431.6,
  temperature: 18.425, fluorescence: 4.3, fluorescenceRaw: 2.1234, chip1: 26, chip2: 27, chip3: 25, id: 1,
};
const bytes = encode(measured);
const base64 = btoa(String.fromCharCode(...bytes));
const hex = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');

test('decodes the FW2 50-byte payload', () => {
  const d = decodePayload(hex);
  assert.equal(d.spectrum.map(c => c.channel).join(','), 'A,B,C,D,E,F,G,H,R,I,S,J,T,U,V,W,K,L');
  assert.equal(d.spectrum[0].wavelength, 410);
  assert.equal(d.spectrum[0].value, 1000);
  assert.equal(d.spectrum[17].value, 5258.5);
  assert.equal(d.turbidity, 3.17);
  assert.equal(d.conductivity, 431.6);
  assert.ok(Math.abs(d.temperature - 18.425) <= 0.001);
  assert.equal(d.fluorescence, 4.3);
  assert.ok(Math.abs(d.fluorescenceRaw - 2.1234) <= 0.0001);
  assert.deepEqual([d.chipTemp1, d.chipTemp2, d.chipTemp3, d.unitId], [26, 27, 25, 1]);
});

test('reads a UG65 uplink and keeps the strongest gateway signal', () => {
  const record = parseUplink({ devEUI: 'A8610A3233386E15', data: base64, fPort: 2,
    rxInfo: [{ rssi: -101, loRaSNR: 2.5 }, { rssi: -88, loRaSNR: 7.25 }] });
  assert.deepEqual(record, { devEui: 'a8610a3233386e15', rssi: -88, snr: 7.25, payload: hex });
  assert.deepEqual(parseUplink({ devEUI: 'x', data: base64 }), { devEui: 'x', rssi: null, snr: null, payload: hex });
});

test('rejects uplinks that are not a FW2 payload', () => {
  assert.throws(() => parseUplink({ data: base64 }));
  assert.throws(() => parseUplink({ devEUI: 'x', data: btoa('short') }), /5 bajtov/);
});

test('stored record becomes a page row', () => {
  const row = rowFromRecord({ received_at: 1761040800000, rssi: -88, snr: 7.25, payload: hex });
  assert.equal(row.receivedAt, 1761040800000);
  assert.equal(row.rssi, -88);
  assert.equal(row.unitId, 1);
  assert.equal(row.spectrum.length, 18);
});
