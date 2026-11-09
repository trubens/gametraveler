import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import { getGameRoutes, hasOrderedRoute, routeStyle } from '../src/routes.ts';
import { validateRoutes } from './lib/validate-routes.mjs';
import { readGames } from './lib/game-data.mjs';

const locations = [
  { placeId: 'paris', name: 'Paris', position: [48.85, 2.35] },
  { placeId: 'london', name: 'London', position: [51.5, -0.12] },
  { placeId: 'prague', name: 'Prague', position: [50.08, 14.42] },
];
const fixture = { locations, routes: [
  { id: 'george', name: 'George', characters: ['George'], storyYears: [1997], stops: ['paris', 'london', 'paris'] },
  { id: 'together', name: 'Together', characters: ['George', 'Nico'], storyYears: [1998], stops: ['paris', 'prague'] },
] };

test('independent journeys preserve character ownership, years and return visits', () => {
  assert.deepEqual(validateRoutes(fixture), []);
  const routes = getGameRoutes(fixture);
  assert.deepEqual(routes[0].locations, [locations[0], locations[1], locations[0]]);
  assert.deepEqual(routes[1].locations, [locations[0], locations[2]]);
  assert.deepEqual(routes[1].characters, ['George', 'Nico']);
  assert.deepEqual(routes[1].storyYears, [1998]);
  assert.notEqual(routeStyle(0).color, routeStyle(1).color);
  assert.equal('dashArray' in routeStyle(0), false);
  assert.equal('dashArray' in routeStyle(1), false);
  assert.equal(fixture.locations.length, 3);
});

test('legacy routes retain their order; unverified locations never become routes', () => {
  assert.deepEqual(getGameRoutes({ locations, route: true })[0].locations, locations);
  assert.equal(hasOrderedRoute({ locations, route: true }), true);
  assert.equal(hasOrderedRoute({ locations }), false);
  assert.deepEqual(getGameRoutes({ locations }), []);
});

test('route validation rejects dangling, ambiguous and malformed journeys', () => {
  for (const change of [
    { stops: ['paris', 'missing'] }, { stops: ['paris'] }, { stops: ['paris', 'paris'] },
    { characters: ['George', 'George'] }, { storyYears: ['1997'] },
    { source: 'javascript:alert(1)' }, { id: 'bad id' }, { name: ' ' }, { extra: true },
  ]) assert.ok(validateRoutes({ locations, routes: [{ ...fixture.routes[0], ...change }] }).length > 0);
  assert.ok(validateRoutes({ locations, routes: [fixture.routes[0], fixture.routes[0]] }).length > 0);
  assert.ok(validateRoutes({ ...fixture, route: true }).length > 0);
  assert.ok(validateRoutes({ ...fixture, locations: [...locations, locations[0]] }).length > 0);
  assert.throws(() => getGameRoutes({ locations, routes: [{ ...fixture.routes[0], stops: ['missing', 'paris'] }] }), /unknown game location/);
});

test('catalogue routes resolve; Broken Sword II separates George and Nico', () => {
  const games = readGames();
  for (const game of games) {
    assert.deepEqual(validateRoutes(game), [], game.name);
    for (const route of getGameRoutes(game)) assert.ok(route.locations.length >= 2, game.name);
  }
  const routes = getGameRoutes(games.find(game => game.id === 64));
  assert.equal(routes.length, 2);
  assert.equal(routes.find(route => route.id === 'george').stops.includes('london-uk'), false);
  assert.equal(routes.find(route => route.id === 'nico').stops.includes('london-uk'), true);
});

test('route selection survives a shared game URL and is omitted from place links', async () => {
  const source = fs.readFileSync('src/url.ts', 'utf8').replace('import.meta.env.BASE_URL', "'/gametraveller/'");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { buildUrl, readUrl } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const url = new URL(buildUrl({ game: 'broken-sword-ii-the-smoking-mirror', route: 'nico', q: 'sword' }), 'https://example.org');
  const oldWindow = globalThis.window;
  globalThis.window = { location: url };
  try {
    assert.equal(readUrl().route, 'nico');
    assert.equal(readUrl().game, 'broken-sword-ii-the-smoking-mirror');
    assert.equal(readUrl().q, 'sword');
    assert.equal(buildUrl({ place: 'paris-france', route: 'nico' }), '/gametraveller/place/paris-france/');
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

const loadUrlModule = async () => {
  const source = fs.readFileSync('src/url.ts', 'utf8').replace('import.meta.env.BASE_URL', "'/gametraveller/'");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};
const withUrl = (href, fn) => {
  const oldWindow = globalThis.window;
  globalThis.window = { location: new URL(href, 'https://example.org') };
  try { return fn(); } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
};

test('page paths end with a slash so the server does not redirect them', async () => {
  const { buildUrl } = await loadUrlModule();
  assert.equal(buildUrl({ game: 'grand-theft-auto-v' }), '/gametraveller/game/grand-theft-auto-v/');
  assert.equal(buildUrl({ series: 'uncharted' }), '/gametraveller/series/uncharted/');
  assert.equal(buildUrl({}), '/gametraveller/');
});

test('the place list and My atlas have their own addresses and survive a reload', async () => {
  const { buildUrl, readUrl, pageKey } = await loadUrlModule();
  assert.equal(buildUrl({ panel: 'places' }), '/gametraveller/places/');
  assert.equal(buildUrl({ panel: 'my-atlas' }), '/gametraveller/my-atlas/');
  assert.equal(withUrl('/gametraveller/places/', () => readUrl().panel), 'places');
  assert.equal(withUrl('/gametraveller/my-atlas', () => readUrl().panel), 'my-atlas');
  assert.notEqual(pageKey({ panel: 'places' }), pageKey({}));
});

test('a series page keeps the shown journey in the address', async () => {
  const { buildUrl, readUrl } = await loadUrlModule();
  const url = buildUrl({ series: 'uncharted', journey: 'uncharted-2-among-thieves' });
  assert.equal(url, '/gametraveller/series/uncharted/?journey=uncharted-2-among-thieves');
  assert.equal(withUrl(url, () => readUrl().journey), 'uncharted-2-among-thieves');
  assert.equal(buildUrl({ game: 'x', series: 'uncharted', journey: 'y' }), '/gametraveller/game/x/');
});

test('a year range missing one end is ignored instead of becoming year 0', async () => {
  const { readUrl } = await loadUrlModule();
  assert.equal(withUrl('/gametraveller/?released=..', () => readUrl().released), undefined);
  assert.equal(withUrl('/gametraveller/?set=..2000', () => readUrl().set), undefined);
  assert.deepEqual(withUrl('/gametraveller/?set=-500..2000', () => readUrl().set), [-500, 2000]);
});
