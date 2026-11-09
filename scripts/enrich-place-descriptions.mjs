// Fyller `description` i stedspostene som har en Wikipedia-artikkel: de to første setningene av
// artikkelens sammendrag (REST-API-et page/summary), høyst rundt 240 tegn. Teksten vises i stedspanelet
// med «Wikipedia» som kilde, slik lisensen (CC BY-SA) krever. Skriv gjerne egne beskrivelser i posten;
// skriptet rører ikke en post som alt har en.
//
//   node scripts/enrich-place-descriptions.mjs            fyll inn der det mangler
//   node scripts/enrich-place-descriptions.mjs --dry-run  bare rapporter
//   node scripts/enrich-place-descriptions.mjs --only id  ett sted

import fs from 'node:fs';
import path from 'node:path';

const PLACE_DIRECTORY = 'src/data/places';
const dryRun = process.argv.includes('--dry-run');
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : undefined;
const HEADERS = { 'User-Agent': 'GameTraveler/1.0 (https://truben.no/gametraveler/; contact via the site)', Accept: 'application/json' };
const MAX_LENGTH = 240;

// De to første setningene. Et punktum er setningsslutt når det følges av mellomrom og stor bokstav,
// og ikke står etter en forkortelse (St. Louis, Mt. Fuji); desimaler (2.1 million) har ikke mellomrom.
const ABBREVIATIONS = new Set(['St', 'Mt', 'Dr', 'Mr', 'Mrs', 'Ms', 'No', 'vs', 'Jr', 'Sr', 'Co', 'Ft', 'Lt', 'Gen', 'Capt', 'approx', 'ca', 'c']);
const splitSentences = text => {
  const sentences = [];
  let start = 0;
  const re = /([.!?])(\s+)(?=[A-Z"“(])/g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(start, m.index + 1);
    const lastWord = before.match(/([A-Za-z]+)\.$/)?.[1];
    if (lastWord && ABBREVIATIONS.has(lastWord)) continue;
    sentences.push(before.trim());
    start = m.index + m[0].length;
  }
  if (start < text.length) sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
};
const firstSentences = text => {
  const clean = text.replace(/\s+/g, ' ').replace(/\s*\([^)]*\)/g, match => (match.length > 40 ? '' : match)).trim();
  const parts = splitSentences(clean);
  let out = '';
  for (const part of parts.slice(0, 2)) {
    if (out && (out + ' ' + part).length > MAX_LENGTH) break;
    out = out ? `${out} ${part}` : part;
  }
  return out.length > MAX_LENGTH ? out.slice(0, MAX_LENGTH - 1).replace(/\s+\S*$/, '') + '…' : out;
};

async function summary(url) {
  const title = decodeURIComponent(url.split('/wiki/')[1]);
  const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: HEADERS });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Wikipedia answered ${response.status} for ${title}`);
  const data = await response.json();
  if (data.type === 'disambiguation' || !data.extract) return null;
  return data.extract;
}

const files = fs.readdirSync(PLACE_DIRECTORY).filter(f => f.endsWith('.json')).sort();
let filled = 0;
const missing = [];
for (const file of files) {
  const filePath = path.join(PLACE_DIRECTORY, file);
  const place = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (only && place.id !== only) continue;
  if (place.description || !place.wikipediaUrl) continue;
  // Et oppdiktet sted lenker til forbildet; sammendraget ville beskrevet Dorset, ikke Dowerton
  if (place.fictional || place.legendary) continue;
  let extract = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { extract = await summary(place.wikipediaUrl); break; } catch (error) { console.error(`${place.id}: ${error.message}`); await new Promise(r => setTimeout(r, 3000)); }
  }
  if (!extract) { missing.push(place.id); continue; }
  const description = firstSentences(extract);
  console.log(`${place.id.padEnd(48)} ${description}`);
  filled++;
  if (!dryRun) {
    place.description = description;
    place.descriptionSource = 'wikipedia';
    fs.writeFileSync(filePath, `${JSON.stringify(place, null, 2)}\n`);
  }
  await new Promise(r => setTimeout(r, 200));
}
console.log(`\n${dryRun ? 'Would fill' : 'Filled'} ${filled} places. No summary: ${missing.length}`);
for (const id of missing) console.log(`  ${id}`);
