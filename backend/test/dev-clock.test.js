import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevClock } from '../src/devtools.js';

test('each clock session starts at 06:00 Vietnam time, advances and resets on restart', () => {
  let real = Date.parse('2026-11-18T16:30:00Z');
  const first = createDevClock({}, () => real);
  assert.equal(first.now().toISOString(), '2026-11-17T23:00:00.000Z');
  real += 15_000;
  assert.equal(first.now().toISOString(), '2026-11-17T23:00:15.000Z');
  first.advance(3 * 3600_000);
  assert.equal(first.now().toISOString(), '2026-11-18T02:00:15.000Z');
  assert.equal(createDevClock({}, () => real).now().toISOString(), '2026-11-17T23:00:00.000Z');
  real = Date.parse('2026-11-18T18:00:00Z');
  assert.equal(createDevClock({}, () => real).now().toISOString(), '2026-11-18T23:00:00.000Z');
});
