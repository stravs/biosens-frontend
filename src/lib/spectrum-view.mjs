export const CHANNEL_MAX = 6553.5;
const VIRIDIS = ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725'];
export const viridisGradient = `linear-gradient(to right, ${VIRIDIS.join(', ')})`;
export function viridis(value) {
  const p = Math.max(0, Math.min(1, value)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(p)), f = p - i;
  const rgb = color => color.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16));
  const a = rgb(VIRIDIS[i]), b = rgb(VIRIDIS[i + 1]);
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(', ')})`;
}

// Use the loaded dataset, not the selected window, to keep comparisons stable.
export function spectrumScale(rows, reference, relative = false) {
  const values = rows.flatMap(r => r.spectrum.map((c, i) => relative ? c.value / reference[i] * 100 : c.value)).filter(Number.isFinite);
  const step = relative ? 25 : 500;
  return { lo: 0, hi: Math.max(relative ? 125 : step, Math.ceil(values.reduce((max, value) => Math.max(max, value), 0) / step) * step) };
}

// Equal-duration columns: absent readings stay absent, rather than stretching nearby data.
export function spectrumBuckets(rows, maxColumns = 96) {
  const from = rows[0].receivedAt, to = rows.at(-1).receivedAt;
  const cols = rows.length === 1 ? 1 : maxColumns;
  const width = (to - from) / cols || 1;
  const buckets = Array.from({ length: cols }, (_, i) => ({ from: from + i * width, to: from + (i + 1) * width, rows: [] }));
  for (const row of rows) buckets[Math.min(cols - 1, Math.floor((row.receivedAt - from) / width))].rows.push(row);
  return buckets;
}
