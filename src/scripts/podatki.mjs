// Podatki: charts for the main measurements, the spectrometer and a full table, for the chosen period.
import { toCsv, rowValue } from '../lib/app.mjs';
import { LINES, SAMPLE, SPEC } from '../lib/labels.mjs';
import { transmission, wavelengthColor } from '../lib/spectrum.mjs';
import { DEFAULT, PRESETS, clamp, fromInputValue, fromQuery, resolve, shift, snapToPreset, toInputValue, toQuery, zoomOut } from '../lib/timerange.mjs';
import { plot, specMeta, syncedHover } from './chart.mjs';
import { WEEK, fetchJson, live, loadWeek, prepare, rules } from './data.mjs';
import { $, fmt, time } from './format.mjs';

// Spectrometer: light that gets through, in % of this device's normal.
const NM_MIN = 400, NM_MAX = 950;
const nmX = nm => (nm - NM_MIN) / (NM_MAX - NM_MIN) * 100; // % across the plot

function spectrumCard(range, reference) {
  const now = transmission(range.at(-1).spectrum, reference), then = transmission(range[0].spectrum, reference);
  const all = [...now, ...then].map(c => c.value);
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.max(101, Math.ceil(Math.max(...all)) + 1);
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
  const earlier = `Na začetku (${time(range[0].receivedAt)})`;
  return `<h3>Koliko svetlobe pride skozi vodo</h3>
    <p class="legend"><span><span class="key"></span> Zdaj</span><span><span class="key then"></span> ${earlier}</span><span><span class="key ref"></span> Običajno = 100 %</span></p>
    <div class="plot spec-plot">
      <div class="ylabels" aria-hidden="true">${yl}</div>
      <div class="area">
        <div class="regions" aria-hidden="true"><b style="left:${nmX(410)}%">rjava barva</b><b class="cy" style="left:${nmX(610)}%">modro&shy;zelene alge</b><b style="left:${nmX(680)}%">alge</b></div>
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Prepustnost po valovnih dolžinah">${grid}${line(then, 'line then')}${line(now, 'line')}</svg>
        ${dots}
      </div>
    </div>
    <div class="spec-strip"><div class="bands">${strip}</div><div class="nm">${ticksNm}</div></div>
    <p class="muted small">Valovna dolžina v nm. Barvni trak = 18 kanalov, vsak širok okoli 20 nm. Nad 700 nm je infrardeča svetloba (siva).</p>`;
}

function heatmap(range, reference) {
  const cols = Math.min(96, range.length), size = range.length / cols;
  const buckets = Array.from({ length: cols }, (_, i) => range.slice(Math.floor(i * size), Math.floor((i + 1) * size)));
  const grid = buckets.map(b => transmission(b.at(-1).spectrum, reference).map((c, ch) => ({ wavelength: c.wavelength,
    value: b.reduce((s, r) => s + transmission(r.spectrum, reference)[ch].value, 0) / b.length })));
  const lo = Math.min(98, Math.floor(Math.min(...grid.flat().map(c => c.value)))); // one scale shared by every channel
  const nm = grid[0].map(c => c.wavelength);
  const cells = grid.map((col, i) => col.map((c, ch) => {
    const p = Math.round(Math.min(1, Math.max(0, (100 - c.value) / (100 - lo))) * 100);
    return `<rect x="${i}" y="${ch}" width="1.02" height="1.02" style="fill:color-mix(in oklab, var(--accent) ${p}%, var(--card))"><title>${c.wavelength} nm · ${time(buckets[i][0].receivedAt)} · ${fmt(c.value, 1)} %</title></rect>`;
  }).join('')).join('');
  return `<h3>Vsi kanali skozi čas</h3>
    <p class="legend scale-legend"><span>100 % (običajno)</span><i></i><span>${lo} %</span><span class="muted">temneje = manj svetlobe</span></p>
    <div class="heat"><div class="heat-labels">${nm.map(wl => `<span><i style="background:${wavelengthColor(wl)}"></i>${wl}</span>`).join('')}</div>
      <svg viewBox="0 0 ${cols} ${nm.length}" preserveAspectRatio="none" role="img" aria-label="Prepustnost vseh kanalov skozi čas">${cells}</svg></div>
    <div class="axis heat-axis"><span>${time(range[0].receivedAt)}</span><span>${time(range.at(-1).receivedAt)}</span></div>`;
}

// Podatki can go back to the first reading ever; other periods are fetched when chosen.
// Up to a week: single readings. Longer: hourly averages (bucket = hours averaged per point).
const week = await loadWeek();
const { bounds } = week; // live() moves bounds.end forward
let shown = { from: bounds.end - WEEK, to: bounds.end, bucket: null, ...week };
let request = 0;
const zoomTo = (from, to) => setRange({ from, to });
const graphsHover = syncedHover($('graphs'), $('stack-time'), zoomTo);
const specHover = syncedHover($('spec-graphs'), $('spec-time'), zoomTo);
// Time range: one control above everything; charts, spectrometer, table and CSV all follow it.
let current = resolve(fromQuery(location.search) ?? DEFAULT, bounds);
// Averages are fetched for exactly the chosen period; their first bucket may start a little before it.
const shownRows = () => shown.bucket ? shown.rows : shown.rows.filter(r => r.receivedAt >= current.from && r.receivedAt <= current.to);
function setRange(state) {
  current = resolve(state.preset ? state : snapToPreset(clamp(state, bounds), bounds), bounds);
  try { history.replaceState(null, '', `?${toQuery(current)}`); } catch {}
  drawData();
}
function drawTimeBar() {
  const preset = PRESETS.find(p => p.id === current.preset);
  $('t-label').textContent = preset ? preset.label : 'Izbrano obdobje';
  $('t-exact').textContent = `${time(current.from)} – ${time(current.to)}`;
  $('t-back').disabled = current.from <= bounds.start;
  $('t-fwd').disabled = current.to >= bounds.end;
  $('t-zoom').disabled = current.from <= bounds.start && current.to >= bounds.end;
  $('t-presets').querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === current.preset)));
  $('t-from').value = toInputValue(current.from);
  $('t-to').value = toInputValue(current.to);
  $('t-from').min = $('t-to').min = toInputValue(bounds.start);
  $('t-from').max = $('t-to').max = toInputValue(bounds.end);
}
function drawEmpty(message) {
  $('data').hidden = true;
  $('empty').hidden = false;
  $('empty').textContent = message;
  graphsHover.set([], []);
  specHover.set([], []);
}
// Chart rows are in the page; put each plot in its row and the time axis under the last one.
function fillCharts(container, plots) {
  const rowEls = [...container.querySelectorAll(':scope > .row')];
  rowEls.forEach((row, i) => { row.querySelector('.plot').outerHTML = plots[i].html; });
  container.querySelector(':scope > .axis').outerHTML = plots[0].axis;
  return rowEls;
}
async function drawData() {
  drawTimeBar();
  const id = ++request;
  const long = current.to - current.from > WEEK;
  if (long || shown.bucket || current.from < shown.from || current.to > shown.to) {
    // Single readings come with the week before the end, so "normal" is that week's median, as for the latest data.
    // Averages: "normal" is the median over the whole period.
    const to = Math.ceil(current.to), from = Math.floor(long ? current.from : Math.min(current.from, to - WEEK));
    $('table-count').textContent = 'Nalagam …';
    const data = await fetchJson(`/api/${long ? 'hours' : 'readings'}?from=${from}&to=${to}`);
    if (id !== request) return; // a newer choice is already loading
    if (!data) return drawEmpty('Podatkov ni bilo mogoče naložiti. Poskusite znova.');
    shown = { from, to, bucket: data.bucket ?? null, ...(data.rows.length ? prepare(data.rows) : { rows: [], events: [], reference: null }) };
  }
  const range = shownRows();
  if (!range.length) return drawEmpty('V tem obdobju ni meritev.');
  $('data').hidden = false;
  $('empty').hidden = true;
  const { events, reference } = shown, newest = week.rows.at(-1).receivedAt;
  const from = range[0].receivedAt, to = range.at(-1).receivedAt;
  const marks = key => events.filter(e => e.key === key && e.end >= from && e.start <= to);
  const plots = LINES.map(key => plot(range, key, rules[key], marks(key)));
  const rowEls = fillCharts($('graphs'), plots);
  graphsHover.set(range, LINES.map((key, i) => ({ key, el: rowEls[i], ...plots[i] })), newest);
  $('spectrum').innerHTML = spectrumCard(range, reference);
  $('spec-heat').innerHTML = heatmap(range, reference);
  const specPlots = SPEC.map(s => plot(range, s.key, rules[s.key], marks(s.key), specMeta(s.key)));
  const specEls = fillCharts($('spec-graphs'), specPlots);
  specHover.set(range, SPEC.map((s, i) => ({ key: s.key, el: specEls[i], ...specPlots[i] })), newest);
  $('readings').innerHTML = range.slice().reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td>${SAMPLE.map(([key, f]) => `<td>${fmt(rowValue(row, key), f.digits)}</td>`).join('')}</tr>`).join('');
  $('table-count').textContent = shown.bucket ? `${range.length} povprečij po ${shown.bucket / 3600000} h, najnovejše zgoraj.` : `${range.length} meritev, najnovejše zgoraj.`;
}

// Time picker popover: presets as rows, custom range below a hairline.
const pop = $('t-pop');
function openPicker(open) {
  pop.hidden = !open;
  $('t-open').setAttribute('aria-expanded', String(open));
  $('t-error').textContent = '';
  if (open) pop.querySelector('[aria-pressed="true"], button')?.focus();
}
$('t-open').addEventListener('click', () => openPicker(pop.hidden));
$('t-presets').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  if (b) { setRange({ preset: b.dataset.preset }); openPicker(false); $('t-open').focus(); }
});
$('t-custom').addEventListener('submit', e => {
  e.preventDefault();
  const from = fromInputValue($('t-from').value), to = fromInputValue($('t-to').value);
  if (!Number.isFinite(from) || !Number.isFinite(to)) { $('t-error').textContent = 'Vnesite začetek in konec.'; return; }
  if (from >= to) { $('t-error').textContent = 'Začetek mora biti pred koncem.'; return; }
  setRange({ from, to });
  openPicker(false);
});
document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.tp')) openPicker(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { openPicker(false); $('t-open').focus(); } });
$('t-back').addEventListener('click', () => setRange(shift(current, -1, bounds)));
$('t-fwd').addEventListener('click', () => setRange(shift(current, 1, bounds)));
$('t-zoom').addEventListener('click', () => setRange(zoomOut(current, bounds)));
drawData();

$('csv').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob(['﻿', toCsv(shownRows(), 'sample', week.simulated)], { type: 'text/csv;charset=utf-8' }));
  const stamp = ms => toInputValue(ms).replace('T', '_').replace(':', '');
  const link = Object.assign(document.createElement('a'), { href: url, download: `biosens_${stamp(current.from)}_${stamp(current.to)}.csv` });
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// New readings: follow them only with a preset over the latest week. A chosen period or hourly
// averages stay as they are (refetching averages per packet would be costly).
live(week, gotNew => {
  if (!gotNew) return;
  const next = resolve(current, bounds);
  if (current.preset && next.to - next.from <= WEEK) {
    shown = { from: bounds.end - WEEK, to: bounds.end, bucket: null, ...week };
    current = next;
    if (pop.hidden) drawData();
  } else if (pop.hidden) drawTimeBar();
});
