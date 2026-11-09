import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { latestReviewed, placeRedirects } from './lib/prerender-helpers.mjs';
import { decodeCountries, encodeCountries } from '../src/countryShapeCodec.ts';

test('place redirects go straight to the trailing-slash page and skip targets without a page', () => {
  const placeById = new Map([
    ['london-uk', { id: 'london-uk', name: 'London, UK' }],
    ['prussia', { id: 'prussia', name: 'Prussia' }],
    ['paris', { id: 'paris', name: 'Paris' }],
  ]);
  const { lines, warnings } = placeRedirects({
    redirects: { 'london-england': 'london-uk', 'prussia-historic-region': 'prussia', paris: 'paris', 'london-uk': 'paris' },
    placeById,
    placeSlug: place => place.id,
    pageSlugs: new Set(['london-uk', 'paris']),
    basePath: '/gametraveler',
  });
  assert.deepEqual(lines, ['RedirectMatch 301 ^/gametraveler/place/london-england/?$ /gametraveler/place/london-uk/']);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /prussia-historic-region -> prussia skipped/);
  assert.match(warnings[1], /london-uk is a live place page/);
  assert.throws(() => placeRedirects({ redirects: { x: 'nowhere' }, placeById, placeSlug: p => p.id, pageSlugs: new Set(), basePath: '' }), /unknown place id/);
});

test('lastmod is the newest review date, and absent when nothing was reviewed', () => {
  assert.equal(latestReviewed([{ reviewed: '2026-11-01' }, { reviewed: '2026-11-03' }, {}]), '2026-11-03');
  assert.equal(latestReviewed([{}, { reviewed: 'soon' }]), undefined);
});

test('the compact country shapes decode to exactly the GeoJSON in public/data', () => {
  for (const scale of ['110m', '50m']) {
    const source = JSON.parse(fs.readFileSync(`public/data/countries-${scale}.json`, 'utf8'));
    const encoded = JSON.stringify(encodeCountries(source));
    const decoded = decodeCountries(JSON.parse(encoded));
    assert.equal(decoded.length, source.features.length);
    for (const [index, feature] of source.features.entries()) {
      const { iso, name, label } = feature.properties;
      assert.deepEqual(decoded[index], { type: 'Feature', properties: { iso, name, label }, geometry: feature.geometry }, `${scale} ${iso}`);
    }
    assert.ok(encoded.length < JSON.stringify(source).length * 0.6, `${scale} is at least 40 % smaller`);
  }
});

test('coordinates with more decimals keep their precision', () => {
  const collection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { iso: 'XX', name: 'X', label: [0, 0] }, geometry: { type: 'MultiPolygon', coordinates: [[[[0.125, -1.5], [10.001, 3], [0.125, -1.5]]]] } }] };
  const decoded = decodeCountries(encodeCountries(collection));
  assert.deepEqual(decoded[0].geometry, collection.features[0].geometry);
});
