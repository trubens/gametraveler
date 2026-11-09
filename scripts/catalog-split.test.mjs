import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { splitCatalog, GAME_DETAIL_FIELDS, LOCATION_DETAIL_FIELDS, PLACE_DETAIL_FIELDS, ROUTE_DETAIL_FIELDS } from './catalog-plugin.mjs';

const readDir = dir => fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
const games = readDir('src/data/games');
const places = readDir('src/data/places');

// Slik gameData.ts legger detaljene tilbake
const merge = (core, details) => ({
  games: core.games.map(game => {
    const extra = details.games[game.id] ?? {};
    const { locations: locationDetails, routes: routeDetails, ...own } = extra;
    return {
      ...game,
      ...own,
      locations: game.locations.map((location, index) => ({ ...location, ...(locationDetails?.[index] ?? {}) })),
      ...(game.routes ? { routes: game.routes.map((route, index) => ({ ...route, ...(routeDetails?.[index] ?? {}) })) } : {}),
    };
  }),
  places: core.places.map(place => ({ ...place, ...(details.places[place.id] ?? {}) })),
});
const sortKeys = value => Array.isArray(value) ? value.map(sortKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])])) : value;

test('the core catalogue carries no notes, sources or descriptions', () => {
  const { core } = splitCatalog(games, places);
  for (const game of core.games) {
    for (const field of GAME_DETAIL_FIELDS) assert.equal(game[field], undefined, `${game.name}.${field}`);
    for (const location of game.locations) for (const field of LOCATION_DETAIL_FIELDS) assert.equal(location[field], undefined, `${game.name} ${location.placeId}.${field}`);
    for (const route of game.routes ?? []) for (const field of ROUTE_DETAIL_FIELDS) assert.equal(route[field], undefined, `${game.name} ${route.id}.${field}`);
  }
  for (const place of core.places) for (const field of PLACE_DETAIL_FIELDS) assert.equal(place[field], undefined, `${place.id}.${field}`);
});

test('core plus details gives back every game and place exactly', () => {
  const { core, details } = splitCatalog(games, places);
  const merged = merge(core, details);
  assert.deepEqual(sortKeys(merged.games), sortKeys(games));
  assert.deepEqual(sortKeys(merged.places), sortKeys(places));
});

test('the core is well under the full catalogue', () => {
  const { core } = splitCatalog(games, places);
  const full = JSON.stringify({ games, places }).length;
  assert.ok(JSON.stringify(core).length < full * 0.6, `core ${JSON.stringify(core).length} of ${full}`);
});
