import assert from 'node:assert/strict';
import test from 'node:test';
import { shortestLongitudeSpan } from '../src/geo.ts';

const span = positions => {
  const lngs = shortestLongitudeSpan(positions).map(p => p[1]);
  return Math.max(...lngs) - Math.min(...lngs);
};

test('Japan and Hawaii are framed across the date line, not around the world', () => {
  const tokyo = [35.68, 139.69];
  const honolulu = [21.31, -157.86];
  const out = shortestLongitudeSpan([tokyo, honolulu]);
  assert.ok(span([tokyo, honolulu]) < 70, `span ${span([tokyo, honolulu])}`);
  // Latitudes are untouched; the shifted point is the same place one world copy over
  assert.deepEqual(out.map(p => p[0]), [35.68, 21.31]);
  assert.equal(out[1][1], -157.86 + 360);
});

test('places that do not straddle the date line are left as they are', () => {
  const europe = [[48.85, 2.35], [51.5, -0.13], [41.9, 12.5]];
  assert.deepEqual(shortestLongitudeSpan(europe), europe);
  const worldwide = [[40.7, -74], [51.5, -0.13], [35.68, 139.69], [-33.87, 151.21]];
  assert.deepEqual(shortestLongitudeSpan(worldwide), worldwide);
});

test('one place or none is returned unchanged', () => {
  assert.deepEqual(shortestLongitudeSpan([]), []);
  assert.deepEqual(shortestLongitudeSpan([[0, 179]]), [[0, 179]]);
});
