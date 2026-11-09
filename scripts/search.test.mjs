import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameSearch, filterSearchResults, searchPositions } from '../src/search.ts';
import { readGames } from './lib/game-data.mjs';

const games = readGames();
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
  assert.deepEqual(ids('Liberty City'), [68, 69, 71, 72, 247, 249]);
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
  assert.ok(hits.every(hit => hit.game.genres.includes('Racing')));
  // Tokyo itself plus its spots (Shibuya Crossing, Tokyo Tower…), all inside the city
  const positions = searchPositions(hits);
  assert.ok(positions.some(([lat, lng]) => lat === 35.6895 && lng === 139.6917));
  assert.ok(positions.every(([lat, lng]) => lat > 35.5 && lat < 35.8 && lng > 139.5 && lng < 139.9));
  assert.equal(new Set(hits.map(hit => hit.game.id)).size, hits.length);
});

test('genre and date filters narrow ranked results without reordering them', () => {
  const hits = search('');
  const selectedGenres = ['Racing', 'Adventure'];
  const result = filterSearchResults(hits, { genres: selectedGenres, yearRange: [2000, 2005] });
  assert.ok(result.length > 0);
  assert.ok(result.some(hit => hit.game.genres.includes('Racing')));
  assert.ok(result.some(hit => hit.game.genres.includes('Adventure')));
  assert.deepEqual(result, hits.filter(hit => hit.game.genres.some(genre => selectedGenres.includes(genre)) && hit.game.year >= 2000 && hit.game.year <= 2005));
  const all = search('');
  assert.equal(filterSearchResults(all, { genres: [], yearRange: [1900, 2100] }).length, games.length);
  const period = filterSearchResults(all, { genres: [], yearRange: [1900, 2100], storyYearRange: [1968, 1968] });
  assert.ok(period.some(hit => hit.game.name === 'Mafia III'));
  assert.ok(period.every(hit => hit.game.storyYears.includes(1968)));
  const multiGenreGame = games.find(game => game.genres.length > 1);
  assert.ok(multiGenreGame, 'the catalog should include a game with multiple genre labels');
  assert.equal(filterSearchResults([{ game: multiGenreGame, matchedLocations: [] }], {
    genres: [multiGenreGame.genres[0]], yearRange: [multiGenreGame.year, multiGenreGame.year],
  }).length, 1);
});

test('exact titles outrank place and description matches, regardless of year', () => {
  const base = { genres: ['Adventure'], developer: 'Test', publisher: 'Test', storyYears: [] };
  const lookup = createGameSearch([
    { ...base, id: 1, name: 'Other Game', year: 1990, locations: [{ name: 'Paris, France', position: [48, 2], note: 'A Firewatch exhibition.' }] },
    { ...base, id: 2, name: 'Firewatch', year: 2016, locations: [{ name: 'Wyoming, USA', position: [43, -109] }] },
    { ...base, id: 3, name: 'Another Game', year: 1980, locations: [{ name: 'Firewatch Park', position: [40, -100] }] },
  ]);
  assert.deepEqual(lookup('Firewatch').map(hit => hit.game.id), [2, 3, 1]);
  assert.deepEqual(searchPositions(lookup('exhibition')), [[48, 2]]);
});

test('near spellings are marked as such and only shown when nothing matches as typed', () => {
  assert.deepEqual(search('Firewath').map(hit => hit.game.name), ['Firewatch']);
  assert.ok(search('Firewath').every(hit => hit.exact === false));
  assert.ok(search('Firewatch').every(hit => hit.exact === true));
  // Letters scattered across a word are not a typo: "mario" is not "marina"
  assert.ok(search('mario').every(hit => !hit.game.locations.some(l => /marina/i.test(l.name))));
  assert.ok(search('rome').length < 40);
});

test('a short single word matches the start of words while the user is still typing', () => {
  const hits = search('pa');
  assert.ok(hits.length > 0);
  assert.ok(hits.some(hit => hit.game.locations.some(l => l.name.startsWith('Paris'))));
  // Inside a longer query a short word still has to be a whole word ("GTA V" is not "Vice City")
  assert.deepEqual(ids('gta v'), [73]);
});

test('the last word is matched as a prefix while typing a multi-word title', () => {
  for (const query of ['post m', 'post mo', 'post mor', 'post mortem']) {
    assert.ok(search(query).some(hit => hit.game.name === 'Post Mortem'), query);
  }
});

test('common ways of writing the same thing find the same games', () => {
  // Typo plus a half-typed last word
  assert.ok(search('sherlok hol').some(hit => hit.game.name.startsWith('Sherlock Holmes')));
  // Digits for roman numerals, and the other way round
  assert.equal(search('mafia 2')[0].game.name, 'Mafia II');
  assert.equal(search('tomb raider 2')[0].game.name, 'Tomb Raider II');
  // Hyphenated titles without the hyphen
  assert.deepEqual(ids('spiderman'), ids('spider-man'));
  // St. and Saint
  assert.deepEqual(ids('st petersburg'), ids('saint petersburg'));
  // Named periods and decades use the story years
  assert.ok(search('ww2').length > 10);
  // A few more come from place notes that mention the war by name
  const inWar = hit => hit.game.storyYears.some(y => y >= 1939 && y <= 1945)
    || hit.game.locations.some(l => /world war (ii|2)/i.test(l.note ?? ''));
  assert.ok(search('ww2').every(inWar));
  assert.ok(search('1940s').every(hit => hit.game.storyYears.some(y => y >= 1940 && y <= 1949) || hit.game.name.includes('1940')));
});

test('an abbreviation does not hide titles and places that start the same way', () => {
  assert.ok(search('cod').some(hit => hit.game.name.startsWith('Codename')));
  assert.ok(search('cod').some(hit => hit.game.name.startsWith('Call of Duty')));
});

test('every way of writing a world war finds the same games', () => {
  // «world war ii» ga null treff og «wwi» traff WWII-titler før spørringen ble skrevet om til tall
  assert.deepEqual(ids('world war ii'), ids('ww2'));
  assert.deepEqual(ids('world war two'), ids('ww2'));
  assert.deepEqual(ids('world war i'), ids('ww1'));
  assert.deepEqual(ids('world war one'), ids('ww1'));
  assert.deepEqual(ids('wwi'), ids('ww1'));
  assert.ok(ids('ww2').length > 0 && ids('ww1').length > 0);
});
