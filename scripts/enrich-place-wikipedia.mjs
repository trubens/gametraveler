// Fyller `wikipediaUrl` i stedspostene som mangler den, med en passende engelsk Wikipedia-artikkel.
//
// Rekkefølge per sted: 1) `source` når den alt er en Wikipedia-artikkel, 2) søk på hele navnet uten
// «(fictional)»-haler («Brest, France»), 3) søk på kortnavnet («Brest») med landet som kontekst.
// Et treff godtas bare når tittelen begynner med kortnavnet (eller omvendt), og flertydighetssider
// hoppes over. Alt annet rapporteres som uløst og får ingen lenke; appen viser aldri et søk, og et sted
// lenker aldri til artikkelen om et spill (oppdiktede steder får forbildet via place-wikipedia-overrides.json).
//
//   node scripts/enrich-place-wikipedia.mjs            fyll inn der det mangler
//   node scripts/enrich-place-wikipedia.mjs --dry-run  bare rapporter
//   node scripts/enrich-place-wikipedia.mjs --only id  ett sted

import fs from 'node:fs';
import path from 'node:path';

const PLACE_DIRECTORY = 'src/data/places';
const dryRun = process.argv.includes('--dry-run');
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;
const W = 'https://en.wikipedia.org/wiki/';
const HEADERS = { 'User-Agent': 'GameTraveler/1.0 (https://truben.no/gametraveler/; contact via the site)', Accept: 'application/json' };

const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stripFiction = name => name.replace(/\s*\((fictional|fictionalized|fictionalised)[^)]*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
const shortName = name => name.match(/^(?:[^,(]|\([^)]*\))+/)?.[0].trim() ?? name;

async function search(query, limit = 5) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&gsrnamespace=0&prop=pageprops|info&ppprop=disambiguation&inprop=url&redirects=1`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`Wikipedia answered ${response.status} for ${query}`);
  const data = await response.json();
  return Object.values(data?.query?.pages ?? {})
    .filter(p => p && typeof p.fullurl === 'string' && !(p.pageprops && 'disambiguation' in p.pageprops))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

// Tittelen må begynne med kortnavnet, eller kortnavnet med tittelen («Khe Sanh» ↔ «Khe Sanh Combat Base»)
// En kvalifikator etter komma («Humboldt County, Iowa») må finnes i stedsnavnet, ellers er det en navnebror
const fits = (title, short, full = short) => {
  const t = norm(title.replace(/\s*\([^)]*\)\s*$/, '')), s = norm(short);
  if (!t || !s) return false;
  const qualifier = title.includes(',') ? norm(title.slice(title.indexOf(',') + 1).replace(/\s*\([^)]*\)\s*$/, '')) : '';
  if (qualifier && !norm(full).includes(qualifier)) return false;
  return t === s || t.startsWith(s + ' ') || t.startsWith(s + ',') || s.startsWith(t + ' ');
};

// Eksakt tittel (med omdirigering): «Innsmouth» finnes som artikkel selv om søket viser novellen først
async function lookup(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops|info&ppprop=disambiguation&inprop=url&titles=${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`Wikipedia answered ${response.status} for ${title}`);
  const data = await response.json();
  return Object.values(data?.query?.pages ?? {}).find(p => p && p.missing !== true && typeof p.fullurl === 'string' && !(p.pageprops && 'disambiguation' in p.pageprops)) ?? null;
}

// Håndplukkede artikler for navn oppslaget ikke klarer: baner, gamle navn og områder uten egen artikkel
const CURATED = JSON.parse(fs.readFileSync('scripts/place-wikipedia-overrides.json', 'utf8'));
// Artikler om spill: et sted lenker aldri dit, bare til artikkelen om stedet eller forbildet
const gameSources = new Set(fs.readdirSync('src/data/games').map(file => JSON.parse(fs.readFileSync(path.join('src/data/games', file), 'utf8')).source));

async function resolve(place) {
  if (CURATED[place.id]) return { url: W + CURATED[place.id], how: 'curated' };
  // Kilden brukes bare når den er en artikkel om stedet, ikke om spillet som bruker det
  if (typeof place.source === 'string' && /^https:\/\/en\.wikipedia\.org\/wiki\//.test(place.source) && !gameSources.has(place.source)) return { url: place.source, how: 'source' };
  const fictionalName = !!(place.fictional || place.legendary);
  if (!fictionalName) {
    const exactFull = await lookup(stripFiction(place.name));
    if (exactFull) return { url: exactFull.fullurl, how: `title "${stripFiction(place.name)}"` };
    const exactShort = await lookup(shortName(stripFiction(place.name)));
    if (exactShort) return { url: exactShort.fullurl, how: `title "${shortName(stripFiction(place.name))}"` };
  }
  const fictional = !!(place.fictional || place.legendary);
  const full = stripFiction(place.name);
  const short = shortName(full);
  const context = full.split(',').slice(1).map(s => s.trim()).filter(Boolean);
  // Et oppdiktet sted får bare en artikkel som heter nøyaktig det samme (Atlantis), ikke en ekte navnebror
  // («Saxton» i Cornwall er ikke Saxton i North Yorkshire)
  const queries = fictional ? [short] : [...new Set([full, [short, ...context.slice(-1)].join(' '), short])];
  for (const query of queries) {
    const hits = await search(query);
    const hit = fictional
      ? hits.find(p => norm(p.title) === norm(short))
      : hits.find(p => fits(p.title, short, full)) ?? hits.find(p => fits(p.title, full, full));
    if (hit) return { url: hit.fullurl, how: `search "${query}" → ${hit.title}` };
  }
  return null;
}

const files = fs.readdirSync(PLACE_DIRECTORY).filter(f => f.endsWith('.json')).sort();
const unresolved = [];
let filled = 0;
for (const file of files) {
  const filePath = path.join(PLACE_DIRECTORY, file);
  const place = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (only && place.id !== only) continue;
  if (place.wikipediaUrl) continue;
  let result = null;
  try {
    result = await resolve(place);
  } catch (error) {
    console.error(`${place.id}: ${error.message}`);
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!result) { unresolved.push(`${place.id} (${place.name})`); continue; }
  console.log(`${place.id.padEnd(48)} ${result.url}   [${result.how}]`);
  filled++;
  if (!dryRun) {
    place.wikipediaUrl = result.url;
    fs.writeFileSync(filePath, `${JSON.stringify(place, null, 2)}\n`);
  }
  await new Promise(r => setTimeout(r, 150));
}
console.log(`\n${dryRun ? 'Would fill' : 'Filled'} ${filled} places. Unresolved: ${unresolved.length}`);
for (const line of unresolved) console.log(`  ${line}`);
