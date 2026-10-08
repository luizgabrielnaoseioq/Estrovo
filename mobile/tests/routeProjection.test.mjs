import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRoute } from '../src/utils/routeProjection.ts';

test('an eastward route goes right and a northward route goes up', () => {
  const route = projectRoute([
    { latitude: -23.55, longitude: -46.64 },
    { latitude: -23.55, longitude: -46.63 },
    { latitude: -23.54, longitude: -46.63 },
  ], 300, 180);

  assert.ok(route[1].x > route[0].x);
  assert.ok(route[2].y < route[1].y);
  for (const point of route) {
    assert.ok(point.x >= 22 && point.x <= 278);
    assert.ok(point.y >= 22 && point.y <= 158);
  }
});

test('a route crossing the date line retains its direction', () => {
  const route = projectRoute([
    { latitude: 0, longitude: 179.9 },
    { latitude: 0, longitude: -179.9 },
    { latitude: 0, longitude: -179.8 },
  ], 300, 180);

  assert.ok(route[0].x < route[1].x && route[1].x < route[2].x);
});

test('a single point is centered and an empty route has no drawing', () => {
  assert.deepEqual(projectRoute([{ latitude: 0, longitude: 0 }], 300, 180), [
    { x: 150, y: 90 },
  ]);
  assert.deepEqual(projectRoute([], 300, 180), []);
});
