// Runs in front of the static site. The UG65 posts uplinks here; the page reads them back.
// Raw payloads are stored and decoded on read, so a decoder fix applies to old readings too.
// Each uplink is also added to its hour in `hours`, for long periods (see hourly.mjs).
import { decodePayload, parseUplink, rowFromRecord } from '../src/lib/payload.mjs';
import { ADD_TO_HOUR, HOURS_TABLE, SUM_BUCKETS, bucketSize, hourStart, hourlyValues, rowFromBucket } from '../src/lib/hourly.mjs';

const DAY = 86400000, WEEK = 7 * DAY;
// Single readings only for short periods; the page uses /api/hours for anything over a week.
const RAW_SPAN = 8 * DAY;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };
let ready = null;
// Tables are created on first use, so there is no migration step.
const setup = db => (ready ??= db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS uplinks (received_at INTEGER NOT NULL, dev_eui TEXT NOT NULL, rssi INTEGER, snr REAL, payload TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS uplinks_time ON uplinks (received_at)'),
  db.prepare(HOURS_TABLE),
]).catch(error => { ready = null; throw error; }));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/uplink' && request.method === 'POST') return uplink(request, url, env);
    if (url.pathname === '/api/readings' && request.method === 'GET') return readings(url, env);
    if (url.pathname === '/api/hours' && request.method === 'GET') return hours(url, env);
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

async function uplink(request, url, env) {
  // Token in the Authorization header or in the URL (?token=), whichever the gateway can send.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? url.searchParams.get('token');
  if (!env.UPLINK_TOKEN || token !== env.UPLINK_TOKEN) return new Response('Unauthorized', { status: 401 });
  let record;
  try { record = parseUplink(await request.json()); } catch (error) { return new Response(error.message, { status: 400 }); }
  const now = Date.now();
  await setup(env.DB);
  // One batch is one transaction: the reading and its hour are saved together or not at all.
  await env.DB.batch([
    env.DB.prepare('INSERT INTO uplinks (received_at, dev_eui, rssi, snr, payload) VALUES (?, ?, ?, ?, ?)')
      .bind(now, record.devEui, record.rssi, record.snr, record.payload),
    env.DB.prepare(ADD_TO_HOUR).bind(hourStart(now), ...hourlyValues(decodePayload(record.payload))),
  ]);
  return new Response(null, { status: 204 });
}

// ?from=&to= in ms, or null when missing or wrong.
function period(q) {
  const from = Number(q.get('from')), to = Number(q.get('to'));
  return q.has('from') && q.has('to') && Number.isFinite(from) && Number.isFinite(to) && from <= to ? { from, to } : null;
}

// Single readings, ?from=&to= up to RAW_SPAN; without them, the week up to the newest reading.
// start/end = first and newest reading overall, so the page knows how far back it can go.
async function readings(url, env) {
  await setup(env.DB);
  const { start, end } = await env.DB.prepare('SELECT MIN(received_at) AS start, MAX(received_at) AS end FROM uplinks').first();
  const newest = end ?? Date.now();
  const p = url.searchParams.size ? period(url.searchParams) : { from: newest - WEEK, to: newest };
  if (!p || p.to - p.from > RAW_SPAN) return new Response(`from in to v ms, največ ${RAW_SPAN / DAY} dni narazen; za daljša obdobja /api/hours.`, { status: 400 });
  const { results } = await env.DB.prepare('SELECT received_at, rssi, snr, payload FROM uplinks WHERE received_at BETWEEN ? AND ? ORDER BY received_at')
    .bind(p.from, p.to).all();
  return Response.json({ start, end, rows: results.map(rowFromRecord) }, NO_STORE);
}

// Averages for any period, ?from=&to=, in whole-hour buckets (at most MAX_POINTS of them).
async function hours(url, env) {
  const p = period(url.searchParams);
  if (!p) return new Response('from in to v ms.', { status: 400 });
  await setup(env.DB);
  const from = hourStart(p.from), bucket = bucketSize(from, p.to);
  const { results } = await env.DB.prepare(SUM_BUCKETS).bind(from, bucket, p.to).all();
  return Response.json({ bucket, rows: results.map(r => rowFromBucket(r, from, bucket)) }, NO_STORE);
}
