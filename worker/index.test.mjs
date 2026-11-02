import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.mjs';
import { BOUNDS_SQL, eventMetadata } from '../src/lib/ingestion.mjs';

function database() {
  const sql = new DatabaseSync(':memory:');
  for (const file of ['0001_initial.sql', '0002_ingestion.sql']) sql.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  const DB = {
    prepare(query) {
      let values = [];
      const prepared = {
        bind(...args) { values = args; return prepared; },
        async first() { return sql.prepare(query).get(...values); },
        async all() { return { results: sql.prepare(query).all(...values) }; },
        run() { return sql.prepare(query).run(...values); },
      };
      return prepared;
    },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result = statements.map(s => s.run()); sql.exec('COMMIT'); return result; }
      catch (e) { sql.exec('ROLLBACK'); throw e; }
    },
  };
  return { sql, env: { DB, UPLINK_TOKEN: 'secret', DEVICE_EUI: 'aabb' } };
}
const data = btoa(String.fromCharCode(...new Uint8Array(50)));
const post = (env, body, token = 'secret') => worker.fetch(new Request('https://example.test/api/uplink', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ devEUI: 'AABB', data, ...body }),
}), env);
const get = async (env, path) => (await worker.fetch(new Request(`https://example.test/api/${path}`), env)).json();

test('retry is stored and aggregated once; event time differs from receipt time', async () => {
  const { sql, env } = database();
  const time = new Date(Date.now() - 7200000).toISOString();
  const body = { time, fCnt: 42 };
  assert.equal((await post(env, body)).status, 204);
  assert.equal((await post(env, body)).status, 204);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM uplinks').get().n, 1);
  assert.equal(sql.prepare('SELECT SUM(n) AS n FROM hours').get().n, 1);
  const record = sql.prepare('SELECT * FROM uplinks').get();
  assert.equal(record.received_at, Date.parse(time));
  assert.ok(record.ingested_at > record.received_at);
  // Same sensor value in a different frame is a real new reading.
  assert.equal((await post(env, { time, fCnt: 43 })).status, 204);
  assert.equal(sql.prepare('SELECT SUM(n) AS n FROM hours').get().n, 2);
});

test('device identity, authentication, event identity and maintenance are enforced', async () => {
  const { env } = database();
  assert.equal((await post(env, { id: '1' }, 'bad')).status, 401);
  assert.equal((await post(env, { id: '1', devEUI: 'other' })).status, 403);
  assert.equal((await post(env, {})).status, 400);
  assert.equal((await post({ ...env, DEVICE_EUI: undefined }, { id: '1' })).status, 503);
  assert.equal((await post({ ...env, INGESTION_PAUSED: 'true' }, { id: '1' })).status, 503);
  assert.throws(() => eventMetadata({ time: 'not a date' }));
  assert.throws(() => eventMetadata({ time: new Date(Date.now() + 3600000).toISOString() }));
  assert.equal(eventMetadata({ fCnt: 0 }).key, null);
});

test('insertion cursor catches delayed readings, without replaying earlier rows', async () => {
  const { env } = database();
  await post(env, { id: 'first' });
  const initial = await get(env, 'readings');
  assert.equal(initial.rows.length, 1);
  await post(env, { id: 'late', time: new Date(Date.now() - 3600000).toISOString() });
  const next = await get(env, `readings?since=${initial.cursor}`);
  assert.equal(next.rows.length, 1);
  assert.ok(next.rows[0].receivedAt < initial.rows[0].receivedAt);
  const empty = await get(env, `readings?since=${next.cursor}`);
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.cursor, next.cursor);
});

test('bounds use two indexed lookups, including an empty database', async () => {
  const { sql, env } = database();
  assert.deepEqual({ ...sql.prepare(BOUNDS_SQL).get() }, { start: null, end: null, cursor: 0 });
  const plan = sql.prepare(`EXPLAIN QUERY PLAN ${BOUNDS_SQL}`).all();
  assert.equal(plan.filter(r => r.detail.includes('COVERING INDEX uplinks_time')).length, 2);
  assert.deepEqual((await get(env, 'readings')).rows, []);
});

test('migration upgrades the old schema without losing raw readings', () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
  sql.prepare('INSERT INTO uplinks VALUES (?, ?, ?, ?, ?)').run(1000, 'aabb', -90, 2, '00'.repeat(50));
  sql.exec(readFileSync(new URL('../migrations/0002_ingestion.sql', import.meta.url), 'utf8'));
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM uplinks').get().n, 1);
  assert.equal(sql.prepare('SELECT ingested_at FROM uplinks').get().ingested_at, null);
});
