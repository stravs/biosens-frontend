// Shared by the pages: settings, readings from the Worker (or demo data) and live refresh.
import { buildDemoData } from '../lib/app.mjs';
import { EVENT_KEYS } from '../lib/labels.mjs';
import { detectEvents } from '../lib/monitoring.mjs';
import { STORAGE_KEY, loadSettings } from '../lib/settings.mjs';
import { baseline, indicators } from '../lib/spectrum.mjs';

export const WEEK = 7 * 86400000;
let saved = null;
try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
export const settings = loadSettings(saved);
export const rules = settings.rules;

// JSON from the Worker; null on error, or with no API (astro dev).
export async function fetchJson(path) {
  try { const response = await fetch(path); if (response.ok) return await response.json(); } catch {}
  return null;
}

// Spectrometer readings are compared with the device's own normal: the per-channel median of the given readings.
export function prepare(raw) {
  const reference = baseline(raw);
  const rows = raw.map(r => ({ ...r, ...indicators(r.spectrum, reference) }));
  return { reference, rows, events: detectEvents(rows, rules, EVENT_KEYS) };
}

// The week up to the newest reading, and bounds = first and last reading ever.
// Demo data only while the device has sent nothing.
export async function loadWeek() {
  const week = await fetchJson('/api/readings');
  const simulated = !week?.rows.length;
  document.getElementById('source').textContent = simulated
    ? 'Ni podatkov z naprave: prikazani so simulirani podatki. Privzete meje so izmišljene.'
    : 'Podatki z naprave. Privzete meje so izmišljene.';
  const data = prepare(simulated ? buildDemoData(1) : week.rows);
  const bounds = simulated ? { start: data.rows[0].receivedAt, end: data.rows.at(-1).receivedAt } : { start: week.start, end: week.end };
  return { simulated, bounds, ...data };
}

// Live: once a minute, fetch only readings newer than the last one (cheap: just the new rows are read),
// update the week in place and call onPoll(gotNew). Paused while the tab is hidden.
// With demo data, the page reloads as soon as the device has sent something.
export function live(week, onPoll) {
  let busy = false;
  async function poll() {
    if (document.hidden || busy) return;
    busy = true;
    try {
      if (week.simulated) { if ((await fetchJson('/api/readings'))?.rows.length) location.reload(); return; }
      const from = week.rows.at(-1).receivedAt + 1;
      const data = await fetchJson(`/api/readings?from=${from}&to=${from + WEEK}`);
      const gotNew = Boolean(data?.rows.length);
      if (gotNew) {
        const end = data.rows.at(-1).receivedAt;
        Object.assign(week, prepare([...week.rows, ...data.rows].filter(r => r.receivedAt >= end - WEEK)));
        week.bounds.end = end;
      }
      onPoll(gotNew);
    } finally { busy = false; }
  }
  setInterval(poll, 60000);
  document.addEventListener('visibilitychange', poll);
}
