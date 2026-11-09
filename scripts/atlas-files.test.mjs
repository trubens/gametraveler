import assert from 'node:assert/strict';
import test from 'node:test';
import LZString from 'lz-string';
import { atlasTable, atlasToCsv, importCsv, parseCsv, placePoints, tableEditorUrl } from '../src/atlasFiles.ts';
import { readGames, readPlaces } from './lib/game-data.mjs';

const games = readGames();
const used = new Set(games.flatMap(game => game.locations.map(l => l.placeId)));
const catalog = {
  places: readPlaces().filter(place => used.has(place.id)),
  games: games.map(game => ({ id: game.id, name: game.name, year: game.year, slug: `slug-${game.id}` })),
};
// Ajaccio og Korsika deler ett punkt: to poster, én rad
const london = placePoints(catalog).byId.get('ajaccio-corsica-france');
const game = catalog.games[0];
const atlas = {
  v: 1,
  places: Object.fromEntries(london.ids.map(id => [id, { been: true, at: '2026-10-20' }])),
  games: { [game.id]: { played: true, at: '2026-10-21' } },
};

test('places on the same point are one row, and import marks every id there again', () => {
  assert.ok(london.ids.length > 1, 'Ajaccio has several place records on one point');
  const csv = atlasToCsv(atlas, catalog);
  assert.ok(csv.startsWith('\uFEFFtype,id,name,been_here,want_to_go,played,want_to_play,updated\r\n'));
  const rows = parseCsv(csv);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], ['game', game.slug, game.name, '', '', 'yes', '', '2026-10-21']);

  const back = importCsv(csv, catalog, '2026-10-24');
  assert.deepEqual(back.atlas, atlas);
  assert.equal(back.places, 1);
  assert.equal(back.been, 1);
  assert.equal(back.games, 1);
  assert.deepEqual(back.skipped, []);
});

test('quoted names, semicolons, unknown rows and name fallback', () => {
  const text = 'Type;Name;Been here;Played\nplace;"London, England, UK";Yes;\nplace;Nowhere Land;yes;\ngame;"Not a real game";;x\nplace;Paris, France;;\n';
  const result = importCsv(text, catalog, '2026-10-24');
  assert.equal(result.been, 1);
  assert.deepEqual(result.skipped, ['Nowhere Land', 'Not a real game']);
  // «London, England, UK» var navnet på en av de tre London-postene som ble slått sammen; det står som alias
  assert.ok(result.atlas.places['london-uk'].been);
  assert.equal(result.atlas.places['london-uk'].at, '2026-10-24');
});

test('a file without the columns is refused', () => {
  assert.ok('error' in importCsv('a,b\n1,2', catalog, '2026-10-24'));
  assert.ok('error' in importCsv('', catalog, '2026-10-24'));
});

test('the Table Editor link carries a header row and a caption, and no output format', () => {
  const rows = atlasTable(atlas, catalog, { places: true, games: true, links: true, siteUrl: 'https://truben.no/gametraveller/', caption: '' });
  assert.deepEqual(rows[0], ['Type', 'Name', 'Area', 'Year', 'Been here', 'Want to go', 'Played', 'Want to play', 'Link']);
  assert.deepEqual(rows[1].slice(0, 6), ['Place', 'Ajaccio', 'Corsica, France', '', 'TRUE', 'FALSE']);
  assert.match(rows[1][8], /^https:\/\/truben\.no\/gametraveller\/place\//);
  const url = tableEditorUrl(rows, 'My atlas');
  assert.ok(url.startsWith('https://truben.no/table/#d='));
  assert.ok(url.endsWith('&op=0'));
  assert.ok(!url.includes('&o='));
  const doc = JSON.parse(LZString.decompressFromEncodedURIComponent(url.split('#d=')[1].split('&')[0]));
  assert.ok(doc.cf.some(([r, c, f]) => r === 1 && c === 4 && f.numberFormat.kind === 'checkbox'), 'Been here is a checkbox');
  assert.equal(doc.ca[4], 'c');
  assert.deepEqual(doc.s, [3, 9]);
  assert.deepEqual(doc.h, [1, 0]);
  assert.equal(doc.c, 'My atlas');
});

test('a place is never both been here and want to go', () => {
  const text = ['type,id,name,been_here,want_to_go', 'place,paris-france,,yes,yes', 'place,moscow-russia,,,yes', 'place,moscow-russia,,yes,'].join('\n');
  const result = importCsv(text, catalog, '2026-10-24');
  for (const mark of Object.values(result.atlas.places)) assert.ok(!(mark.been && mark.want), JSON.stringify(mark));
  assert.equal(result.been, 2);
  assert.equal(result.wantGo, 0);
  const games = importCsv(['type,id,name,played,want_to_play', `game,${game.slug},,yes,yes`].join('\n'), catalog, '2026-10-24');
  assert.deepEqual(games.atlas.games[game.id], { played: true, at: '2026-10-24' });
});
