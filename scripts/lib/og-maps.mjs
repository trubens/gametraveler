// Kartbilder per side (1200×630) til Open Graph, Google Bilder og miniatyrbildet i søkeresultatene.
// Samme oppsett som delingsbildet (scripts/og-card.mjs): ark med tittel til venstre, kartet til høyre med
// spillets steder i terrakotta og resten av atlaset dempet. Tegnes som SVG og gjøres om til PNG med resvg,
// uten nettleser. Fontene er faste utgaver av Archivo og Newsreader (scripts/fonts), og bredden på teksten
// regnes fra metrics.json, siden SVG ikke bryter linjer selv.
//
// Bildene mellomlagres på innholdet (node_modules/.cache/gt-og), så et bygg tegner bare de som er endret,
// og like bilder blir byte for byte like, så publiseringen hopper over dem.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const W = 1200, H = 630, PANEL = 520;
const C = {
  ink: '#1b2a41', inkSoft: '#4f5a6b', sheet: '#fdfaf2', rule: '#d2d1c2', accent: '#c0432a',
  dimmed: '#9aa0aa', sea: '#b7cbd2', land: '#f6f0e3', border: 'rgba(27,42,65,0.18)',
};
const VERSION = 'v8';
const FONT_DIR = 'scripts/fonts';
const fontFiles = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf')).map(f => path.join(FONT_DIR, f));
const metrics = JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'metrics.json'), 'utf8'));
const CACHE = 'node_modules/.cache/gt-og';
fs.mkdirSync(CACHE, { recursive: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = n => Math.round(n * 10) / 10;
const textWidth = (text, font, size) => [...text].reduce((sum, ch) => sum + (metrics[font][ch] ?? 0.55), 0) * size;

// Bryter teksten i linjer som får plass; den siste linja kortes med … om det trengs
function wrap(text, font, size, width, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, font, size) <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return { lines, fits: lines.every(l => textWidth(l, font, size) <= width) };
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;
  while (textWidth(`${last}…`, font, size) > width && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
  kept[maxLines - 1] = `${last.replace(/[,·:;–-]\s*$/, '')}…`;
  return { lines: kept, fits: false };
}

// Landformene, med avgrensningsboks per land så bare de som synes tegnes
function boxOf(rings) {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const ring of rings) for (const [lon, lat] of ring ?? []) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return [minLon, minLat, maxLon, maxLat];
}
const loadCountries = file => JSON.parse(fs.readFileSync(file, 'utf8')).features.map(loadCountries.one);
loadCountries.one = feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return { polygons, box: boxOf(polygons.map(polygon => polygon[0])) };
};
// Nære utsnitt (under 20 grader) bruker Natural Earth 1:10m rett fra kilden: 1:50m-fila i public er forenklet
// og rundet til to desimaler for nettkartet, og kystene ble kantete når et kort zoomer inn på en by
async function naturalEarth(name) {
  const file = path.join('.cache', `ne_10m_${name}.geojson`);
  if (!fs.existsSync(file)) {
    const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_${name}.geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`);
    fs.mkdirSync('.cache', { recursive: true });
    fs.writeFileSync(file, await res.text());
  }
  return file;
}
const WORLD = {
  coarse: loadCountries('public/data/countries-110m.json'),
  fine: loadCountries('public/data/countries-50m.json'),
  detail: loadCountries(await naturalEarth('admin_0_countries')),
};
// Innsjøer (landformene har dem ikke, så De store sjøene manglet) og elver, så en by inne i landet får noe
// å kjenne seg igjen i: Seinen gjennom Paris, Themsen gjennom London
const LAKES = JSON.parse(fs.readFileSync(await naturalEarth('lakes'), 'utf8')).features.map(feature => ({
  ...loadCountries.one(feature), rank: feature.properties.scalerank,
}));
const RIVERS = JSON.parse(fs.readFileSync(await naturalEarth('rivers_lake_centerlines'), 'utf8')).features
  .filter(feature => feature.properties.featurecla === 'River' && feature.geometry)
  .map(feature => {
    const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return { lines, box: boxOf(lines), rank: feature.properties.scalerank };
  });

// Stedets eget omriss, fargelagt på stedskortet: land, delstater og provinser (Alaska, Bayern), og naturlige
// regioner (Sibir, Patagonia, Alpene; de er grovt tegnet, så de får bare flate, ikke kant). Uten omriss ble en stor region en nål midt i en tom flate
const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const shapeOf = (feature, names, iso) => ({ ...loadCountries.one(feature), names: new Set(names.flatMap(n => String(n ?? '').split('|')).map(fold).filter(Boolean)), iso });
const COUNTRY_SHAPES = new Map(JSON.parse(fs.readFileSync(await naturalEarth('admin_0_countries'), 'utf8')).features
  .map(feature => [[feature.properties.ISO_A2_EH, feature.properties.ISO_A2].find(v => v && v !== '-99'), loadCountries.one(feature)]));
const REGION_SHAPES = [
  ...JSON.parse(fs.readFileSync(await naturalEarth('admin_1_states_provinces'), 'utf8')).features
    .map(f => shapeOf(f, [f.properties.name, f.properties.name_en, f.properties.name_alt, f.properties.woe_name, f.properties.gn_name], f.properties.iso_a2)),
  ...JSON.parse(fs.readFileSync(await naturalEarth('geography_regions_polys'), 'utf8')).features
    .map(f => ({ ...shapeOf(f, [f.properties.NAME, f.properties.NAME_EN, f.properties.NAMEALT], null), rough: true })),
];
// Byer med navn, til orientering på stedskortene
const CITIES = JSON.parse(fs.readFileSync(await naturalEarth('populated_places_simple'), 'utf8')).features
  .map(f => ({ name: f.properties.name, lon: f.properties.longitude, lat: f.properties.latitude, rank: f.properties.scalerank, pop: f.properties.pop_max }))
  .sort((a, b) => a.rank - b.rank || b.pop - a.pop);

function inRing(ring, [lon, lat]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const contains = (shape, point) => shape.polygons.some(polygon => polygon[0] && inRing(polygon[0], point));

// Omrisset for et sted: landet etter ISO-kode, ellers en region med samme navn som inneholder punktet
function findShape({ type, names, iso, position }) {
  if (type === 'country') return COUNTRY_SHAPES.get(iso);
  if (!['region', 'natural_feature', 'island', 'area'].includes(type)) return undefined;
  const wanted = new Set(names.map(fold));
  return REGION_SHAPES.find(shape => (!shape.iso || !iso || shape.iso === iso)
    && [...shape.names].some(n => wanted.has(n) || wanted.has(n.replace(/ (state|province|region|prefecture|oblast|county)$/, '')))
    && contains(shape, position));
}

// Tre store byer i utsnittet, i grått, så en ser hvor nålen er; ikke oppå nålen, hverandre eller kanten
function cityLabels(project, [px, py], ownNames) {
  const skip = new Set(ownNames.map(fold));
  const size = 18, placed = [{ x: px - 26, y: py - 26, w: 52, h: 52 }];
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const out = [];
  for (const city of CITIES) {
    if (out.length >= 3) break;
    if (skip.has(fold(city.name))) continue;
    const [x, y] = project(city.lon, city.lat);
    if (x < PANEL + 20 || x > W - 20 || y < 20 || y > H - 20) continue;
    const w = textWidth(city.name, 'regular', size);
    const box = [{ x: x + 8, y: y - size / 2 - 2, w, h: size + 4 }, { x: x - 8 - w, y: y - size / 2 - 2, w, h: size + 4 }]
      .find(b => b.x > PANEL + 10 && b.x + b.w < W - 10 && !placed.some(p => hits(b, p) || hits({ x: x - 5, y: y - 5, w: 10, h: 10 }, p)));
    if (!box) continue;
    placed.push(box, { x: x - 5, y: y - 5, w: 10, h: 10 });
    out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="3.5" fill="${C.inkSoft}" /><text x="${r1(box.x)}" y="${r1(y + size * 0.36)}" font-family="Archivo Regular" font-size="${size}" fill="${C.inkSoft}" stroke="${C.land}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${esc(city.name)}</text>`);
  }
  return out.join('');
}

// Utsnittet rammes inn etter den største flaten i omrisset (fastlandet; Aleutene krysser datolinjen)
function extentOf(shape) {
  const ring = shape.polygons.map(polygon => polygon[0] ?? []).sort((a, b) => b.length - a.length)[0];
  const [w, s, e, n] = boxOf([ring]);
  return e - w > 170 ? [] : [[w, s], [e, n]];
}

const mercY = lat => -Math.log(Math.tan(Math.PI / 4 + (Math.max(-80, Math.min(80, lat)) * Math.PI) / 360)) / (2 * Math.PI);
const mercator = (lon, lat) => [lon / 360, mercY(lat)];
const unMercY = y => (Math.atan(Math.exp(-y * 2 * Math.PI)) - Math.PI / 4) * 360 / Math.PI;

// Kartutsnittet: alle punktene med luft rundt, minst et visst spenn så ett sted får land rundt seg
function frame(points, minSpanDeg) {
  const merc = points.map(([lon, lat]) => mercator(lon, lat));
  let [minX, maxX] = [Math.min(...merc.map(p => p[0])), Math.max(...merc.map(p => p[0]))];
  let [minY, maxY] = [Math.min(...merc.map(p => p[1])), Math.max(...merc.map(p => p[1]))];
  const pad = { left: 70, right: 70, top: 70, bottom: 70 };
  const areaW = W - PANEL - pad.left - pad.right, areaH = H - pad.top - pad.bottom;
  const minSpan = minSpanDeg / 360;
  const grow = (lo, hi, span) => { const mid = (lo + hi) / 2; return [mid - span / 2, mid + span / 2]; };
  if (maxX - minX < minSpan) [minX, maxX] = grow(minX, maxX, minSpan);
  if (maxY - minY < minSpan * (areaH / areaW)) [minY, maxY] = grow(minY, maxY, minSpan * (areaH / areaW));
  const scale = Math.min(areaW / (maxX - minX), areaH / (maxY - minY));
  const offsetX = PANEL + pad.left - minX * scale + (areaW - (maxX - minX) * scale) / 2;
  const offsetY = pad.top - minY * scale + (areaH - (maxY - minY) * scale) / 2;
  const project = (lon, lat) => { const [x, y] = mercator(lon, lat); return [x * scale + offsetX, y * scale + offsetY]; };
  // Det synlige området i grader, for å velge land og målestokk
  const lonAt = x => ((x - offsetX) / scale) * 360;
  const view = [lonAt(PANEL), unMercY((H - offsetY) / scale), lonAt(W), unMercY((0 - offsetY) / scale)];
  return { project, view };
}

const visible = ([w, s, e, n], box) => !(box[2] < w || box[0] > e || box[3] < s || box[1] > n);

// En linje i pikselkoordinater, uten punkter som faller på samme piksel
function line(project, points, close) {
  let d = '', prev = '';
  points.forEach(([lon, lat], index) => {
    const [x, y] = project(lon, lat);
    const point = `${Math.round(x)} ${Math.round(y)}`;
    if (index && point === prev) return;
    d += `${index ? 'L' : 'M'}${point}`;
    prev = point;
  });
  return close ? `${d}Z` : d;
}

function landPath(project, view) {
  const span = view[2] - view[0];
  const countries = span < 20 ? WORLD.detail : span < 70 ? WORLD.fine : WORLD.coarse;
  return countries.filter(({ box }) => visible(view, box))
    .flatMap(({ polygons }) => polygons.flatMap(polygon => polygon.map(ring => line(project, ring, true)))).join('');
}

// Små innsjøer og elver bare når kartet er nært; ellers de store
function waterPaths(project, view) {
  const span = view[2] - view[0];
  if (span >= 70) return { lakes: '', rivers: '', width: 0 };
  const maxRank = span < 5 ? 10 : span < 20 ? 7 : 4;
  const lakes = LAKES.filter(lake => lake.rank <= maxRank && visible(view, lake.box))
    .flatMap(({ polygons }) => polygons.flatMap(polygon => polygon.map(ring => line(project, ring, true)))).join('');
  const rivers = RIVERS.filter(river => river.rank <= maxRank && visible(view, river.box))
    .flatMap(({ lines }) => lines.map(points => line(project, points, false))).join('');
  return { lakes, rivers, width: span < 5 ? 3 : span < 20 ? 1.6 : 1 };
}

const MARK = `<g transform="translate(64 60) scale(0.4)">
  <polygon points="0,16 24,24 24,96 0,88" fill="${C.ink}" /><polygon points="28,24 58,0 58,72 28,96" fill="${C.ink}" />
  <polygon points="62,0 92,24 92,96 62,72" fill="${C.ink}" /><polygon points="96,24 120,16 120,88 96,96" fill="${C.accent}" /></g>`;

/**
 * Tegner et kort og returnerer PNG-en.
 * @param {{ kicker: string, title: string, lines: Array<{ text: string, strong?: boolean }>,
 *   pins: Array<[number, number]>, numbered?: boolean, context?: Array<[number, number]>, minSpan?: number }} card
 */
// PNG-en får en palett på 64 farger: kartet er flate farger, og fila blir en tredel så stor (≈20 kB)
const used = new Set();
// Sletter kortene ingen side brukte i dette bygget, så mellomlageret ikke vokser for hver endring
export function pruneCache() {
  for (const file of fs.readdirSync(CACHE)) if (!used.has(file)) fs.rmSync(path.join(CACHE, file));
}

export async function renderCard(card) {
  const svg = cardSvg(card);
  const key = crypto.createHash('sha256').update(VERSION).update(svg).digest('hex').slice(0, 24);
  const cached = path.join(CACHE, `${key}.png`);
  used.add(`${key}.png`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  const full = new Resvg(svg, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Archivo Semi' },
    fitTo: { mode: 'width', value: W },
  }).render().asPng();
  const png = await sharp(full).png({ palette: true, colors: 64, quality: 90, effort: 10 }).toBuffer();
  fs.writeFileSync(cached, png);
  return png;
}

// Nålene: én for et sted, prikker for flere, tall for en reiserute eller en klynge (lest på en telefon, så store)
const R = { single: 18, dot: 13, count: 20 };

// Stoppene som ligger oppå hverandre samles i én nål med antallet, til ingen nåler overlapper
function clusters(points) {
  const groups = points.map(([x, y], i) => ({ x, y, members: [i] }));
  const radius = group => (group.members.length > 1 ? R.count : R.dot);
  for (;;) {
    let pair = null;
    for (let i = 0; i < groups.length && !pair; i++) for (let j = i + 1; j < groups.length && !pair; j++) {
      if (Math.hypot(groups[i].x - groups[j].x, groups[i].y - groups[j].y) < radius(groups[i]) + radius(groups[j]) + 4) pair = [i, j];
    }
    if (!pair) return groups;
    const [a, b] = [groups[pair[0]], groups[pair[1]]];
    const [na, nb] = [a.members.length, b.members.length];
    groups[pair[0]] = { x: (a.x * na + b.x * nb) / (na + nb), y: (a.y * na + b.y * nb) / (na + nb), members: [...a.members, ...b.members] };
    groups.splice(pair[1], 1);
  }
}

// Navnet på en klynge: den delen av navnene flest har felles («Paris» for Notre-Dame, Paris, France og Paris, France)
function groupName(names) {
  const parts = names.map(name => {
    const segments = name.replace(/ \((?:fictional|legendary)\)$/, '').split(', ');
    return segments.length > 1 ? segments.slice(0, -1) : segments;
  });
  if (parts.length === 1) return parts[0][0];
  const counts = new Map();
  for (const segments of parts) for (const segment of new Set(segments)) counts.set(segment, (counts.get(segment) ?? 0) + 1);
  const [best, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (count > 1) return best;
  // Ingen felles by: landet om de deler det, ellers intet navn (ti baner over Europa er ikke «Silverstone»)
  const countries = new Set(names.map(name => name.replace(/ \((?:fictional|legendary)\)$/, '').split(', ').at(-1)));
  return countries.size === 1 ? [...countries][0] : null;
}

// Navn ved nålene: til høyre, så venstre, over og under; et navn som ikke får plass uten å dekke noe, droppes
function labelSvg(items, pins) {
  const size = 21, placed = [];
  const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const out = [];
  for (const { x, y, r, text } of items) {
    if (placed.length >= 8) break;
    const w = textWidth(text, 'semi', size), h = size;
    const candidates = [
      { x: x + r + 7, y: y - h / 2 }, { x: x - r - 7 - w, y: y - h / 2 },
      { x: x - w / 2, y: y - r - 6 - h }, { x: x - w / 2, y: y + r + 6 },
    ];
    const box = candidates.map(c => ({ ...c, w, h })).find(b =>
      b.x > PANEL + 10 && b.x + b.w < W - 10 && b.y > 10 && b.y + b.h < H - 10
      && !placed.some(p => hits(b, p))
      && !pins.some(p => !(p.x === x && p.y === y) && hits(b, { x: p.x - p.r, y: p.y - p.r, w: 2 * p.r, h: 2 * p.r })));
    if (!box) continue;
    placed.push(box);
    out.push(`<text x="${r1(box.x)}" y="${r1(box.y + h * 0.78)}" font-family="Archivo Semi" font-size="${size}" fill="${C.ink}" stroke="${C.land}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(text)}</text>`);
  }
  return out.join('');
}

export function cardSvg(card) {
  const { kicker, title, lines, pins, names = [], numbered = false, context = [], minSpan = 6, places, shape: hint } = card;
  const own = hint && findShape({ ...hint, position: pins[0] });
  const extent = own ? extentOf(own) : [];
  // Ett sted får land rundt seg (14 grader). Flere steder vises fra 6 grader; ligger alle i samme by, blir de
  // én nål med antallet og samme utsnitt som ett sted, så kortet viser hvor i verden det er og ikke en tom bygate
  const single = pins.length === 1;
  let framed = frame([...pins, ...extent], single ? Math.max(minSpan, 14) : minSpan);
  let pinPoints = pins.map(([lon, lat]) => framed.project(lon, lat));
  let groups = clusters(pinPoints);
  if (!single && groups.length === 1) {
    framed = frame(pins, 14);
    pinPoints = pins.map(([lon, lat]) => framed.project(lon, lat));
    groups = clusters(pinPoints);
    // En reise som holder seg i én by, vises som byen med alle spillets steder, også dem ruten ikke går innom
    if (numbered && places) return cardSvg({ ...card, pins: places.pins, names: places.names, numbered: false, places: undefined });
  }
  const { project, view } = framed;
  const land = landPath(project, view);
  const water = waterPaths(project, view);
  const inMap = ([x, y]) => x > PANEL + 4 && x < W - 4 && y > 4 && y < H - 4;
  const nearby = new Map();
  for (const p of context.map(([lon, lat]) => project(lon, lat)).filter(inMap)) nearby.set(`${Math.round(p[0] / 6)}:${Math.round(p[1] / 6)}`, p);
  const dimmed = [...nearby.values()].filter(([x, y]) => !pinPoints.some(([px, py]) => Math.hypot(x - px, y - py) < 10)).slice(0, 400);
  const ownPath = own ? own.polygons.flatMap(polygon => polygon.map(ring => line(project, ring, true))).join('') : '';
  const cities = hint ? cityLabels(project, pinPoints[0], [...(hint.names ?? [])]) : '';

  // Venstre ark: merket øverst, så kicker, tittel og linjene samlet nederst
  const textW = PANEL - 64 - 48;
  let size = 66, wrapped;
  for (const candidate of [66, 58, 50, 44, 38]) {
    size = candidate;
    wrapped = wrap(title, 'bold', size, textW, 3);
    if (wrapped.fits) break;
  }
  const lineH = size * 1.0;
  const infoSize = 22, infoH = 31;
  const info = lines.flatMap(line => wrap(line.text, line.strong ? 'semi' : 'regular', infoSize, textW, 2).lines.map(text => ({ text, strong: line.strong })));
  const bottom = H - 56;
  const infoTop = bottom - info.length * infoH + 22;
  const ruleY = infoTop - 30;
  const titleBase = ruleY - 28;
  const titleTop = titleBase - (wrapped.lines.length - 1) * lineH;
  const kickerY = titleTop - size * 0.82 - 16;

  // En reiserute får nummererte stopp når de ikke overlapper; ellers linja med prikker, og ligger alt i én by,
  // bare klyngen. Andre spill får prikker og klynger
  const crowded = groups.length < pinPoints.length;
  const route = numbered && !single && groups.length > 1;
  const numberedPins = route && !crowded && pins.length <= 30;
  const numberPin = (x, y, label, r) => `<g transform="translate(${r1(x)} ${r1(y)})"><circle r="${r}" fill="${C.accent}" stroke="${C.sheet}" stroke-width="3" /><text y="${String(label).length > 1 ? 5.5 : 6.5}" font-family="Archivo Bold" font-size="${String(label).length > 1 ? 16 : 19}" fill="#fff" text-anchor="middle">${label}</text></g>`;
  const dot = (x, y, r) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${C.accent}" stroke="${C.sheet}" stroke-width="3" />`;
  const routeSvg = route ? `<path d="${pinPoints.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')}" fill="none" stroke="${C.accent}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" />` : '';
  let marks, labelled;
  if (single) {
    marks = [{ x: pinPoints[0][0], y: pinPoints[0][1], r: R.single, svg: dot(...pinPoints[0], R.single), members: [0] }];
  } else if (numberedPins) {
    const seen = new Set();
    marks = pinPoints.map(([x, y], i) => ({ x, y, r: R.count, svg: numberPin(x, y, i + 1, R.count), members: seen.has(names[i]) ? [] : (seen.add(names[i]), [i]) }));
  } else if (route) {
    marks = groups.map(({ x, y, members }) => ({ x, y, r: R.dot, svg: '', members }));
    marks.unshift(...pinPoints.map(([x, y]) => ({ x, y, r: R.dot, svg: dot(x, y, R.dot), members: [] })));
  } else {
    marks = groups.map(({ x, y, members }) => {
      // Antallet er stedene, ikke stoppene: en rute som kommer tilbake til samme sted, teller det én gang
      const places = new Set(members.map(i => names[i] ?? i)).size;
      const r = places > 1 ? R.count : R.dot;
      return { x, y, r, svg: places > 1 ? numberPin(x, y, places, r) : dot(x, y, r), members };
    });
  }
  // Spillkortene får navn ved nålene, de største klyngene først; kort for et sted har navnet i tittelen og får ingen
  if (names.length) {
    labelled = labelSvg(marks.filter(m => m.members.length).sort((a, b) => b.members.length - a.members.length)
      .map(m => ({ ...m, text: groupName(m.members.map(i => names[i])) })).filter(m => m.text), marks);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${C.sea}" />
<path d="${land}" fill="${C.land}" stroke="${C.border}" stroke-width="0.8" stroke-linejoin="round" />
${water.lakes ? `<path d="${water.lakes}" fill="${C.sea}" />` : ''}
${water.rivers ? `<path d="${water.rivers}" fill="none" stroke="${C.sea}" stroke-width="${water.width}" stroke-linejoin="round" stroke-linecap="round" />` : ''}
${ownPath ? `<clipPath id="land"><path d="${land}" /></clipPath><path d="${ownPath}" clip-path="url(#land)" fill="${C.accent}" fill-opacity="${own.rough ? 0.16 : 0.13}"${own.rough ? '' : ` stroke="${C.accent}" stroke-opacity="0.55" stroke-width="1.6" stroke-linejoin="round"`} />` : ''}
<g fill="${C.dimmed}" fill-opacity="0.75">${dimmed.map(([x, y]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="3.5" />`).join('')}</g>
${cities}${routeSvg}${marks.map(m => m.svg).join('')}${labelled ?? ''}
<rect width="${PANEL}" height="${H}" fill="${C.sheet}" /><rect x="${PANEL}" width="1" height="${H}" fill="${C.rule}" />
${MARK}
<text x="122" y="94" font-family="Archivo Bold" font-size="36" fill="${C.ink}" letter-spacing="-0.5">Game<tspan font-family="Newsreader Italic" font-size="40" dx="3">Traveler</tspan></text>
<text x="64" y="${r1(kickerY)}" font-family="Archivo Semi" font-size="17" letter-spacing="1.6" fill="${C.inkSoft}">${esc(kicker.toUpperCase())}</text>
${wrapped.lines.map((line, i) => `<text x="64" y="${r1(titleTop + i * lineH)}" font-family="Archivo Bold" font-size="${size}" fill="${C.ink}">${esc(line)}</text>`).join('\n')}
<rect x="64" y="${r1(ruleY)}" width="${textW}" height="1" fill="${C.rule}" />
${info.map((line, i) => `<text x="64" y="${r1(infoTop + i * infoH)}" font-family="${line.strong ? 'Archivo Semi' : 'Archivo Regular'}" font-size="${infoSize}" fill="${line.strong ? C.ink : C.inkSoft}">${esc(line.text)}</text>`).join('\n')}
</svg>`;
}
