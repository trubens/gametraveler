// Én fil per spill reduserer mergekonflikter når flere bidrar samtidig.
import type { GameRoute } from './routes.ts';
export { hasOrderedRoute } from './routes.ts';

export type PlaceRecord = {
  // Stable, human-readable key derived when the place is first added.
  id: string;
  name: string;
  scale: 'area' | 'site';
  placeType: PlaceType;
  parentId?: string;
  aliases?: string[];
  position: Coordinates;
  source?: string;
  // Optional curated article and stable Wikidata entity reference.
  wikipediaUrl?: string;
  wikidataId?: string;
  // En setning eller to om hva stedet er, vist i stedspanelet (scripts/enrich-place-descriptions.mjs
  // henter dem fra Wikipedia-sammendraget; skriv gjerne egne)
  description?: string;
  // «wikipedia» når teksten er artikkelens sammendrag (krediteres i panelet); håndskrevet tekst har ingen
  descriptionSource?: 'wikipedia';
  // Stedet er diktet opp av spillet (Big Shell) eller hentet fra en legende (Zerzura). Det står ikke i navnet:
  // «(fictional)» lages av placeLabel, så navnet er bare navnet og merkelappen er den samme overalt.
  fictional?: boolean;
  legendary?: boolean;
};

// Navnet slik det vises og blir til adresse: «Big Shell, New York (fictional)». Adressene til oppdiktede steder
// har alltid hatt haken, så de består.
export const placeLabel = (record: Pick<PlaceRecord, 'name' | 'fictional' | 'legendary'>) =>
  record.legendary ? `${record.name} (legendary)` : record.fictional ? `${record.name} (fictional)` : record.name;
export const isInvented = (record: { fictional?: boolean; legendary?: boolean }) => !!(record.fictional || record.legendary);

export type PlaceType = 'country' | 'city' | 'region' | 'neighborhood' | 'island' | 'natural_feature' | 'body_of_water' | 'landmark' | 'venue' | 'area';

export type Coordinates = { lat: number; lon: number };

export type GameLocationReference = {
  placeId: string;
  // Game-specific names such as an in-game alias.
  aliases?: string[];
  // Only set when this game uses a verified point different from the canonical place point.
  positionOverride?: Coordinates;
  // Omitted values are real; fictionalized places have a real-world geographic anchor.
  settingType?: 'real' | 'fictionalized' | 'imaginary';
  // Én setning om hvorfor stedet er med i spillet
  note?: string;
  // Source specifically supporting this location when the game-level source is not enough.
  source?: string;
};

export type Location = {
  placeId: string;
  name: string;
  scale: 'area' | 'site';
  placeType: PlaceType;
  parentId?: string;
  aliases?: string[];
  position: [number, number];
  settingType?: 'real' | 'fictionalized' | 'imaginary';
  note?: string;
  source?: string;
  wikipediaUrl?: string;
  wikidataId?: string;
  fictional?: boolean;
  legendary?: boolean;
};

export type Game = {
  id: number;
  name: string;
  aliases?: string[];
  // Serien spillet hører til (Broken Sword, Forza Horizon); satt i dataene, ikke gjettet fra tittelen
  series?: string;
  // Dato spillet sist ble sjekket mot kildene (steder, notater, rute, år); settes av add-game-skillet
  reviewed?: string;
  genres: string[];
  year: number;
  publisher: string;
  publisherUrl?: string;
  developer: string;
  developerUrl?: string;
  // Settes av scripts/fetch-covers.mjs
  coverUrl?: string;
  // Kilden dataene er sjekket mot
  source: string;
  // True only when the listed locations form a verified ordered journey.
  route?: boolean;
  routes?: GameRoute[];
  locations: Location[];
  storyYears: number[];
};

type GameRecord = Omit<Game, 'locations'> & { locations: GameLocationReference[] };
// Kjernen (scripts/catalog-plugin.mjs): alt kartet trenger for å tegne seg. Notater, kilder, lenker og
// stedsbeskrivelser kommer med loadCatalogDetails rett etter første visning og legges inn i de samme objektene.
import catalogCore from 'virtual:catalog-core';
type GameDetails = Pick<Game, 'source' | 'publisherUrl' | 'developerUrl'> & {
  locations?: Array<Pick<GameLocationReference, 'note' | 'source'> | null>;
  routes?: Array<Pick<GameRoute, 'note' | 'source'> | null>;
};
type PlaceDetails = Pick<PlaceRecord, 'description' | 'descriptionSource' | 'source' | 'wikipediaUrl' | 'wikidataId'>;
export type CatalogDetails = { games: Record<string, GameDetails>; places: Record<string, PlaceDetails> };
const core = catalogCore as { games: GameRecord[]; places: PlaceRecord[] };

export const places = core.places.map(record => ({ ...record, name: placeLabel(record) })).sort((a, b) => a.name.localeCompare(b.name));
const placesByKey = new Map(places.map(place => [place.id, place]));
export const games: Game[] = core.games.map(game => ({
  ...game,
  source: game.source ?? '',
  locations: game.locations.map(reference => {
    const place = placesByKey.get(reference.placeId);
    if (!place) throw new Error(`${game.name} refers to missing place key ${reference.placeId}`);
    return {
      ...place,
      ...reference,
      aliases: [...new Set([...(place.aliases ?? []), ...(reference.aliases ?? [])])],
      position: toMapPosition(reference.positionOverride ?? place.position),
    };
  }),
})).sort((a, b) => a.id - b.id);

// Legger detaljene inn i spill- og stedsobjektene som allerede er i bruk, så alt som holder på dem
// (panelene, søket etter at det er bygget på nytt) ser dem. Kalles én gang.
export function applyCatalogDetails(details: CatalogDetails) {
  for (const place of places) Object.assign(place, details.places[place.id] ?? {});
  for (const game of games) {
    const { locations, routes, ...own } = details.games[game.id] ?? {};
    Object.assign(game, own);
    game.locations.forEach((location, index) => {
      const place = placesByKey.get(location.placeId);
      const extra = locations?.[index];
      location.note = extra?.note;
      location.source = extra?.source ?? place?.source;
      location.wikipediaUrl = place?.wikipediaUrl;
      location.wikidataId = place?.wikidataId;
    });
    game.routes?.forEach((route, index) => Object.assign(route, routes?.[index] ?? {}));
  }
}

let detailsLoaded = false;
let detailsPromise: Promise<void> | undefined;
const detailListeners = new Set<() => void>();
export const catalogDetailsLoaded = () => detailsLoaded;
export const subscribeCatalogDetails = (listener: () => void) => {
  detailListeners.add(listener);
  return () => { detailListeners.delete(listener); };
};
export function loadCatalogDetails(): Promise<void> {
  detailsPromise ??= import('virtual:catalog-details').then(module => {
    applyCatalogDetails(module.default as CatalogDetails);
    detailsLoaded = true;
    detailListeners.forEach(listener => listener());
  });
  return detailsPromise;
}

function toMapPosition(position: Coordinates): [number, number] {
  return [position.lat, position.lon];
}

// Et sted på nivå to: en site-post med en by, bydel, region eller øy som forelder (parken i Lisboa).
// Kartet viser det først fra zoom 12, og panelet lister det under byen.
const placeRecordById = new Map(places.map(record => [record.id, record]));
// Bare byer og bydeler: en kirke i Cornwall eller et slott i Bayern er et sted for seg, ikke «inne i» regionen.
// Med region og område på lista fikk Barrow Hill en oppdiktet rad «Cornwall, England» med stedene under.
const SPOT_PARENT_TYPES = new Set<PlaceType>(['city', 'neighborhood']);
// Google Maps-lenke for et sted. Byer, bygg og punkter lenkes med koordinatene, så nåla lander der vår
// nål står. Land, regioner, øyer og hav lenkes med navnet: en koordinat midt i et land er bare et tomt
// punkt på kartet, mens et navnesøk gir Googles egen omrissing og stedskort (endret 1. november 2026).
// Oppdiktede steder får ingen lenke: nåla deres er vår plassering, ikke et sted å finne.
const BROAD_TYPES = new Set<PlaceType>(['country', 'region', 'natural_feature', 'body_of_water', 'island', 'area']);
// Et sted i et spill kan besøkes (Been here / Want to go) når det verken er rent imaginært eller diktet opp
export const isVisitableLocation = (loc: { settingType?: string; fictional?: boolean; legendary?: boolean }) => (loc.settingType ?? 'real') !== 'imaginary' && !isInvented(loc);
export const googleMapsUrl = (record: Pick<PlaceRecord, 'name' | 'position' | 'scale' | 'placeType' | 'fictional' | 'legendary'>) => {
  if (isInvented(record)) return undefined;
  if (record.scale !== 'site' && BROAD_TYPES.has(record.placeType)) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(record.name)}`;
  const zoom = record.scale === 'site' ? 16 : 11;
  return `https://www.google.com/maps?q=${record.position.lat},${record.position.lon}&z=${zoom}`;
};

export const spotParentOf = (loc: Pick<Location, 'scale' | 'parentId'>) => {
  if (loc.scale !== 'site' || !loc.parentId) return undefined;
  const parent = placeRecordById.get(loc.parentId);
  return parent && SPOT_PARENT_TYPES.has(parent.placeType) ? parent : undefined;
};
// Antall steder i et spill slik panelet teller dem: nivå to teller som byen sin (parken er «1 place», Lisboa)
export const topLevelPlaceCount = (game: Game) => {
  const keys = new Set<string>();
  for (const loc of game.locations) keys.add(spotParentOf(loc)?.id ?? loc.placeId);
  return keys.size;
};

// Seriene: navn → spillene i årsrekkefølge. Bare serier med minst to spill i katalogen teller.
export const seriesGames: Map<string, Game[]> = (() => {
  const out = new Map<string, Game[]>();
  for (const game of games) if (game.series) out.set(game.series, [...(out.get(game.series) ?? []), game]);
  for (const [name, list] of out) {
    if (list.length < 2) out.delete(name);
    else list.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  }
  return out;
})();
export const seriesSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const seriesBySlug = new Map([...seriesGames.keys()].map(name => [seriesSlug(name), name]));
