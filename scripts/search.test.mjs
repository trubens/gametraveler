import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGameSearch, filterSearchResults, searchPositions } from '../src/search.ts';

const games = JSON.parse(readFileSync(new URL('../src/data/games.json', import.meta.url), 'utf8'));
const search = createGameSearch(games);
const ids = query => search(query).map(hit => hit.game.id).sort((a, b) => a - b);

test('blank search restores the catalogue; punctuation and unknown text do not', () => {
  assert.equal(search('  ').length, games.length);
  for (const query of ['!!!', '🗺️', 'zzzzxxxx', 'x'.repeat(500)]) assert.deepEqual(search(query), []);
});

test('accents, case and apostrophe variants do not change matches', () => {
  assert.deepEqual(ids('  NÜRBURGRING '), ids('nurburgring'));
  assert.deepEqual(ids('Assassin’s Creed'), ids("Assassin's Creed"));
  assert.deepEqual(ids("Assassin's Creed"), ids('assassins creed'));
  assert.ok(ids('nurburgring').includes(228));
});

test('typos find the intended title and city', () => {
  assert.equal(search('Firewath')[0].game.name, 'Firewatch');
  assert.ok(search('tokoyo').some(hit => hit.game.name === 'Ghostwire: Tokyo'));
  assert.ok(search('tokoyo').every(hit => hit.matchedLocations.some(l => l.name.includes('Tokyo'))));
});

test('abbreviations and sequel numbers resolve to the right games', () => {
  assert.equal(search('GTA').length, games.filter(g => g.name.startsWith('Grand Theft Auto')).length);
  assert.deepEqual(ids('gta 5'), [73]);
  assert.deepEqual(ids('gta v'), [73]);
  assert.deepEqual(ids('pgr 4'), [230]);
});

test('fictional city aliases only match games that actually use that name', () => {
  assert.deepEqual(ids('Liberty City'), [68, 69, 72]);
  assert.deepEqual(ids('Empire Bay'), [238]);
  assert.deepEqual(searchPositions(search('Liberty City')), [[40.7128, -74.006]]);
  assert.deepEqual(searchPositions(search('Empire Bay')), [[40.7128, -74.006]]);
});

test('country aliases find local names without unrelated fuzzy results', () => {
  assert.ok(search('Norge').length > 0);
  assert.ok(search('Norge').every(hit => hit.matchedLocations.some(l => /Norway$/.test(l.name))));
});

test('multiple words narrow across fields, independent of word order', () => {
  const hits = search('racing Tokyo');
  assert.ok(hits.length > 0);
  assert.deepEqual(ids('racing Tokyo'), ids('Tokyo racing'));
  assert.ok(hits.every(hit => hit.game.genre === 'Racing'));
  assert.deepEqual(searchPositions(hits), [[35.6895, 139.6917]]);
  assert.equal(new Set(hits.map(hit => hit.game.id)).size, hits.length);
});

test('genre and date filters narrow ranked results without reordering them', () => {
  const hits = search('Tokyo');
  const result = filterSearchResults(hits, { genre: 'Racing', yearRange: [2000, 2005] });
  assert.ok(result.length > 0);
  assert.deepEqual(result, hits.filter(hit => hit.game.genre === 'Racing' && hit.game.year >= 2000 && hit.game.year <= 2005));
  const all = search('');
  assert.equal(filterSearchResults(all, { genre: '', yearRange: [1900, 2100] }).length, games.length);
  const period = filterSearchResults(all, { genre: '', yearRange: [1900, 2100], storyYearRange: [1968, 1968] });
  assert.ok(period.some(hit => hit.game.name === 'Mafia III'));
  assert.ok(period.every(hit => hit.game.storyYears.includes(1968)));
});

test('exact titles outrank place and description matches, regardless of year', () => {
  const base = { genre: 'Adventure', developer: 'Test', publisher: 'Test', storyYears: [] };
  const lookup = createGameSearch([
    { ...base, id: 1, name: 'Other Game', year: 1990, locations: [{ name: 'Paris, France', position: [48, 2], note: 'A Firewatch exhibition.' }] },
    { ...base, id: 2, name: 'Firewatch', year: 2016, locations: [{ name: 'Wyoming, USA', position: [43, -109] }] },
    { ...base, id: 3, name: 'Another Game', year: 1980, locations: [{ name: 'Firewatch Park', position: [40, -100] }] },
  ]);
  assert.deepEqual(lookup('Firewatch').map(hit => hit.game.id), [2, 3, 1]);
  assert.deepEqual(searchPositions(lookup('exhibition')), [[48, 2]]);
});
