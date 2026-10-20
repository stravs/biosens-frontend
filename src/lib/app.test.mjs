import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData, selectRange, toCsv, fieldsForView } from './app.mjs';

const now = Date.parse('2026-10-22T12:03:00Z');
const rows = buildDemoData(1, now);

test('demo data covers seven days at five-minute intervals', () => {
  assert.equal(rows.length, 2017);
  assert.equal(rows.at(-1).receivedAt, Date.parse('2026-10-22T12:00:00Z'));
  assert.equal(rows.at(-1).receivedAt - rows[0].receivedAt, 7 * 86400000);
  rows.forEach((row, i) => {
    if (i) assert.equal(row.receivedAt - rows[i - 1].receivedAt, 300000);
    for (const field of ['temperature', 'conductivity', 'turbidity', 'fluorescenceRaw', 'fluorescence', 'chipTemp1', 'chipTemp2', 'chipTemp3']) {
      assert.ok(Number.isFinite(row[field]) && row[field] >= 0);
    }
  });
});

test('devices are distinct and data is reproducible', () => {
  assert.deepEqual(rows, buildDemoData(1, now));
  assert.notDeepEqual(rows, buildDemoData(2, now));
});

test('spectrum follows FW2 wavelength order', () => {
  assert.equal(rows[0].spectrum.map(item => item.channel).join(','), 'A,B,C,D,E,F,G,H,R,I,S,J,T,U,V,W,K,L');
  assert.equal(rows[0].spectrum[0].wavelength, 410);
  assert.equal(rows[0].spectrum.at(-1).wavelength, 940);
  assert.ok(rows[0].spectrum.every(item => Number.isFinite(item.value)));
});

test('range filters include the boundary and latest reading', () => {
  assert.equal(selectRange(rows, 6).length, 73);
  assert.equal(selectRange(rows, 24).length, 289);
  assert.equal(selectRange(rows, 168).length, 2017);
  assert.equal(selectRange(rows, 6).at(-1), rows.at(-1));
  assert.deepEqual(selectRange([], 6), []);
});

test('CSV has UTC timestamps, consistent columns, and explicit demo labels', () => {
  const csv = toCsv(selectRange(rows, 6));
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 74);
  assert.ok(lines.every(line => line.split(';').length === 31));
  assert.ok(lines.slice(1).every(line => line.endsWith(';da')));
  assert.ok(lines.at(-1).startsWith('2026-10-22T12:00:00.000Z;1;'));
  const header = lines[0].split(';');
  const values = lines.at(-1).split(';');
  const latest = rows.at(-1);
  assert.equal(values[header.indexOf('temperatura_vode_c')], latest.temperature.toFixed(3).replace('.', ','));
  assert.equal(values[header.indexOf('kalibrirana_fluorescenca_enota_nepotrjena')], latest.fluorescence.toFixed(1).replace('.', ','));
  for (let i = 1; i <= 3; i++) assert.equal(values[header.indexOf(`temperatura_cipa_${i}_c`)], String(latest[`chipTemp${i}`]));
  latest.spectrum.forEach(item => assert.equal(values[header.indexOf(`kanal_${item.channel}_${item.wavelength}nm`)], item.value.toFixed(1).replace('.', ',')));
});

test('sample and device views separate all measurements without overlap', () => {
  const sample = fieldsForView('sample').map(([key]) => key);
  const device = fieldsForView('device').map(([key]) => key);
  assert.equal(sample.length, 23);
  assert.equal(device.length, 5);
  assert.equal(new Set([...sample, ...device]).size, fieldsForView('all').length);
  assert.ok(!sample.includes('rssi') && !sample.includes('chipTemp1'));
  assert.ok(device.includes('rssi') && device.includes('chipTemp1'));
  assert.throws(() => fieldsForView('unknown'));
});

test('CSV exports only fields from the selected view and retains device context', () => {
  for (const [view, columns] of [['sample', 26], ['device', 8]]) {
    const lines = toCsv(selectRange(rows, 6), view).split('\r\n');
    assert.equal(lines.length, 74);
    assert.ok(lines.every(line => line.split(';').length === columns));
    assert.ok(lines[0].includes('id_naprave'));
    assert.ok(lines[1].startsWith('2026-10-22T06:00:00.000Z;1;'));
    assert.ok(lines[1].endsWith(';da'));
    assert.equal(lines[0].includes('temperatura_vode_c'), view === 'sample');
    assert.equal(lines[0].includes('kanal_L_940nm'), view === 'sample');
    assert.equal(lines[0].includes('temperatura_cipa_1_c'), view === 'device');
    assert.equal(lines[0].includes('rssi_dbm'), view === 'device');
  }
});
