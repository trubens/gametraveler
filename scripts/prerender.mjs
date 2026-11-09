// Lager en statisk HTML-side per sted og spill etter `vite build`, slik at søkemotorer og
// lenkeforhåndsvisninger får tittel, beskrivelse og innhold uten å kjøre JavaScript.
// Appen leser stien (/place/<slug>/, /game/<slug>/) og åpner riktig panel når den starter.
// Alle adresser har skråstrek til slutt: sidene ligger som <sti>/index.html, og uten skråstreken svarer
// Apache med en 301 til adressen med den. Canonical, og:url, sitemap, lenker og JSON-LD bruker samme form.
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { placeLabel, readGames, readPlaces } from './lib/game-data.mjs';
import { latestReviewed, placeRedirects } from './lib/prerender-helpers.mjs';
import { getGameRoutes } from '../src/routes.ts';
import { withArticle } from '../src/placeArticle.ts';
import { pruneCache, renderCard } from './lib/og-maps.mjs';

const dist = 'dist';
const indexPath = path.join(dist, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const siteUrl = readSiteUrl();
// Sidene peker på app.js og app.css, som har faste navn og henter de byggede filene med hash.
// Da endres en side bare når innholdet på den endres, og en publisering laster bare opp det som er nytt.
const builtTemplate = fs.readFileSync(indexPath, 'utf8');
if (builtTemplate.includes('%VITE_SITE_URL%')) throw new Error('dist/index.html still contains %VITE_SITE_URL%: Vite did not resolve VITE_SITE_URL.');
const scriptTag = builtTemplate.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleTag = builtTemplate.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
// Katalogen er sin egen fil (vite.config.ts); Vite forhåndslaster den med modulepreload, og app.js
// importerer den først, så nettleseren henter begge så snart app.js er lest
const preloadTags = [...builtTemplate.matchAll(/<link rel="modulepreload" crossorigin href="([^"]+)">/g)];
if (!scriptTag || !styleTag) {
  throw new Error('dist/index.html does not have the expected Vite script and stylesheet tags. Run `vite build` again.');
}
const assetBase = scriptTag[1].slice(0, scriptTag[1].indexOf('assets/'));
const fromBase = url => url.slice(assetBase.length);
const imports = [...preloadTags.map(tag => tag[1]), scriptTag[1]].map(url => `import './${fromBase(url)}';`).join('\n');
fs.writeFileSync(path.join(dist, 'app.js'), `// Laget av scripts/prerender.mjs: peker på bygget med hash\n${imports}\n`);
fs.writeFileSync(path.join(dist, 'app.css'), `/* Laget av scripts/prerender.mjs: peker på bygget med hash */\n@import url("${fromBase(styleTag[1])}");\n`);
// Hovedskriften (Archivo, latinsk) forhåndslastes: ellers finner nettleseren den først etter app.css og
// CSS-en den importerer, to rundturer senere. Navnet har hash, så det hentes fra bygget.
const fontFile = fs.readdirSync(path.join(dist, 'assets')).find(file => /^archivo-latin-wdth-normal-[\w-]+\.woff2$/.test(file));
const builtCss = fs.readFileSync(path.join(dist, fromBase(styleTag[1])), 'utf8');
const fontUrl = fontFile && builtCss.includes(fontFile) ? `${assetBase}assets/${fontFile}` : undefined;
if (!fontUrl) console.warn('Warning: the Archivo latin font was not found in the built CSS; no font preload added.');
const fontPreload = fontUrl ? `<link rel="preload" href="${fontUrl}" as="font" type="font/woff2" crossorigin>\n    ` : '';
let template = builtTemplate
  .replace(scriptTag[0], `${fontPreload}<script type="module" src="${assetBase}app.js"></script>`)
  .replace(styleTag[0], `<link rel="stylesheet" href="${assetBase}app.css">`);
for (const tag of preloadTags) template = template.replace(tag[0], '');
const basePath = new URL(siteUrl).pathname.replace(/\/$/, '');
const appPath = route => `${basePath}${route}`;
const games = readGames();

// Holdes i synk med slugify i src/format.ts
const slugify = text => text
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const gameBaseSlugCounts = new Map();
for (const game of games) gameBaseSlugCounts.set(slugify(game.name), (gameBaseSlugCounts.get(slugify(game.name)) ?? 0) + 1);
const gameSlugById = new Map(games.map(game => {
  const base = slugify(game.name);
  return [game.id, gameBaseSlugCounts.get(base) > 1 ? `${base}-${game.year}` : base];
}));
const gameSlug = game => gameSlugById.get(game.id);
// Sidenes stier, alle med skråstrek til slutt
const gameRoute = game => `/game/${gameSlug(game)}/`;
const placeRoute = name => `/place/${slugify(name)}/`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Som formatYear i src/format.ts: fem sifre får tusenskille («10,000 BC»), fire gjør det ikke («1500 BC»)
const yearDigits = n => (n >= 10000 ? n.toLocaleString('en-US') : String(n));
const formatYear = y => (y < 0 ? `${yearDigits(-y)} BC` : yearDigits(y));
// «Medal of Honor (1999)» får ikke året to ganger når det alt står i parentes
const withYear = game => game.name.endsWith(` (${game.year})`) ? game.name : `${game.name} (${game.year})`;
const listNames = (names, max = 4) => {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
};

const andList = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

// Steder samles på navn, slik appen gjør det på koordinater
const places = new Map();
const addPlace = (name, game, note, gameAliases = [], position) => {
  const slug = slugify(name);
  const place = places.get(slug) ?? { name, slug, games: [], notes: [], gameAliases: new Map(), position };
  if (!place.games.includes(game)) place.games.push(game);
  if (note) place.notes.push({ game: game.name, note });
  for (const alias of gameAliases) place.gameAliases.set(alias, (place.gameAliases.get(alias) ?? 0) + 1);
  places.set(slug, place);
};
// Nivå to (spotParentOf i src/gameData.ts): et sted inne i en by gir også byen spillet, også når ingen spill
// peker rett på byen. Ellers fikk byen ingen side, og Incheon, Siena og Masyaf ga 404 fra «Nearby».
const SPOT_PARENT_TYPES = new Set(['city', 'neighborhood']);
const placeRecords = new Map(readPlaces().map(place => [place.id, place]));
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Navnet spillet selv bruker på stedet (Kamurocho for Kabukichō, Liberty City for New York): folk søker på
// det, så det står i stedets tittel. Bare aliasene på spillets sted, ikke stedets egne.
const gameAliasesOf = loc => {
  const own = new Set((placeRecords.get(loc.placeId)?.aliases ?? []).map(fold));
  return (loc.aliases ?? []).filter(alias => !own.has(fold(alias)) && !fold(loc.name).includes(fold(alias)));
};
for (const game of games) {
  for (const loc of game.locations) {
    addPlace(loc.name, game, loc.note, gameAliasesOf(loc), loc.position);
    const parent = loc.scale === 'site' && loc.parentId ? placeRecords.get(loc.parentId) : undefined;
    // Notatet handler om stedet inne i byen, så byens side sier hvor («At Songdo: …»), som appens «At …»-rad
    if (parent && SPOT_PARENT_TYPES.has(parent.placeType)) addPlace(placeLabel(parent), game, loc.note && `At ${loc.name.split(',')[0]}: ${loc.note}`, [], [parent.position.lat, parent.position.lon]);
  }
}

// De dempede prikkene på kartbildene: hele atlaset utenom land, [lon, lat]
// Hvor bredt kartbildet for et sted er: et land eller en region trenger mer enn de 14 gradene en by får (Alaska ble en tom flate)
const recordByLabel = new Map([...placeRecords.values()].map(record => [placeLabel(record), record]));
const SPAN_BY_TYPE = { country: 30, region: 24, body_of_water: 24 };
// Det kartbildet trenger for å finne stedets omriss: typen, navnene og landet
const placeCountries = JSON.parse(fs.readFileSync('src/data/generated/place-countries.json', 'utf8'));
const placeShape = (record, name) => ({
  type: record?.placeType,
  names: [name.split(', ')[0], ...(record?.aliases ?? [])],
  iso: record ? placeCountries[record.id] : undefined,
});
const contextDots = [...placeRecords.values()].filter(p => p.placeType !== 'country').map(p => [p.position.lon, p.position.lat]);
const lonLat = ([lat, lon]) => [lon, lat];

// Kartbildene tegnes til slutt, flere om gangen (renderCard er asynkron)
const imageJobs = [];

// Sidene som står i sitemap.xml, med datoen innholdet sist ble gjennomgått (games/*.json «reviewed»)
const sitemap = [];

// route er stien under nettstedet med skråstrek til slutt ('/' er forsiden); noindex holder siden ute av
// søkeresultatene og sitemap.xml
function page({ route, title, description, body, structuredData, lastmod, noindex = false, image }) {
  const url = `${siteUrl}${route}`;
  // Kartbildet for siden (scripts/lib/og-maps.mjs): delingsbilde, bilde i teksten og i sitemap.xml
  let imageUrl;
  if (image) {
    imageJobs.push({ file: path.join(dist, route, 'map.png'), card: image.card });
    imageUrl = `${url}map.png`;
    const img = `<p><img src="${esc(appPath(`${route}map.png`))}" alt="${esc(image.alt)}" width="1200" height="630" loading="lazy" decoding="async" style="max-width:100%;height:auto" /></p>`;
    body = body.replace('</h1>', () => `</h1>\n      ${img}`);
  }
  const robots = noindex ? '<meta name="robots" content="noindex" />' : '<meta name="robots" content="max-image-preview:large" />';
  const imageAlt = image ? `<meta property="og:image:alt" content="${esc(image.alt)}" />\n  ` : '';
  const data = imageUrl ? { ...structuredData, image: imageUrl } : structuredData;
  const head = `${robots}\n  ${imageAlt}<link rel="canonical" href="${esc(url)}" />\n  ${jsonLd(data)}`;
  // Erstatningene er funksjoner, så «$&» eller «$'» i et notat ikke tolkes som mønstre av replace
  const html = template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(description)}${b}`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, (_, a, b) => `${a}${esc(title)}${b}`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, (_, a, b) => `${a}${esc(description)}${b}`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, (_, a, b) => `${a}${esc(url)}${b}`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, (_, a, b) => `${a}${esc(imageUrl ?? `${siteUrl}/og.png?v=fogg`)}${b}`)
    // Canonical-lenken kan ikke stå i index.html: Vite leser <link href> som en fil, og "/" er en mappe
    .replace('</head>', () => `${head}</head>`)
    .replace('<div id="root"></div>', () => `<section id="static-content">${body}</section>\n    <div id="root"></div>`);
  const file = path.join(dist, route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (!noindex) sitemap.push({ url, lastmod, image: imageUrl });
  return url;
}

const homeTitle = 'Game Traveler – Explore the real-world places behind video games';
// Nettstedsnavnet står synlig i teksten på hver side: Google viste «Truben» som avsender og meldte at
// siden ikke inneholdt «traveler», fordi navnet bare sto i tittelen og metadataene
const siteLine = `<p><a href="${esc(appPath('/'))}">Game Traveler</a> · A video game atlas of the real places games are set in</p>`;
const homeDescription = `Explore ${games.length} video games on an interactive atlas. Find the real cities, regions and landmarks behind their stories, from Paris to Tokyo.`;
const popularPlaces = [...places.values()]
  .sort((a, b) => b.games.length - a.games.length || a.name.localeCompare(b.name))
  .slice(0, 16);
const gamesCount = count => `${count} ${count === 1 ? 'game' : 'games'}`;
const homeBody = `
      <main>
        <h1>Explore where video games take place</h1>
        <p>Game Traveler is an interactive atlas connecting ${games.length} video games to real-world cities, regions and landmarks. Browse locations, follow a game's journey, and discover the places behind its story.</p>
        <h2>Popular places in video games</h2>
        <ul>${popularPlaces.map(place => `<li><a href="${esc(appPath(placeRoute(place.name)))}">${esc(place.name)}</a> – ${gamesCount(place.games.length)}</li>`).join('')}</ul>
        <p><a href="${esc(appPath('/places/'))}">All ${places.size} places</a></p>
        <h2>Browse the game atlas</h2>
        <ul>${[...games].sort((a, b) => a.name.localeCompare(b.name)).map(game => `<li><a href="${esc(appPath(gameRoute(game)))}">${esc(game.name)}</a>${game.name.endsWith(` (${game.year})`) ? '' : ` (${game.year})`} – set in ${esc(listNames(game.locations.map(location => location.name)))}</li>`).join('')}</ul>
      </main>`;
page({
  route: '/',
  title: homeTitle,
  description: homeDescription,
  body: homeBody,
  structuredData: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Game Traveler', description: homeDescription, url: `${siteUrl}/` },
  lastmod: latestReviewed(games),
});

// «All places» i appen (/places/): hele stedslista, alfabetisk
const placesTitle = 'All places in the video game atlas – Game Traveler';
const placesDescription = `All ${places.size} real-world cities, regions and landmarks that video games are set in, with the games set in each place.`;
const sortedPlaces = [...places.values()].sort((a, b) => a.name.localeCompare(b.name));
page({
  route: '/places/',
  title: placesTitle,
  description: placesDescription,
  body: `
      ${siteLine}
      <h1>All places in the video game atlas</h1>
      <p>${esc(placesDescription)}</p>
      <ul>${sortedPlaces.map(place => `<li><a href="${esc(appPath(placeRoute(place.name)))}">${esc(place.name)}</a> – ${gamesCount(place.games.length)}</li>`).join('')}</ul>`,
  structuredData: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: placesTitle, description: placesDescription, url: `${siteUrl}/places/` },
  lastmod: latestReviewed(games),
});

// «My atlas» (/my-atlas/) er hver leser sin egen (lagret i nettleseren), så siden er bare et skall som
// lar adressen lastes direkte; den holdes ute av søkeresultatene
page({
  route: '/my-atlas/',
  title: 'My atlas – Game Traveler',
  description: 'The places you have been and want to go, and the games you have played, on the Game Traveler atlas. Saved in your browser.',
  body: `
      ${siteLine}
      <h1>My atlas</h1>
      <p>Mark the places you have been and want to go, and the games you have played. Your atlas is saved in this browser.</p>`,
  noindex: true,
});

for (const place of places.values()) {
  const sorted = [...place.games].sort((a, b) => a.year - b.year);
  // Det mest brukte spillnavnet på stedet, bare når flere enn ett spill bruker det eller det er stedets eneste spill
  const [inGameName] = [...place.gameAliases].filter(([, n]) => n > 1 || sorted.length === 1).sort((a, b) => b[1] - a[1])[0] ?? [];
  const title = `Video games set in ${place.name}${inGameName ? ` (${inGameName})` : ''} – Game Traveler`;
  const description = truncate(`${sorted.length === 1 ? '1 video game is' : `${sorted.length} video games are`} set in ${place.name}${inGameName ? `, known in games as ${inGameName}` : ''}: ${listNames(sorted.map(withYear))}.`);
  const body = `
      ${siteLine}
      <h1>Video games set in ${esc(place.name)}</h1>
      <p>${esc(description)}</p>
      <ul>${sorted.map(g => `<li><a href="${esc(appPath(gameRoute(g)))}">${esc(g.name)}</a> (${g.year}, ${esc(g.developer)})${noteFor(g, place.name)}</li>`).join('')}</ul>`;
  const route = placeRoute(place.name);
  page({
    route,
    title,
    description,
    body,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: `${siteUrl}${route}`,
      mainEntity: { '@type': 'ItemList', itemListElement: sorted.map((game, index) => ({ '@type': 'ListItem', position: index + 1, name: game.name, url: `${siteUrl}${gameRoute(game)}` })) },
    },
    lastmod: latestReviewed(place.games),
    image: {
      alt: `Map of ${place.name}, where ${sorted.length === 1 ? `${sorted[0].name} is` : `${sorted.length} video games are`} set`,
      card: {
        kicker: 'Video games set in',
        title: place.name.split(', ')[0],
        lines: [
          { text: [place.name.split(', ').slice(1).join(', '), inGameName && `${inGameName} in the games`].filter(Boolean).join(' · ') || 'Real place' },
          { text: sorted.length === 1 ? `${withYear(sorted[0])}` : `${sorted.length} games, ${sorted[0].year}–${sorted.at(-1).year}`, strong: true },
        ],
        pins: [lonLat(place.position)],
        minSpan: SPAN_BY_TYPE[recordByLabel.get(place.name)?.placeType] ?? 14,
        shape: placeShape(recordByLabel.get(place.name), place.name),
        context: contextDots,
      },
    },
  });
}

for (const game of games) {
  const routeBody = game.routes ? getGameRoutes(game).map(route => `
      <section><h2>${esc(route.name)}</h2>
      ${route.characters?.length ? `<p>${esc(route.characters.join(' & '))}</p>` : ''}
      ${route.storyYears?.length ? `<p>Set in ${route.storyYears.map(formatYear).join(', ')}</p>` : ''}
      ${route.note ? `<p>${esc(route.note)}</p>` : ''}
      <ol>${route.locations.map(location => `<li><a href="${esc(appPath(placeRoute(location.name)))}">${esc(location.name)}</a></li>`).join('')}</ol>
</section>`).join('') : '';
  const firstNote = game.locations.find(l => l.note)?.note;
  // Svaret først, slik folk spør («where does Forza Horizon 2 take place»): landene, så stedene med kortnavn.
  // Før sto «Nice, France, Sisteron, France, Provence, France», og spillsidene fikk nesten ingen klikk.
  const shortNames = [...new Set(game.locations.map(l => l.name.split(', ')[0]))];
  const countries = [...new Set(game.locations.map(l => {
    if (placeRecords.get(l.placeId)?.placeType === 'country') return l.name;
    return l.name.includes(', ') ? l.name.split(', ').at(-1).replace(/ \((?:fictional|legendary)\)$/, '') : null;
  }).filter(Boolean))];
  const onlyCountries = shortNames.every(name => countries.includes(name));
  const inWhat = shortNames.length === 1
    ? game.locations[0].name.split(', ').map((part, i) => (i === 0 ? part : withArticle(part))).join(', ')
    : countries.length === 0 || onlyCountries
    ? andList(shortNames.slice(0, 4).map(withArticle)) + (shortNames.length > 4 ? ` and ${shortNames.length - 4} more` : '')
    : `${countries.length <= 3 ? andList(countries.map(withArticle)) : `${countries.length} countries`}: ${listNames(shortNames)}`;
  const title = `Where ${gameBaseSlugCounts.get(slugify(game.name)) > 1 ? withYear(game) : game.name} takes place: ${shortNames.length === 1 ? game.locations[0].name : `map of ${shortNames.length} ${game.locations.some(l => l.fictional || l.legendary || l.settingType && l.settingType !== 'real') ? '' : 'real '}places`} – Game Traveler`;
  const description = truncate(`${withYear(game)} takes place in ${inWhat}.${firstNote ? ` ${firstNote}` : ''}`);
  const body = `
      ${siteLine}
      <h1>Where ${esc(game.name)} takes place</h1>
      <p>${esc(withYear(game))}, ${esc(game.genres.join(', '))} by ${esc(game.developer)}, published by ${esc(game.publisher)}.${game.storyYears.length ? ` Set in ${game.storyYears.map(formatYear).join(', ')}.` : ''}${game.aliases?.length ? ` Also known as ${esc(game.aliases.join(', '))}.` : ''}</p>
      <ol>${game.locations.map(l => `<li><a href="${esc(appPath(placeRoute(l.name)))}">${esc(l.name)}</a>${l.note ? ` – ${esc(l.note)}` : ''}${l.source ? ` <a href="${esc(l.source)}" target="_blank" rel="noopener noreferrer">Location source</a>` : ''}</li>`).join('')}</ol>
      ${routeBody}
      ${game.source ? `<p><a href="${esc(game.source)}" target="_blank" rel="noopener noreferrer">${game.source.includes('wikipedia.org/wiki/') ? 'Wikipedia' : 'About this game'}</a></p>` : ''}`;
  page({
    route: gameRoute(game),
    title,
    description,
    body,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: game.name,
      description,
      datePublished: String(game.year),
      genre: game.genres,
      author: { '@type': 'Organization', name: game.developer },
      publisher: { '@type': 'Organization', name: game.publisher },
      about: game.locations.map(location => ({ '@type': 'Place', name: location.name })),
      ...(game.source ? { citation: game.source } : {}),
      url: `${siteUrl}${gameRoute(game)}`,
    },
    lastmod: latestReviewed([game]),
    image: gameImage(game, shortNames, countries),
  });
}

// Kartbildet for et spill: én reiserute gir nummererte stopp i rekkefølge, ellers alle stedene som prikker
function gameImage(game, shortNames, countries) {
  const routes = game.routes ? getGameRoutes(game) : [];
  const ordered = routes.length === 1 && routes[0].locations.length > 1;
  const unique = [...new Map(game.locations.map(l => [l.placeId, l])).values()];
  const stops = ordered ? routes[0].locations : unique;
  const where = shortNames.length === 1
    ? game.locations[0].name
    : `${shortNames.length} places${countries.length === 0 ? '' : countries.length <= 3 ? ` in ${andList(countries.map(withArticle))}` : ` in ${countries.length} countries`}`;
  return {
    alt: `Map of where ${game.name} takes place: ${listNames(shortNames)}`,
    card: {
      kicker: ordered ? 'The journey' : 'Where it takes place',
      title: game.name,
      lines: [{ text: `${game.year} · ${game.developer}` }, { text: where, strong: true }],
      pins: stops.map(l => lonLat(l.position)),
      names: stops.map(l => l.name),
      numbered: ordered,
      places: ordered ? { pins: unique.map(l => lonLat(l.position)), names: unique.map(l => l.name) } : undefined,
      context: contextDots,
    },
  };
}

function noteFor(game, placeName) {
  // Spillets eget notat for stedet, ellers notatet fra et sted inne i byen («At Songdo: …»)
  const note = game.locations.find(l => l.name === placeName)?.note
    ?? places.get(slugify(placeName))?.notes.find(n => n.game === game.name)?.note;
  return note ? ` – ${esc(note)}` : '';
}

// Seriesider: «Where the Broken Sword games take place», spillene i årsrekkefølge med stedene sine
const seriesSlug = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const bySeries = new Map();
for (const game of games) if (game.series) bySeries.set(game.series, [...(bySeries.get(game.series) ?? []), game]);
for (const [name, list] of bySeries) {
  if (list.length < 2) continue;
  list.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  const placeNames = [...new Set(list.flatMap(g => g.locations.map(l => l.name)))];
  const title = `Where the ${name} games take place – Game Traveler`;
  const description = truncate(`${list.length} ${name} games from ${list[0].year} to ${list[list.length - 1].year}, set in ${listNames(placeNames.slice(0, 6))}${placeNames.length > 6 ? ' and more' : ''}.`);
  const body = `
      ${siteLine}
      <h1>Where the ${esc(name)} games take place</h1>
      <p>${esc(description)}</p>
      <ol>${list.map(g => `<li><a href="${esc(appPath(gameRoute(g)))}">${esc(g.name)}</a> (${g.year}) – ${esc(listNames(g.locations.map(l => l.name).slice(0, 5)))}${g.locations.length > 5 ? ' and more' : ''}</li>`).join('')}</ol>`;
  const route = `/series/${seriesSlug(name)}/`;
  page({
    route,
    title,
    description,
    body,
    structuredData: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: `${siteUrl}${route}`, hasPart: list.map(g => ({ '@type': 'VideoGame', name: g.name, url: `${siteUrl}${gameRoute(g)}` })) },
    lastmod: latestReviewed(list),
  });
}

// lastmod er datoen spillet (eller det nyeste av spillene på siden) sist ble gjennomgått; byggedatoen sa
// at alt var endret ved hver publisering. Sider uten gjennomgåtte spill står uten lastmod.
for (let i = 0; i < imageJobs.length; i += 8) {
  await Promise.all(imageJobs.slice(i, i + 8).map(async ({ file, card }) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await renderCard(card));
  }));
}
pruneCache();

fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  sitemap.map(({ url, lastmod, image }) => `  <url><loc>${esc(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${image ? `<image:image><image:loc>${esc(image)}</image:loc></image:image>` : ''}</url>`).join('\n') +
  `\n</urlset>\n`);

// Steder som har byttet navn beholder den gamle adressen som én 301 til den nye (Apache, se public/.htaccess)
const redirects = JSON.parse(fs.readFileSync('src/data/redirects.json', 'utf8'));
const { lines: redirectLines, warnings: redirectWarnings } = placeRedirects({
  redirects: redirects.place ?? {},
  placeById: placeRecords,
  placeSlug: place => slugify(placeLabel(place)),
  pageSlugs: new Set(places.keys()),
  basePath,
});
for (const warning of redirectWarnings) console.warn(`Warning: ${warning}`);
const htaccessPath = path.join(dist, '.htaccess');
if (redirectLines.length && fs.existsSync(htaccessPath)) {
  fs.appendFileSync(htaccessPath, `\n# Laget av scripts/prerender.mjs fra src/data/redirects.json: steder som har byttet navn\n${redirectLines.join('\n')}\n`);
}

fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

// Feilsiden (ErrorDocument i public/.htaccess) står alene, uten appen: appen ville tatt over adressen og
// vist kartet i stedet for beskjeden. Den kan vises på hvilken som helst sti, så alle lenker er absolutte.
const fontFace = fontUrl ? `@font-face{font-family:"Archivo Variable";font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(${fontUrl}) format("woff2-variations")}` : '';
fs.writeFileSync(path.join(dist, '404.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Page not found – Game Traveler</title>
    <meta name="theme-color" content="#fdfaf2" />
    <link rel="icon" href="${assetBase}favicon.svg?v=fogg" sizes="any" type="image/svg+xml" />
    <link rel="icon" href="${assetBase}favicon-32.png?v=fogg" sizes="32x32" type="image/png" />
    <style>
      ${fontFace}
      :root{color:#1b2a41;background:#ece5d5;font-family:"Archivo Variable",system-ui,sans-serif;line-height:1.5}
      body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;box-sizing:border-box}
      main{max-width:34rem;background:#fdfaf2;border:1px solid #d2d1c2;border-radius:12px;padding:32px 28px}
      .brand{margin:0 0 20px;font-weight:600}
      .brand a{color:inherit;text-decoration:none}
      h1{margin:0 0 8px;font-size:1.75rem;font-stretch:80%;line-height:1.15}
      p{margin:0 0 16px;color:#4f5a6b}
      form{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}
      input{flex:1 1 12rem;font:inherit;padding:10px 12px;border:1px solid #868c97;border-radius:8px;background:#fff;color:inherit;min-width:0}
      button{font:inherit;font-weight:600;padding:10px 16px;border:0;border-radius:8px;background:#c0432a;color:#fff;cursor:pointer}
      button:hover{background:#97321e}
      a{color:#97321e}
      :focus-visible{outline:3px solid #c0432a;outline-offset:2px}
    </style>
  </head>
  <body>
    <main>
      <p class="brand"><a href="${esc(appPath('/'))}">Game Traveler</a></p>
      <h1>This page is not on the map</h1>
      <p>The address may be mistyped, or the place or game has moved. Search the atlas for a game, city or country instead.</p>
      <form action="${esc(appPath('/'))}" method="get" role="search">
        <label for="q" style="position:absolute;left:-9999px">Search games and places</label>
        <input id="q" name="q" type="search" placeholder="Try Paris or Tokyo" autocomplete="off" />
        <button type="submit">Search</button>
      </form>
      <p><a href="${esc(appPath('/'))}">Go to the atlas</a> · <a href="${esc(appPath('/places/'))}">All places</a></p>
    </main>
  </body>
</html>
`);

console.log(`Prerendered ${places.size} place pages, ${games.length} game pages, ${[...bySeries.values()].filter(l => l.length >= 2).length} series pages, /places/, /my-atlas/ and 404.html for ${siteUrl}.`);

// VITE_SITE_URL slik Vite leser den (prosessmiljøet, så .env.production.local, .env.production, .env.local og .env).
// Uten den ville canonical, sitemap og Open Graph pekt feil, så bygget stopper.
function readSiteUrl() {
  const value = (loadEnv('production', process.cwd(), 'VITE_').VITE_SITE_URL ?? '').trim().replace(/\/$/, '');
  if (!value) throw new Error('VITE_SITE_URL is not set (environment, .env.production.local, .env.production, .env.local or .env). Set it to the public URL, such as https://truben.no/gametraveler.');
  if (!/^https?:\/\/[^/]+/i.test(value)) throw new Error(`VITE_SITE_URL must be an absolute http(s) URL without a trailing slash, got "${value}".`);
  return value;
}

function jsonLd(data) {
  if (!data) return '';
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n  `;
}

function truncate(text, maxLength = 160) {
  if (text.length <= maxLength) return text;
  const sentence = text.slice(0, maxLength - 1).replace(/\s+\S*$/, '');
  return `${sentence}…`;
}
