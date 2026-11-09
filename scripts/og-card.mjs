// Lager scripts/og-card.html, delingsbildet (public/og.png), fra katalogen:
// arket til venstre med ordmerket, kartet til høyre med Indiana Jones and the Fate of Atlantis
// sin rute over alle andre steder, dempet slik appen demper dem når et spill er åpent.
//
//   node scripts/og-card.mjs
//   npx vite --port 5199, åpne http://localhost:5199/gametraveler/scripts/og-card.html i 1200×630
//   og ta skjermbilde av #card til public/og.png
import fs from 'node:fs';
import { readGameRecords, readPlaces } from './lib/game-data.mjs';

const W = 1200, H = 630, PANEL = 520;
const ROUTE_GAME = 2; // Indiana Jones and the Fate of Atlantis
const VENUE_GENRES = new Set(['Racing', 'Sports']);

const places = new Map(readPlaces().map(place => [place.id, place]));
const games = readGameRecords();
const storyGames = games.filter(game => !game.genres.some(genre => VENUE_GENRES.has(genre)));

// Tallene i ark-linja: historiespill og tidsspennet som appens indekslinje; stedene rundes ned til hundre,
// siden appen slår steder inne i byer sammen med byen og teller litt færre enn postene
const storyPlaceIds = new Set(storyGames.flatMap(game => game.locations.map(location => location.placeId)));
const years = storyGames.flatMap(game => game.storyYears ?? []);
const formatYear = year => (year < 0 ? `${-year} BC` : String(year));
const counts = { games: storyGames.length, places: storyPlaceIds.size, from: formatYear(Math.min(...years)), to: formatYear(Math.max(...years)) };

// Web Mercator som kartet i appen, skalert og forskjøvet så ruten fyller kartflaten til høyre for arket
const routeGame = games.find(game => game.id === ROUTE_GAME);
const route = routeGame.routes[0];
const stops = route.stops.map(id => places.get(id).position);
const mercator = (lon, lat) => [lon / 360, -Math.log(Math.tan(Math.PI / 4 + (Math.max(-80, Math.min(80, lat)) * Math.PI) / 360)) / (2 * Math.PI)];
const raw = stops.map(({ lon, lat }) => mercator(lon, lat));
const [minX, maxX] = [Math.min(...raw.map(p => p[0])), Math.max(...raw.map(p => p[0]))];
const [minY, maxY] = [Math.min(...raw.map(p => p[1])), Math.max(...raw.map(p => p[1]))];
const pad = { left: 80, right: 70, top: 70, bottom: 90 };
const scale = Math.min((W - PANEL - pad.left - pad.right) / (maxX - minX), (H - pad.top - pad.bottom) / (maxY - minY));
const offsetX = PANEL + pad.left - minX * scale + ((W - PANEL - pad.left - pad.right) - (maxX - minX) * scale) / 2;
const offsetY = pad.top - minY * scale + ((H - pad.top - pad.bottom) - (maxY - minY) * scale) / 2;
const project = (lon, lat) => { const [x, y] = mercator(lon, lat); return [x * scale + offsetX, y * scale + offsetY]; };
const r1 = n => Math.round(n * 10) / 10;

// Land fra Natural Earth 1:110m, de samme landformene appen tegner
const countries = JSON.parse(fs.readFileSync('public/data/countries-110m.json', 'utf8'));
const ringPath = ring => {
  let d = '';
  ring.forEach(([lon, lat], index) => { const [x, y] = project(lon, lat); d += `${index ? 'L' : 'M'}${r1(x)} ${r1(y)}`; });
  return `${d}Z`;
};
const land = countries.features.map(feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.map(polygon => polygon.map(ringPath).join('')).join('');
}).join('');

const inMap = ([x, y]) => x > PANEL - 10 && x < W + 10 && y > -10 && y < H + 10;
const routeIds = new Set(route.stops);
const dimmed = [...storyPlaceIds]
  .filter(id => !routeIds.has(id))
  .map(id => places.get(id))
  .filter(place => place.placeType !== 'country')
  .map(place => project(place.position.lon, place.position.lat))
  .filter(inMap);

const points = stops.map(({ lon, lat }) => project(lon, lat));
// Knossos, Santorini og Atlantis ligger innen en grad av hverandre; numrene vifter ut så alle tre kan leses
const nudges = { 'knossos-greece': [6, 16], 'santorini-greece': [-12, -14], 'atlantis-fictional-mediterranean': [20, -10] };
const stopPoints = route.stops.map((id, index) => {
  const [x, y] = points[index];
  const [dx, dy] = nudges[id] ?? [0, 0];
  return [x + dx, y + dy];
});
const routePath = stopPoints.map(([x, y], index) => `${index ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('');

const svg = `<svg class="map" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <rect width="${W}" height="${H}" fill="var(--sea)" />
      <path d="${land}" fill="var(--land)" stroke="var(--border)" stroke-width="0.8" stroke-linejoin="round" />
      <g fill="var(--dimmed)" stroke="var(--sheet)" stroke-width="1.5">
${dimmed.map(([x, y]) => `        <circle cx="${r1(x)}" cy="${r1(y)}" r="3.6" />`).join('\n')}
      </g>
      <path d="${routePath}" fill="none" stroke="var(--terracotta)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />
${stopPoints.map(([x, y], index) => `      <g transform="translate(${r1(x)} ${r1(y)})"><circle r="15" fill="var(--terracotta)" stroke="var(--sheet)" stroke-width="3" /><text y="5.5">${index + 1}</text></g>`).join('\n')}
    </svg>`;

const html = `<!doctype html>
<!-- Laget av scripts/og-card.mjs. Ikke rediger for hånd: endre skriptet og kjør det på nytt. -->
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @font-face {
    font-family: "Archivo";
    src: url("../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2") format("woff2");
    font-weight: 100 900;
    font-stretch: 62% 125%;
  }
  @font-face {
    font-family: "Newsreader";
    font-style: italic;
    font-weight: 450 500;
    src: url("../src/fonts/newsreader-latin-opsz-italic-subset.woff2") format("woff2-variations");
  }
  :root {
    --ink: #1b2a41; --ink-soft: #4f5a6b; --sheet: #fdfaf2; --rule: #d2d1c2;
    --terracotta: #c0432a; --dimmed: #9aa0aa;
    --sea: #b7cbd2; --land: #f6f0e3; --border: rgb(27 42 65 / 0.18);
  }
  body { margin: 0; background: #444; }
  #card { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--sea); color: var(--ink); font-family: "Archivo", system-ui, sans-serif; }
  .map { position: absolute; inset: 0; }
  .map text { fill: #fff; font: 750 16px/1 "Archivo"; font-stretch: 80%; font-variant-numeric: tabular-nums; text-anchor: middle; }
  .sheet { position: absolute; left: 0; top: 0; bottom: 0; width: ${PANEL}px; box-sizing: border-box; padding: 64px 48px 52px 64px; display: flex; flex-direction: column; background: var(--sheet); border-right: 1px solid var(--rule); }
  .brand { display: flex; align-items: center; gap: 0.43em; font-size: 50px; }
  .brand svg { height: 1.05em; width: auto; flex: none; }
  .brand h1 { margin: 0; font-size: 1em; font-weight: 720; font-stretch: 88%; line-height: 1; letter-spacing: -0.025em; white-space: nowrap; }
  .brand h1 span { margin-left: 0.05em; font-family: "Newsreader"; font-size: 1.1em; font-style: italic; font-weight: 500; font-stretch: normal; font-variation-settings: "opsz" 24; letter-spacing: -0.01em; }
  .tagline { margin: 14px 0 0; font-family: "Newsreader"; font-style: italic; font-weight: 450; font-size: 26px; }
  .headline { margin: auto 0 0; font-weight: 800; font-stretch: 68%; font-size: 58px; line-height: 1; letter-spacing: -0.01em; text-wrap: balance; }
  .counts { margin: 22px 0 0; padding-top: 18px; border-top: 1px solid var(--rule); font-size: 21px; font-weight: 500; line-height: 1.45; color: var(--ink-soft); font-variant-numeric: tabular-nums lining-nums; }
  .counts b { font-weight: 700; color: var(--ink); }
  .legend { position: absolute; right: 28px; bottom: 28px; display: grid; grid-template-columns: 28px auto; column-gap: 12px; align-items: center; padding: 14px 18px 15px 16px; border: 1px solid rgb(27 42 65 / 0.14); border-radius: 12px; background: var(--sheet); box-shadow: 0 8px 24px -12px rgb(27 42 65 / 0.35); }
  .legend i { grid-row: span 2; height: 5px; border-radius: 3px; background: var(--terracotta); }
  .legend b { font-size: 21px; font-weight: 800; font-stretch: 68%; line-height: 1.1; }
  .legend span { font-size: 16px; font-weight: 500; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <div id="card">
    ${svg}
    <div class="legend"><i></i><b>${routeGame.name}</b><span>${route.stops.length} stops · ${places.get(route.stops[0]).name.split(',')[0]} → ${places.get(route.stops.at(-1)).name.split(',')[0]}</span></div>
    <div class="sheet">
      <div class="brand">
        ${fs.readFileSync('src/assets/atlas-mark.svg', 'utf8').trim().replace(/ width="120" height="96"/, '')}
        <h1>Game<span>Traveler</span></h1>
      </div>
      <p class="tagline">A video game atlas</p>
      <p class="headline">Where video games take place</p>
      <p class="counts"><b>${counts.games}</b> story games in over <b>${(Math.floor(counts.places / 100) * 100).toLocaleString('en-US')}</b> places, set from <b>${counts.from}</b> to <b>${counts.to}</b></p>
    </div>
  </div>
</body>
</html>
`;
fs.writeFileSync('scripts/og-card.html', html);
console.log(`scripts/og-card.html: ${counts.games} story games, ${counts.places} places, ${counts.from}–${counts.to}, ${dimmed.length} dimmed dots, route of ${route.stops.length} stops.`);
