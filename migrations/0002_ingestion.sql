-- received_at remains the API's event-time column; existing rows retain arrival time.
ALTER TABLE uplinks ADD COLUMN ingested_at INTEGER;
ALTER TABLE uplinks ADD COLUMN event_key TEXT;
ALTER TABLE uplinks ADD COLUMN attempt_id TEXT;
CREATE UNIQUE INDEX uplinks_event ON uplinks (dev_eui, event_key);
CREATE INDEX uplinks_attempt ON uplinks (attempt_id);
