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

// Usual time between readings: the median step. The interval is set on the device and real readings
// never arrive exactly on time, so nothing assumes a fixed one. Also right for hourly averages.
export function usualStep(rows) {
  const steps = rows.slice(1).map((row, i) => row.receivedAt - rows[i].receivedAt).sort((a, b) => a - b);
  return steps[Math.floor((steps.length - 1) / 2)];
}
// A missing sample: a step over 1.5x the usual one.
const isGap = (rows, i, step) => i > 0 && rows[i].receivedAt - rows[i - 1].receivedAt > step * 1.5;

// Change over the last hour: from the reading closest to one hour earlier (within half a usual step),
// with no missing samples or invalid values in between. Pass step when calling for many rows.
export function hourChange(rows, index, key, step = usualStep(rows)) {
  if (!(step > 0) || !Number.isFinite(rows[index][key])) return null;
  const target = rows[index].receivedAt - HOUR;
  let i = index - 1;
  for (; i >= 0 && rows[i].receivedAt > target + step / 2; i--) {
    if (!Number.isFinite(rows[i][key]) || isGap(rows, i + 1, step)) return null;
  }
  if (i < 0 || isGap(rows, i + 1, step) || rows[i].receivedAt < target - step / 2 || !Number.isFinite(rows[i][key])) return null;
  return rows[index][key] - rows[i][key];
}

export function assessPoint(rows, index, key, rule = {}, step = usualStep(rows)) {
  const value = rows[index]?.[key];
  const delta = hourChange(rows, index, key, step);
  let severity = null, boundary = null;
  if (Number.isFinite(value)) {
    if (rule.min != null && value < rule.min) { severity = 'unusual'; boundary = rule.min; }
    else if (rule.max != null && value > rule.max) { severity = 'unusual'; boundary = rule.max; }
  }
  return { severity, boundary, delta, magnitude: boundary == null ? null : Math.abs(value - boundary),
    changed: delta != null && rule.change != null && Math.abs(delta) >= rule.change };
}

// extra: keys that can make the status unusual but don't count towards coverage (spectrometer alerts).
export function currentStatus(rows, rules = {}, extra = []) {
  if (!rows.length) return { status: 'unknown', covered: 0 };
  const latest = rows.at(-1), step = usualStep(rows);
  const points = [...MAIN_FIELDS, ...extra].map(key => assessPoint(rows, rows.length - 1, key, rules[key], step));
  const covered = MAIN_FIELDS.filter(key => rules[key]?.min != null && rules[key]?.max != null && Number.isFinite(latest[key])).length;
  const status = points.some(point => point.severity === 'unusual' || point.changed) ? 'unusual'
    : covered === MAIN_FIELDS.length ? 'normal' : 'unknown';
  return { status, covered };
}

export function detectEvents(rows, rules = {}, keys = MAIN_FIELDS) {
  const events = [], step = usualStep(rows);
  for (const key of keys) {
    for (const type of ['range', 'change']) {
      let active = null;
      function close(end, interrupted = false) {
        if (!active) return;
        events.push({ ...active, end, ongoing: false, interrupted });
        active = null;
      }
      rows.forEach((row, index) => {
        if (isGap(rows, index, step)) close(rows[index - 1].receivedAt, true);
        const point = assessPoint(rows, index, key, rules[key], step);
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
