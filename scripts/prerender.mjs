// Lager en statisk HTML-side per sted og spill etter `vite build`, slik at søkemotorer og
// lenkeforhåndsvisninger får tittel, beskrivelse og innhold uten å kjøre JavaScript.
// Appen leser stien (/place/<slug>, /game/<slug>) og åpner riktig panel når den starter.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const indexPath = path.join(dist, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const siteUrl = readSiteUrl();
const template = fs.readFileSync(indexPath, 'utf8');
const games = JSON.parse(fs.readFileSync('src/data/games.json', 'utf8'));

// Holdes i synk med slugify i src/format.ts
const slugify = text => text
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const formatYear = y => (y < 0 ? `${-y} BC` : String(y));
const listNames = (names, max = 4) => {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
};

// Steder samles på navn, slik appen gjør det på koordinater
const places = new Map();
for (const game of games) {
  for (const loc of game.locations) {
    const slug = slugify(loc.name);
    const place = places.get(slug) ?? { name: loc.name, slug, games: [], notes: [] };
    if (!place.games.includes(game)) place.games.push(game);
    if (loc.note) place.notes.push({ game: game.name, note: loc.note });
    places.set(slug, place);
  }
}

function page({ route, title, description, body }) {
  const url = `${siteUrl}${route}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace('</head>', `${canonical(url)}</head>`)
    .replace('<div id="root"></div>', `<section id="static-content">${body}</section>\n    <div id="root"></div>`);
  const file = path.join(dist, route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return url;
}

// Canonical-lenken kan ikke stå i index.html: Vite leser <link href> som en fil, og "/" er en mappe
const canonical = url => (siteUrl ? `<link rel="canonical" href="${esc(url)}" />\n  ` : '');
fs.writeFileSync(indexPath, template.replace('</head>', `${canonical(`${siteUrl}/`)}</head>`));

const urls = [`${siteUrl}/`];

for (const place of places.values()) {
  const sorted = [...place.games].sort((a, b) => a.year - b.year);
  const title = `Video games set in ${place.name} – Game Traveller`;
  const description = `${sorted.length === 1 ? '1 video game is' : `${sorted.length} video games are`} set in ${place.name}: ${listNames(sorted.map(g => `${g.name} (${g.year})`))}.`;
  const body = `
      <h1>Video games set in ${esc(place.name)}</h1>
      <p>${esc(description)}</p>
      <ul>${sorted.map(g => `<li><a href="/game/${slugify(g.name)}">${esc(g.name)}</a> (${g.year}, ${esc(g.developer)})${noteFor(g, place.name)}</li>`).join('')}</ul>`;
  urls.push(page({ route: `/place/${place.slug}`, title, description, body }));
}

for (const game of games) {
  const placeNames = game.locations.map(l => l.name);
  const firstNote = game.locations.find(l => l.note)?.note;
  const title = `${game.name} (${game.year}) – where it takes place – Game Traveller`;
  const description = `${game.name} by ${game.developer} is set in ${listNames(placeNames)}.${firstNote ? ` ${firstNote}` : ''}`;
  const body = `
      <h1>Where ${esc(game.name)} takes place</h1>
      <p>${esc(game.name)} (${game.year}), ${esc(game.genre)} by ${esc(game.developer)}, published by ${esc(game.publisher)}.${game.storyYears.length ? ` Set in ${game.storyYears.map(formatYear).join(', ')}.` : ''}</p>
      <ol>${game.locations.map(l => `<li><a href="/place/${slugify(l.name)}">${esc(l.name)}</a>${l.note ? ` – ${esc(l.note)}` : ''}</li>`).join('')}</ol>`;
  urls.push(page({ route: `/game/${slugify(game.name)}`, title, description, body }));
}

function noteFor(game, placeName) {
  const note = game.locations.find(l => l.name === placeName)?.note;
  return note ? ` – ${esc(note)}` : '';
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`);
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

console.log(`Prerendered ${places.size} place pages and ${games.length} game pages${siteUrl ? ` for ${siteUrl}` : ' (VITE_SITE_URL is empty: links in sitemap.xml and OG tags are relative)'}.`);

function readSiteUrl() {
  let value = process.env.VITE_SITE_URL;
  if (value === undefined && fs.existsSync('.env')) {
    const match = fs.readFileSync('.env', 'utf8').match(/^VITE_SITE_URL=(.*)$/m);
    value = match?.[1].trim();
  }
  return (value ?? '').replace(/\/$/, '');
}
