import { readGameRecords, writeGames } from './lib/game-data.mjs';

const games = readGameRecords();

const seen = new Set();
const names = [];
for (const game of games) {
  for (const field of ['developer', 'publisher']) {
    const value = game[field];
    if (typeof value === 'string' && value.trim() && !seen.has(value)) {
      seen.add(value);
      names.push({ field, value });
    }
  }
}

const wikiUrlCache = new Map();

async function fetchWikipediaUrl(name) {
  if (wikiUrlCache.has(name)) return wikiUrlCache.get(name);
  const url = `https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&redirects=1&prop=info&inprop=url&titles=${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GameTraveller/1.0 (https://github.com/; contact@localhost)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    wikiUrlCache.set(name, null);
    return null;
  }

  const data = await response.json();
  const page = Object.values(data?.query?.pages ?? {}).find(p => p && p.missing !== true && typeof p.fullurl === 'string');
  const result = page?.fullurl ?? null;
  wikiUrlCache.set(name, result);
  return result;
}

for (const item of names) {
  const key = `${item.field}Url`;
  const lookup = await fetchWikipediaUrl(item.value);
  if (!lookup) continue;
  for (const game of games) {
    if (game[item.field] === item.value && !game[key]) {
      game[key] = lookup;
    }
  }
}

writeGames(games);
console.log(`Added Wikipedia links for ${names.length} unique companies.`);
