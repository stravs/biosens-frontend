// Offline generator: never contacts production or changes the source export.
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { ADD_TO_HOUR, hourStart, hourlyValues } from '../src/lib/hourly.mjs';
import { decodePayload } from '../src/lib/payload.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) {
  console.error('Usage: npm run rebuild:hours -- uplinks.sql rebuilt-hours.sql');
  process.exit(1);
}
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
db.exec(readFileSync(new URL('../migrations/0002_ingestion.sql', import.meta.url), 'utf8'));
// Input must be a trusted D1 --no-schema --table uplinks export.
db.exec(readFileSync(input, 'utf8'));
db.exec('DELETE FROM hours');
const add = db.prepare(ADD_TO_HOUR);
let count = 0;
for (const r of db.prepare('SELECT received_at, payload FROM uplinks').iterate()) {
  add.run(hourStart(r.received_at), ...hourlyValues(decodePayload(r.payload)));
  count++;
}
const columns = db.prepare('PRAGMA table_info(hours)').all().map(r => r.name);
const statements = ['-- Apply only while ingestion is paused. Keep the source export for recovery.', 'DELETE FROM hours;'];
for (const row of db.prepare('SELECT * FROM hours ORDER BY hour').iterate()) {
  const values = columns.map(c => {
    if (!Number.isFinite(row[c])) throw new Error('Non-finite aggregate');
    return row[c];
  });
  statements.push(`INSERT INTO hours (${columns.join(',')}) VALUES (${values.join(',')});`);
}
writeFileSync(output, statements.join('\n') + '\n');
console.log(`Decoded ${count} readings. Wrote ${statements.length - 2} hours to ${output}.`);
db.close();
