// Shared bits for the Voda sketches (pages in src/pages/skice/).
import { FIELDS } from '../../lib/app.mjs';
import { MAIN, SPEC_BY_KEY, info } from '../../lib/labels.mjs';
import { assessPoint, currentStatus, timing } from '../../lib/monitoring.mjs';
import { describe } from '../../lib/plain.mjs';
import { segments } from '../../lib/series.mjs';
import { ALERT_KEYS } from '../../lib/spectrum.mjs';
import { isOnline, rules } from '../data.mjs';
import { clock, fmt } from '../format.mjs';

export const HOUR = 3600000, DAY = 24 * HOUR;
export const KEYS = [...Object.keys(MAIN), ...ALERT_KEYS];

export const STATUS = {
  normal: { icon: '✓', title: 'Voda je v redu', tone: 'bg-ok-bg text-ok', dot: 'bg-ok' },
  unusual: { icon: '!', title: 'Nekaj je nenavadno', tone: 'bg-warn-bg text-ink', dot: 'bg-warn-dot' },
  unknown: { icon: '?', title: 'Ni dovolj podatkov', tone: 'bg-line text-muted', dot: 'bg-muted' },
  offline: { icon: '!', title: 'Naprava ni povezana', tone: 'bg-bad-bg text-bad', dot: 'bg-bad' },
};

const specAnswer = (v, rule = {}) => !Number.isFinite(v) ? 'Ni podatka' : rule.max != null && v > rule.max ? 'Več kot običajno' : 'Kot običajno';

// Status now and one plain line per measurement.
export function snapshot(week) {
  const { rows } = week, latest = rows.at(-1), t = timing(rows);
  const status = isOnline(week) ? currentStatus(rows, rules, ALERT_KEYS, t).status : 'offline';
  const items = KEYS.map(key => {
    const point = assessPoint(rows, rows.length - 1, key, rules[key], t);
    const spec = SPEC_BY_KEY[key];
    const plain = spec ? { question: spec.title, answer: specAnswer(latest[key], rules[key]) } : describe(key, latest[key], rules[key]);
    const number = spec ? `${latest[key] > 0 ? '+' : ''}${fmt(latest[key], 1)} %` : `${fmt(latest[key], MAIN[key].digits)} ${FIELDS[key].unit}`;
    return { key, spec: Boolean(spec), point, plain, number, unusual: Boolean(point.severity || point.changed),
      question: plain.question, answer: plain.answer ?? number };
  });
  return { rows, latest, status, items };
}

// One sentence under the status.
export function sentence({ status, items }) {
  const odd = items.filter(i => i.unusual).map(i => i.question.toLowerCase());
  if (status === 'offline') return 'Prikazane so zadnje prejete meritve.';
  if (status === 'unknown') return 'Za nekatere meritve ni nastavljenih običajnih območij.';
  if (status === 'normal') return 'V redu';
  return `Poglejte: ${odd.join(', ')}.`;
}

// The last 24 hours, hour by hour: per key 'unusual' if an event touches the hour, 'none' without readings.
export function hours(week, keys = KEYS) {
  const end = week.rows.at(-1).receivedAt;
  return Array.from({ length: 24 }, (_, h) => {
    const a = end - DAY + h * HOUR, b = a + HOUR;
    const has = week.rows.some(r => r.receivedAt > a && r.receivedAt <= b);
    const state = Object.fromEntries(keys.map(k => [k, !has ? 'none'
      : week.events.some(e => e.key === k && e.start <= b && e.end > a) ? 'unusual' : 'normal']));
    return { start: a, end: b, state };
  });
}

export function eventText(e) {
  const what = e.type === 'range' ? (e.direction > 0 ? 'nad običajnim' : 'pod običajnim') : (e.direction > 0 ? 'hitro narašča' : 'hitro pada');
  return `${info(e.key).name}: ${what}`;
}
export const eventTime = e => e.ongoing ? `od ${clock(e.start)} · še traja` : `${clock(e.start)}–${clock(e.end)}`;

// Small 24 h line with the normal band; gaps stay open.
export function spark(rows, key, rule = {}) {
  const W = 200, H = 48, P = 4;
  const finite = rows.map(r => r[key]).filter(Number.isFinite);
  let lo = Math.min(...finite, rule.min ?? Infinity), hi = Math.max(...finite, rule.max ?? -Infinity);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const x = i => i / Math.max(1, rows.length - 1) * W;
  const y = v => H - P - (v - lo) / (hi - lo) * (H - 2 * P);
  const band = rule.min != null || rule.max != null
    ? `<rect class="fill-ok-bg" x="0" width="${W}" y="${y(rule.max ?? hi)}" height="${y(rule.min ?? lo) - y(rule.max ?? hi)}"/>` : '';
  const path = segments(rows, r => r[key]).map(run => run.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(rows[i][key]).toFixed(1)}`).join('')).join('');
  return `<svg class="block w-full h-12" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${band}<path class="fill-none stroke-accent stroke-2" stroke-linejoin="round" d="${path}" vector-effect="non-scaling-stroke"/></svg>`;
}
