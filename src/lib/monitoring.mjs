// No default water-quality limits. Rules must be provided for the selected device.
export const MAIN_FIELDS = ['temperature', 'turbidity', 'conductivity', 'fluorescenceRaw'];
const HOUR = 3600000;

export function validateRules(rules) {
  for (const key of MAIN_FIELDS) {
    const rule = rules[key] || {};
    for (const name of ['min', 'max', 'change']) {
      if (rule[name] != null && !Number.isFinite(rule[name])) throw new Error('Vnesite končna števila ali pustite polja prazna.');
    }
    if ((rule.min != null) !== (rule.max != null)) throw new Error('Za običajno območje vnesite obe meji.');
    if (rule.min != null && rule.min >= rule.max) throw new Error('Spodnja meja mora biti manjša od zgornje.');
    if (rule.change != null && rule.change <= 0) throw new Error('Prag spremembe mora biti večji od nič.');
  }
  return rules;
}

// Where samples are missing. The interval is set on the device and can change, and real readings never
// arrive exactly on time, so nothing assumes a fixed one. The usual step around a reading is the median of
// the steps just before it or just after it, whichever is longer, so a change of interval is not a gap.
// A step over 1.5x the usual one is a gap. Repeated timestamps (duplicate uplinks) are ignored.
// Also right for hourly averages.
const SIDE = 10; // steps looked at on each side
const lowerMedian = values => {
  const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};
export function timing(rows) {
  const steps = rows.map((row, i) => i ? row.receivedAt - rows[i - 1].receivedAt : 0);
  const step = steps.map((s, i) => {
    const before = lowerMedian(steps.slice(Math.max(1, i - SIDE), i)), after = lowerMedian(steps.slice(i + 1, i + 1 + SIDE));
    return before == null && after == null ? s : Math.max(before ?? 0, after ?? 0);
  });
  return { step, gap: steps.map((s, i) => i > 0 && s > step[i] * 1.5) };
}

// Change over the last hour: from the reading closest to one hour earlier, with no missing samples or
// invalid values in between. "Closest" allows half a usual step, but never more than 15 minutes, so with
// readings (or averages) more than 1.5 hours apart there is no one-hour change.
// Pass t = timing(rows) when calling for many rows.
export function hourChange(rows, index, key, t = timing(rows)) {
  const now = rows[index];
  if (!now || !Number.isFinite(now[key])) return null;
  const target = now.receivedAt - HOUR, tolerance = Math.min(t.step[index] / 2, HOUR / 4);
  let best = -1;
  for (let i = index - 1; i >= 0 && rows[i].receivedAt >= target - tolerance; i--) {
    const off = Math.abs(rows[i].receivedAt - target);
    if (off <= tolerance && (best < 0 || off < Math.abs(rows[best].receivedAt - target))) best = i;
  }
  if (best < 0) return null;
  for (let i = best; i < index; i++) if (!Number.isFinite(rows[i][key]) || t.gap[i + 1]) return null;
  return now[key] - rows[best][key];
}

export function assessPoint(rows, index, key, rule = {}, t = timing(rows)) {
  const value = rows[index]?.[key];
  const delta = hourChange(rows, index, key, t);
  let severity = null, boundary = null;
  if (Number.isFinite(value)) {
    if (rule.min != null && value < rule.min) { severity = 'unusual'; boundary = rule.min; }
    else if (rule.max != null && value > rule.max) { severity = 'unusual'; boundary = rule.max; }
  }
  return { severity, boundary, delta, magnitude: boundary == null ? null : Math.abs(value - boundary),
    changed: delta != null && rule.change != null && Math.abs(delta) >= rule.change };
}

// extra: keys that can make the status unusual but don't count towards coverage (spectrometer alerts).
export function currentStatus(rows, rules = {}, extra = [], t = timing(rows)) {
  if (!rows.length) return { status: 'unknown', covered: 0 };
  const latest = rows.at(-1);
  const points = [...MAIN_FIELDS, ...extra].map(key => assessPoint(rows, rows.length - 1, key, rules[key], t));
  const covered = MAIN_FIELDS.filter(key => rules[key]?.min != null && rules[key]?.max != null && Number.isFinite(latest[key])).length;
  const status = points.some(point => point.severity === 'unusual' || point.changed) ? 'unusual'
    : covered === MAIN_FIELDS.length ? 'normal' : 'unknown';
  return { status, covered };
}

export function detectEvents(rows, rules = {}, keys = MAIN_FIELDS) {
  const events = [], t = timing(rows);
  for (const key of keys) {
    for (const type of ['range', 'change']) {
      let active = null;
      function close(end, interrupted = false) {
        if (!active) return;
        events.push({ ...active, end, ongoing: false, interrupted });
        active = null;
      }
      rows.forEach((row, index) => {
        if (t.gap[index]) close(rows[index - 1].receivedAt, true);
        const point = assessPoint(rows, index, key, rules[key], t);
        const severity = type === 'range' ? point.severity : point.changed ? 'unusual' : null;
        if (!severity) { close(Number.isFinite(row[key]) ? row.receivedAt : rows[Math.max(0, index - 1)].receivedAt, !Number.isFinite(row[key])); return; }
        const direction = type === 'range' ? Math.sign(row[key] - point.boundary) : Math.sign(point.delta);
        if (active && (active.severity !== severity || active.direction !== direction)) close(row.receivedAt);
        const magnitude = type === 'range' ? point.magnitude : Math.abs(point.delta);
        if (!active) active = { key, type, severity, start: row.receivedAt, peak: row.receivedAt, magnitude, boundary: point.boundary,
          direction, clippedStart: index === 0 };
        if (magnitude > active.magnitude) { active.magnitude = magnitude; active.peak = row.receivedAt; }
      });
      if (active) events.push({ ...active, end: rows.at(-1).receivedAt, ongoing: true, interrupted: false });
    }
  }
  return events.sort((a, b) => b.start - a.start);
}

export function eventsInRange(events, end, hours) {
  const start = end - hours * 3600000;
  return events.filter(event => event.start <= end && event.end >= start);
}
