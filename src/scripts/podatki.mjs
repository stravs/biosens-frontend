// Podatki: charts for the main measurements, the spectrometer and a full table, for the chosen period.
import { toCsv, rowValue } from '../lib/app.mjs';
import { LINES, SAMPLE, SPEC } from '../lib/labels.mjs';
import { transmission, wavelengthColor } from '../lib/spectrum.mjs';
import { DEFAULT, PRESETS, clamp, fromInputValue, fromQuery, resolve, shift, snapToPreset, toInputValue, toQuery, zoomOut } from '../lib/timerange.mjs';
import { AREA, PLOT, YLABEL, fillCharts, plot, specMeta, syncedHover } from './chart.mjs';
import { WEEK, fetchJson, live, loadWeek, prepare } from './data.mjs';
import { $, fmt, time } from './format.mjs';
import { heatmapHover } from './heatmap-hover.mjs';
import { CHANNEL_MAX, spectrumBuckets, spectrumScale, viridis, viridisGradient } from '../lib/spectrum-view.mjs';

// Spectrometer: measured response by default; baseline-relative signal is optional.
const NM_MIN = 400, NM_MAX = 950;
const nmX = nm => (nm - NM_MIN) / (NM_MAX - NM_MIN) * 100; // % across the plot

const H3 = 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2 text-[19px] font-[650]';
const LEGEND = 'flex flex-wrap items-center gap-x-5 gap-y-1 mb-2 text-[18px]';
const KEY = 'inline-block w-7 h-0 align-middle';
let relativeSpectrum = false;
const spectrumUnit = () => relativeSpectrum ? '%' : 'a.u.';
const spectrumValues = (row, reference) => relativeSpectrum ? transmission(row.spectrum, reference) : row.spectrum;
const clipped = value => value >= CHANNEL_MAX ? ' · možna nasičenost' : '';

function spectrumCard(range, reference, scale) {
  const now = spectrumValues(range.at(-1), reference), then = spectrumValues(range[0], reference);
  const { lo, hi } = scale, unit = spectrumUnit(), w = 800, h = 220;
  const x = nm => nmX(nm) / 100 * w, y = v => h - 12 - (v - lo) / (hi - lo) * (h - 24);
  const line = (values, cls, attrs = '') => {
    let connected = false;
    const d = values.map(c => {
      if (!Number.isFinite(c.value)) { connected = false; return ''; }
      const command = connected ? 'L' : 'M'; connected = true;
      return `${command}${x(c.wavelength).toFixed(1)},${y(c.value).toFixed(1)}`;
    }).join('');
    return `<path class="fill-none stroke-[2.5] ${cls}" stroke-linejoin="round" ${attrs} vector-effect="non-scaling-stroke" d="${d}"/>`;
  };
  const dots = now.map((c, i) => !Number.isFinite(c.value) ? '' : `<span class="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent after:absolute after:-inset-2.5 hover:size-4 focus-visible:size-4" style="left:${nmX(c.wavelength)}%;top:${y(c.value) / h * 100}%" tabindex="0"
      title="${c.wavelength} nm · zadnja ${fmt(c.value, 1)} ${unit} · začetek ${fmt(then[i].value, 1)} ${unit}${clipped(range.at(-1).spectrum[i].value)}"></span>`).join('');
  const ticks = [hi, hi / 2, lo];
  const yl = ticks.map(v => `<span class="${YLABEL}" style="top:${y(v) / h * 100}%">${fmt(v, 0)}</span>`).join('');
  const grid = ticks.map(v => `<line class="stroke-line" x1="0" x2="${w}" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join('');
  const baseline = relativeSpectrum ? `<line class="stroke-muted" stroke-dasharray="4 4" x1="0" x2="${w}" y1="${y(100)}" y2="${y(100)}"/>` : '';
  const strip = now.map(c => `<i class="absolute inset-y-0 rounded-xs" style="left:${nmX(c.wavelength - 10)}%;width:${nmX(c.wavelength + 10) - nmX(c.wavelength - 10)}%;background:${wavelengthColor(c.wavelength)}"></i>`).join('');
  const ticksNm = [400, 500, 600, 700, 800, 900].map(nm => `<span class="absolute top-0.5 -translate-x-1/2" style="left:${nmX(nm)}%">${nm}</span>`).join('');
  return `<h3 class="${H3}">Spekter · ${relativeSpectrum ? 'signal glede na običajno stanje (%)' : 'odziv senzorja (a.u.)'}</h3>
    <p class="${LEGEND}"><span><span class="${KEY} border-t-4 border-accent"></span> Zadnja meritev (${time(range.at(-1).receivedAt)})</span><span><span class="${KEY} border-t-4 border-dashed border-muted"></span> Na začetku (${time(range[0].receivedAt)})</span></p>
    <div class="${PLOT}"><div class="relative" aria-hidden="true">${yl}</div><div class="area ${AREA}">
      <svg class="block w-full h-55" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Odziv senzorja po valovnih dolžinah v ${unit}">${grid}${baseline}${line(then, 'stroke-muted', 'stroke-dasharray="6 5"')}${line(now, 'stroke-accent')}</svg>${dots}
    </div></div>
    <div class="ml-13"><div class="relative h-3 mt-1.5 rounded-[3px] bg-line">${strip}</div><div class="relative h-5 text-[14px] text-muted">${ticksNm}</div></div>
    <p class="mt-2 text-center text-[16px] text-muted">Valovna dolžina (nm)</p>`;
}

function heatmap(range, reference, scale) {
  const buckets = spectrumBuckets(range), cols = buckets.length;
  const nm = range[0].spectrum.map(c => c.wavelength);
  const { lo, hi } = scale, unit = spectrumUnit();
  const cells = buckets.map((bucket, i) => nm.map((wavelength, ch) => {
    const values = bucket.rows.map(row => spectrumValues(row, reference)[ch].value).filter(Number.isFinite);
    if (!values.length) return '';
    const value = values.reduce((sum, v) => sum + v, 0) / values.length;
    const saturated = bucket.rows.some(row => row.spectrum[ch].value >= CHANNEL_MAX);
    return `<rect data-column="${i}" data-channel="${ch}" data-wavelength="${wavelength}" data-time="${bucket.from}" data-end="${bucket.to}" data-count="${values.length}" data-unit="${unit}" data-saturated="${saturated}" data-value="${value}" class="[&[data-heat-active]]:stroke-ink [&[data-heat-active]]:stroke-2" vector-effect="non-scaling-stroke" x="${i}" y="${ch}" width="1" height="1" fill="${viridis((value - lo) / (hi - lo))}"/>`;
  }).join('')).join('');
  return `<h3 class="${H3}">Vsi kanali skozi čas</h3>
    <p class="${LEGEND}"><span>${fmt(lo, 0)}</span><i class="inline-block w-40 h-3 rounded border border-line" style="background:${viridisGradient}"></i><span>${fmt(hi, 0)} ${unit}</span><span class="text-muted">vijolično = manj, rumeno = več</span></p>
    <p class="mb-2 text-[15px] text-muted">Valovna dolžina (nm) · barva = ${relativeSpectrum ? 'signal glede na običajno stanje (%)' : 'odziv senzorja (a.u.)'}</p>
    <div class="grid grid-cols-[auto_1fr] gap-2"><div class="grid grid-rows-[repeat(18,1fr)] text-right text-[14px] leading-none text-muted">${nm.map(wl => `<span class="self-center">${wl}</span>`).join('')}</div>
      <svg data-heatmap tabindex="0" aria-describedby="heat-tooltip" class="block w-full h-94.5 rounded-lg cursor-crosshair bg-line md:h-108" viewBox="0 0 ${cols} ${nm.length}" preserveAspectRatio="none" role="img" aria-label="Izmerjene vrednosti vseh kanalov skozi čas. Puščice izberejo čas in kanal; Escape zapre prikaz.">${cells}<line data-heat-crosshair visibility="hidden" y1="0" y2="${nm.length}" class="pointer-events-none stroke-ink stroke-[1.5]" vector-effect="non-scaling-stroke"/></svg></div>
    <div class="flex justify-between gap-2 mt-1.5 pl-14.5 text-[16px] text-muted"><span>${time(range[0].receivedAt)}</span><span>${time(range.at(-1).receivedAt)}</span></div>
    <p class="mt-2 text-center text-[16px] text-muted">Čas · povprečje na časovni stolpec · sivo = ni podatkov</p>
    <div id="heat-tooltip" data-heat-tooltip role="tooltip" aria-live="polite" hidden class="pointer-events-none absolute z-20 max-w-[calc(100%-16px)] rounded-2xl border border-line bg-card p-4 text-[15px] text-ink shadow-card"></div>`;
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
heatmapHover($('spec-heat'));
// Time range: one control above everything; charts, spectrometer, table and CSV all follow it.
let current = resolve(fromQuery(location.search) ?? DEFAULT, bounds);
// Averages are fetched for exactly the chosen period; their first bucket may start a little before it.
const shownRows = () => shown.bucket ? shown.rows : shown.rows.filter(r => r.receivedAt >= current.from && r.receivedAt <= current.to);
function setRange(state) {
  current = resolve(state.preset ? state : snapToPreset(clamp(state, bounds), bounds), bounds);
  try { history.replaceState(null, '', `?${toQuery(current)}${week.simulated ? '&demo=1' : ''}`); } catch {}
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
  const { reference } = shown, newest = week.rows.at(-1).receivedAt;
  const plots = LINES.map(key => plot(range, key));
  const rowEls = fillCharts($('graphs'), plots);
  graphsHover.set(range, LINES.map((key, i) => ({ key, el: rowEls[i], ...plots[i] })), newest);
  const specPlots = SPEC.map(s => plot(range, s.key, {}, [], specMeta(s.key)));
  const specEls = fillCharts($('spec-graphs'), specPlots);
  specHover.set(range, SPEC.map((s, i) => ({ key: s.key, el: specEls[i], ...specPlots[i] })), newest);
  const scale = spectrumScale(shown.rows, reference, relativeSpectrum);
  $('spectrum').innerHTML = spectrumCard(range, reference, scale);
  $('spec-heat').innerHTML = heatmap(range, reference, scale);
  $('readings').innerHTML = range.slice().reverse().map(row =>
    `<tr><td>${time(row.receivedAt)}</td>${SAMPLE.map(([key, f]) => `<td>${fmt(rowValue(row, key), f.digits)}</td>`).join('')}</tr>`).join('');
  $('table-count').textContent = shown.bucket ? `${range.length} povprečij po ${shown.bucket / 3600000} h, najnovejše zgoraj.` : `${range.length} meritev, najnovejše zgoraj.`;
}

$('spectrum-mode').addEventListener('change', event => {
  relativeSpectrum = event.target.value === 'relative';
  drawData();
});

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
