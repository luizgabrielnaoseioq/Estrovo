import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGpsPoint, validateGpsTrack } from '../src/utils/gpsValidation.ts';

const first = {
  id: 'first', latitude: -23.5505, longitude: -46.6333,
  accuracy: 5, speed: 0, timestamp: 1_000,
};

test('valid walking segments add distance and keep the first point as an anchor', () => {
  const second = { ...first, id: 'second', longitude: -46.6330, timestamp: 11_000, speed: 3 };
  const result = validateGpsTrack([first, second]);
  assert.deepEqual(result.decisions.map((decision) => decision.isValid), [true, true]);
  assert.ok(result.distanceMeters > 25 && result.distanceMeters < 35);
});

test('poor accuracy, tiny jitter, and GPS teleportation do not inflate distance', () => {
  const inaccurate = { ...first, id: 'inaccurate', longitude: -46.6329, accuracy: 70, timestamp: 5_000 };
  const jitter = { ...first, id: 'jitter', longitude: -46.63328, timestamp: 6_000 };
  const teleport = { ...first, id: 'teleport', longitude: -46.6243, timestamp: 9_000 };
  const recovery = { ...first, id: 'recovery', longitude: -46.6330, timestamp: 12_000 };
  const result = validateGpsTrack([first, inaccurate, jitter, teleport, recovery]);
  assert.deepEqual(result.decisions.map((decision) => decision.isValid), [true, false, false, false, true]);
  assert.ok(result.distanceMeters > 25 && result.distanceMeters < 35);
});

test('reported excessive speed and duplicate timestamps are ignored', () => {
  const tooFast = { ...first, id: 'fast', longitude: -46.6330, timestamp: 11_000, speed: 12 };
  const sameTime = { ...first, id: 'same', longitude: -46.6329, timestamp: 1_000 };
  assert.equal(validateGpsPoint(tooFast, first).isValid, false);
  assert.equal(validateGpsPoint(sameTime, first).isValid, false);
});
