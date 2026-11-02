// UG65 event metadata. A frame counter alone is not unique across OTAA sessions.
export function eventMetadata(body, now = Date.now()) {
  const rawTime = body.time ?? body.rxInfo?.find(r => r.time)?.time;
  const eventAt = rawTime == null ? now : Date.parse(rawTime);
  if (!Number.isFinite(eventAt) || eventAt < 0 || eventAt > now + 300000) throw new Error('Invalid uplink time.');
  const id = body.deduplicationId ?? body.id;
  if (id != null && (typeof id !== 'string' || !id.length || id.length > 200)) throw new Error('Invalid message id.');
  // Prefer the network's stable message id. Otherwise require event time + frame counter.
  const counter = body.fCnt;
  const key = id != null ? `id:${id}` : rawTime != null && Number.isSafeInteger(counter) && counter >= 0
    ? `frame:${eventAt}:${counter}` : null;
  return { eventAt, key };
}

export const BOUNDS_SQL = `SELECT
  (SELECT received_at FROM uplinks ORDER BY received_at ASC LIMIT 1) AS start,
  (SELECT received_at FROM uplinks ORDER BY received_at DESC LIMIT 1) AS end,
  (SELECT COALESCE(MAX(rowid), 0) FROM uplinks) AS cursor`;

export const INSERT_UPLINK = `INSERT INTO uplinks
  (received_at, dev_eui, rssi, snr, payload, ingested_at, event_key, attempt_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(dev_eui, event_key) DO NOTHING`;
