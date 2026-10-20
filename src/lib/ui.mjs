// Simple page: three views (everyone / expert / maintenance). All data is simulated.
import { FIELDS, buildDemoData, fieldsForView, rowValue, selectRange, toCsv } from './app.mjs';
import { assessPoint, currentStatus, detectEvents, eventsInRange } from './monitoring.mjs';
import { createDemoRules } from './demo-rules.mjs';

const MAIN = {
  temperature: { name: 'Temperatura', digits: 1 },
  turbidity: { name: 'Motnost', digits: 1 },
  conductivity: { name: 'Prevodnost', digits: 0 },
  fluorescenceRaw: { name: 'Fluorescenca', digits: 2 },
};
const STATUS = {
  normal: { text: 'Voda je v redu', icon: '✓' },
  unusual: { text: 'Nekaj je nenavadno', icon: '!' },
  attention: { text: 'Pozor! Preverite vodo', icon: '!' },
  unknown: { text: 'Ni dovolj podatkov', icon: '?' },
};
const WORD = { attention: 'Pozor', unusual: 'Nenavadno', normal: 'V redu' };

const $ = id => document.getElementById(id);
const fmt = (value, digits) => Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '–';
const time = ms => new Date(ms).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

function chart(rows, key, rule = {}) {
  const w = 800, h = 200, pad = 12;
  const values = rows.map(row => rowValue(row, key));
  const lo = Math.min(...values, rule.min ?? Infinity), hi = Math.max(...values, rule.max ?? -Infinity);
  const x = i => pad + i / (rows.length - 1) * (w - 2 * pad);
  const y = v => h - pad - (v - lo) / (hi - lo || 1) * (h - 2 * pad);
  const band = rule.min != null ? `<rect x="0" width="${w}" y="${y(rule.max)}" height="${y(rule.min) - y(rule.max)}" class="band"/>` : '';
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const digits = FIELDS[key].digits, unit = FIELDS[key].unit;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Graf: ${FIELDS[key].title}">${band}<path d="${path}" class="line" vector-effect="non-scaling-stroke"/></svg>
    <div class="axis"><span>${time(rows[0].receivedAt)}</span><span>${time(rows.at(-1).receivedAt)}</span></div>
    <p class="range">Najnižje ${fmt(Math.min(...values), digits)} ${unit} · najvišje ${fmt(Math.max(...values), digits)} ${unit}</p>`;
}

const rows = buildDemoData(1);
const rules = createDemoRules();
const latest = rows.at(-1);

// Everyone: one big answer + four cards.
const { status } = currentStatus(rows, rules);
$('status').dataset.status = status;
$('status').innerHTML = `<span class="icon" aria-hidden="true">${STATUS[status].icon}</span>${STATUS[status].text}`;
$('updated').textContent = `Zadnja meritev: ${time(latest.receivedAt)}`;
$('cards').innerHTML = Object.entries(MAIN).map(([key, { name, digits }]) => {
  const state = assessPoint(rows, rows.length - 1, key, rules[key]).severity ?? 'normal';
  return `<div class="card" data-status="${state}"><h3>${name}</h3>
    <p class="value">${fmt(latest[key], digits)} <small>${FIELDS[key].unit}</small></p>
    <p class="word">${WORD[state]}</p></div>`;
}).join('');

// Expert: a graph for every sample measurement + full table, for the chosen period.
const SAMPLE = fieldsForView('sample');
const unitText = unit => unit ? ` ${unit}` : '';
let hours = 24;
function drawData() {
  const range = selectRange(rows, hours);
  $('graphs').innerHTML = SAMPLE.map(([key, f]) => `<article class="chart">
    <h3>${f.title}<span>${fmt(rowValue(latest, key), f.digits)}${unitText(f.unit)}</span></h3>
    ${chart(range, key, rules[key])}</article>`).join('');
  $('table-head').innerHTML = `<tr><th>Čas</th>${SAMPLE.map(([, f]) => `<th>${f.title}${f.unit ? `<br>${f.unit}` : ''}</th>`).join('')}</tr>`;
  $('readings').innerHTML = range.slice().reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td>${SAMPLE.map(([key, f]) => `<td>${fmt(rowValue(row, key), f.digits)}</td>`).join('')}</tr>`).join('');
  $('table-count').textContent = `${range.length} meritev, najnovejše zgoraj.`;
  document.querySelectorAll('[data-hours]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.hours === hours)));
}
document.querySelectorAll('[data-hours]').forEach(b => b.addEventListener('click', () => { hours = +b.dataset.hours; drawData(); }));
drawData();

const events = eventsInRange(detectEvents(rows, rules), latest.receivedAt, 24).slice(0, 6);
$('events').innerHTML = events.length
  ? events.map(ev => `<li>${time(ev.start)} · ${MAIN[ev.key].name}: ${ev.type === 'range' ? 'izven območja' : 'hitra sprememba'}${ev.ongoing ? ' <b>(še traja)</b>' : ''}</li>`).join('')
  : '<li>V zadnjih 24 urah ni bilo posebnosti.</li>';
$('csv').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob(['﻿', toCsv(rows, 'sample')], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: 'biosens-7dni.csv' });
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Maintenance: is the device alive and healthy?
const minutesAgo = Math.max(0, Math.round((Date.now() - latest.receivedAt) / 60000));
const online = minutesAgo <= 15;
const signal = latest.rssi >= -90 ? 'Dober' : latest.rssi >= -105 ? 'Srednji' : 'Slab';
$('device').innerHTML = [
  ['Naprava', `BioSens ${String(latest.unitId).padStart(2, '0')}`],
  ['Povezava', online ? 'Deluje' : 'Ni povezave', online ? 'normal' : 'attention'],
  ['Zadnji paket', `pred ${minutesAgo} min`],
  ['Signal', `${signal} · ${latest.rssi} dBm · SNR ${fmt(latest.snr, 1)} dB`, signal === 'Slab' ? 'unusual' : 'normal'],
  ...[1, 2, 3].map(i => [`Temperatura čipa ${i}`, `${latest[`chipTemp${i}`]} °C`]),
].map(([label, value, state]) => `<div${state ? ` data-status="${state}"` : ''}><dt>${label}</dt><dd>${value}</dd></div>`).join('');
$('packets').innerHTML = rows.slice(-8).reverse().map(row =>
  `<tr><td>${time(row.receivedAt)}</td><td>${row.rssi} dBm</td><td>${fmt(row.snr, 1)} dB</td></tr>`).join('');

// View switch, remembered per browser.
const buttons = [...document.querySelectorAll('[data-view]')];
function show(name) {
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  document.querySelectorAll('main > section').forEach(s => { s.hidden = s.id !== name; });
  try { localStorage.setItem('view', name); } catch {}
}
buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
let saved = null;
try { saved = localStorage.getItem('view'); } catch {}
show(buttons.some(b => b.dataset.view === saved) ? saved : 'everyone');
