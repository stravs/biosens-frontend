import test from 'node:test';
import assert from 'node:assert/strict';

function browser(search = '') {
  const main = { hidden: false };
  const footer = { textContent: '', setAttribute() {}, classList: { toggle() {} } };
  const listeners = {};
  globalThis.location = { search };
  globalThis.localStorage = { getItem: () => null };
  globalThis.document = {
    hidden: false,
    getElementById: () => footer,
    querySelector: () => main,
    querySelectorAll: () => [],
    addEventListener: (event, callback) => { listeners[event] = callback; },
  };
  return { main, footer, listeners };
}

// Tests in this file run serially; globals are restored after each test.
async function withBrowser(run) {
  const names = ['location', 'localStorage', 'document', 'fetch', 'setTimeout', 'setInterval'];
  const originals = names.map(n => Object.getOwnPropertyDescriptor(globalThis, n));
  try { await run(); }
  finally { names.forEach((n, i) => originals[i] ? Object.defineProperty(globalThis, n, originals[i]) : delete globalThis[n]); }
}

test('demo is explicit and never contacts the API', () => withBrowser(async () => {
  const { footer } = browser('?demo=1');
  globalThis.fetch = () => { throw new Error('Demo must not fetch'); };
  const module = await import('./data.mjs?demo-test');
  const week = await module.loadWeek();
  assert.equal(week.simulated, true);
  assert.ok(week.rows.length);
  assert.match(footer.textContent, /DEMO/);
}));

test('initial API failure and empty data wait for real data, without showing demo', () => withBrowser(async () => {
  const { main, footer } = browser();
  const { buildDemoData } = await import('../lib/app.mjs');
  const rows = buildDemoData(1).slice(-2);
  const replies = [null, { rows: [] }, { rows, start: rows[0].receivedAt, end: rows.at(-1).receivedAt, cursor: 2 }];
  globalThis.fetch = async () => {
    const reply = replies.shift();
    return { ok: Boolean(reply), json: async () => reply };
  };
  let waits = 0;
  globalThis.setTimeout = resolve => {
    assert.equal(main.hidden, true);
    assert.doesNotMatch(footer.textContent, /simulirani/);
    waits++;
    resolve();
  };
  const module = await import('./data.mjs?initial-failure-test');
  const week = await module.loadWeek();
  assert.equal(waits, 2);
  assert.equal(week.simulated, false);
  assert.equal(main.hidden, false);
}));

test('live failure preserves real readings and warns; recovery clears warning', () => withBrowser(async () => {
  const { footer } = browser();
  const { buildDemoData } = await import('../lib/app.mjs');
  const module = await import('./data.mjs?live-failure-test');
  const rows = buildDemoData(1).slice(-2);
  const week = { ...module.prepare(rows), cursor: 2, bounds: { start: rows[0].receivedAt, end: rows.at(-1).receivedAt } };
  const originalRows = week.rows;
  let poll;
  globalThis.setInterval = (fn, ms) => { poll = fn; assert.equal(ms, 120000); };
  globalThis.fetch = async () => ({ ok: false });
  module.live(week, () => {});
  await poll();
  assert.equal(week.rows, originalRows);
  assert.match(footer.textContent, /Osveževanje ne deluje/);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ rows: [], cursor: 2 }) });
  await poll();
  assert.doesNotMatch(footer.textContent, /ne deluje/);
}));
