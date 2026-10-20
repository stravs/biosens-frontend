// No default water-quality limits. Rules must be provided for the selected device.
export const MAIN_FIELDS = ['temperature', 'turbidity', 'conductivity', 'fluorescenceRaw'];
export const INTERVAL_MS = 5 * 60 * 1000;

export function validateRules(rules) {
  for (const key of MAIN_FIELDS) {
    const rule = rules[key] || {};
    for (const name of ['min', 'max', 'attentionMin', 'attentionMax', 'change']) {
      if (rule[name] != null && !Number.isFinite(rule[name])) throw new Error('Vnesite končna števila ali pustite polja prazna.');
    }
    if ((rule.min != null) !== (rule.max != null)) throw new Error('Za običajno območje vnesite obe meji.');
    if (rule.min != null && rule.min >= rule.max) throw new Error('Spodnja meja mora biti manjša od zgornje.');
    if (rule.attentionMin != null && rule.attentionMax != null && rule.attentionMin >= rule.attentionMax) throw new Error('Spodnja opozorilna meja mora biti manjša od zgornje.');
    if (rule.min != null && rule.attentionMin != null && rule.attentionMin > rule.min) throw new Error('Spodnja opozorilna meja mora biti pod običajnim območjem ali na njegovi meji.');
    if (rule.max != null && rule.attentionMax != null && rule.attentionMax < rule.max) throw new Error('Zgornja opozorilna meja mora biti nad običajnim območjem ali na njegovi meji.');
    if (rule.change != null && rule.change <= 0) throw new Error('Prag spremembe mora biti večji od nič.');
  }
  return rules;
}

export function hourChange(rows, index, key) {
  // Exactly one hour, with no missing five-minute samples or invalid values.
  if (index < 12) return null;
  for (let i = index - 12; i <= index; i++) {
    if (!Number.isFinite(rows[i][key])) return null;
    if (i > index - 12 && rows[i].receivedAt - rows[i - 1].receivedAt !== INTERVAL_MS) return null;
  }
  return rows[index][key] - rows[index - 12][key];
}

export function assessPoint(rows, index, key, rule = {}) {
  const value = rows[index]?.[key];
  const delta = hourChange(rows, index, key);
  let severity = null, boundary = null;
  if (Number.isFinite(value)) {
    if (rule.attentionMin != null && value < rule.attentionMin) { severity = 'attention'; boundary = rule.attentionMin; }
    else if (rule.attentionMax != null && value > rule.attentionMax) { severity = 'attention'; boundary = rule.attentionMax; }
    else if (rule.min != null && value < rule.min) { severity = 'unusual'; boundary = rule.min; }
    else if (rule.max != null && value > rule.max) { severity = 'unusual'; boundary = rule.max; }
  }
  return { severity, boundary, delta, magnitude: boundary == null ? null : Math.abs(value - boundary),
    changed: delta != null && rule.change != null && Math.abs(delta) >= rule.change };
}

export function currentStatus(rows, rules = {}) {
  if (!rows.length) return { status: 'unknown', covered: 0 };
  const latest = rows.at(-1);
  const points = MAIN_FIELDS.map(key => assessPoint(rows, rows.length - 1, key, rules[key]));
  const covered = MAIN_FIELDS.filter(key => rules[key]?.min != null && rules[key]?.max != null && Number.isFinite(latest[key])).length;
  const status = points.some(point => point.severity === 'attention') ? 'attention'
    : points.some(point => point.severity === 'unusual' || point.changed) ? 'unusual'
    : covered === MAIN_FIELDS.length ? 'normal' : 'unknown';
  return { status, covered };
}

export function detectEvents(rows, rules = {}) {
  const events = [];
  for (const key of MAIN_FIELDS) {
    for (const type of ['range', 'change']) {
      let active = null;
      function close(end, interrupted = false) {
        if (!active) return;
        events.push({ ...active, end, ongoing: false, interrupted });
        active = null;
      }
      rows.forEach((row, index) => {
        const gap = index > 0 && row.receivedAt - rows[index - 1].receivedAt !== INTERVAL_MS;
        if (gap) close(rows[index - 1].receivedAt, true);
        const point = assessPoint(rows, index, key, rules[key]);
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
