import assert from 'node:assert/strict';
import test from 'node:test';
import { boundsAround, estimateTileCount } from '../src/utils/offlineMapRegion.ts';

test('a 90 km map area contains walks up to 90 km north, south, east, and west', () => {
  const bounds = boundsAround(-23.55, -46.63, 90);
  assert.ok(bounds);
  const [west, south, east, north] = bounds;
  assert.ok(south < -23.55 - 0.8);
  assert.ok(north > -23.55 + 0.8);
  assert.ok(west < -46.63 - 0.88);
  assert.ok(east > -46.63 + 0.88);
});

test('higher detail needs more tiles and the configured cap can be checked', () => {
  const bounds = boundsAround(-23.55, -46.63, 90);
  assert.ok(bounds);
  assert.ok(estimateTileCount(bounds, 5, 14) > estimateTileCount(bounds, 5, 13));
  assert.ok(estimateTileCount(bounds, 5, 14) < 10_000);
});

test('invalid coordinates and antimeridian crossing do not produce a broken download', () => {
  assert.equal(boundsAround(Number.NaN, 0, 90), null);
  assert.equal(boundsAround(0, 179.9, 90), null);
});
