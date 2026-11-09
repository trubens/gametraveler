// Landgrenser fra Natural Earth (public domain) for kartet, og hvilket land hvert sted ligger i.
//
// Skriver:
//   public/data/countries-110m.json         grove grenser for verdensutsnittet (iso + navn, to desimaler), lastes ved behov
//   public/data/countries-50m.json          finere grenser fra regionnivå og oppover, lastes ved behov
//   src/data/generated/country-labels.json  land som finnes som flate, med punktet der navnet står
//   src/data/generated/place-countries.json sted-id -> ISO 3166-1 alpha-2, regnet ut med punkt-i-polygon (1:50m)
//   src/data/places/<land>.json             stedspost for land som har spill i seg, men ingen post fra før
//
// Bruk: node scripts/build-countries.mjs   (henter kildefilene fra GitHub om de ikke ligger i .cache/)
import fs from 'node:fs';
import path from 'node:path';
import { readPlaces } from './lib/game-data.mjs';

const load = async scale => {
  const file = `ne_${scale}_admin_0_countries.geojson`;
  const cache = path.join('.cache', file);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`);
  const raw = await res.text();
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, raw);
  return JSON.parse(raw);
};
const coarse = await load('110m');
const source = await load('50m');

// Natural Earth setter ISO_A2 til -99 for Frankrike og Norge; ISO_A2_EH har riktig kode
const isoOf = p => [p.ISO_A2_EH, p.ISO_A2, p.ADM0_A3].find(v => v && v !== '-99');
const round = n => Math.round(n * 100) / 100;
const roundCoords = c => typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords);

// Douglas–Peucker: fjerner punkter som ligger nærmere enn `tolerance` grader fra linja mellom naboene.
// Flatene vises bare til zoom 7 (1,2 km per piksel), og 1:50m har langt finere detalj enn det: Leaflet
// projiserte 100 000 punkter på nytt for hvert zoomnivå, og det var det meste av tiden et zoom kostet.
const simplifyRing = (ring, tolerance) => {
  const sqTolerance = tolerance * tolerance;
  const sqSegmentDistance = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = sqTolerance, index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegmentDistance(ring[i], ring[first], ring[last]);
      if (d > maxDistance) { index = i; maxDistance = d; }
    }
    if (index > 0) { keep[index] = 1; stack.push([first, index], [index, last]); }
  }
  return ring.filter((_, i) => keep[i]);
};
const simplifyGeometry = (geometry, tolerance) => {
  const simplifyPolygon = polygon => polygon.map(ring => simplifyRing(ring, tolerance)).filter(ring => ring.length >= 4);
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: simplifyPolygon(geometry.coordinates) };
  return { type: 'MultiPolygon', coordinates: geometry.coordinates.map(simplifyPolygon).filter(polygon => polygon.length > 0) };
};

// Areal i grader², til å skille småstater (som beholder nålen) fra land som er store nok til å treffes som flate
const polygonArea = geometry => {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let area = 0;
  for (const poly of polys) {
    const ring = poly[0];
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    area += Math.abs(sum) / 2;
  }
  return area;
};

// Natural Earth har et punkt per land der navnet bør stå (LABEL_X/LABEL_Y).
// Samme landkode kan stå på flere poster (Australia og dets havterritorier); den største beholdes.
const slim = (data, tolerance) => {
  const byIso = new Map();
  for (const f of data.features) {
    const iso = isoOf(f.properties);
    if (!iso) continue;
    const feature = { type: 'Feature', properties: { iso, name: f.properties.NAME_EN ?? f.properties.NAME, label: [round(f.properties.LABEL_Y), round(f.properties.LABEL_X)], area: Math.round(polygonArea(f.geometry) * 100) / 100 }, geometry: simplifyGeometry({ type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) }, tolerance) };
    const current = byIso.get(iso);
    if (!current || feature.properties.area > current.properties.area) byIso.set(iso, feature);
  }
  return [...byIso.values()];
};
// 0,02° er under én piksel på zoom 6,75, det siste nivået før flatene slukkes på 7; 0,03° er under én piksel på zoom 4, der de grove slutter
const features = slim(source, 0.02);
// De grove grensene mangler småstatene (Malta, Singapore, Kiribati); de hentes fra de fine, så hvert land finnes på alle zoomnivåer
const coarseFeatures = slim(coarse, 0.03);
const coarseIsos = new Set(coarseFeatures.map(f => f.properties.iso));
for (const f of features) if (!coarseIsos.has(f.properties.iso)) coarseFeatures.push(f);
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/countries-50m.json', JSON.stringify({ type: 'FeatureCollection', features }));
fs.writeFileSync('public/data/countries-110m.json', JSON.stringify({ type: 'FeatureCollection', features: coarseFeatures }));
// Hvilke land som finnes som flate, hvor navnet står og hvor store de er; appen bruker dette uten å laste grensene
fs.mkdirSync('src/data/generated', { recursive: true });
fs.writeFileSync('src/data/generated/country-labels.json', JSON.stringify(Object.fromEntries(features.map(f => [f.properties.iso, { name: f.properties.name, label: f.properties.label, area: f.properties.area }]))) + '\n');

// Punkt i polygon (ray casting), med hull
const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPolygon = (pt, rings) => inRing(pt, rings[0]) && !rings.slice(1).some(hole => inRing(pt, hole));
const contains = (pt, geometry) => geometry.type === 'Polygon' ? inPolygon(pt, geometry.coordinates) : geometry.coordinates.some(poly => inPolygon(pt, poly));

// Brukes på de originale (urundede) grensene, så små land ikke mistes
const byName = new Map();
for (const f of source.features) for (const n of [f.properties.NAME, f.properties.NAME_LONG, f.properties.NAME_EN, f.properties.NAME_SORT]) if (n) byName.set(n.toLowerCase(), isoOf(f.properties));
const shortName = name => name.replace(/\s*\([^)]*\)/g, '').split(',')[0].trim().toLowerCase();

// Navn i stedsdataene som Natural Earth staver annerledes
const ALIASES = { usa: 'US', 'united states': 'US', uk: 'GB', 'united kingdom': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB', 'türkiye': 'TR', turkey: 'TR', 'czech republic': 'CZ', czechia: 'CZ', russia: 'RU', uae: 'AE', vietnam: 'VN', 'south korea': 'KR', 'north korea': 'KP', burma: 'MM', myanmar: 'MM', 'hong kong': 'CN', macao: 'CN', macau: 'CN', 'vatican city': 'VA', 'the bahamas': 'BS', bahamas: 'BS', 'channel islands': 'GB', 'cornwall': 'GB', singapore: 'SG', malta: 'MT', maldives: 'MV', kiribati: 'KI', palau: 'PW', 'french polynesia': 'PF', bahrain: 'BH', philippines: 'PH' };
const byAnyName = name => ALIASES[name] ?? byName.get(name) ?? null;
const segments = name => name.replace(/\s*\([^)]*\)/g, '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const result = {};
let hits = 0;
for (const place of readPlaces()) {
  const pt = [place.position.lon, place.position.lat];
  let iso = null;
  // Hele land kjennes igjen på navnet: grensene er for grove for Singapore og for små land som Malta
  if (place.placeType === 'country') iso = byAnyName(shortName(place.name));
  if (!iso) {
    const hit = source.features.find(f => contains(pt, f.geometry));
    iso = hit ? isoOf(hit.properties) : null;
  }
  // Kyststeder og øyer faller utenfor de grove grensene; da sier resten av navnet hvilket land det er («Istanbul, Turkey»)
  if (!iso) for (const segment of segments(place.name).slice(1).reverse()) { iso = byAnyName(segment); if (iso) break; }
  result[place.id] = iso;
  if (iso) hits++;
}
fs.writeFileSync('src/data/generated/place-countries.json', JSON.stringify(result, null, 0) + '\n');

// Hvert land med spill i seg skal kunne åpnes og merkes, også når ingen spill er satt på «hele landet».
// Da trenger landet en stedspost. De som mangler, lages her fra Natural Earth og skrives én gang.
const slugify = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const existingNames = new Set();
for (const place of readPlaces()) if (place.placeType === 'country') for (const n of [shortName(place.name), ...(place.aliases ?? []).map(a => a.toLowerCase())]) existingNames.add(n);
const extraAliases = {};
for (const [alias, iso] of Object.entries(ALIASES)) (extraAliases[iso] ??= []).push(alias);
const withContent = new Set(Object.values(result).filter(Boolean));
let created = 0;
for (const f of source.features) {
  const iso = isoOf(f.properties);
  if (!iso || !withContent.has(iso)) continue;
  const names = [f.properties.NAME_EN, f.properties.NAME, f.properties.NAME_LONG].filter(Boolean);
  if (names.some(n => existingNames.has(n.toLowerCase()))) continue;
  const name = f.properties.NAME_EN ?? f.properties.NAME;
  const id = slugify(name);
  const file = `src/data/places/${id}.json`;
  if (fs.existsSync(file)) continue;
  // Bare forkortelser (UK, USA) hentes fra alias-tabellen; «England» er ikke et navn på Storbritannia
  const aliases = [...new Set([...names, ...(extraAliases[iso] ?? []).filter(a => a.length <= 3).map(a => a.toUpperCase())])].filter(a => a !== name);
  const record = { id, name, ...(aliases.length ? { aliases } : {}), position: { lat: round(f.properties.LABEL_Y), lon: round(f.properties.LABEL_X) }, scale: 'area', placeType: 'country', source: 'https://www.naturalearthdata.com/downloads/110m-cultural-vectors/' };
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  result[id] = iso;
  created++;
}
if (created) fs.writeFileSync('src/data/generated/place-countries.json', JSON.stringify(result, null, 0) + '\n');
// Land som har spill i seg, men ingen post som heter det landet heter (de åpnes med navnet fra Natural Earth)
const recordNames = new Set(readPlaces().map(p => shortName(p.name)));
const nameless = [...withContent].filter(iso => { const f = source.features.find(f => isoOf(f.properties) === iso); return f && ![f.properties.NAME_EN, f.properties.NAME, f.properties.NAME_LONG].some(n => n && recordNames.has(n.toLowerCase())); });
console.log(`Country records created: ${created}. Countries with games but no record of their own: ${nameless.join(', ') || 'none'}.`);
console.log(`Countries: ${features.length} shapes (${(fs.statSync('public/data/countries-50m.json').size / 1024).toFixed(0)} kB at 1:50m, ${(fs.statSync('public/data/countries-110m.json').size / 1024).toFixed(0)} kB at 1:110m). Places in a country: ${hits} of ${Object.keys(result).length}.`);
