// Runs in front of the static site. The UG65 posts uplinks here; the page reads them back.
// Raw payloads are stored and decoded on read, so a decoder fix applies to old readings too.
// Each uplink is also added to its hour in `hours`, for long periods (see hourly.mjs).
import { decodePayload, parseUplink, rowFromRecord } from '../src/lib/payload.mjs';
import { ADD_NEW_TO_HOUR, SUM_BUCKETS, bucketSize, hourStart, hourlyValues, rowFromBucket } from '../src/lib/hourly.mjs';

import { BOUNDS_SQL, INSERT_UPLINK, eventMetadata } from '../src/lib/ingestion.mjs';

const DAY = 86400000, WEEK = 7 * DAY;
// Single readings only for short periods; the page uses /api/hours for anything over a week.
const RAW_SPAN = 8 * DAY;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/uplink' && request.method === 'POST') return uplink(request, url, env);
    if (request.method === 'GET' && ['/api/readings', '/api/hours'].includes(url.pathname)) {
      // Shared short cache only for explicitly bounded historical periods.
      // Live/default/cursor requests always reach D1.
      const p = period(url.searchParams);
      const cacheable = p && p.to < Date.now() - 3600000 && !url.searchParams.has('since');
      const cache = cacheable && typeof caches !== 'undefined' ? caches.default : null;
      const cached = cache && await cache.match(request);
      if (cached) return cached;
      const response = await (url.pathname === '/api/readings' ? readings(url, env) : hours(url, env));
      if (cache && response.ok) {
        response.headers.set('Cache-Control', 'public, max-age=60');
        ctx.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};

async function uplink(request, url, env) {
  // Token in the Authorization header or in the URL (?token=), whichever the gateway can send.
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? url.searchParams.get('token');
  if (!env.UPLINK_TOKEN || token !== env.UPLINK_TOKEN) return new Response('Unauthorized', { status: 401 });
  if (env.INGESTION_PAUSED === 'true') return new Response('Maintenance; retry later', { status: 503 });
  if (!env.DEVICE_EUI) return new Response('DEVICE_EUI not configured', { status: 503 });
  let record, metadata;
  const now = Date.now();
  try {
    const body = await request.json();
    record = parseUplink(body);
    metadata = eventMetadata(body, now);
  } catch (error) { return new Response(error.message, { status: 400 }); }
  if (record.devEui !== env.DEVICE_EUI.toLowerCase()) return new Response('Unexpected device', { status: 403 });
  // Reject unsafe ingestion rather than silently accepting duplicates with no identity.
  if (!metadata.key) return new Response('Uplink needs a stable id or time + fCnt', { status: 400 });
  const attempt = crypto.randomUUID();
  // One batch is one transaction: the reading and its hour are saved together or not at all.
  await env.DB.batch([
    env.DB.prepare(INSERT_UPLINK)
      .bind(metadata.eventAt, record.devEui, record.rssi, record.snr, record.payload, now, metadata.key, attempt),
    env.DB.prepare(ADD_NEW_TO_HOUR).bind(hourStart(metadata.eventAt), ...hourlyValues(decodePayload(record.payload)), attempt),
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
  const { start, end, cursor } = await env.DB.prepare(BOUNDS_SQL).first();
  if (url.searchParams.has('since')) {
    const since = Number(url.searchParams.get('since'));
    if (!Number.isSafeInteger(since) || since < 0) return new Response('Invalid cursor', { status: 400 });
    const { results } = await env.DB.prepare('SELECT rowid, received_at, rssi, snr, payload FROM uplinks WHERE rowid > ? AND rowid <= ? ORDER BY rowid LIMIT 5000')
      .bind(since, cursor).all();
    return Response.json({ start, end, cursor: results.at(-1)?.rowid ?? cursor, hasMore: (results.at(-1)?.rowid ?? cursor) < cursor, rows: results.map(rowFromRecord) }, NO_STORE);
  }
  const newest = end ?? Date.now();
  const p = url.searchParams.size ? period(url.searchParams) : { from: newest - WEEK, to: newest };
  if (!p || p.to - p.from > RAW_SPAN) return new Response(`from in to v ms, največ ${RAW_SPAN / DAY} dni narazen; za daljša obdobja /api/hours.`, { status: 400 });
  const { results } = await env.DB.prepare('SELECT received_at, rssi, snr, payload FROM uplinks WHERE received_at BETWEEN ? AND ? AND rowid <= ? ORDER BY received_at')
    .bind(p.from, p.to, cursor).all();
  return Response.json({ start, end, cursor, rows: results.map(rowFromRecord) }, NO_STORE);
}

// Averages for any period, ?from=&to=, in whole-hour buckets (at most MAX_POINTS of them).
async function hours(url, env) {
  const p = period(url.searchParams);
  if (!p) return new Response('from in to v ms.', { status: 400 });
  const from = hourStart(p.from), bucket = bucketSize(from, p.to);
  const { results } = await env.DB.prepare(SUM_BUCKETS).bind(from, bucket, p.to).all();
  return Response.json({ bucket, rows: results.map(r => rowFromBucket(r, from, bucket)) }, NO_STORE);
}
