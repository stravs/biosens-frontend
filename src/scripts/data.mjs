// Shared settings, explicit demo mode, and live readings. Failures never generate measurements.
import { buildDemoData } from '../lib/app.mjs';
import { EVENT_KEYS } from '../lib/labels.mjs';
import { detectEvents } from '../lib/monitoring.mjs';
import { STORAGE_KEY, loadSettings } from '../lib/settings.mjs';
import { baseline, indicators } from '../lib/spectrum.mjs';

export const WEEK = 7 * 86400000;
const POLL_MS = 120000;
const demo = new URLSearchParams(location.search).get('demo') === '1';
let saved = null;
try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
export const settings = loadSettings(saved);
export const rules = settings.rules;
export const minutesAgo = week => Math.max(0, Math.round((Date.now() - week.rows.at(-1).receivedAt) / 60000));
export const isOnline = week => minutesAgo(week) <= settings.offlineMinutes;

function source(message, warning = false) {
  const el = document.getElementById('source');
  el.textContent = message;
  el.setAttribute('role', warning ? 'alert' : 'status');
  el.classList.toggle('text-bad', warning);
}

export async function fetchJson(path) {
  try {
    const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
    if (response.ok) return await response.json();
  } catch {}
  return null;
}

export function prepare(raw) {
  const reference = baseline(raw);
  const rows = raw.map(r => ({ ...r, ...indicators(r.spectrum, reference) }));
  return { reference, rows, events: detectEvents(rows, rules, EVENT_KEYS) };
}

export async function loadWeek() {
  if (demo) {
    source('DEMO: simulirani podatki. Privzete meje so izmišljene.', true);
    document.querySelectorAll('nav a').forEach(a => { a.search = '?demo=1'; });
    const data = prepare(buildDemoData(1));
    return { simulated: true, bounds: { start: data.rows[0].receivedAt, end: data.rows.at(-1).receivedAt }, ...data };
  }
  // Keep page scripts waiting until real data exists. No dummy rows and no broken empty charts.
  const main = document.querySelector('main');
  main.hidden = true;
  for (;;) {
    const week = await fetchJson('/api/readings');
    if (week?.rows.length) {
      main.hidden = false;
      source('Podatki z naprave. Privzete meje so izmišljene.');
      return { simulated: false, cursor: week.cursor, bounds: { start: week.start, end: week.end }, ...prepare(week.rows) };
    }
    source(week ? 'Ni meritev z naprave. Ponovni poskus čez 2 minuti; za takojšen poskus osvežite stran.'
      : 'Podatkov ni mogoče naložiti. Ponovni poskus čez 2 minuti; za takojšen poskus osvežite stran.', true);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

export function live(week, onPoll) {
  if (week.simulated) return;
  let busy = false;
  async function poll() {
    if (document.hidden || busy) return;
    busy = true;
    try {
      // An insertion cursor also catches delayed packets whose event time predates the newest reading.
      let cursor = week.cursor, data, incoming = [];
      do {
        data = await fetchJson(`/api/readings?since=${cursor}`);
        if (!data) {
          source('Osveževanje ne deluje. Prikazane so zadnje naložene meritve; preverite njihov čas.', true);
          onPoll(false);
          return;
        }
        incoming.push(...data.rows);
        incoming = incoming.filter(r => r.receivedAt >= data.end - WEEK);
        cursor = data.cursor;
      } while (data.hasMore);
      source('Podatki z naprave. Privzete meje so izmišljene.');
      week.cursor = cursor;
      const gotNew = Boolean(incoming.length);
      if (gotNew) {
        const end = data.end;
        const rows = [...week.rows, ...incoming].filter(r => r.receivedAt >= end - WEEK).sort((a, b) => a.receivedAt - b.receivedAt);
        Object.assign(week, prepare(rows));
        week.bounds.start = data.start;
        week.bounds.end = end;
      }
      onPoll(gotNew);
    } finally { busy = false; }
  }
  setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', poll);
}
