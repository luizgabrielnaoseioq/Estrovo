import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDistance, calculatePathDistance } from '../src/utils/distance.ts';

test('the distance between identical coordinates is zero', () => {
  const point = { latitude: -23.5505, longitude: -46.6333 };
  assert.equal(calculateDistance(point, point), 0);
  assert.equal(calculatePathDistance([point]), 0);
});

test('one degree at the equator is about 111.2 km', () => {
  const distance = calculateDistance(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 }
  );
  assert.ok(Math.abs(distance - 111_195) < 20);
});

test('a path adds consecutive segments, including one across the date line', () => {
  const points = [
    { latitude: 0, longitude: 179.9 },
    { latitude: 0, longitude: -179.9 },
    { latitude: 0, longitude: -179.8 },
  ];
  const expected = calculateDistance(points[0], points[1]) + calculateDistance(points[1], points[2]);
  assert.ok(Math.abs(calculatePathDistance(points) - expected) < 0.001);
  assert.ok(expected < 40_000);
});
