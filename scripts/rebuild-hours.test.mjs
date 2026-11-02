import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('rebuild decodes raw rows, replaces old sums, and is safe to rerun', () => {
  const dir = mkdtempSync(join(tmpdir(), 'biosens-rebuild-'));
  try {
    const input = join(dir, 'uplinks.sql'), output = join(dir, 'hours.sql');
    const bytes = Buffer.alloc(50);
    bytes.writeUInt16LE(12345, 40);
    const payload = bytes.toString('hex');
    writeFileSync(input, `INSERT INTO uplinks (received_at,dev_eui,payload) VALUES (1000,'aabb','${payload}'),(2000,'aabb','${payload}'),(3601000,'aabb','${payload}');`);
    execFileSync(process.execPath, ['scripts/rebuild-hours.mjs', input, output]);
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    const rebuilt = readFileSync(output, 'utf8');
    db.exec(rebuilt);
    db.exec(rebuilt);
    const rows = db.prepare('SELECT hour, n, temperature FROM hours ORDER BY hour').all();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].n, 2);
    assert.equal(rows[0].temperature, 24.69);
    assert.equal(rows[1].n, 1);
    assert.equal(rows[1].temperature, 12.345);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
