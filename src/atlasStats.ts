// Tall og lister for «My atlas», regnet ut fra markeringene og de faste stedsdataene.
import { places as canonicalPlaces } from './gameData';
import type { Atlas } from './myAtlas';
import { slugify } from './format';
import placeCountries from './data/generated/place-countries.json';
import countryLabels from './data/generated/country-labels.json';

type Position = [number, number];
// Steder og spill filtreres hver for seg; begge kan være valgt samtidig
export type PlaceFilter = 'been' | 'want' | 'not-been';
export type GameFilter = 'played' | 'want' | 'not-played';
export type AtlasFilter = { place: PlaceFilter | null; game: GameFilter | null };
export const NO_ATLAS_FILTER: AtlasFilter = { place: null, game: null };

// Et kartpunkt (samme posisjon) kan ha flere sted-id-er; tallene og listene teller punkter, ikke id-er
// «via» er tomt for steder du selv har markert, og ellers stedene inni som gir markeringen («Bangkok» for Thailand)
export type AtlasPlace = { key: string; name: string; position: Position; ids: string[]; via: string[] };

const pointKey = (position: Position) => `${position[0].toFixed(5)},${position[1].toFixed(5)}`;

// Har du vært i Bangkok, har du vært i Thailand. Et sted arver «been here» fra stedene inni det:
// via parentId, og via navnet («Bangkok, Thailand» ligger i stedet som heter Thailand).
const placeById = new Map(canonicalPlaces.map(place => [place.id, place]));
const strip = (name: string) => name.replace(/\s*\([^)]*\)/g, '');
const areaByName = new Map<string, string>();
for (const place of canonicalPlaces) {
  if (!['country', 'region', 'island'].includes(place.placeType)) continue;
  for (const name of [strip(place.name).split(',')[0], ...(place.aliases ?? [])]) areaByName.set(name.trim().toLowerCase(), place.id);
}
const ancestorCache = new Map<string, string[]>();
export function ancestorsOf(id: string): string[] {
  const cached = ancestorCache.get(id);
  if (cached) return cached;
  const out = new Set<string>();
  const visit = (current: string) => {
    const place = placeById.get(current);
    if (!place) return;
    const next = new Set<string>();
    if (place.parentId) next.add(place.parentId);
    for (const segment of strip(place.name).split(',').slice(1)) {
      const hit = areaByName.get(segment.trim().toLowerCase());
      if (hit) next.add(hit);
    }
    for (const parent of next) {
      if (parent === id || out.has(parent)) continue;
      out.add(parent);
      visit(parent);
    }
  };
  visit(id);
  const list = [...out];
  ancestorCache.set(id, list);
  return list;
}

// Alle sted-id-er som teller som besøkt: de markerte og alt de ligger i. «via» sier hvilke markerte steder som gir det.
type BeenIndex = { been: Set<string>; via: Map<string, string[]> };
const beenCache = new WeakMap<Atlas, BeenIndex>();
export function beenIndex(atlas: Atlas): BeenIndex {
  const cached = beenCache.get(atlas);
  if (cached) return cached;
  const been = new Set<string>();
  const via = new Map<string, string[]>();
  for (const [id, mark] of Object.entries(atlas.places)) {
    if (!mark.been) continue;
    been.add(id);
    for (const ancestor of ancestorsOf(id)) {
      been.add(ancestor);
      const name = strip(placeById.get(id)?.name ?? id).split(',')[0].trim();
      const list = via.get(ancestor) ?? [];
      if (!list.includes(name)) via.set(ancestor, [...list, name]);
    }
  }
  const index = { been, via };
  beenCache.set(atlas, index);
  return index;
}

// Markeringen for et kartpunkt (flere id-er), med arv: been vinner over want, og «via» lister stedene som gir arven
export function placeMarkFor(atlas: Atlas, ids: Iterable<string>) {
  const index = beenIndex(atlas);
  let been = false;
  let want = false;
  let explicit = false;
  const via: string[] = [];
  for (const id of ids) {
    if (atlas.places[id]?.been) explicit = true;
    if (index.been.has(id)) been = true;
    if (atlas.places[id]?.want) want = true;
    for (const name of index.via.get(id) ?? []) if (!via.includes(name)) via.push(name);
  }
  return { been, want: want && !been, explicit, via };
}

export type AtlasPlaceOptions = { implied?: boolean };
export function atlasPlaces(atlas: Atlas, field: 'been' | 'want', { implied = true }: AtlasPlaceOptions = {}): AtlasPlace[] {
  const byPoint = new Map<string, AtlasPlace>();
  const index = beenIndex(atlas);
  // Et punkt du har vært på, er ikke også et du vil til, selv om én av id-ene der sier det
  const beenKeys = field === 'want' ? new Set(atlasPlaces(atlas, 'been').map(place => place.key)) : undefined;
  for (const record of canonicalPlaces) {
    const marked = field === 'been' && implied ? index.been.has(record.id) : !!atlas.places[record.id]?.[field];
    if (!marked) continue;
    if (beenKeys?.has(pointKey([record.position.lat, record.position.lon]))) continue;
    const position: Position = [record.position.lat, record.position.lon];
    const key = pointKey(position);
    const existing = byPoint.get(key);
    if (existing) existing.ids.push(record.id);
    else byPoint.set(key, { key, name: record.name, position, ids: [record.id], via: [] });
  }
  for (const place of byPoint.values()) {
    const mark = placeMarkFor(atlas, place.ids);
    place.via = mark.explicit ? [] : mark.via;
  }
  return [...byPoint.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Antall markeringer: kartpunkter med en stedsmarkering pluss spill med en spillmarkering
export const atlasTotal = (atlas: Atlas) =>
  new Set([...atlasPlaces(atlas, 'been', { implied: false }), ...atlasPlaces(atlas, 'want')].map(place => place.key)).size + Object.keys(atlas.games).length;

const PLACE_FILTER_TEXT: Record<PlaceFilter, string> = {
  'been': "places you've been",
  'want': 'places you want to go',
  'not-been': "places you haven't been",
};
const GAME_FILTER_TEXT: Record<GameFilter, string> = {
  'played': "games you've played",
  'want': 'games you want to play',
  'not-played': "games you haven't played",
};

// «places you've been, in games you've played»
export function atlasFilterText(filter: AtlasFilter): string | null {
  const place = filter.place && PLACE_FILTER_TEXT[filter.place];
  const game = filter.game && GAME_FILTER_TEXT[filter.game];
  if (place && game) return `${place}, in ${game}`;
  if (game) return `the places of ${game}`;
  return place || null;
}

// Landene som finnes som flate på kartet: navnet fra Natural Earth og punktet der navnet står (lat, lon)
const countryShapes = countryLabels as unknown as Record<string, { name: string; label: [number, number]; area: number }>;
export const countryLabel = (iso: string): [number, number] | undefined => countryShapes[iso]?.label;
// Småstater (under 2 grader² i areal) er bare en prikk som flate i verdensutsnittet, så de beholder nålen
export const countrySmall = (iso: string) => (countryShapes[iso]?.area ?? Infinity) < 2;
export const countryName = (iso: string): string | undefined => countryShapes[iso]?.name;

// Stedsposten som står for et land: helst en post av typen land med landets eget navn («United Kingdom» foran
// «England, UK»); ellers en post som heter det landet heter, slik Grønland er en øy i dataene
const countryRecordByIso = new Map<string, { id: string; name: string }>();
for (const place of canonicalPlaces) {
  if (place.placeType !== 'country') continue;
  const iso = (placeCountries as Record<string, string | null>)[place.id];
  if (!iso) continue;
  const current = countryRecordByIso.get(iso);
  const plain = !place.name.includes(',');
  if (!current || (plain && (current.name.includes(',') || place.name.length < current.name.length))) countryRecordByIso.set(iso, { id: place.id, name: place.name });
}
for (const [iso, shape] of Object.entries(countryShapes)) {
  if (countryRecordByIso.has(iso)) continue;
  const place = canonicalPlaces.find(p => !p.name.includes(',') && p.name.toLowerCase() === shape.name.toLowerCase());
  if (place) countryRecordByIso.set(iso, { id: place.id, name: place.name });
}
export const countryRecord = (iso: string) => countryRecordByIso.get(iso);
// Det landet heter i appen: postens navn, ellers Natural Earth sitt
export const countryTitle = (iso: string) => countryRecord(iso)?.name ?? countryName(iso) ?? iso;
export const countryBySlug = (slug: string) =>
  Object.keys(countryShapes).map(iso => [iso, countryTitle(iso)] as const).find(([, name]) => slugify(name) === slug);

// Landkoden (ISO 3166-1 alpha-2) stedet ligger i, fra scripts/build-countries.mjs
export const countryOf = (placeId: string): string | undefined => (placeCountries as Record<string, string | null>)[placeId] ?? undefined;

// Landene du har vært i: alle markerte steder (og det de arver) slått sammen på land
export function beenCountries(atlas: Atlas): Set<string> {
  const out = new Set<string>();
  for (const id of beenIndex(atlas).been) {
    const iso = countryOf(id);
    if (iso) out.add(iso);
  }
  return out;
}
