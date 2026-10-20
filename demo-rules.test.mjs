import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoRules } from './demo-rules.mjs';
import { buildDemoData } from './app.mjs';
import { validateRules, currentStatus, detectEvents } from './monitoring.mjs';

test('demo presets are valid and each device receives an independent copy', () => {
  const first = createDemoRules(), second = createDemoRules();
  assert.doesNotThrow(() => validateRules(first));
  first.temperature.max = 999;
  assert.equal(second.temperature.max, 23);
  assert.equal(createDemoRules().temperature.max, 23);
});

test('demo presets illustrate current status and historical events for both demo devices', () => {
  for (const device of [1, 2]) {
    const rows = buildDemoData(device, Date.parse('2026-10-22T12:00:00Z'));
    const rules = createDemoRules();
    assert.equal(currentStatus(rows, rules).status, 'normal');
    assert.ok(detectEvents(rows, rules).some(event => event.key === 'turbidity'));
    assert.equal(currentStatus(rows, {}).status, 'unknown');
    assert.deepEqual(detectEvents(rows, {}), []);
  }
});
