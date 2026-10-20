// Simple page: three views (everyone / expert / maintenance). All data is simulated.
import { FIELDS, buildDemoData, fieldsForView, rowValue, selectRange, toCsv } from './app.mjs';
import { assessPoint, currentStatus, detectEvents, eventsInRange } from './monitoring.mjs';
import { createDemoRules } from './demo-rules.mjs';
import { describe, eventText } from './plain.mjs';
import { mergeSpans, segments, ticks } from './series.mjs';
import { indicators, transmission, wavelengthColor } from './spectrum.mjs';

const MAIN = {
  temperature: { name: 'Temperatura', digits: 1 },
  turbidity: { name: 'Motnost', digits: 1 },
  conductivity: { name: 'Prevodnost', digits: 0 },
  fluorescenceRaw: { name: 'Fluorescenca', digits: 2 },
};
const STATUS = {
  normal: { text: 'OK', icon: '✓' },
  unusual: { text: 'Nenavadno', icon: '!' },
  unknown: { text: 'Ni dovolj podatkov', icon: '?' },
};
const WORD = { unusual: 'Nenavadno' };
// Chart and table names on Podatki: plain measurement names.
const LABEL = { temperature: 'Temperatura', turbidity: 'Motnost', conductivity: 'Prevodnost',
  fluorescenceRaw: 'Fluorescenca', fluorescence: 'Umerjena fluorescenca' };
const AXIS_DIGITS = { temperature: 1, turbidity: 1, conductivity: 0, fluorescenceRaw: 2, fluorescence: 1 };

const $ = id => document.getElementById(id);
const fmt = (value, digits) => Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '–';
const clock = ms => new Date(ms).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
const time = ms => new Date(ms).toLocaleString('sl-SI', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

// Time-series plot: hairline grid with y labels, normal-range band, event spans, gaps left open.
const W = 800, H = 160, PAD = 8, PAD_Y = 22; // PAD_Y keeps edge labels inside their own row
// meta lets a chart draw a calculated series (e.g. spectrometer indicators) instead of a stored field.
function plot(rows, key, rule = {}, marks = [], meta = {}) {
  const f = { title: FIELDS[key]?.title, unit: FIELDS[key]?.unit, digits: FIELDS[key]?.digits, ...meta };
  const val = meta.value ?? (r => rowValue(r, key));
  const values = rows.map(val), finite = values.filter(Number.isFinite);
  const [lo, mid, hi] = ticks(Math.min(...finite, rule.min ?? Infinity), Math.max(...finite, rule.max ?? -Infinity));
  const x = i => PAD + i / Math.max(1, rows.length - 1) * (W - 2 * PAD);
  const y = v => H - PAD_Y - (v - lo) / (hi - lo) * (H - 2 * PAD_Y);
  const index = ms => { const i = rows.findIndex(r => r.receivedAt >= ms); return i < 0 ? rows.length - 1 : i; };
  const band = rule.min != null ? `<rect class="band" x="0" width="${W}" y="${y(rule.max)}" height="${y(rule.min) - y(rule.max)}"/>` : '';
  const grid = [lo, mid, hi].map(v => `<line class="grid" x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join('');
  const spans = mergeSpans(marks).map(m => { const a = x(index(m.start)), b = x(index(m.end)); return `<rect class="mark" x="${a}" width="${Math.max(4, b - a)}" y="0" height="${H}"/>`; }).join('');
  const path = segments(rows, val).map(run => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join('')).join('');
  const labels = [hi, mid, lo].map(v => `<span style="top:${(y(v) / H * 100).toFixed(1)}%">${fmt(v, f.axisDigits ?? AXIS_DIGITS[key] ?? f.digits)}</span>`).join('');
  const middle = rows[Math.floor((rows.length - 1) / 2)];
  // Short axis labels: clock time up to a day, date for longer periods.
  const tick = ms => rows.at(-1).receivedAt - rows[0].receivedAt > 86400000
    ? new Date(ms).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric' }) : clock(ms);
  return {
    x, y, values, unit: f.unit, digits: f.digits,
    html: `<div class="plot">
      <div class="ylabels" aria-hidden="true">${labels}</div>
      <div class="area">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Graf: ${f.title}">${band}${grid}${spans}<path class="line" d="${path}" vector-effect="non-scaling-stroke"/></svg>
        <div class="cursor" hidden><i></i></div>
      </div>
    </div>`,
    axis: `<div class="axis"><span>${tick(rows[0].receivedAt)}</span><span>${tick(middle.receivedAt)}</span><span>${tick(rows.at(-1).receivedAt)}</span></div>`,
  };
}

// One crosshair for every chart in a container: pointing at a time shows that time in all charts.
// With timeEl, the time is shown once there instead of under every value.
function syncedHover(container, timeEl = null) {
  let rows = [], charts = [];
  const readout = (c, i) => {
    const v = c.values[i], unit = c.unit;
    const when = i == null ? (rows.at(-1) === latest ? 'zdaj' : time(rows.at(-1).receivedAt)) : time(rows[i].receivedAt);
    c.el.querySelector('.readout').innerHTML = `${fmt(i == null ? c.values.at(-1) : v, c.digits)}${unit ? ` ${unit}` : ''}${timeEl ? '' : `<small>${when}</small>`}`;
    if (timeEl) timeEl.textContent = i == null ? `Zadnja meritev · ${when}` : when;
  };
  const show = i => charts.forEach(c => {
    const cursor = c.el.querySelector('.cursor'), dot = cursor.firstElementChild, v = c.values[i];
    cursor.hidden = false;
    cursor.style.left = `${(c.x(i) / W * 100).toFixed(2)}%`;
    dot.hidden = !Number.isFinite(v);
    if (Number.isFinite(v)) dot.style.top = `${(c.y(v) / H * 100).toFixed(2)}%`;
    readout(c, i);
  });
  const hide = () => charts.forEach(c => { c.el.querySelector('.cursor').hidden = true; readout(c, null); });
  container.addEventListener('pointermove', e => {
    const p = e.target.closest('.area');
    if (!p || !rows.length) return;
    const r = p.getBoundingClientRect();
    const frac = ((e.clientX - r.left) / r.width * W - PAD) / (W - 2 * PAD);
    show(Math.round(Math.min(1, Math.max(0, frac)) * (rows.length - 1)));
  });
  container.addEventListener('pointerleave', hide);
  return { set(newRows, newCharts) { rows = newRows; charts = newCharts; hide(); } };
}

const rows = buildDemoData(1);
const rules = createDemoRules();
const latest = rows.at(-1);

// Everyone: one big answer + four cards.
const { status } = currentStatus(rows, rules);
$('status').dataset.status = status;
$('status').innerHTML = `<span class="icon" aria-hidden="true">${STATUS[status].icon}</span>${STATUS[status].text}
  <small class="when">Zadnja meritev<br>${time(latest.receivedAt)}</small>`;
$('cards').innerHTML = Object.entries(MAIN).map(([key, { name, digits }]) => {
  const point = assessPoint(rows, rows.length - 1, key, rules[key]);
  const state = point.severity || point.changed ? 'unusual' : 'normal';
  const plain = describe(key, latest[key], rules[key]);
  const scale = plain.position == null ? '' : `<div class="scale" aria-hidden="true"><div class="track"><i style="left:${(plain.position * 100).toFixed(1)}%"></i></div>
      <div class="ends"><span>${plain.ends[0]}</span><span>${plain.ends[1]}</span></div></div>`;
  if (plain.answer == null) {
    // Number-only card (temperature): big value + change over the last hour.
    const d = point.delta;
    const trend = d == null ? '' : Math.abs(d) < 0.05 ? 'Enako kot pred eno uro'
      : `<b>${d > 0 ? '↑' : '↓'} ${fmt(Math.abs(d), 1)} ${FIELDS[key].unit}</b> v zadnji uri`;
    return `<div class="card number" data-status="${state}"><h3>${plain.question}</h3>
    <p class="answer">${fmt(latest[key], digits)}<span>${FIELDS[key].unit}</span></p>
    <p class="trend">${trend}</p>
    ${state === 'normal' ? '' : `<p class="word">${WORD[state]}</p>`}</div>`;
  }
  return `<div class="card" data-status="${state}"><h3>${plain.question}</h3>
    <p class="answer">${plain.answer}</p>
    <p class="measure">${name}: ${fmt(latest[key], digits)} ${FIELDS[key].unit}</p>
    ${scale}
    ${state === 'normal' ? '' : `<p class="word">${WORD[state]}</p>`}</div>`;
}).join('');

// Everyone: notable events in plain words, newest first.
const events = eventsInRange(detectEvents(rows, rules), latest.receivedAt, 24).slice(0, 6);
$('events').innerHTML = events.length
  ? events.map((ev, i) => `<li data-status="${ev.severity}"><button type="button" data-event="${i}">
      <b>${time(ev.start)}</b><em>${eventText(ev)}</em><span>${ev.ongoing ? 'Še traja' : `Do ${clock(ev.end)}`}</span><i aria-hidden="true">›</i></button></li>`).join('')
  : '<li data-status="normal"><em>V zadnjih 24 urah ni bilo nič posebnega.</em></li>';

// Event detail: what happened, when, and the measurement around it.
const dialogHover = syncedHover($('event-body'));
function openEvent(ev) {
  const f = FIELDS[ev.key], rule = rules[ev.key] ?? {};
  const unit = f.unit, digits = MAIN[ev.key].digits;
  const around = rows.filter(r => r.receivedAt >= ev.start - 2 * 3600000 && r.receivedAt <= ev.end + 2 * 3600000);
  const peak = rows.find(r => r.receivedAt === ev.peak);
  const p = plot(around, ev.key, rule, [ev]);
  const why = ev.type === 'range'
    ? `Običajno območje je ${fmt(rule.min, digits)}–${fmt(rule.max, digits)} ${unit}.`
    : `V eni uri se je spremenilo za ${fmt(ev.magnitude, digits)} ${unit}. Opozorimo pri ${fmt(rule.change, digits)} ${unit}.`;
  $('event-body').innerHTML = `<h2>${eventText(ev)}</h2>
    <dl class="event-facts">
      <div><dt>Začetek</dt><dd>${time(ev.start)}</dd></div>
      <div><dt>Konec</dt><dd>${ev.ongoing ? 'Še traja' : time(ev.end)}</dd></div>
      <div><dt>Vrhunec</dt><dd>${clock(ev.peak)} · ${fmt(peak?.[ev.key], digits)} ${unit}</dd></div>
    </dl>
    <p class="muted">${why}</p>
    <article class="chart ts"><h3>${LABEL[ev.key]}<span class="readout"></span></h3>${p.html}${p.axis}</article>
    <p class="muted">Rumeni pas = čas dogodka. Zeleni pas = običajno območje.</p>`;
  dialogHover.set(around, [{ key: ev.key, el: $('event-body').querySelector('.ts'), ...p }]);
  $('event-dialog').showModal();
  $('event-dialog').scrollTop = 0; // focus lands on Zapri at the bottom; keep the title in view
}
document.querySelectorAll('[data-event]').forEach(b => b.addEventListener('click', () => openEvent(events[+b.dataset.event])));
$('event-close').addEventListener('click', () => $('event-dialog').close());
$('event-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// Spectrometer, shown as in the WaQuMoS report: light that gets through, in % of clean water.
const SPEC = [
  { key: 'overall', title: 'Slabljenje – vsi kanali', hint: 'mulj, delci', digits: 1 },
  { key: 'blue', title: 'Slabljenje – modri del', hint: '410–435 nm · železo, mangan', digits: 1 },
  { key: 'algae', title: 'Alge – 680 nm', hint: 'klorofil, glede na sosednja kanala', digits: 2 },
];
const specRows = rows.map(r => ({ receivedAt: r.receivedAt, ...indicators(r.spectrum) }));
const NM_MIN = 400, NM_MAX = 950;
const nmX = nm => (nm - NM_MIN) / (NM_MAX - NM_MIN) * 100; // % across the plot

function spectrumCard(range) {
  const now = transmission(range.at(-1).spectrum), then = transmission(range[0].spectrum);
  const lo = Math.floor(Math.min(...now.map(c => c.value), ...then.map(c => c.value)) - 1), hi = 101;
  const w = 800, h = 220;
  const x = nm => nmX(nm) / 100 * w, y = v => h - 12 - (v - lo) / (hi - lo) * (h - 24);
  const line = (t, cls) => `<path class="${cls}" vector-effect="non-scaling-stroke" d="${t.map((c, i) => `${i ? 'L' : 'M'}${x(c.wavelength).toFixed(1)},${y(c.value).toFixed(1)}`).join('')}"/>`;
  const dots = now.map((c, i) => `<span class="pt" style="left:${nmX(c.wavelength)}%;top:${(y(c.value) / h * 100).toFixed(2)}%" tabindex="0"
      title="${c.wavelength} nm · zdaj ${fmt(c.value, 1)} % · prej ${fmt(then[i].value, 1)} %"></span>`).join('');
  const yl = [hi - 1, Math.round((lo + hi - 1) / 2), lo].map(v => `<span style="top:${(y(v) / h * 100).toFixed(1)}%">${v} %</span>`).join('');
  const grid = [hi - 1, Math.round((lo + hi - 1) / 2), lo].map(v => `<line class="grid${v === 100 ? ' ref' : ''}" x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join('');
  // Colour strip: one 20 nm wide band per channel (the AS7265x filter width), in the colour of that light.
  const strip = now.map(c => `<i style="left:${nmX(c.wavelength - 10)}%;width:${nmX(c.wavelength + 10) - nmX(c.wavelength - 10)}%;background:${wavelengthColor(c.wavelength)}"></i>`).join('');
  const ticksNm = [400, 500, 600, 700, 800, 900].map(nm => `<span style="left:${nmX(nm)}%">${nm}</span>`).join('');
  const earlier = hours === 24 ? 'Pred 24 urami' : hours === 6 ? 'Pred 6 urami' : 'Pred 7 dnevi';
  return `<h3>Koliko svetlobe pride skozi vodo</h3>
    <p class="legend"><span><span class="key"></span> Zdaj</span><span><span class="key then"></span> ${earlier}</span><span><span class="key ref"></span> Čista voda = 100 %</span></p>
    <div class="plot spec-plot">
      <div class="ylabels" aria-hidden="true">${yl}</div>
      <div class="area">
        <div class="regions" aria-hidden="true"><b style="left:${nmX(410)}%">železo, mangan</b><b style="left:${nmX(680)}%">alge</b></div>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Prepustnost po valovnih dolžinah">${grid}${line(then, 'line then')}${line(now, 'line')}</svg>
        ${dots}
      </div>
    </div>
    <div class="spec-strip"><div class="bands">${strip}</div><div class="nm">${ticksNm}</div></div>
    <p class="muted small">Valovna dolžina v nm. Barvni trak = 18 kanalov, vsak širok okoli 20 nm. Nad 700 nm je infrardeča svetloba (siva).</p>`;
}

function heatmap(range) {
  const cols = Math.min(96, range.length), size = range.length / cols;
  const buckets = Array.from({ length: cols }, (_, i) => range.slice(Math.floor(i * size), Math.floor((i + 1) * size)));
  const grid = buckets.map(b => transmission(b.at(-1).spectrum).map((c, ch) => ({ wavelength: c.wavelength,
    value: b.reduce((s, r) => s + transmission(r.spectrum)[ch].value, 0) / b.length })));
  const lo = Math.min(98, Math.floor(Math.min(...grid.flat().map(c => c.value)))); // one scale shared by every channel
  const nm = grid[0].map(c => c.wavelength);
  const cells = grid.map((col, i) => col.map((c, ch) => {
    const p = Math.round(Math.min(1, Math.max(0, (100 - c.value) / (100 - lo))) * 100);
    return `<rect x="${i}" y="${ch}" width="1.02" height="1.02" style="fill:color-mix(in oklab, var(--accent) ${p}%, var(--card))"><title>${c.wavelength} nm · ${time(buckets[i][0].receivedAt)} · ${fmt(c.value, 1)} %</title></rect>`;
  }).join('')).join('');
  return `<h3>Vsi kanali skozi čas</h3>
    <p class="legend scale-legend"><span>100 % (čista voda)</span><i></i><span>${lo} %</span><span class="muted">temneje = manj svetlobe</span></p>
    <div class="heat"><div class="heat-labels">${nm.map(wl => `<span><i style="background:${wavelengthColor(wl)}"></i>${wl}</span>`).join('')}</div>
      <svg viewBox="0 0 ${cols} ${nm.length}" preserveAspectRatio="none" role="img" aria-label="Prepustnost vseh kanalov skozi čas">${cells}</svg></div>
    <div class="axis heat-axis"><span>${time(range[0].receivedAt)}</span><span>${time(range.at(-1).receivedAt)}</span></div>`;
}

// Expert: graphs for the main measurements, the spectrometer, and a full table, for the chosen period.
// Same order as the cards on the Voda view.
const LINES = ['temperature', 'turbidity', 'conductivity', 'fluorescenceRaw', 'fluorescence'];
// Table columns: the charted measurements first (same order and names), then the 18 spectral channels.
const SAMPLE = [...LINES.map(key => [key, FIELDS[key]]), ...fieldsForView('sample').filter(([key]) => !LINES.includes(key))];
const allEvents = detectEvents(rows, rules);
const graphsHover = syncedHover($('graphs'), $('stack-time'));
const specHover = syncedHover($('spec-graphs'), $('spec-time'));
let hours = 24;
function drawData() {
  const range = selectRange(rows, hours);
  const from = range[0].receivedAt;
  const plots = LINES.map(key => plot(range, key, rules[key], allEvents.filter(e => e.key === key && e.end >= from)));
  // One card, rows touching, one time axis at the bottom: the pointer line runs through every row.
  $('graphs').innerHTML = LINES.map((key, i) => `<div class="ts row">
    <h3>${LABEL[key]}<span class="readout"></span></h3>${plots[i].html}</div>`).join('') + plots[0].axis;
  graphsHover.set(range, LINES.map((key, i) => ({ key, el: $('graphs').children[i], ...plots[i] })));
  $('spectrum').innerHTML = spectrumCard(range);
  $('spec-heat').innerHTML = heatmap(range);
  const specRange = selectRange(specRows, hours);
  const specPlots = SPEC.map(s => plot(specRange, s.key, {}, [], { value: r => r[s.key], title: s.title, unit: '%', digits: s.digits, axisDigits: s.digits }));
  $('spec-graphs').innerHTML = SPEC.map((s, i) => `<div class="ts row">
    <h3>${s.title}<small class="hint">${s.hint}</small><span class="readout"></span></h3>${specPlots[i].html}</div>`).join('') + specPlots[0].axis;
  specHover.set(specRange, SPEC.map((s, i) => ({ key: s.key, el: $('spec-graphs').children[i], ...specPlots[i] })));
  $('table-head').innerHTML = `<tr><th>Čas</th>${SAMPLE.map(([key, f]) => `<th>${LABEL[key] ?? f.title}${f.unit ? `<br>${f.unit}` : ''}</th>`).join('')}</tr>`;
  $('readings').innerHTML = range.slice().reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td>${SAMPLE.map(([key, f]) => `<td>${fmt(rowValue(row, key), f.digits)}</td>`).join('')}</tr>`).join('');
  $('table-count').textContent = `${range.length} meritev, najnovejše zgoraj.`;
  document.querySelectorAll('[data-hours]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.hours === hours)));
}
document.querySelectorAll('[data-hours]').forEach(b => b.addEventListener('click', () => { hours = +b.dataset.hours; drawData(); }));
drawData();

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
