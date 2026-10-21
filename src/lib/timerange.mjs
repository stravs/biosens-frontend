// Time range state for the Podatki view, modelled on monitoring tools (Grafana, Datadog):
// relative presets ("last 24 hours") that follow the newest data, or a fixed from-to range.
// bounds = { start, end } of the available data; "now" is the newest measurement.

const HOUR = 3600000;
export const PRESETS = [
  { id: '1h', label: 'Zadnja ura', ms: HOUR },
  { id: '6h', label: 'Zadnjih 6 ur', ms: 6 * HOUR },
  { id: '12h', label: 'Zadnjih 12 ur', ms: 12 * HOUR },
  { id: '24h', label: 'Zadnjih 24 ur', ms: 24 * HOUR },
  { id: '2d', label: 'Zadnja 2 dneva', ms: 48 * HOUR },
  { id: '7d', label: 'Zadnjih 7 dni', ms: 168 * HOUR },
  { id: 'vse', label: 'Vse', ms: Infinity }, // from the first reading
];
export const DEFAULT = { preset: '24h' };
export const MIN_SPAN = 30 * 60000; // at least 7 five-minute samples

// Keep a fixed range inside the data and at least MIN_SPAN long, without changing its length if possible.
export function clamp({ from, to }, { start, end }) {
  if (from > to) [from, to] = [to, from];
  const span = Math.min(Math.max(to - from, MIN_SPAN), end - start);
  if (from < start) { from = start; to = start + span; }
  if (to > end) { to = end; from = end - span; }
  if (to - from < span) to = from + span;
  return { from, to };
}

// State -> concrete { from, to, preset }. Unknown presets fall back to the default.
export function resolve(state, bounds) {
  const p = PRESETS.find(x => x.id === state?.preset);
  if (p) return { from: Math.max(bounds.start, bounds.end - p.ms), to: bounds.end, preset: p.id };
  if (Number.isFinite(state?.from) && Number.isFinite(state?.to)) return { ...clamp(state, bounds), preset: null };
  return resolve(DEFAULT, bounds);
}

// A fixed range that ends at the newest data and matches a preset length becomes that preset again,
// so the view goes back to following new data (e.g. after moving back and forward again).
export function snapToPreset(range, bounds) {
  if (range.preset || range.to !== bounds.end) return range;
  const p = PRESETS.find(x => Math.abs(range.to - range.from - Math.min(x.ms, bounds.end - bounds.start)) < 1);
  return p ? { preset: p.id } : range;
}

// Twice as long, around the same middle.
export function zoomOut({ from, to }, bounds) {
  const mid = (from + to) / 2, span = (to - from) * 2;
  return clamp({ from: mid - span / 2, to: mid + span / 2 }, bounds);
}

// Move by half the range: dir -1 = back in time, +1 = forward.
export function shift({ from, to }, dir, bounds) {
  const step = (to - from) / 2 * dir;
  return clamp({ from: from + step, to: to + step }, bounds);
}

// URL: ?obdobje=24h for presets, ?od=...&do=... (ISO, UTC) for fixed ranges. Shareable and bookmarkable.
export function toQuery(range) {
  return range.preset ? `obdobje=${range.preset}`
    : `od=${new Date(range.from).toISOString()}&do=${new Date(range.to).toISOString()}`;
}

export function fromQuery(search) {
  const q = new URLSearchParams(search);
  if (PRESETS.some(p => p.id === q.get('obdobje'))) return { preset: q.get('obdobje') };
  const from = Date.parse(q.get('od') ?? ''), to = Date.parse(q.get('do') ?? '');
  return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : null;
}

// <input type="datetime-local"> uses local time without a zone: "2026-10-20T13:05".
export function toInputValue(ms) {
  const d = new Date(ms), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromInputValue = value => (value ? new Date(value).getTime() : NaN);
