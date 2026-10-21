// Helpers for time-series charts: honest gaps and simple axis ticks.
// Split points into continuous runs. A run breaks on a missing value or a missing sample (a step over
// 1.5x the usual one, the median), so the chart shows a gap instead of drawing a line over data that was
// never measured. Works for readings at any interval and for hourly averages.
export function segments(rows, value) {
  const steps = rows.slice(1).map((row, i) => row.receivedAt - rows[i].receivedAt).sort((a, b) => a - b);
  const usual = steps[Math.floor(steps.length / 2)];
  const runs = [];
  let run = [];
  rows.forEach((row, i) => {
    const v = value(row);
    const gap = i > 0 && row.receivedAt - rows[i - 1].receivedAt > usual * 1.5;
    if (!Number.isFinite(v) || gap) { if (run.length) runs.push(run); run = []; }
    if (Number.isFinite(v)) run.push(i);
  });
  if (run.length) runs.push(run);
  return runs;
}

// Join overlapping time spans so overlapping events draw as one band, not darker stacked blocks.
export function mergeSpans(spans) {
  const merged = [];
  for (const { start, end } of [...spans].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else merged.push({ start, end });
  }
  return merged;
}

// Low, middle and high tick for a value range; pads a flat range so the line is not glued to an edge.
export function ticks(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi - lo < 1e-9) { const d = Math.abs(lo) * 0.05 || 1; lo -= d; hi += d; }
  return [lo, (lo + hi) / 2, hi];
}
