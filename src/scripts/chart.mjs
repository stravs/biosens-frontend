// Time-series charts shared by Podatki and Voda.
import { FIELDS, rowValue } from '../lib/app.mjs';
import { AXIS_DIGITS, SPEC_BY_KEY } from '../lib/labels.mjs';
import { mergeSpans, segments, ticks } from '../lib/series.mjs';
import { clock, fmt, time, year } from './format.mjs';

// Chart options for a spectrometer indicator (stored on the row, not in FIELDS).
export const specMeta = key => SPEC_BY_KEY[key] ? { value: r => r[key], title: SPEC_BY_KEY[key].title, unit: '%', digits: 1, axisDigits: 1 } : {};

// Shared with the spectrometer chart in podatki.mjs.
export const PLOT = 'grid grid-cols-[46px_1fr] gap-1.5';
export const AREA = 'relative cursor-crosshair touch-pan-y select-none';
export const YLABEL = 'absolute left-0 w-11.5 -translate-y-1/2 text-right text-[14px] text-muted tabular-nums';
const AXIS = 'flex justify-between gap-2 mt-1.5 pl-13 text-[15px] text-muted [&>:nth-child(2)]:text-center';

// Time-series plot: hairline grid with y labels, normal-range band, event spans, gaps left open.
const W = 800, H = 160, PAD = 8, PAD_Y = 22; // PAD_Y keeps edge labels inside their own row
// meta lets a chart draw a calculated series (e.g. spectrometer indicators) instead of a stored field.
export function plot(rows, key, rule = {}, marks = [], meta = {}) {
  const f = { title: FIELDS[key]?.title, unit: FIELDS[key]?.unit, digits: FIELDS[key]?.digits, ...meta };
  const val = meta.value ?? (r => rowValue(r, key));
  const values = rows.map(val), finite = values.filter(Number.isFinite);
  const [lo, mid, hi] = ticks(Math.min(...finite, rule.min ?? Infinity), Math.max(...finite, rule.max ?? -Infinity));
  const x = i => PAD + i / Math.max(1, rows.length - 1) * (W - 2 * PAD);
  const y = v => H - PAD_Y - (v - lo) / (hi - lo) * (H - 2 * PAD_Y);
  const index = ms => { const i = rows.findIndex(r => r.receivedAt >= ms); return i < 0 ? rows.length - 1 : i; };
  // Normal band; with only an upper limit (spectrometer) it runs from the bottom of the chart.
  const band = rule.min != null || rule.max != null
    ? `<rect class="fill-ok-bg" x="0" width="${W}" y="${y(rule.max ?? hi)}" height="${y(rule.min ?? lo) - y(rule.max ?? hi)}"/>` : '';
  const grid = [lo, mid, hi].map(v => `<line class="stroke-line" x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" vector-effect="non-scaling-stroke"/>`).join('');
  const spans = mergeSpans(marks).map(m => { const a = x(index(m.start)), b = x(index(m.end)); return `<rect class="fill-warn-dot opacity-28" x="${a}" width="${Math.max(4, b - a)}" y="0" height="${H}"/>`; }).join('');
  const path = segments(rows, val).map(run => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`).join('')).join('');
  const labels = [hi, mid, lo].map(v => `<span class="${YLABEL}" style="top:${(y(v) / H * 100).toFixed(1)}%">${fmt(v, f.axisDigits ?? AXIS_DIGITS[key] ?? f.digits)}</span>`).join('');
  const middle = rows[Math.floor((rows.length - 1) / 2)];
  // Short axis labels: clock time up to a day, date for longer periods.
  const tick = ms => rows.at(-1).receivedAt - rows[0].receivedAt > 86400000
    ? new Date(ms).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', ...year(ms) }) : clock(ms);
  return {
    x, y, values, unit: f.unit, digits: f.digits,
    // Plot height comes from --plot-h on the container.
    html: `<div class="plot ${PLOT}">
      <div class="relative" aria-hidden="true">${labels}</div>
      <div class="area ${AREA}">
        <svg class="block w-full h-(--plot-h)" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Graf: ${f.title}">${band}${grid}${spans}<path class="fill-none stroke-accent stroke-[2.5]" stroke-linejoin="round" d="${path}" vector-effect="non-scaling-stroke"/></svg>
        <div class="sel pointer-events-none absolute inset-y-0 border-x-[1.5px] border-accent bg-accent/14" hidden></div>
        <div class="cursor pointer-events-none absolute inset-y-0 w-0 border-l-[1.5px] border-ink" hidden><i class="absolute left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent"></i></div>
      </div>
    </div>`,
    axis: `<div class="axis ${AXIS}"><span>${tick(rows[0].receivedAt)}</span><span>${tick(middle.receivedAt)}</span><span>${tick(rows.at(-1).receivedAt)}</span></div>`,
  };
}

// Chart rows are in the page (components/ChartStack.astro); put each plot in its row and the time axis under the last one.
export function fillCharts(container, plots) {
  const rowEls = [...container.querySelectorAll(':scope > .row')];
  rowEls.forEach((row, i) => { row.querySelector('.plot').outerHTML = plots[i].html; });
  container.querySelector(':scope > .axis').outerHTML = plots[0].axis;
  return rowEls;
}

// One crosshair for every chart in a container: pointing at a time shows that time in all charts.
// The time is shown once in timeEl. With onSelect, dragging across a chart with the mouse selects
// a time range (zoom in), as in Grafana.
// set(rows, charts, newest): newest = time of the newest reading, shown as "zdaj" when the chart ends there.
export function syncedHover(container, timeEl, onSelect = null) {
  let rows = [], charts = [], newest = null, drag = null;
  const readout = (c, i) => {
    const v = c.values[i], unit = c.unit;
    const when = i == null ? (rows.at(-1).receivedAt === newest ? 'zdaj' : time(rows.at(-1).receivedAt)) : time(rows[i].receivedAt);
    c.el.querySelector('.readout').innerHTML = `${fmt(i == null ? c.values.at(-1) : v, c.digits)}${unit ? ` ${unit}` : ''}`;
    timeEl.textContent = i == null ? `Zadnja meritev · ${when}` : when;
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
  const indexAt = (e, area) => {
    const r = area.getBoundingClientRect();
    const frac = ((e.clientX - r.left) / r.width * W - PAD) / (W - 2 * PAD);
    return Math.round(Math.min(1, Math.max(0, frac)) * (rows.length - 1));
  };
  const selection = (a, b) => charts.forEach(c => {
    const s = c.el.querySelector('.sel');
    s.hidden = a == null;
    if (a != null) { s.style.left = `${c.x(Math.min(a, b)) / W * 100}%`; s.style.width = `${Math.abs(c.x(b) - c.x(a)) / W * 100}%`; }
  });
  container.addEventListener('pointermove', e => {
    const p = e.target.closest('.area');
    if (!p || !rows.length) return;
    const i = indexAt(e, p);
    show(i);
    if (drag) { drag.i = i; if (Math.abs(e.clientX - drag.x) > 6) selection(drag.start, i); }
  });
  container.addEventListener('pointerleave', () => { if (!drag) hide(); });
  if (onSelect) {
    container.addEventListener('pointerdown', e => {
      const p = e.target.closest('.area');
      if (!p || e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      drag = { start: indexAt(e, p), i: indexAt(e, p), x: e.clientX };
    });
    window.addEventListener('pointerup', e => {
      if (!drag) return;
      const { start, i, x } = drag;
      drag = null;
      selection(null);
      if (Math.abs(e.clientX - x) > 6 && start !== i) onSelect(rows[Math.min(start, i)].receivedAt, rows[Math.max(start, i)].receivedAt);
    });
  }
  return { set(newRows, newCharts, newestAt = null) { rows = newRows; charts = newCharts; newest = newestAt; hide(); } };
}
