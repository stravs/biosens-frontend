// Naprava: connection, last packet, signal and chip temperatures.
import { live, loadWeek, settings } from './data.mjs';
import { $, fmt, time } from './format.mjs';

const week = await loadWeek();

function draw() {
  const latest = week.rows.at(-1);
  const minutesAgo = Math.max(0, Math.round((Date.now() - latest.receivedAt) / 60000));
  const online = minutesAgo <= settings.offlineMinutes;
  const signal = latest.rssi >= settings.rssiGood ? 'Dober' : latest.rssi >= settings.rssiWeak ? 'Srednji' : 'Slab';
  $('device').innerHTML = [
    ['Naprava', `BioSens ${String(latest.unitId).padStart(2, '0')}`],
    ['Povezava', online ? 'Deluje' : 'Ni povezave', online ? 'normal' : 'attention'],
    ['Zadnji paket', `pred ${minutesAgo} min`],
    ['Signal', `${signal} · ${latest.rssi} dBm · SNR ${fmt(latest.snr, 1)} dB`, signal === 'Slab' ? 'unusual' : 'normal'],
    ...[1, 2, 3].map(i => [`Temperatura čipa ${i}`, `${latest[`chipTemp${i}`]} °C`]),
  ].map(([label, value, state]) => `<div${state ? ` data-status="${state}"` : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  $('packets').innerHTML = week.rows.slice(-8).reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td><td>${row.rssi} dBm</td><td>${fmt(row.snr, 1)} dB</td></tr>`).join('');
}
draw();
live(week, draw); // "pred X min" and the connection state change even without new data
