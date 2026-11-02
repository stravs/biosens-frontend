# Operations

## Before deploying this upgrade

1. Export the existing database as a backup.
2. Confirm it contains only the intended device:
   `npx wrangler d1 execute biosens --remote --command "SELECT dev_eui, COUNT(*) FROM uplinks GROUP BY dev_eui"`
   Do not combine multiple devices in this single-device dashboard.
3. Inspect a real UG65 HTTP payload. It must include a **stable event identifier** in
   `deduplicationId` or `id`, or a **stable ISO timestamp** (`time` / `rxInfo[].time`)
   together with integer `fCnt`. A device ID is NOT a message ID. A frame counter
   alone is unsafe after device rejoin. Configure the gateway/template if needed.
   Retries must preserve these fields. Never use a changing HTTP delivery timestamp.
4. Set `UPLINK_TOKEN` and `DEVICE_EUI` using `wrangler secret put`.
5. Run `npm run deploy`. This applies additive migrations before publishing.
   Existing rows retain their old receipt timestamps; their original event times
   and duplicate identities cannot be recovered automatically.
6. Check an authorized test packet, a retry, and a wrong-device packet. The retry
   must leave both raw count and hourly count unchanged; wrong device returns 403.

For a new deployment, create D1 first (`wrangler d1 create biosens`) and put its
database ID in the existing DB binding before applying remote migrations.

## Local development

Use Node 24+ (the rebuild tool and SQLite tests use `node:sqlite`).
Create ignored `.dev.vars` with `UPLINK_TOKEN` and `DEVICE_EUI`.
`npm run preview:worker` builds assets, applies local migrations, and starts Wrangler.
Astro-only dev has no API: use `/?demo=1` for explicit simulated data.

## Verify ingestion / investigate an outage

```sh
npx wrangler tail
npx wrangler d1 execute biosens --remote --command "SELECT received_at AS event_at, ingested_at, dev_eui FROM uplinks ORDER BY rowid DESC LIMIT 5"
```

Timestamps are Unix milliseconds. Old rows may have NULL ingested_at.
Check both event age (instrument freshness) and receipt age (gateway connectivity).
An API/network failure preserves readings already loaded in the tab and shows an
alert. Initial failure or an empty database shows no simulated measurements.

Bounds use two indexed lookups, not combined MIN/MAX. To inspect actual D1 cost:

```sh
npx wrangler d1 execute biosens --remote --command "SELECT (SELECT received_at FROM uplinks ORDER BY received_at ASC LIMIT 1) AS start, (SELECT received_at FROM uplinks ORDER BY received_at DESC LIMIT 1) AS end" --json
```

Inspect `meta.rows_read`. Visible tabs poll every two minutes; hidden tabs pause.
Historical, explicitly bounded responses can be cached for 60 seconds.

## Backups and restore

Export before migrations, decoder changes, or repairs. Keep exports outside git,
in durable storage with access restricted to operators.

```sh
npx wrangler d1 export biosens --remote --output biosens-backup.sql
npx wrangler d1 time-travel info biosens
```

D1 Time Travel availability/retention depends on the account plan. Record a bookmark
before destructive work. Restore through `wrangler d1 time-travel restore biosens`
using the recorded bookmark (check `--help` for current flags). A restore rolls
back the whole database, including readings received after that point.

For an SQL export, rehearse recovery into a NEW empty database:
`wrangler d1 execute <recovery-db> --remote --file biosens-backup.sql`.
Verify raw counts, bounds and hourly counts, then point DB at the recovered database.
Do not import a full backup over a populated production database.

## Rebuild hourly aggregates after a decoder fix

This is an explicit maintenance operation. Raw data is not modified.
For the current small single-device dataset the rebuild runs locally in memory.

1. Stop gateway HTTP forwarding or ensure it buffers/retries rejected requests.
2. Add `"vars": { "INGESTION_PAUSED": "true" }` to Wrangler config and deploy.
   Wait for in-flight uplinks to finish. Uplinks now return 503.
   Do not rely on 503 alone unless the gateway is confirmed to retry.
3. Export a full backup, then export raw rows and generate replacement sums:

```sh
npx wrangler d1 export biosens --remote --no-schema --table uplinks --output uplinks.sql
npm run rebuild:hours -- uplinks.sql rebuilt-hours.sql
```

4. Review the generated SQL and test it against a local copy first.
   The generator executes the trusted SQL export locally; never feed it untrusted SQL.
5. While ingestion remains paused:

```sh
npx wrangler d1 execute biosens --remote --file rebuilt-hours.sql
npx wrangler d1 execute biosens --remote --command "SELECT (SELECT COUNT(*) FROM uplinks) AS raw_count, (SELECT SUM(n) FROM hours) AS hourly_count"
```

The counts should match (SUM is NULL for no readings). D1 may apply SQL files in
batches: if interrupted, keep ingestion paused and rerun the generated file from
the beginning. It deletes/replaces only hours and is safe to rerun while paused.
Reads during rebuilding may see partial aggregates. Allow 60 seconds for cached
historical responses to expire.

6. Remove INGESTION_PAUSED and deploy; resume gateway forwarding.
7. Verify the next real event and its hour.

## Rotate the uplink token

Generate a new random token, update `UPLINK_TOKEN` with
`npx wrangler secret put UPLINK_TOKEN`, then update the gateway.
Coordinate a short interruption/buffered retry window: old/new tokens are not
accepted simultaneously. Prefer Authorization headers over query parameters.
Never paste token-bearing URLs in logs, tickets, or git.
