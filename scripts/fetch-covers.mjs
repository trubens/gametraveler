// Henter cover-bilder fra IGDB (https://api-docs.igdb.com) og skriver `coverUrl` inn i src/data/games.json.
//
// Bruk:
//   TWITCH_CLIENT_ID=… TWITCH_CLIENT_SECRET=… node scripts/fetch-covers.mjs [--force]
// Nøklene får du gratis ved å registrere en app på https://dev.twitch.tv/console/apps.
// Bildene lenkes direkte fra images.igdb.com; IGDB krever kreditering, som appen viser i panelet.
import fs from 'node:fs';

const DATA = 'src/data/games.json';
const force = process.argv.includes('--force');
const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET (see https://dev.twitch.tv/console/apps).');
  process.exit(1);
}

const games = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
if (!tokenRes.ok) {
  console.error('Could not get a Twitch token:', await tokenRes.text());
  process.exit(1);
}
const { access_token: token } = await tokenRes.json();

let found = 0;
const misses = [];
for (const game of games) {
  if (game.coverUrl && !force) continue;
  // Søk på hovedtittelen; undertitler etter kolon og skråstrek forvirrer IGDB-søket
  const query = game.name.split(/[/:]/)[0].trim();
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: `search "${game.name.replace(/"/g, '')}"; fields name,cover.image_id,first_release_date; limit 8;`,
  });
  if (!res.ok) {
    console.error(`${game.name}: IGDB ${res.status}`);
    await sleep(1000);
    continue;
  }
  const results = await res.json();
  const wanted = normalize(game.name);
  const scored = results
    .filter(r => r.cover?.image_id)
    .map(r => {
      const year = r.first_release_date ? new Date(r.first_release_date * 1000).getUTCFullYear() : undefined;
      const name = normalize(r.name);
      const nameScore = name === wanted ? 3 : name.startsWith(normalize(query)) ? 1 : 0;
      const yearScore = year === undefined ? 0 : Math.abs(year - game.year) <= 1 ? 2 : -2;
      return { r, score: nameScore + yearScore };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best && best.score >= 2) {
    game.coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${best.r.cover.image_id}.jpg`;
    found++;
    console.log(`✓ ${game.name} ← ${best.r.name}`);
  } else {
    misses.push(game.name);
    console.log(`✗ ${game.name} (no confident match)`);
  }
  // IGDB tillater 4 forespørsler i sekundet
  await sleep(300);
}

fs.writeFileSync(DATA, JSON.stringify(games, null, 2) + '\n');
console.log(`\nCovers found: ${found}. Without a match: ${misses.length}.`);
if (misses.length) console.log('Add coverUrl by hand for: ' + misses.join(', '));
