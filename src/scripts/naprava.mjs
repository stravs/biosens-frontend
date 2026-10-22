// Naprava: connection, last packet, signal and chip temperatures.
import { isOnline, live, loadWeek, minutesAgo, settings } from './data.mjs';
import { $, fmt, time } from './format.mjs';

const TONE = { normal: 'text-ok', unusual: 'text-warn', attention: 'text-bad' };
const week = await loadWeek();

function draw() {
  const latest = week.rows.at(-1);
  const online = isOnline(week);
  const signal = latest.rssi >= settings.rssiGood ? 'Dober' : latest.rssi >= settings.rssiWeak ? 'Srednji' : 'Slab';
  $('device').innerHTML = [
    ['Naprava', `BioSens ${String(latest.unitId).padStart(2, '0')}`],
    ['Povezava', online ? 'Deluje' : 'Ni povezave', online ? 'normal' : 'attention'],
    ['Zadnji paket', `pred ${minutesAgo(week)} min`],
    ['Signal', `${signal} · ${latest.rssi} dBm · SNR ${fmt(latest.snr, 1)} dB`, signal === 'Slab' ? 'unusual' : 'normal'],
    ...[1, 2, 3].map(i => [`Temperatura čipa ${i}`, `${latest[`chipTemp${i}`]} °C`]),
  ].map(([label, value, state]) => `<div class="flex flex-wrap justify-between gap-x-3 gap-y-1 px-4.5 py-4 border-b border-line last:border-b-0"><dt class="text-muted">${label}</dt><dd class="font-bold ${TONE[state] ?? ''}">${value}</dd></div>`).join('');
  $('packets').innerHTML = week.rows.slice(-8).reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td><td>${row.rssi} dBm</td><td>${fmt(row.snr, 1)} dB</td></tr>`).join('');
}
draw();
live(week, draw); // "pred X min" and the connection state change even without new data
