import { MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import L from 'leaflet';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { NIGHT, WATER, toneColorText } from './basemapTone';
import { type ThemeChoice, getIsDark, readThemeChoice, saveThemeChoice, useIsDark } from './theme';
import { ArrowUpRight, BookMarked, Check, Coffee, Compass, Gamepad2, Layers, Shuffle, Info, List, LocateFixed, MapPin, MoreHorizontal, RotateCcw, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import './App.css';
import './atlas.css';

import { catalogDetailsLoaded, loadCatalogDetails, subscribeCatalogDetails, games, Game, Location, places as canonicalPlaces, PlaceType, spotParentOf, googleMapsUrl, isInvented, isVisitableLocation, seriesGames, seriesSlug, seriesBySlug } from './gameData';
import { getGameRoutes, routeStyle, type ResolvedRoute } from './routes';
import { Basemap } from './Basemap';
import { AtlasBrand } from './AtlasBrand';
import { MyAtlasPanel } from './MyAtlasPanel';
import { type AtlasFilter, type GameFilter, NO_ATLAS_FILTER, type PlaceFilter, ancestorsOf, atlasFilterText, atlasPlaces, atlasTotal, beenCountries, countryBySlug, countryLabel, countryOf, countryRecord, countrySmall, countryTitle, placeMarkFor } from './atlasStats';
import { COUNTRY_SHAPES_HIDE_ZOOM, type CountryPlace, CountryShapes } from './CountryShapes';
import { markCount, restoreCleared, useMyAtlas } from './myAtlas';
import { type AtlasCatalog, atlasToCsv, importCsv } from './atlasFiles';
import { type AtlasDialog, AtlasDialogs, type AtlasToast, AtlasToastMessage } from './MyAtlasDialogs';
import { IndexPlace, LocationFlyout, NearbyPlace, PanelSection, SHEET_PEEK_HEIGHT } from './LocationFlyout';
import { DoubleRangeSlider, Scale } from './DoubleRangeSlider';
import { count, distanceKm, eraSpan, shortName, slugify } from './format';
import { pageKey, readUrl, writeUrl, UrlState } from './url';
import { shortestLongitudeSpan } from './geo';
import { createGameSearch, filterSearchResults, normalizeSearch, searchPositions, type SearchHit } from './search';

type Position = [number, number];
// spots: steder på nivå to inne i dette stedet (parken i Lisboa), per spill; spot: dette stedet er selv et slikt
type Place = { position: Position; name: string; games: Game[]; slugs: Set<string>; settingTypes: Set<'real' | 'fictionalized' | 'imaginary'>; placeTypes: Set<PlaceType>; approximate: boolean; visitable: boolean; spots?: Map<number, Location[]>; spot?: boolean };

// Kopierer tekst: utklippstavlen der den finnes, ellers den gamle måten via et skjult tekstfelt
// (utklippstavlen mangler eller nektes i noen mobilnettlesere og innebygde nettlesere)
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    field.remove();
    return copied;
  }
}

const stableCoordinate = (value: number) => Number(value.toFixed(6));
const posKey = (p: Position) => `${stableCoordinate(p[0])},${stableCoordinate(p[1])}`;
const normalizePosition = ([lat, lng]: Position): Position => {
  const normalized = ((lng + 180) % 360 + 360) % 360 - 180;
  return [stableCoordinate(lat), stableCoordinate(Math.abs(normalized + 180) < 1e-8 && lng > 0 ? 180 : normalized)];
};
// Jordkopier: på desktop tegnes hver markør tre ganger, så kartet kan rulles over datolinjen uten hull.
// På telefon er skjermen for smal til at kopiene noen gang synes, og de tredoblet klyngetreet og ikon-DOM-en
// ved oppstart (3 800 markører for 1 282 steder), så der tegnes bare den ene.
let copyOffsets = [0];
const refreshCopyOffsets = () => { copyOffsets = window.matchMedia('(min-width: 768px)').matches ? [-360, 0, 360] : [0]; };
if (typeof window !== 'undefined') { refreshCopyOffsets(); window.addEventListener('resize', refreshCopyOffsets); }
// På telefon får stedene nærmest datolinjen likevel én kopi på den andre siden: worldCopyJump flytter
// kartet først når midten passerer ±180°, så uten den sto Stillehavet tomt det siste stykket av draget
const worldCopies = ([lat, lng]: Position): Position[] => {
  if (copyOffsets.length > 1) return copyOffsets.map(offset => [lat, lng + offset]);
  if (lng > 100) return [[lat, lng], [lat, lng - 360]];
  if (lng < -100) return [[lat, lng], [lat, lng + 360]];
  return [[lat, lng]];
};
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

// Gyldige koordinater (ikke [0,0] og ikke undefined)
const isValidPosition = (pos: Position) =>
  Array.isArray(pos) && pos.length === 2 &&
  typeof pos[0] === 'number' && typeof pos[1] === 'number' &&
  pos[0] >= -90 && pos[0] <= 90 && pos[1] >= -180 && pos[1] <= 180 &&
  (pos[0] !== 0 || pos[1] !== 0);

// Kartmarkørene er ikke tabulatorstopp: hundre punkter i tilfeldig rekkefølge som panorerer kartet hjelper ingen.
// Tastatur og skjermleser bruker søket og stedslista («All places») i stedet.
(L as unknown as { MarkerCluster?: typeof L.Marker }).MarkerCluster?.mergeOptions({ keyboard: false });

// Markør-ikoner per tilstand, opprettet én gang. 44px treffområde for touch.
const makeIcon = (className: string, size: number) =>
  L.divIcon({ className, html: '<span class="gt-marker-dot"></span>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
const ICONS = {
  normal: makeIcon('gt-marker', 44),
  approximate: makeIcon('gt-marker is-approximate', 44),
  fictionalized: makeIcon('gt-marker is-fictionalized', 44),
  approximateFictionalized: makeIcon('gt-marker is-approximate is-fictionalized', 44),
  imaginary: makeIcon('gt-marker is-imaginary', 44),
  approximateImaginary: makeIcon('gt-marker is-approximate is-imaginary', 44),
  mixed: makeIcon('gt-marker is-mixed', 44),
  approximateMixed: makeIcon('gt-marker is-approximate is-mixed', 44),
  active: makeIcon('gt-marker is-active', 44),
  activeApproximate: makeIcon('gt-marker is-active is-approximate', 44),
  activeFictionalized: makeIcon('gt-marker is-active is-fictionalized', 44),
  activeApproximateFictionalized: makeIcon('gt-marker is-active is-approximate is-fictionalized', 44),
  activeImaginary: makeIcon('gt-marker is-active is-imaginary', 44),
  activeApproximateImaginary: makeIcon('gt-marker is-active is-approximate is-imaginary', 44),
  activeMixed: makeIcon('gt-marker is-active is-mixed', 44),
  activeApproximateMixed: makeIcon('gt-marker is-active is-approximate is-mixed', 44),
  dimmed: makeIcon('gt-marker is-dimmed', 44),
  dimmedApproximate: makeIcon('gt-marker is-dimmed is-approximate', 44),
  user: makeIcon('gt-user', 24),
  // Reisestopp som er hele land: landet er flaten, så stoppet får bare nummerlappen, ingen prikk
  countryStop: L.divIcon({ className: 'gt-marker is-country', html: '', iconSize: [44, 44], iconAnchor: [22, 22] }),
};
// Nivå to (parken, slottet, torget): en rombe med navnet under, ikke en prikk, så den skilles fra byens punkt
const spotIcons = new Map<string, L.DivIcon>();
// labelled: navnet står alltid (stedene under et åpent sted); ellers kommer navnene først fra SPOT_LABEL_ZOOM (App.css)
const spotIcon = (name: string, labelled = false) => {
  const key = `${labelled ? '+' : '-'}${name}`;
  let icon = spotIcons.get(key);
  if (!icon) {
    icon = L.divIcon({ className: `gt-marker is-spot${labelled ? ' is-labelled' : ''}`, html: `<span class="gt-spot"></span><span class="gt-spot-label">${escapeHtml(shortName(name))}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
    spotIcons.set(key, icon);
  }
  return icon;
};

// Nivå to (spotParentOf i gameData): spillet rulles opp til forelderen, og stedet selv vises først fra SPOT_ZOOM

// Landet et kartpunkt ligger i, og om punktet er «hele landet» (bare land-typen)
const countryOfPoint = (key: string, place: Place) =>
  place.games.flatMap(game => game.locations.filter(l => posKey(l.position) === key).map(l => countryOf(l.placeId))).find(Boolean);
// Et punkt som er et helt land åpner landet, også når en oppdiktet «Greece (fictionalized)» deler punktet
const isCountryPoint = (place: Place) => place.placeTypes.has('country');

// «My atlas»: et lite merke i hjørnet av prikken, så fargen fortsatt sier om stedet er ekte eller oppdiktet
const BEEN_BADGE = '<span class="gt-mark is-been" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></span>';
const WANT_BADGE = '<span class="gt-mark is-want" aria-hidden="true"><svg viewBox="0.5 3 20 20"><path d="M4 22V4h13l-2.5 4.5L17 13H6v9z"/></svg></span>';
const markedIcons = new Map<L.DivIcon, Map<'been' | 'want', L.DivIcon>>();
const withAtlasMark = (icon: L.DivIcon, mark: 'been' | 'want' | undefined) => {
  if (!mark) return icon;
  let variants = markedIcons.get(icon);
  if (!variants) markedIcons.set(icon, variants = new Map());
  let marked = variants.get(mark);
  if (!marked) {
    marked = L.divIcon({ ...icon.options, html: `${icon.options.html}${mark === 'been' ? BEEN_BADGE : WANT_BADGE}` });
    variants.set(mark, marked);
  }
  return marked;
};

// Et sted med steder på nivå to under seg får et lite tall i hjørnet, så prikken ikke ser ut som ett sted
// når fem ligger under den; tallet skjules når rombene selv er synlige (zoom 12 og innover, se App.css)
const spotCountIcons = new Map<L.DivIcon, Map<number, L.DivIcon>>();
const withSpotCount = (icon: L.DivIcon, count: number) => {
  if (!count) return icon;
  let variants = spotCountIcons.get(icon);
  if (!variants) spotCountIcons.set(icon, variants = new Map());
  let marked = variants.get(count);
  if (!marked) {
    // Romben foran tallet sier at det er steder på nivå to, ikke spill som i klyngene
    marked = L.divIcon({ ...icon.options, html: `${icon.options.html}<span class="gt-dot-count gt-spot-count" aria-hidden="true"><i class="gt-dot-count-spot"></i>${count}</span>` });
    variants.set(count, marked);
  }
  return marked;
};
// Prikken for et spill satt i hele landet står på landets navnepunkt, der kartet skriver landsnavnet. Den
// flyttes 20 px ned (lappen følger med), så den står under navnet i stedet for oppå første bokstav.
const COUNTRY_DOT_DROP = 20;
const countryDotIcons = new WeakMap<L.DivIcon, L.DivIcon>();
const belowCountryName = (icon: L.DivIcon) => {
  let moved = countryDotIcons.get(icon);
  if (!moved) {
    const [x, y] = icon.options.iconAnchor as [number, number];
    moved = L.divIcon({ ...icon.options, iconAnchor: [x, y - COUNTRY_DOT_DROP], tooltipAnchor: [0, COUNTRY_DOT_DROP] });
    countryDotIcons.set(icon, moved);
  }
  return moved;
};
const spotCountOf = (place: Place) => place.spots ? new Set([...place.spots.values()].flatMap(list => list.map(loc => loc.placeId))).size : 0;

// Et sted på nivå to beholder romben også når det er nålet (åpent spill, åpent sted): en rund prikk der
// sa at Baker Street var et sted som Paris, ikke et sted inne i London
const ACTIVE_SPOT_ICON = L.divIcon({ className: 'gt-marker is-spot is-active', html: '<span class="gt-spot"></span>', iconSize: [44, 44], iconAnchor: [22, 22] });
const activePlaceIcon = (place: Place, settingType?: 'real' | 'fictionalized' | 'imaginary') => {
  if (place.spot) return ACTIVE_SPOT_ICON;
  const type = settingType ?? (place.settingTypes.size === 1 ? [...place.settingTypes][0] : undefined);
  const prefix = place.approximate ? 'activeApproximate' : 'active';
  if (type === 'imaginary') return ICONS[`${prefix}Imaginary` as 'activeImaginary' | 'activeApproximateImaginary'];
  if (type === 'fictionalized') return ICONS[`${prefix}Fictionalized` as 'activeFictionalized' | 'activeApproximateFictionalized'];
  if (!type && place.settingTypes.size > 1) return ICONS[`${prefix}Mixed` as 'activeMixed' | 'activeApproximateMixed'];
  return ICONS[prefix as 'active' | 'activeApproximate'];
};

const placeMarkerIcon = (place: Place) => {
  const type = place.settingTypes.size > 1 ? 'mixed' : place.settingTypes.has('imaginary') ? 'imaginary' : place.settingTypes.has('fictionalized') ? 'fictionalized' : '';
  if (place.approximate) {
    if (type === 'mixed') return ICONS.approximateMixed;
    if (type === 'imaginary') return ICONS.approximateImaginary;
    if (type === 'fictionalized') return ICONS.approximateFictionalized;
    return ICONS.approximate;
  }
  return type === 'mixed' ? ICONS.mixed : type === 'imaginary' ? ICONS.imaginary : type === 'fictionalized' ? ICONS.fictionalized : ICONS.normal;
};

const PLACE_TYPES: { value: PlaceType; label: string }[] = [
  { value: 'country', label: 'Country' }, { value: 'city', label: 'City / town' },
  { value: 'region', label: 'Region' }, { value: 'neighborhood', label: 'District / neighborhood' },
  { value: 'island', label: 'Island' }, { value: 'natural_feature', label: 'Natural feature' },
  { value: 'body_of_water', label: 'Body of water' }, { value: 'landmark', label: 'Landmark' },
  { value: 'venue', label: 'Venue' }, { value: 'area', label: 'Other area' },
];

// Spilldata er statisk, så verdier for filtrene beregnes én gang
const years = Array.from(new Set(games.map(g => g.year))).sort((a, b) => a - b);
const minYear = years[0] ?? 1980;
const maxYear = years[years.length - 1] ?? 2025;
// Merk: år 0 og negative år (BC) er gyldige her
const storyYearsList = Array.from(new Set(games.flatMap(g => g.storyYears))).sort((a, b) => a - b);
const minStoryYear = storyYearsList[0] ?? minYear;
const maxStoryYear = storyYearsList[storyYearsList.length - 1] ?? maxYear;
const genres = Array.from(new Set(games.flatMap(game => game.genres))).sort();

// Filteret viser noen få sjangerfamilier; dataene og kortene beholder de detaljerte sjangrene.
// En sjanger som ikke står her havner under «Other», så ingen spill blir umulige å filtrere fram.
const VENUE_FAMILY = 'Racing & sports';
const GENRE_FAMILIES: { label: string; genres: string[] }[] = [
  { label: 'Adventure', genres: ['Adventure', 'Interactive Drama', 'Visual Novel'] },
  { label: 'Action', genres: ['Action-Adventure', 'Action-Platformer', 'Puzzle-Platformer', 'Stealth', 'Tactical Stealth', 'Survival Horror'] },
  { label: 'Shooter', genres: ['Shooter', 'First-Person Shooter', 'Third-Person Shooter', 'Tactical Shooter'] },
  { label: 'RPG', genres: ['RPG', 'Action RPG', 'Narrative RPG', 'Tactical RPG'] },
  { label: 'Strategy', genres: ['Strategy', 'Real-Time Strategy', 'Real-Time Tactics'] },
  { label: VENUE_FAMILY, genres: ['Racing', 'Sports'] },
];
{
  const listed = new Set(GENRE_FAMILIES.flatMap(family => family.genres));
  const other = genres.filter(genre => !listed.has(genre));
  if (other.length) GENRE_FAMILIES.push({ label: 'Other', genres: other });
}
const familyOfGenre = new Map(GENRE_FAMILIES.flatMap(family => family.genres.map(genre => [genre, family.label] as const)));
const familyGenres = (labels: string[]) => GENRE_FAMILIES.filter(family => labels.includes(family.label)).flatMap(family => family.genres);
const familyCount = new Map(GENRE_FAMILIES.map(family => [family.label, games.filter(game => game.genres.some(genre => family.genres.includes(genre))).length]));
const gameBaseSlugCounts = new Map<string, number>();
for (const game of games) gameBaseSlugCounts.set(slugify(game.name), (gameBaseSlugCounts.get(slugify(game.name)) ?? 0) + 1);
const gameSlugById = new Map(games.map(game => {
  const base = slugify(game.name);
  return [game.id, gameBaseSlugCounts.get(base)! > 1 ? `${base}-${game.year}` : base] as const;
}));
const gameBySlug = new Map(games.flatMap(game => [[slugify(game.name), game] as const, [gameSlugById.get(game.id)!, game] as const]));
const gameById = new Map(games.map(g => [g.id, g]));
// «My atlas» lagrer steder på sted-id og spill på spill-id; filene bruker samme id som sideadressene
const placesInGames = new Set(games.flatMap(game => game.locations.map(l => l.placeId)));
const atlasCatalog: AtlasCatalog = {
  places: canonicalPlaces.filter(place => placesInGames.has(place.id)),
  games: games.map(game => ({ id: game.id, name: game.name, year: game.year, slug: gameSlugById.get(game.id)! })),
};
let searchGames = createGameSearch(games);
// Notatene er med i søket (vekt 0,1); når detaljene er lastet, bygges søket på nytt med dem
subscribeCatalogDetails(() => { searchGames = createGameSearch(games); });

const chipClass = 'min-h-11 cursor-pointer rounded-[10px] border px-3 text-[0.95rem] font-semibold transition-colors md:min-h-9';

// Tidsskalaen gir mest plass til epokene der de fleste spillene foregår
const STORY_SCALE: Scale = [[0, 0.12], [1000, 0.24], [1500, 0.34], [1800, 0.44], [1900, 0.54], [2000, 0.8], [2030, 0.88]];

const thisYear = new Date().getFullYear();
type Era = { label: string; range: [number, number] };
const ERAS: Era[] = ([
  { label: 'Ancient', range: [minStoryYear, 499] },
  { label: 'Medieval', range: [500, 1499] },
  { label: '1500s–1700s', range: [1500, 1799] },
  { label: '1800s', range: [1800, 1899] },
  { label: '1900s', range: [1900, 1999] },
  { label: 'Today', range: [2000, thisYear] },
  { label: 'Future', range: [thisYear + 1, maxStoryYear] },
] satisfies Era[]).filter(e => e.range[0] <= e.range[1]);

// Klynger åpner lista når stedene ligger så tett at kartet ikke kan skille dem, eller når det er få nok spill til å lese
const LIST_ZOOM = 10;
// Radiusen klyngene samler prikker innenfor, i piksler
const CLUSTER_RADIUS = 50;
const CLUSTER_LIST_MAX_GAMES = 12;
// Minste zoom når et sted åpnes, omtrent en region
const PLACE_ZOOM = 5;
// Hvor nær kartet minst går når et sted åpnes: en by eller et bygg på 8, så byen og nabolaget står fram og
// naboprikkene skiller seg; en region, en elv eller et hav på 6; nivå to (en park i byen) på SPOT_ZOOM.
// Fra 5 var Brest bare en prikk i et Europa-kart. Er man allerede nærmere, beholdes zoomen.
const placeMinZoom = (types: Iterable<PlaceType>, spot = false) => {
  if (spot) return SPOT_ZOOM;
  const list = [...types];
  if (list.some(t => t === 'city' || t === 'neighborhood' || t === 'landmark' || t === 'venue' || t === 'island')) return 8;
  if (list.some(t => t === 'region' || t === 'natural_feature' || t === 'body_of_water' || t === 'area')) return 6;
  return PLACE_ZOOM;
};
// Steder på nivå to vises fra denne zoomen; å åpne ett zoomer minst hit
// Rombene kommer fra 11 og navnene deres fra 12: mellom 9 og 11 var byen bare én prikk med et tall i tre
// zoomtrinn (UX-gjennomgang av Paris og London), og på 11 ligger stedene i Paris 15–110 px fra hverandre
// Et spill som holder seg innenfor én by (Sherlock Holmes i London, stedene 8 km fra hverandre) rammes
// inn tett, til zoom 13; ellers rammes reisen inn så den fyller kartet, til høyst zoom 10. En reise over
// kontinenter havner langt ute av seg selv. Taket var 6 til 3. november 2026, og da sto Valiant Hearts, med
// steder et par hundre kilometer fra hverandre i Nord-Frankrike, som en liten klump midt i halve Europa.
// Ett sted alene: en by står på 6 med landet rundt seg, et sted på nivå to går inn til rombene vises.
const gameFitMaxZoom = (locations: Location[]) => {
  const positions = locations.map(l => l.position).filter(isValidPosition);
  if (positions.length === 1) return spotParentOf(locations[0]) ? 13 : 6;
  const lats = positions.map(p => p[0]);
  const lngs = positions.map(p => p[1]);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  return span < 0.6 ? 13 : 10;
};
const gameFit = (locations: Location[]) => ({ positions: locations.map(l => l.position).filter(isValidPosition), maxZoom: gameFitMaxZoom(locations) });

const SPOT_ZOOM = 11;
const SPOT_LABEL_ZOOM = 12;
// Gloria rundt områdepunkter vises først herfra; i verdens- og kontinentutsnittet ble den rosa flekker
const HALO_ZOOM = 6;
// Radius for «Nearby» og «Near me»
const NEARBY_KM = 600;
const NEAR_ME_KM = 800;

const CONTRIBUTE_URL = (import.meta.env.VITE_CONTRIBUTE_URL as string | undefined) || undefined;
const DEFAULT_TITLE = 'Game Traveler – where video games take place';
const INTRO_DISMISSED_KEY = 'game-traveller-intro-dismissed';
const START_PLACES = [
  { name: 'Paris, France', label: 'Paris' },
  { name: 'Tokyo, Japan', label: 'Tokyo' },
  { name: 'New York City, USA', label: 'New York' },
];

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
const HOME_MAP_CENTER: Position = [30, 10];
const homeMapZoom = () => isDesktop() ? 3 : 2;

function readIntroDismissed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(INTRO_DISMISSED_KEY) === 'true';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.warn('Game Traveler could not read the saved welcome preference.');
      return false;
    }
    throw error;
  }
}

function writeIntroDismissed(dismissed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (dismissed) window.localStorage.setItem(INTRO_DISMISSED_KEY, 'true');
    else window.localStorage.removeItem(INTRO_DISMISSED_KEY);
  } catch (error) {
    if (error instanceof DOMException && ['SecurityError', 'QuotaExceededError'].includes(error.name)) {
      console.warn('Game Traveler could not save the welcome preference.');
      return;
    }
    throw error;
  }
}

type MapMove =
  | { kind: 'point'; position: Position; minZoom?: number }
  | { kind: 'bounds'; positions: Position[]; maxZoom?: number; tight?: boolean };
type MapTarget = MapMove & { seq: number; instant?: boolean };

// Hva panelet viser. Det husker steder, ikke spill, slik at innholdet følger søk og filter.
type Panel =
  | { mode: 'place'; position: Position; name: string }
  | { mode: 'cluster'; positions: Position[] }
  | { mode: 'search'; query: string }
  | { mode: 'game'; id: number }
  | { mode: 'near'; position: Position }
  | { mode: 'index' }
  | { mode: 'atlas' }
  // Et helt land: alle spill med et sted i landet
  | { mode: 'country'; iso: string }
  | { mode: 'series'; name: string };
// scrolls: rulleposisjonen i hvert panel i history, så «Back to …» åpner det der leseren slapp det
type PanelState = { view: Panel; seq: number; autoFocus: boolean; history: Panel[]; scrolls?: number[] };
type SearchSuggestion = {
  id: string;
  kind: 'game' | 'place' | 'series' | 'all' | 'browse';
  label: string;
  detail: string;
  game?: Game;
  position?: Position;
  series?: string;
};

// Overkanten av arket på mobil, i vindus-koordinater; undefined når det ikke er noe ark
// Med afterOpen regnes standardhøyden (62 %) uansett hvor arket står: et ark som er dratt ned til minimum
// går opp til 62 % igjen når nytt innhold åpnes, og et ark som er dratt opp til 90 % dekker nesten hele
// kartet, så en innramming regnet for det zoomet helt ut (Norge på zoom 1). Utsnittet regnes for arket
// slik det står når brukeren drar det ned for å se kartet.
// Med assumeOpen regnes et ark som ennå ikke er tegnet (panelet er åpent i React, men ikke i DOM-en) som 62 %.
const SHEET_DEFAULT_SNAP = 0.62;
// Med peek regnes arket som nede (landet åpnes slik)
const sheetTopPx = ({ afterOpen = false, assumeOpen = false, peek = false } = {}) => {
  if (peek && !isDesktop()) return window.innerHeight - SHEET_PEEK_HEIGHT;
  if (afterOpen && !isDesktop()) return window.innerHeight * (1 - SHEET_DEFAULT_SNAP);
  const popup = document.querySelector<HTMLElement>('.gt-sheet-popup');
  if (!popup) return assumeOpen && !isDesktop() ? window.innerHeight * (1 - SHEET_DEFAULT_SNAP) : undefined;
  const snapPoint = popup.dataset.snapPoint;
  if (!snapPoint) return popup.getBoundingClientRect().top;
  // Brøk-snappunkter regnes av vindushøyden, ikke av arkets egen høyde (arket starter under toppfeltet)
  const value = Number.parseFloat(snapPoint);
  return window.innerHeight - (snapPoint.endsWith('px') ? value : value * window.innerHeight);
};

// En innramming får alltid minst så mye høyde, selv om arket dekker mer av kartet; ellers kollapser
// den til minste zoom (hele verden) når feltet over arket er brukt opp av margene
const MIN_FIT_HEIGHT = 80;

// Med tight rammes det inn med bare nålene i tankene (klyngelister har ingen navnelapper): feltet over
// arket på en telefon er rundt 180 px, og lapp-luften på 56 + 60 px lot 60 px stå igjen, så klyngen
// ble liggende like tett som den var klynget. Kartknappene øverst til høyre får fortsatt plass.
const panelPadding = (map: L.Map, { afterOpen = true, tight = false } = {}) => {
  if (isDesktop()) {
    return { paddingTopLeft: L.point(470, 60), paddingBottomRight: L.point(80, 60) };
  }

  const size = map.getSize();
  const sheetTop = sheetTopPx({ afterOpen });
  const mapRect = map.getContainer().getBoundingClientRect();
  const mapBottom = mapRect.bottom;
  const overlap = sheetTop === undefined ? size.y * 0.62 : Math.max(0, mapBottom - Math.max(mapRect.top, sheetTop));
  if (tight) {
    return {
      paddingTopLeft: L.point(24, 32),
      paddingBottomRight: L.point(72, Math.min(size.y - 32 - MIN_FIT_HEIGHT, overlap + 16)),
    };
  }
  // Luft til navnelappene over og under stoppene, og til kartknappene øverst til høyre
  return {
    paddingTopLeft: L.point(40, 56),
    paddingBottomRight: L.point(72, Math.min(size.y - 56 - MIN_FIT_HEIGHT, overlap + 60)),
  };
};

// Bare bredden begrenses (ingen grå flate over og under kartet); øst-vest går kartet rundt jorden
const WORLD_BOUNDS = L.latLngBounds([-85.051128, -540], [85.051128, 540]);
// På telefon zoomes det i halve trinn, ned til 1: feltet over arket er lite, og Russland og ruter rundt
// hele kloden (F1-sesongen) får plass først der. Desktop beholder hele trinn fra 2. Minste zoom er fast:
// klyngelaget bygger ett rutenett per zoomnivå ned til kartets minste zoom i det øyeblikket det legges til,
// og endres minste zoom etterpå, mister det nålene som står alene (Hawke's Bay) eller krasjer (Murmansk).
const minZoomFor = () => isDesktop() ? 2 : 1;
// Kvarte trinn på desktop: et knip på pekeplata (se MapPinchZoom) lander nær der det slapp, og
// innrammingene lander tettere på stedene
const zoomSnapFor = () => isDesktop() ? 0.25 : 0.5;

type Filters = { query: string; genres: string[]; yearRange: [number, number]; storyYearRange: [number, number]; includeVenues: boolean; settings: string[]; placeTypes: PlaceType[] };

// Racing og sport foregår på en bane eller arena, ikke i en historie. De skjules som standard,
// men vises når man søker, velger sjangeren selv eller slår på «All games».
const VENUE_GENRES = ['Racing', 'Sports'];
const isVenueGame = (game: Game) => game.genres.every(genre => VENUE_GENRES.includes(genre));
const venueGameCount = games.filter(isVenueGame).length;

function filterGames({ query, genres, yearRange, storyYearRange, includeVenues, settings, placeTypes }: Filters): SearchHit[] {
  // Fullt spenn betyr ingen avgrensning, også for spill uten oppgitt år i handlingen
  const storyFull = storyYearRange[0] === minStoryYear && storyYearRange[1] === maxStoryYear;
  const hits = filterSearchResults(searchGames(query), {
    genres: familyGenres(genres), yearRange, storyYearRange: storyFull ? undefined : storyYearRange,
  });
  const showVenues = includeVenues || !!query || genres.includes(VENUE_FAMILY);
  const visible = showVenues ? hits : hits.filter(hit => !isVenueGame(hit.game));
  const bySetting = settings.length ? visible.filter(hit => hit.game.locations.some(location => settings.includes(location.settingType ?? 'real'))) : visible;
  return placeTypes.length ? bySetting.filter(hit => hit.game.locations.some(location => placeTypes.includes(location.placeType))) : bySetting;
}

// Ett kartpunkt per unike sted, med alle spillene som utspiller seg der
function buildPlaces(list: Game[], typeFilter: PlaceType[] = []): Map<string, Place> {
  const byKey = new Map<string, Place>();
  const add = (game: Game, position: Position, name: string, placeType: PlaceType, scale: 'area' | 'site', settingType: 'real' | 'fictionalized' | 'imaginary', invented: boolean) => {
    const key = posKey(position);
    const place = byKey.get(key) ?? { position, name, games: [], slugs: new Set<string>(), settingTypes: new Set<'real' | 'fictionalized' | 'imaginary'>(), placeTypes: new Set<PlaceType>(), approximate: true, visitable: false };
    // Every generated place URL must survive merging pins at the same coordinates.
    place.slugs.add(slugify(name));
    place.settingTypes.add(settingType);
    place.placeTypes.add(placeType);
    place.approximate &&= scale !== 'site';
    place.visitable ||= settingType !== 'imaginary' && !invented;
    if (!place.games.includes(game)) place.games.push(game);
    byKey.set(key, place);
    return place;
  };
  for (const game of list) {
    for (const loc of game.locations) {
      if (typeFilter.length && !typeFilter.includes(loc.placeType)) continue;
      if (!isValidPosition(loc.position)) continue;
      const own = add(game, loc.position, loc.name, loc.placeType, loc.scale, loc.settingType ?? 'real', isInvented(loc));
      // Nivå to: spillet står også hos byen, med stedet som brikke i raden
      const parent = spotParentOf(loc);
      if (!parent) continue;
      const parentPosition: Position = [parent.position.lat, parent.position.lon];
      if (!isValidPosition(parentPosition) || posKey(parentPosition) === posKey(loc.position)) continue;
      own.spot = true;
      const city = add(game, parentPosition, parent.name, parent.placeType, parent.scale, loc.settingType ?? 'real', isInvented(parent));
      city.spots ??= new Map();
      const list = city.spots.get(game.id) ?? [];
      if (!list.some(l => l.placeId === loc.placeId)) city.spots.set(game.id, [...list, loc]);
    }
  }
  return byKey;
}
// Et sted kan besøkes når minst ett spill viser det som ekte eller som en fri versjon av et ekte sted, og
// stedet ikke er diktet opp av spillet (Big Shell, Atlantis): oppdiktede steder får ikke «Been here» og «Want to go»
const isVisitable = (place: Place) => place.visitable;
// Andelene i «My atlas» regnes mot steder du kan reise til og historiespillene, som tallene i headeren.
// Steder telles som kartet gjør (spillenes egne punkter).
const atlasTotals = {
  places: [...buildPlaces(games.filter(game => !isVenueGame(game))).values()].filter(isVisitable).length,
  games: games.length - venueGameCount,
};

function placeForLocation(location: Game['locations'][number]): Place {
  return {
    position: location.position,
    name: location.name,
    games: [],
    slugs: new Set([slugify(location.name)]),
    settingTypes: new Set([location.settingType ?? 'real']),
    placeTypes: new Set([location.placeType]),
    approximate: location.scale !== 'site',
    visitable: isVisitableLocation(location),
  };
}

// Én bokstav er ikke et søk ennå: kartet filtreres først fra to tegn, som forslagene
const MIN_QUERY = 2;
const effectiveQuery = (text: string) => {
  const trimmed = text.trim().toLowerCase();
  return trimmed.length >= MIN_QUERY ? trimmed : '';
};

const clampRange = (range: [number, number] | undefined, min: number, max: number): [number, number] =>
  range ? [Math.min(max, Math.max(min, range[0])), Math.max(min, Math.min(max, range[1]))] : [min, max];

// Startstilstand fra en delt lenke
function initialFromUrl(url: UrlState) {
  const filters: Filters = {
    query: effectiveQuery(url.q ?? ''),
    genres: [...new Set((url.genre ?? []).map(genre => familyOfGenre.get(genre) ?? (familyCount.has(genre) ? genre : undefined)).filter((genre): genre is string => !!genre))],
    yearRange: clampRange(url.released, minYear, maxYear),
    storyYearRange: clampRange(url.set, minStoryYear, maxStoryYear),
    includeVenues: !!url.all,
    settings: url.setting ?? [],
    placeTypes: [...new Set((url.placeType ?? []).filter((type): type is PlaceType => PLACE_TYPES.some(item => item.value === type)))],
  };
  const game = url.game ? gameBySlug.get(url.game) : undefined;
  // En lenke til et racingspill eller en bane skal virke selv om racing er skjult
  if (game && isVenueGame(game)) filters.includeVenues = true;
  let hits = filterGames(filters);
  let places = buildPlaces(hits.map(hit => hit.game), filters.placeTypes);
  if (url.place && !filters.includeVenues && ![...places.values()].some(p => p.slugs.has(url.place!))) {
    filters.includeVenues = true;
    hits = filterGames(filters);
    places = buildPlaces(hits.map(hit => hit.game), filters.placeTypes);
  }
  let panel: PanelState | null = null;
  let selectedGameId: number | undefined;
  let target: MapTarget | undefined;
  const place = url.place ? [...places.values()].find(p => p.slugs.has(url.place!)) : undefined;
  const country = url.country ? countryBySlug(url.country) : undefined;
  // Et land med bare racing- og sportsspill (Finland, Bahrain) åpnes tomt når de er skjult; da vises alle spill
  const inCountry = (iso: string) => [...places.values()].some(p => p.games.some(g => g.locations.some(l => countryOf(l.placeId) === iso)));
  if (country && !filters.includeVenues && !inCountry(country[0])) {
    filters.includeVenues = true;
    hits = filterGames(filters);
    places = buildPlaces(hits.map(hit => hit.game), filters.placeTypes);
  }
  const seriesName = url.series ? seriesBySlug.get(url.series) : undefined;
  if (seriesName && !filters.includeVenues && seriesGames.get(seriesName)!.every(isVenueGame)) {
    filters.includeVenues = true;
    hits = filterGames(filters);
    places = buildPlaces(hits.map(hit => hit.game), filters.placeTypes);
  }
  if (game) {
    panel = { view: { mode: 'game', id: game.id }, seq: 1, autoFocus: false, history: [] };
    selectedGameId = game.id;
    const route = getGameRoutes(game).find(route => route.id === url.route);
    target = { kind: 'bounds', ...gameFit(route?.locations ?? game.locations), seq: 1, instant: true };
  } else if (place && isCountryPoint(place) && countryOfPoint(posKey(place.position), place) && countryLabel(countryOfPoint(posKey(place.position), place)!)) {
    // Stedssiden for et helt land åpner landet
    panel = { view: { mode: 'country', iso: countryOfPoint(posKey(place.position), place)! }, seq: 1, autoFocus: false, history: [] };
  } else if (place) {
    panel = { view: { mode: 'place', position: place.position, name: place.name }, seq: 1, autoFocus: false, history: [] };
    target = { kind: 'point', position: place.position, seq: 1, instant: true, minZoom: placeMinZoom(place.placeTypes, place.spot) };
  } else if (country) {
    panel = { view: { mode: 'country', iso: country[0] }, seq: 1, autoFocus: false, history: [] };
  } else if (seriesName) {
    panel = { view: { mode: 'series', name: seriesName }, seq: 1, autoFocus: false, history: [] };
    // ?journey=uncharted-2: reisen til ett av spillene i serien vises, også etter tilbake-knappen
    const journey = url.journey ? seriesGames.get(seriesName)!.find(g => gameSlugById.get(g.id) === url.journey) : undefined;
    selectedGameId = journey?.id;
    target = { kind: 'bounds', ...gameFit(journey?.locations ?? seriesGames.get(seriesName)!.flatMap(g => g.locations)), seq: 1, instant: true };
  } else if (url.panel) {
    panel = { view: { mode: url.panel === 'places' ? 'index' : 'atlas' }, seq: 1, autoFocus: false, history: [] };
  } else if (filters.query && places.size > 0) {
    panel = { view: { mode: 'search', query: (url.q ?? '').trim() }, seq: 1, autoFocus: false, history: [] };
    selectedGameId = hits.length === 1 ? hits[0].game.id : undefined;
    target = { kind: 'bounds', positions: searchPositions(hits).filter(isValidPosition), seq: 1, instant: true };
  }
  const routeId = game && getGameRoutes(game).some(route => route.id === url.route) ? url.route : undefined;
  return { filters, search: url.q ?? '', panel, selectedGameId, target, routeId };
}

// Flytter kartet, og tar hensyn til at panelet dekker venstre side (desktop) eller bunnen (mobil)
function MapMover({ target }: { target?: MapTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const animate = !target.instant && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (target.kind === 'point') {
      map.stop();
      const frame = window.requestAnimationFrame(() => {
        // Behold zoomen når man allerede er nær; zoom bare inn fra verdens- og kontinentnivå
        const zoom = Math.max(map.getZoom(), target.minZoom ?? PLACE_ZOOM);
        let shift: L.Point;
        if (isDesktop()) {
          shift = L.point(210, 0);
        } else {
          const mapRect = map.getContainer().getBoundingClientRect();
          const sheetTop = sheetTopPx({ afterOpen: true });
          if (sheetTop === undefined) {
            shift = L.point(0, 0);
          } else {
            const visibleBottom = Math.max(mapRect.top, Math.min(mapRect.bottom, sheetTop));
            const visibleCenter = (mapRect.top + visibleBottom) / 2;
            const mapCenter = (mapRect.top + mapRect.bottom) / 2;
            shift = L.point(0, visibleCenter - mapCenter);
          }
        }
        const center = map.unproject(map.project(target.position, zoom).subtract(shift), zoom);
        if (animate) map.flyTo(center, zoom, { duration: 0.8 });
        else map.setView(center, zoom, { animate: false });
      });
      return () => window.cancelAnimationFrame(frame);
    } else if (target.positions.length > 0) {
      const bounds = L.latLngBounds(shortestLongitudeSpan(target.positions));
      const options = { ...panelPadding(map, { tight: target.tight }), maxZoom: target.maxZoom ?? 6 };
      if (animate) map.flyToBounds(bounds, { ...options, duration: 1 });
      else map.fitBounds(bounds, { ...options, animate: false });
    }
  }, [target, map]);

  return null;
}

// Let Leaflet remeasure captions when web fonts or responsive wrapping change their size.
// Knip på pekeplata: Windows og macOS sender det som wheel-hendelser med ctrlKey og små utslag.
// Leaflets hjulzoom samler dem i 40 ms og runder hvert knippe opp til et helt nivå, så knipet hakket
// nivå for nivå (ThinkPad X1). Og å sette zoomen for hver hendelse kostet 20–240 ms hver gang: hvert
// zoomend bygger klyngene og lappene på nytt. Derfor gjøres det som Leaflets eget fingerknip: lagene
// skaleres med CSS mens knipet pågår (map._move med pinch), og først når det stopper lander kartet på
// et zoomnivå med ett zoomend.
type PinchableMap = L.Map & {
  _moveStart(zoomChanged: boolean, noMoveStart: boolean): L.Map;
  _move(center: L.LatLng, zoom: number, data?: { pinch: boolean; round: boolean }): L.Map;
  _animateZoom(center: L.LatLng, zoom: number, startAnim: boolean, noUpdate?: boolean | number): void;
  _resetView(center: L.LatLng, zoom: number): L.Map;
  _limitZoom(zoom: number): number;
};
function MapPinchZoom() {
  const map = useMap();
  useEffect(() => {
    const internal = map as PinchableMap;
    const container = map.getContainer();
    let pinching = false;
    let target = 0;
    let center: L.LatLng | undefined;
    let idle = 0;
    const finish = () => {
      if (!pinching || !center) return;
      pinching = false;
      const zoom = internal._limitZoom(target);
      if (map.options.zoomAnimation) internal._animateZoom(center, zoom, true, map.options.zoomSnap);
      else internal._resetView(center, zoom);
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 60 : e.deltaY;
      if (!pinching) {
        pinching = true;
        target = map.getZoom();
        internal._moveStart(true, false);
      }
      // Rundt 40 px per nivå: et helt knip på pekeplata gir rundt 100 px, og det skal ta kartet et par nivåer
      const next = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), target - delta / 40));
      // Punktet under pekeren står stille, som i setZoomAround
      const scale = map.getZoomScale(next, target);
      const viewHalf = map.getSize().divideBy(2);
      const offset = map.mouseEventToContainerPoint(e).subtract(viewHalf).multiplyBy(1 - 1 / scale);
      center = map.containerPointToLatLng(viewHalf.add(offset));
      target = next;
      internal._move(center, target, { pinch: true, round: false });
      window.clearTimeout(idle);
      idle = window.setTimeout(finish, 150);
    };
    container.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      window.clearTimeout(idle);
      container.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [map]);
  return null;
}

function MapLabelLayout() {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      map.eachLayer(layer => {
        if (layer instanceof L.Tooltip) layer.update();
      });
    };
    void document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    map.on('resize', refresh);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener('loadingdone', refresh);
      map.off('resize', refresh);
    };
  }, [map]);

  return null;
}

// Hvor mange piksler av kartet arket dekker nederst (0 på desktop og uten ark)
const sheetOverlapPx = (map: L.Map, { afterOpen = false, assumeOpen = false, peek = false } = {}) => {
  if (isDesktop()) return 0;
  const sheetTop = sheetTopPx({ afterOpen, assumeOpen, peek });
  if (sheetTop === undefined) return 0;
  const mapRect = map.getContainer().getBoundingClientRect();
  return Math.max(0, mapRect.bottom - Math.max(mapRect.top, sheetTop));
};

// Innrammingen når et land åpnes: på mobil legger arket seg nederst (peek), og landet får hele kartet
// over det, med liten margin, så store land får plass.
// peek: landet ble åpnet med arket nede (trykk på landflaten); ellers står arket på 62 % som for et sted
const countryPadding = (map: L.Map, peek = true): L.FitBoundsOptions => {
  if (isDesktop()) return panelPadding(map);
  const size = map.getSize();
  const overlap = peek ? sheetOverlapPx(map, { peek: true }) : sheetOverlapPx(map, { afterOpen: true });
  return { paddingTopLeft: L.point(16, 16), paddingBottomRight: L.point(16, Math.min(size.y - 16 - MIN_FIT_HEIGHT, overlap + 16)) };
};

function MapWorldBoundary({ sheetOpen }: { sheetOpen: boolean }) {
  const map = useMap();

  // Kartet holdes innenfor verden, i piksler: ingen grå flate over Arktis eller under Antarktis.
  // Leaflets maxBounds duger ikke, for på mobil dekker arket nederste del av kartet, og verden må få
  // rulle like langt sør som arket dekker, så feltet over arket kan vise Antarktis og store land.
  // En breddegrad sør for 85° finnes ikke i Mercator, så grensen regnes her i piksler for hver zoom.
  useEffect(() => {
    let enforcing = false;
    const limit = () => {
      if (enforcing) return;
      const zoom = map.getZoom();
      const size = map.getSize();
      const center = map.project(map.getCenter(), zoom);
      const top = map.project(WORLD_BOUNDS.getNorthWest(), zoom);
      const bottom = map.project(WORLD_BOUNDS.getSouthEast(), zoom);
      // Et panel som er åpent, men hvis ark ennå ikke er tegnet, regnes med; ellers sentreres verden
      // i hele kartflaten et øyeblikk før arket kommer, og det som nettopp ble rammet inn havner under det
      const maxY = bottom.y + sheetOverlapPx(map, { assumeOpen: sheetOpen });
      let dy = 0;
      if (maxY - top.y < size.y) {
        // Verden er lavere enn kartet: den står midt i (midt i feltet over arket når arket er oppe)
        dy = (top.y + maxY) / 2 - center.y;
      } else {
        if (center.y + size.y / 2 > maxY) dy = maxY - (center.y + size.y / 2);
        if (center.y - size.y / 2 + dy < top.y) dy = top.y - (center.y - size.y / 2);
      }
      let dx = 0;
      if (center.x + size.x / 2 > bottom.x) dx = bottom.x - (center.x + size.x / 2);
      if (center.x - size.x / 2 + dx < top.x) dx = top.x - (center.x - size.x / 2);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      enforcing = true;
      map.once('moveend', () => { enforcing = false; });
      map.panBy([dx, dy]);
    };
    limit();
    // Arket glir på plass etter at panelet er åpnet eller lukket
    const later = window.setTimeout(limit, 500);
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target instanceof HTMLElement && event.target.classList.contains('gt-sheet-popup')) limit();
    };
    map.on('moveend resize', limit);
    document.addEventListener('transitionend', onTransitionEnd);
    return () => {
      window.clearTimeout(later);
      map.off('moveend resize', limit);
      document.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [map, sheetOpen]);

  return null;
}

type ClusterMarker = { key: string; position: Position; icon: L.DivIcon; title: string };

// Navnelappene på reisestoppene legges bort fra nærmeste andre stopp, så to stopp som ligger
// over hverandre ikke får lappene oppå hverandre. Regnes om når kartet zoomer eller flyttes.
type LabelDirection = 'top' | 'bottom' | 'left' | 'right';
const LABEL_OFFSET: Record<LabelDirection, [number, number]> = { top: [0, -14], bottom: [0, 14], left: [-14, 0], right: [14, 0] };
// Lapp med bare rutenummeret, brukt når navnet ikke får en fri plass før man zoomer inn
const COMPACT_LABEL_WIDTH = 36;
type StopLabel = { direction: LabelDirection; compact: boolean };
function StopLabelLayout({ positions, names, children }: { positions: Position[]; names: string[]; children: (labels: StopLabel[]) => React.ReactNode }) {
  const map = useMap();
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    // Arket på mobil kommer etter kartet og glir til snappunktet sitt; da må lappene regnes om igjen
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target instanceof HTMLElement && event.target.classList.contains('gt-sheet-popup')) bump();
    };
    const timer = window.setTimeout(bump, 700);
    map.on('zoomend moveend', bump);
    window.addEventListener('resize', bump);
    document.addEventListener('transitionend', onTransitionEnd);
    return () => {
      window.clearTimeout(timer);
      map.off('zoomend moveend', bump);
      window.removeEventListener('resize', bump);
      document.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [map]);
  const points = positions.map(position => map.latLngToContainerPoint(position));
  // Omtrentlig bredde på lappen: nummerpillen, teksten (14 px halvfet) og luft
  const labelWidths = names.map(name => 46 + name.length * 5.5);
  // Den synlige delen av kartet: under arket på mobil, og til venstre for kartknappene
  const size = map.getSize();
  const mapRect = map.getContainer().getBoundingClientRect();
  const sheetTop = isDesktop() ? undefined : sheetTopPx();
  const visibleBottom = sheetTop === undefined ? size.y : Math.max(0, Math.min(size.y, sheetTop - mapRect.top));
  const placed: [number, number, number, number][] = [];
  const labels = points.map((point, index): StopLabel => {
    let nearest: L.Point | undefined;
    let best = Infinity;
    points.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      const d = point.distanceTo(other);
      if (d < best) { best = d; nearest = other; }
    });
    // Først bort fra naboen, så de andre retningene; den første lappen som får plass på det synlige kartet vinner
    let candidates: LabelDirection[] = ['top', 'bottom', 'right', 'left'];
    if (nearest && best <= 160) {
      const dx = nearest.x - point.x;
      const dy = nearest.y - point.y;
      const horizontalAway: LabelDirection = dx > 0 ? 'left' : 'right';
      const verticalAway: LabelDirection = dy > 0 ? 'top' : 'bottom';
      const horizontalToward: LabelDirection = dx > 0 ? 'right' : 'left';
      const verticalToward: LabelDirection = dy > 0 ? 'bottom' : 'top';
      candidates = Math.abs(dx) > Math.abs(dy) * 1.5
        ? [horizontalAway, verticalAway, verticalToward, horizontalToward]
        : [verticalAway, horizontalAway, horizontalToward, verticalToward];
    }
    // Kartknappene øverst til høyre dekker de øverste 130 px langs høyre kant
    const rightEdge = size.x - (point.y < 130 ? 64 : 8);
    const rect = (direction: LabelDirection, width: number): [number, number, number, number] =>
      direction === 'top' ? [point.x - width / 2, point.y - 42, point.x + width / 2, point.y - 14]
      : direction === 'bottom' ? [point.x - width / 2, point.y + 14, point.x + width / 2, point.y + 42]
      : direction === 'right' ? [point.x + 14, point.y - 14, point.x + 14 + width, point.y + 14]
      : [point.x - 14 - width, point.y - 14, point.x - 14, point.y + 14];
    const onMap = ([x1, y1, x2, y2]: number[]) => x1 >= 0 && y1 >= 0 && x2 <= rightEdge && y2 <= visibleBottom;
    const overlaps = ([x1, y1, x2, y2]: number[]) => placed.some(([px1, py1, px2, py2]) => x1 < px2 && x2 > px1 && y1 < py2 && y2 > py1);
    const free = (width: number) => candidates.find(direction => onMap(rect(direction, width)) && !overlaps(rect(direction, width)));
    // Helst hele navnet på en fri plass; ellers bare nummeret på en fri plass; til sist hele navnet der det er plass på kartet
    const fullWidth = labelWidths[index];
    const named = free(fullWidth);
    if (named) { placed.push(rect(named, fullWidth)); return { direction: named, compact: false }; }
    const numbered = free(COMPACT_LABEL_WIDTH);
    if (numbered) { placed.push(rect(numbered, COMPACT_LABEL_WIDTH)); return { direction: numbered, compact: true }; }
    const fallback = candidates.find(direction => onMap(rect(direction, fullWidth))) ?? candidates[0];
    placed.push(rect(fallback, fullWidth));
    return { direction: fallback, compact: false };
  });
  return <>{children(labels)}</>;
}

// Stedene i klyngelaget styres direkte. Et søk kan fjerne og legge til over tusen markører
// (598 steder × tre verdenskopier); én og én, slik react-leaflet gjør det, regnet klyngene om
// for hver av dem og låste siden i sekunder. Her endres bare forskjellen, i bulk.
// Steder på nivå to: romber som bare finnes på kartet fra SPOT_ZOOM; under det står spillet hos byen
// always: nøklene til stedene under det åpne stedet, som vises uansett zoom (innrammingen kan lande lavere enn 12)
function SpotLayer({ spots, always, onClick }: { spots: Place[]; always: Set<string>; onClick: (position: Position) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  useEffect(() => {
    map.getContainer().classList.toggle('gt-zoom-spots', zoom >= SPOT_ZOOM);
    map.getContainer().classList.toggle('gt-zoom-spot-labels', zoom >= SPOT_LABEL_ZOOM);
    map.getContainer().classList.toggle('gt-zoom-halos', zoom >= HALO_ZOOM);
  }, [map, zoom]);
  const visible = zoom >= SPOT_ZOOM ? spots : spots.filter(place => always.has(posKey(place.position)));
  if (visible.length === 0) return null;
  return (
    <>
      {visible.flatMap(place => worldCopies(place.position).map((position, copyIndex) => (
        <Marker
          key={`${posKey(place.position)}-${copyIndex}`}
          position={position}
          icon={spotIcon(place.name, always.has(posKey(place.position)))}
          zIndexOffset={500}
          eventHandlers={{ click: () => onClick(place.position) }}
        >
          {!always.has(posKey(place.position)) && <Tooltip direction="top" offset={[0, -10]} className="gt-label gt-country-hover">{shortName(place.name)}</Tooltip>}
        </Marker>
      )))}
    </>
  );
}

function PlaceClusterLayer({ markers, iconCreateFunction, onClusterClick, onMarkerClick, groupRef }: {
  markers: ClusterMarker[];
  iconCreateFunction: (cluster: L.MarkerCluster) => L.Icon | L.DivIcon;
  onClusterClick: (e: L.LeafletMouseEvent) => void;
  onMarkerClick: (position: Position) => void;
  groupRef: React.RefObject<L.MarkerClusterGroup | null>;
}) {
  const map = useMap();
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const live = useRef(new Map<string, L.Marker>());
  // Første innlegging venter til kartet har tegnet én gang, så basemapet kommer opp før klyngetreet bygges
  const pendingAdd = useRef<number | undefined>(undefined);
  const markerClick = useRef(onMarkerClick);
  useEffect(() => { markerClick.current = onMarkerClick; });

  useEffect(() => {
    const layer = L.markerClusterGroup({
      zoomToBoundsOnClick: false,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      maxClusterRadius: CLUSTER_RADIUS,
      chunkedLoading: true,
      iconCreateFunction,
    });
    layer.on('clusterclick', e => onClusterClick(e as L.LeafletMouseEvent));
    map.addLayer(layer);
    group.current = layer;
    groupRef.current = layer;
    const markersOnMap = live.current;
    return () => {
      map.removeLayer(layer);
      markersOnMap.clear();
      group.current = null;
      groupRef.current = null;
    };
  }, [map, iconCreateFunction, onClusterClick, groupRef]);

  useEffect(() => {
    const layer = group.current;
    if (!layer) return;
    const next = new Map(markers.map(m => [m.key, m]));
    const removed: L.Marker[] = [];
    for (const [key, marker] of live.current) {
      if (!next.has(key)) {
        removed.push(marker);
        live.current.delete(key);
      }
    }
    const added: L.Marker[] = [];
    for (const m of markers) {
      const existing = live.current.get(m.key);
      if (existing) {
        if (existing.options.icon !== m.icon) existing.setIcon(m.icon);
        continue;
      }
      // Navnet kommer som en lapp i kartets egen stil med en gang pekeren er over, ikke som nettleserens
      // sene title-boble; landlappen viker for den (se CountryShapes)
      const marker = L.marker(m.position, { icon: m.icon, keyboard: false });
      marker.bindTooltip(escapeHtml(m.title), { direction: 'top', offset: [0, -12], className: 'gt-label gt-country-hover' });
      // Kopiene av verden ligger ±360° unna; stedet slås opp på sin egen lengdegrad
      marker.on('click', () => markerClick.current(normalizePosition(m.position)));
      live.current.set(m.key, marker);
      added.push(marker);
    }
    // Når de fleste markørene forsvinner (første bokstav i et søk), er det raskere å tømme laget
    // og legge inn de som blir igjen enn å plukke ut hver enkelt fra klyngetreet
    if (pendingAdd.current !== undefined) {
      // En utsatt første innlegging er ikke gjort ennå: glem den og legg inn alt som skal være der nå
      window.clearTimeout(pendingAdd.current); pendingAdd.current = undefined;
      layer.clearLayers();
      layer.addLayers([...live.current.values()]);
    } else if (layer.getLayers().length === 0 && removed.length === 0 && added.length > 200) {
      pendingAdd.current = window.setTimeout(() => {
        pendingAdd.current = undefined;
        layer.addLayers(added);
      }, 0);
    } else if (removed.length > live.current.size) {
      layer.clearLayers();
      layer.addLayers([...live.current.values()]);
    } else {
      if (removed.length) layer.removeLayers(removed);
      if (added.length) layer.addLayers(added);
    }
  }, [markers]);

  return null;
}

// Når verden er lavere enn kartfeltet (helt utzoomet på telefon), tegnet kartmotoren landfarge over Arktis og
// under Antarktis: et beige bånd rett mot det blå havet øverst. Hav over nordkanten og is under sørkanten i stedet,
// i kartets egne farger. Flatene ligger i en egen rute over flisene og følger kartet (8. november 2026).
const POLAR_ICE_LIGHT = toneColorText('hsl(0,0%,98%)');
const polarColors = () => getIsDark()
  ? { sea: NIGHT.water, ice: NIGHT.fills.landcover_glacier }
  : { sea: WATER, ice: POLAR_ICE_LIGHT };
const MERCATOR_EDGE = 85.0511;
function MapPolarBands() {
  const map = useMap();
  const dark = useIsDark();
  useEffect(() => {
    const pane = map.getPane('gtPolar') ?? map.createPane('gtPolar');
    pane.style.zIndex = '250';
    pane.style.pointerEvents = 'none';
    const band = (color: string) => {
      const el = L.DomUtil.create('div', '', pane);
      Object.assign(el.style, { position: 'absolute', left: '0', width: '0', background: color });
      return el;
    };
    const colors = polarColors();
    const north = band(colors.sea);
    const south = band(colors.ice);
    const update = () => {
      const size = map.getSize();
      const origin = map.containerPointToLayerPoint([0, 0]);
      const top = map.latLngToLayerPoint([MERCATOR_EDGE, 0]).y;
      const bottom = map.latLngToLayerPoint([-MERCATOR_EDGE, 0]).y;
      // God margin til sidene og utover, så flatene dekker også mens kartet dras
      const left = origin.x - size.x;
      const width = size.x * 3;
      const reach = size.y * 2;
      Object.assign(north.style, { left: `${left}px`, width: `${width}px`, top: `${top - reach}px`, height: `${reach}px` });
      Object.assign(south.style, { left: `${left}px`, width: `${width}px`, top: `${bottom}px`, height: `${reach}px` });
    };
    update();
    map.on('zoom move zoomend moveend viewreset resize', update);
    return () => {
      map.off('zoom move zoomend moveend viewreset resize', update);
      north.remove();
      south.remove();
    };
  }, [map, dark]);
  return null;
}

// Melder bare når kartet krysser zoomnivået der landflatene forsvinner, så App ikke tegnes på nytt ved hvert zoom
function MapShapesVisibility({ onChange }: { onChange: (visible: boolean) => void }) {
  const map = useMap();
  useMapEvents({ zoomend: () => onChange(map.getZoom() < COUNTRY_SHAPES_HIDE_ZOOM) });
  // Kartet kan starte nærmere enn utgangsnivået (en delt lenke til et sted)
  useEffect(() => { onChange(map.getZoom() < COUNTRY_SHAPES_HIDE_ZOOM); }, [map, onChange]);
  return null;
}

function MapTapHandler({ onTap }: { onTap: () => void }) {
  useMapEvents({
    click: event => {
      const target = event.originalEvent.target;
      if (target instanceof Element && target.closest('.leaflet-marker-icon, .leaflet-control, .leaflet-tooltip, .leaflet-interactive')) return;
      onTap();
    },
  });
  return null;
}

function MapDoubleTapZoom() {
  const map = useMap();

  useEffect(() => {
    // Handle touch double-taps ourselves because some mobile browsers do not
    // emit the native dblclick event Leaflet normally relies on.
    map.doubleClickZoom.disable();
    let previousTap: { time: number; x: number; y: number } | undefined;
    let lastTouchZoomAt = 0;
    const zoomAt = (latlng: L.LatLng) => {
      map.setZoomAround(latlng, Math.min(map.getZoom() + 1, map.getMaxZoom()), { animate: true });
    };
    const onDoubleClick = (event: L.LeafletMouseEvent) => {
      if (Date.now() - lastTouchZoomAt < 400) return;
      zoomAt(event.latlng);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.changedTouches.length !== 1) {
        previousTap = undefined;
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest('.leaflet-marker-icon, .leaflet-control, .leaflet-tooltip')) {
        previousTap = undefined;
        return;
      }
      const touch = event.changedTouches[0];
      const now = Date.now();
      const rect = map.getContainer().getBoundingClientRect();
      if (previousTap && now - previousTap.time <= 300 && Math.hypot(touch.clientX - previousTap.x, touch.clientY - previousTap.y) <= 40) {
        const point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);
        zoomAt(map.containerPointToLatLng(point));
        lastTouchZoomAt = now;
        previousTap = undefined;
        event.preventDefault();
      } else {
        previousTap = { time: now, x: touch.clientX, y: touch.clientY };
      }
    };

    const container = map.getContainer();
    map.on('dblclick', onDoubleClick);
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      map.off('dblclick', onDoubleClick);
      container.removeEventListener('touchend', onTouchEnd);
      map.doubleClickZoom.enable();
    };
  }, [map]);

  return null;
}

// Hver etappe tegnes som en bue, som en flyrute eller dampskipsrute på et kart, ikke som en rett strek.
// Buen regnes i Mercator-planet (zoom 0), så den har samme form ved alle zoomnivåer, og alle buer bøyer samme
// vei: mot nord, som flyruter på et verdenskart (en etappe rett nord–sør bøyer mot øst). En tur fram og tilbake
// følger dermed samme bue. Forkastet 3. november 2026: bøy mot venstre i reiseretningen med 18 %, som ga
// «øyne» der en rute gikk fram og tilbake og slangelinjer der etappene skiftet retning (Valiant Hearts).
const ARC_BOW = 0.12;
const ARC_STEPS = 24;
const arcPositions = (positions: Position[]): Position[] => {
  const crs = L.CRS.EPSG3857;
  const points = positions.map(([lat, lng]) => crs.latLngToPoint(L.latLng(lat, lng), 0));
  const out: Position[] = [positions[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) { out.push(positions[i + 1]); continue; }
    // Normalen som peker mot nord (minst y i Mercator-planet); loddrett etappe: mot øst
    let nx = dy / length, ny = -dx / length;
    if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx < 0)) { nx = -nx; ny = -ny; }
    const control = L.point((a.x + b.x) / 2 + nx * length * ARC_BOW, (a.y + b.y) / 2 + ny * length * ARC_BOW);
    for (let step = 1; step <= ARC_STEPS; step++) {
      const t = step / ARC_STEPS, u = 1 - t;
      const point = L.point(u * u * a.x + 2 * u * t * control.x + t * t * b.x, u * u * a.y + 2 * u * t * control.y + t * t * b.y);
      const latLng = crs.pointToLatLng(point, 0);
      out.push(step === ARC_STEPS ? positions[i + 1] : [latLng.lat, latLng.lng]);
    }
  }
  return out;
};

// Reiseruten trekkes ut som én sammenhengende strek fra første til siste stopp (.gt-route i App.css)
function RouteLine({ route, index, longitudeOffset = 0 }: { route: ResolvedRoute; index: number; longitudeOffset?: number }) {
  const positions = route.locations.map(l => l.position).filter(isValidPosition).map(([lat, lng]) => [lat, lng + longitudeOffset] as Position);
  if (positions.length < 2) return null;
  return (
    <Polyline
      positions={arcPositions(positions)}
      // className må gis til konstruktøren: pathOptions går gjennom setStyle, som ikke setter klasser
      className="gt-route"
      pathOptions={{ ...routeStyle(index), weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
      // pathLength 1 gjør at strek-animasjonen går like fort uansett hvor lang ruten er på skjermen
      eventHandlers={{ add: event => (event.target as L.Path).getElement()?.setAttribute('pathLength', '1') }}
    >
      <Tooltip sticky>{route.name}</Tooltip>
    </Polyline>
  );
}

function App() {
  const [initial] = useState(() => initialFromUrl(readUrl()));
  const [routeSelections, setRouteSelections] = useState<Record<number, string | undefined>>(() =>
    initial.selectedGameId !== undefined ? { [initial.selectedGameId]: initial.routeId } : {});

  // Filtre
  const [search, setSearch] = useState(initial.search);
  // Kartet, tellingen og klyngene følger søket med en liten forsinkelse, så feltet og forslagene
  // svarer med en gang mens man skriver. Å tømme søket slår gjennom straks.
  const [mapSearch, setMapSearch] = useState(initial.search);
  useEffect(() => {
    const timer = setTimeout(() => setMapSearch(search), search ? 220 : 0);
    return () => clearTimeout(timer);
  }, [search]);
  const [selectedGenres, setSelectedGenres] = useState(initial.filters.genres);
  const [selectedSettings, setSelectedSettings] = useState<string[]>(initial.filters.settings);
  const [selectedPlaceTypes, setSelectedPlaceTypes] = useState<PlaceType[]>(initial.filters.placeTypes);
  const [yearRange, setYearRange] = useState<[number, number]>(initial.filters.yearRange);
  const [storyYearRange, setStoryYearRange] = useState<[number, number]>(initial.filters.storyYearRange);
  const [includeVenues, setIncludeVenues] = useState(initial.filters.includeVenues);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchListOpen, setSearchListOpen] = useState(false);
  // «My atlas»: markeringene og hvilket av tallene som eventuelt avgrenser kartet
  const myAtlas = useMyAtlas();
  const [atlasFilter, setAtlasFilter] = useState<AtlasFilter>(NO_ATLAS_FILTER);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(readIntroDismissed);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Samme dialog viser enten «About» eller forklaringen av hvordan steder velges
  const [infoTab, setInfoTab] = useState<'about' | 'places'>('about');
  const [atlasDialog, setAtlasDialog] = useState<AtlasDialog | null>(null);
  const [atlasToast, setAtlasToast] = useState<AtlasToast | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [panel, setPanel] = useState<PanelState | null>(initial.panel);
  const [mapTapCount, setMapTapCount] = useState(0);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readThemeChoice);
  const [countryShapesVisible, setCountryShapesVisible] = useState(() => homeMapZoom() < COUNTRY_SHAPES_HIDE_ZOOM);
  // Rutelinjene og andre farger som må være ekte verdier leses når de tegnes; App tegnes på nytt ved temabytte
  useIsDark();
  // Toppfeltets underkant som CSS-variabel: søkelista på telefon starter der (atlas.css, .gt-search-positioner)
  const mastheadRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const masthead = mastheadRef.current;
    if (!masthead || typeof ResizeObserver === 'undefined') return;
    const update = () => document.documentElement.style.setProperty('--gt-masthead-bottom', `${Math.round(masthead.getBoundingClientRect().bottom)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, []);
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(initial.selectedGameId);
  const [mapTarget, setMapTarget] = useState<MapTarget | undefined>(initial.target);
  const [userPosition, setUserPosition] = useState<Position | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(initial.target?.seq ?? 0);
  // Panelets seq må alltid øke, også etter at panelet har vært lukket: landflaten husker hvilken seq den
  // sist rammet inn, og startet tellingen på nytt, fikk neste land samme seq og ble aldri rammet inn
  const panelSeq = useRef(initial.panel?.seq ?? 0);
  // Et land åpnes med arket nede på telefon (se LocationFlyout); lenker rett til et land også
  // Panelet (seq) som skal åpnes med arket nede: et land åpnet ved å trykke på landflaten, eller fra adressen.
  // Knyttet til panelet, ikke en teller: telleren ble lest på nytt hver gang panelet ble bygd, og etter at ett
  // land var åpnet kom alle steder etterpå opp med arket nede (7. november 2026).
  const [peekFor, setPeekFor] = useState<number | undefined>(initial.panel?.view.mode === 'country' ? initial.panel.seq : undefined);
  // Stoppet på spillsiden som sist ble trykket: første trykk flytter bare kartet dit, så ruten og spillet
  // blir stående; et nytt trykk på samme stopp åpner stedet. Knyttet til panelets seq, så et nytt panel
  // starter på nytt uten en effekt.
  const [focusedStop, setFocusedStop] = useState<{ key: string; seq: number }>();
  const mapRef = useRef<L.Map>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const infoDialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Søkeeffekten skal bare reagere på det brukeren skriver, ikke på søk hentet fra lenken
  const searchTouched = useRef(false);

  const rememberIntroDismissal = (dismissed: boolean) => {
    if (introDismissed === dismissed) return;
    setIntroDismissed(dismissed);
    writeIntroDismissed(dismissed);
  };

  const query = effectiveQuery(search);
  const mapQuery = effectiveQuery(mapSearch);
  // Treffene til forslagslista regnes ut for hvert tegn (billig); kartet bruker det forsinkede søket
  // Den forhåndsrendrede siden står til appen er tegnet (main.tsx)
  useLayoutEffect(() => { document.getElementById('static-content')?.remove(); }, []);
  // Notater, kilder og beskrivelser lastes rett etter første visning (gameData.ts); appen tegnes på nytt når de er inne
  const detailsReady = useSyncExternalStore(subscribeCatalogDetails, catalogDetailsLoaded, () => false);
  useEffect(() => { void loadCatalogDetails(); }, []);
  const filteredHits = useMemo(
    () => filterGames({ query, genres: selectedGenres, yearRange, storyYearRange, includeVenues, settings: selectedSettings, placeTypes: selectedPlaceTypes }),
    // detailsReady: søket er bygget på nytt med notatene
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, selectedGenres, yearRange, storyYearRange, includeVenues, selectedSettings, selectedPlaceTypes, detailsReady],
  );
  // Tallene i filteret følger de andre valgene: med «1800s» valgt sier «Adventure» hvor mange av de spillene
  // som er eventyr, ikke hvor mange i hele atlaset. Hver gruppe teller uten sitt eget valg, som i nettbutikker.
  const facetCounts = useMemo(() => {
    const base = { query, yearRange, storyYearRange, includeVenues, settings: selectedSettings };
    const forGenres = filterGames({ ...base, genres: [], placeTypes: selectedPlaceTypes }).map(hit => hit.game);
    const genres = new Map(GENRE_FAMILIES.map(family => [family.label, forGenres.filter(game => game.genres.some(genre => family.genres.includes(genre))).length]));
    const typePlaces = [...buildPlaces(filterGames({ ...base, genres: selectedGenres, placeTypes: [] }).map(hit => hit.game)).values()];
    const placeTypes = new Map(PLACE_TYPES.map(({ value }) => [value, typePlaces.filter(place => place.placeTypes.has(value)).length]));
    return { genres, placeTypes };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedGenres, yearRange, storyYearRange, includeVenues, selectedSettings, selectedPlaceTypes, detailsReady]);
  const mapHits = useMemo(
    () => mapQuery === query
      ? filteredHits
      : filterGames({ query: mapQuery, genres: selectedGenres, yearRange, storyYearRange, includeVenues, settings: selectedSettings, placeTypes: selectedPlaceTypes }),
    [mapQuery, query, filteredHits, selectedGenres, yearRange, storyYearRange, includeVenues, selectedSettings, selectedPlaceTypes],
  );
  const filteredGames = useMemo(() => {
    const list = mapHits.map(hit => hit.game);
    const field = atlasFilter.game;
    if (!field) return list;
    return list.filter(game => {
      const mark = myAtlas.games[String(game.id)];
      return field === 'not-played' ? !mark?.played : !!mark?.[field];
    });
  }, [mapHits, atlasFilter.game, myAtlas]);
  // Treff som bare ligner søket, f.eks. «Firewath» → Firewatch, sies fra om
  const approximate = query.length > 0 && filteredHits.length > 0 && filteredHits.every(hit => hit.exact === false);
  const allPlaces = useMemo(() => buildPlaces(filteredGames, selectedPlaceTypes), [filteredGames, selectedPlaceTypes]);
  // Det du har markert på hvert kartpunkt; et punkt teller som markert når én av sted-id-ene der er det
  const atlasCounts = useMemo(() => {
    const marks = Object.values(myAtlas.games);
    return {
      been: atlasPlaces(myAtlas, 'been').length,
      wantGo: atlasPlaces(myAtlas, 'want').length,
      played: marks.filter(mark => mark.played).length,
      wantPlay: marks.filter(mark => mark.want).length,
    };
  }, [myAtlas]);
  const pointMarks = useMemo(() => {
    const marks = new Map<string, { been: boolean; want: boolean }>();
    if (Object.keys(myAtlas.places).length === 0) return marks;
    for (const [key, place] of allPlaces) {
      const ids = place.games.flatMap(game => game.locations.filter(l => posKey(l.position) === key).map(l => l.placeId));
      const mark = placeMarkFor(myAtlas, ids);
      if (mark.been || mark.want) marks.set(key, mark);
    }
    return marks;
  }, [allPlaces, myAtlas]);
  const places = useMemo(() => {
    const field = atlasFilter.place;
    if (!field) return allPlaces;
    return new Map([...allPlaces].filter(([key, place]) => field === 'not-been' ? isVisitable(place) && !pointMarks.get(key)?.been : !!pointMarks.get(key)?.[field]));
  }, [allPlaces, pointMarks, atlasFilter.place]);

  const view = panel?.view;
  const openGame = view?.mode === 'game' ? gameById.get(view.id) : undefined;
  // Spillet som vises (åpent i panelet eller valgt i en liste) får alle stedene sine markert og navngitt,
  // også når søk eller filter ellers skjuler dem, og også når stedene ikke har en fast rekkefølge
  const focusGame = openGame ?? (selectedGameId !== undefined ? gameById.get(selectedGameId) : undefined);
  const focusRoutes = focusGame ? getGameRoutes(focusGame) : [];
  const selectedRouteId = focusGame ? routeSelections[focusGame.id] : undefined;
  const selectedRoute = focusRoutes.find(route => route.id === selectedRouteId);
  const focusStops = (selectedRoute?.locations ?? focusGame?.locations ?? []).filter(l => isValidPosition(l.position));
  const focusKeys = new Set(focusStops.map(l => posKey(l.position)));
  const openGameHidden = !!openGame && !filteredGames.some(game => game.id === openGame.id);
  const activeKey = view?.mode === 'place' ? posKey(view.position) : undefined;
  // Steder som matcher søket markeres på kartet
  const searchKeys = new Set(filteredHits.flatMap(hit => hit.matchedLocations.filter(location => !selectedPlaceTypes.length || selectedPlaceTypes.includes(location.placeType)).map(l => posKey(l.position))));

  // Andre steder i nærheten, nærmest først
  // Med flere utgangspunkt (stoppene i et spill) sier hver rad hvilket stopp den er nær: ellers sto steder i
  // Istanbul og Lhasa om hverandre i én liste
  const nearbyOf = (origins: Array<{ position: Position; name?: string }>, exclude: Set<string>, limit = 6): NearbyPlace[] =>
    origins.length === 0 ? [] : [...places]
      .filter(([key]) => !exclude.has(key))
      .map(([, p]) => {
        const nearest = origins.map(o => ({ o, km: distanceKm(o.position, p.position) })).sort((a, b) => a.km - b.km)[0];
        return { name: p.name, position: p.position, games: p.games.length, km: nearest.km, from: origins.length > 1 ? nearest.o.name : undefined };
      })
      .filter(p => p.km <= NEARBY_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, limit);

  // Det panelet skal vise akkurat nå
  const byYear = (a: Game, b: Game) => a.year - b.year || a.name.localeCompare(b.name);
  let panelTitle = "";
  let sections: PanelSection[] = [];
  let nearby: NearbyPlace[] | undefined;
  let sameEra: Game[] | undefined;
  if (view?.mode === 'place') {
    const place = places.get(posKey(view.position));
    panelTitle = place?.name ?? view.name;
    sections = [{ position: view.position, games: [...(place?.games ?? [])].sort(byYear), spots: place?.spots }];
    // Byen og stedene inne i den er samme sted i to størrelser: en by lister ikke sine egne steder som naboer
    // (de står som «At …»), og et sted inne i byen lister ikke byen (Incheon og Songdo viste hverandre)
    const here = posKey(view.position);
    const related = new Set([here]);
    place?.spots?.forEach(list => list.forEach(loc => related.add(posKey(loc.position))));
    if (place?.spot) {
      for (const [key, other] of places) {
        if ([...(other.spots?.values() ?? [])].some(list => list.some(loc => posKey(loc.position) === here))) related.add(key);
      }
    }
    nearby = nearbyOf([{ position: view.position }], related);
  } else if (view?.mode === 'cluster') {
    // Hvert spill vises én gang, under stedet med flest spill (byen med steder under seg først ved likt antall).
    // Har klyngen bare ett spill, står det under hvert sted: da er poenget hva som skjer på hvert av dem,
    // og lista ville ellers ha krympet til ett sted (Rennes-le-Château-prikken åpnet som «Château de Blanchefort»).
    const seen = new Set<number>();
    const clusterPlaces = view.positions
      .map(p => places.get(posKey(p)))
      .filter((p): p is Place => p !== undefined)
      .sort((a, b) => b.games.length - a.games.length || (b.spots?.size ?? 0) - (a.spots?.size ?? 0));
    const singleGame = new Set(clusterPlaces.flatMap(p => p.games.map(g => g.id))).size === 1;
    sections = clusterPlaces.map(p => {
      const own = (singleGame ? p.games : p.games.filter(g => !seen.has(g.id))).sort(byYear);
      own.forEach(g => seen.add(g.id));
      return { title: p.name, position: p.position, games: own };
    }).filter(s => s.games.length > 0);
    panelTitle = sections.length === 1 ? sections[0].title! : sections.length ? `${shortName(sections[0].title!)} area` : "";
  } else if (view?.mode === 'search') {
    // Behold relevansrekkefølgen fra søket; steds- og klyngepaneler sorteres fortsatt på år.
    panelTitle = `“${view.query}”`;
    sections = [{ games: filteredGames }];
  } else if (view?.mode === 'game' && openGame) {
    panelTitle = openGame.name;
    sections = [{ games: [openGame] }];
    const own = openGame.locations.map(l => l.position).filter(isValidPosition);
    // Avstand fra midten av et land eller en region sier ingenting («Wales 313 km» fra midten av Irland)
    const origins = openGame.locations.filter(l => isValidPosition(l.position) && l.placeType !== 'country' && l.placeType !== 'region')
      .map(l => ({ position: l.position, name: shortName(l.name) }));
    nearby = nearbyOf(origins, new Set(own.map(posKey)));
    // Spill med handling innenfor ti år av dette
    const years = openGame.storyYears;
    const closeness = (g: Game) => Math.min(...g.storyYears.flatMap(y => years.map(gy => Math.abs(y - gy))));
    sameEra = years.length
      ? games.filter(g => g.id !== openGame.id && g.storyYears.some(y => years.some(gy => Math.abs(y - gy) <= 10)))
          .sort((a, b) => closeness(a) - closeness(b) || byYear(a, b))
          .slice(0, 5)
      : undefined;
  } else if (view?.mode === 'country') {
    // Alle spill med et sted i landet, hvert spill én gang, under stedet med flest spill
    panelTitle = countryTitle(view.iso);
    const seen = new Set<number>();
    // Steder på nivå to står ikke som egne avsnitt: spillet er alt listet hos byen
    const inCountry = [...places].filter(([key, p]) => !p.spot && countryOfPoint(key, p) === view.iso).map(([, p]) => p).sort((a, b) => b.games.length - a.games.length);
    sections = inCountry.map(p => {
      const own = p.games.filter(g => !seen.has(g.id)).sort(byYear);
      own.forEach(g => seen.add(g.id));
      return { title: p.name, position: p.position, games: own, spots: p.spots };
    }).filter(s => s.games.length > 0);
  } else if (view?.mode === 'series') {
    // Seriens spill i årsrekkefølge, ett avsnitt; stedene nåles alle på kartet
    panelTitle = view.name;
    sections = [{ games: seriesGames.get(view.name) ?? [] }];
  } else if (view?.mode === 'index') {
    panelTitle = 'All places';
  } else if (view?.mode === 'atlas') {
    panelTitle = 'My atlas';
  } else if (view?.mode === 'near') {
    panelTitle = 'Near you';
    sections = [...places.values()]
      .map(p => ({ place: p, km: distanceKm(view.position, p.position) }))
      .filter(x => x.km <= NEAR_ME_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, 12)
      .map(({ place, km }) => ({ title: place.name, meta: `${Math.round(km)} km away`, position: place.position, games: [...place.games].sort(byYear) }));
  }
  const panelGames = sections.reduce((n, s) => n + s.games.length, 0);
  const placeIndex: IndexPlace[] | undefined = view?.mode === 'index'
    ? [...places.values()].map(p => ({ name: p.name, position: p.position, games: p.games.length, placeType: p.placeTypes.size === 1 ? [...p.placeTypes][0] : 'area' }))
    : undefined;
  const panelPlace = view?.mode === 'place' ? places.get(posKey(view.position)) : undefined;
  const panelPlaceType = view?.mode === 'country' ? 'country' : panelPlace?.placeTypes.size === 1 ? [...panelPlace.placeTypes][0] : undefined;
  // Sted-id-ene bak kartpunktet; «Been here» markerer alle, så et punkt med flere stedstyper telles én gang
  // Steder som bare finnes som oppdiktede (Atlantis) kan du ikke reise til, så de får ikke knappene
  // Postene bak punktet gir beskrivelse og lenker også for oppdiktede steder; knappene får bare de som kan besøkes
  const panelRecordIds = view?.mode === 'country'
    ? [countryRecord(view.iso)?.id].filter((id): id is string => !!id)
    : panelPlace
      ? [...new Set(panelPlace.games.flatMap(game => game.locations.filter(l => posKey(l.position) === posKey(panelPlace.position)).map(l => l.placeId)))]
      : [];
  const panelPlaceIds = view?.mode === 'country' || (panelPlace && isVisitable(panelPlace)) ? panelRecordIds : [];
  const panelVisible = !!panel && (panelGames > 0 || (placeIndex?.length ?? 0) > 0 || view?.mode === 'atlas');

  // Hvert land med spill i seg er en flate på kartet. Et spill satt i hele landet har i tillegg en prikk med ring
  // på landets navnepunkt, som en region: uten den så telefonen bare de andre prikkene (Island så ut til å ha ett
  // spill, ved Vík, mens to spill er satt i hele landet), og klyngene talte ikke med disse spillene.
  const countryContent = useMemo(() => {
    const out = new Map<string, { keys: Set<string>; games: Set<number>; countryKeys: Set<string> }>();
    for (const [key, place] of places) {
      const iso = countryOfPoint(key, place);
      if (!iso || !countryLabel(iso)) continue;
      const entry = out.get(iso) ?? { keys: new Set(), games: new Set(), countryKeys: new Set() };
      entry.keys.add(key);
      place.games.forEach(game => entry.games.add(game.id));
      if (isCountryPoint(place) && !countrySmall(iso)) entry.countryKeys.add(key);
      out.set(iso, entry);
    }
    return out;
  }, [places]);
  const openCountryIso = view?.mode === 'country' ? view.iso : undefined;
  const wholeCountryKeys = useMemo(() => new Set([...countryContent.values()].flatMap(entry => [...entry.countryKeys])), [countryContent]);
  // Et åpent land har allerede det røde omrisset; prikken i tillegg ble for mye. Den kommer tilbake når kartet er
  // zoomet så nært at landflatene ikke tegnes (8. november 2026).
  const hiddenCountryDots = openCountryIso && countryShapesVisible ? countryContent.get(openCountryIso)?.countryKeys : undefined;
  const atCountryName = (key: string, icon: L.DivIcon) => (wholeCountryKeys.has(key) ? belowCountryName(icon) : icon);
  const countryShapes = new Map<string, CountryPlace>();
  for (const [iso, entry] of countryContent) {
    const stopInside = focusStops.some(l => countryOf(l.placeId) === iso);
    const state = iso === openCountryIso || [...entry.countryKeys].some(key => focusKeys.has(key)) ? 'selected'
      : [...entry.countryKeys].some(key => searchKeys.has(key)) ? 'active'
      : (focusGame && !stopInside) || (openCountryIso && iso !== openCountryIso) ? 'dimmed' : 'normal';
    countryShapes.set(iso, { iso, name: countryTitle(iso), games: entry.games.size, state });
  }
  const shadedCountries = useMemo(() => beenCountries(myAtlas), [myAtlas]);

  // Klyngene dempes når et spill er valgt, slik at reisestoppene står ut, og når et land er åpent,
  // slik at landets egne steder står ut: en klynge dempes da når ingen av stedene i den ligger i landet
  const clusterGroupRef = useRef<L.MarkerClusterGroup>(null);
  const openSeriesKeys = view?.mode === 'series' ? new Set((seriesGames.get(view.name) ?? []).flatMap(g => g.locations.filter(l => isValidPosition(l.position)).map(l => posKey(l.position)))) : undefined;
  const countryKeysOpen = openCountryIso ? countryContent.get(openCountryIso)?.keys : openSeriesKeys;
  const dimClustersRef = useRef<{ all: boolean; inside?: Set<string> }>({ all: !!focusGame, inside: countryKeysOpen });
  const dimSignature = `${focusGame ? 'g' : ''}|${openCountryIso ?? ''}|${view?.mode === 'series' ? view.name : ''}|${countryKeysOpen?.size ?? ''}`;
  useEffect(() => {
    dimClustersRef.current = { all: !!focusGame, inside: countryKeysOpen };
    clusterGroupRef.current?.refreshClusters();
    // dimSignature dekker det som endrer dempingen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimSignature]);

  // Klyngeikonet viser antall spill, ikke antall steder, og navnene på noen av dem ved hover
  const placesRef = useRef(places);
  // Layout-effekt: den kjører før klyngelagets vanlige effekt legger inn markørene og tegner ikonene.
  // Med vanlig useEffect slo ikonene opp nye markører i den gamle tabellen og viste «0».
  useLayoutEffect(() => { placesRef.current = places; }, [places]);
  // Klyngene viser hvor mange av stedene inni du har vært; de tegnes på nytt når markeringene endres
  const pointMarksRef = useRef(pointMarks);
  useLayoutEffect(() => { pointMarksRef.current = pointMarks; }, [pointMarks]);
  // Bare når selve markeringene endres; et nytt søk bygger klyngene uansett
  const pointMarksSignature = [...pointMarks].map(([key, mark]) => `${key}:${mark.been ? 'b' : ''}${mark.want ? 'w' : ''}`).sort().join('|');
  useEffect(() => { clusterGroupRef.current?.refreshClusters(); }, [pointMarksSignature]);
  const clusterIcon = useMemo(() => (cluster: L.MarkerCluster) => {
    const clusterGames = new Map<number, Game>();
    const children = cluster.getAllChildMarkers();
    const childPlace = (marker: L.Marker) => {
      const ll = marker.getLatLng();
      return placesRef.current.get(posKey(normalizePosition([ll.lat, ll.lng])));
    };
    for (const m of children) {
      childPlace(m)?.games.forEach(g => clusterGames.set(g.id, g));
    }
    const n = clusterGames.size;
    let beenHere = 0;
    let wantHere = 0;
    for (const m of children) {
      const ll = m.getLatLng();
      const mark = pointMarksRef.current.get(posKey(normalizePosition([ll.lat, ll.lng])));
      if (mark?.been) beenHere++;
      else if (mark?.want) wantHere++;
    }
    const yours = beenHere ? `, you've been to ${beenHere}` : wantHere ? `, ${wantHere} you want to go to` : '';
    const label = `${count(n, 'game')} in ${count(children.length, 'place')}${yours}`;
    const dimming = dimClustersRef.current;
    const dim = dimming.all || (dimming.inside && !children.some(m => { const ll = m.getLatLng(); return dimming.inside!.has(posKey(normalizePosition([ll.lat, ll.lng]))); })) ? ' is-dimmed' : '';
    // Ett spill på flere steder i nærheten vises som en prikk, ikke som et tall; antall steder står i
    // hjørnet, så prikken ikke ser ut som ett sted (Rennes-le-Château så ut som én prikk med tre steder bak)
    if (n === 1) {
      const singlePlace = children[0] ? childPlace(children[0]) : undefined;
      const singleType = singlePlace?.settingTypes.size === 1 ? [...singlePlace.settingTypes][0] : 'real';
      const pinPrecision = singlePlace?.approximate ? ' is-approximate' : '';
      return L.divIcon({
        html: `<div class="gt-cluster is-single${dim} is-${singleType}${pinPrecision}" role="img" aria-label="${label}${singlePlace?.approximate ? ', approximate area' : ', specific site'}" style="width:20px;height:20px"></div>`
          + (beenHere ? BEEN_BADGE : wantHere ? WANT_BADGE : `<span class="gt-dot-count" aria-hidden="true">${children.length}</span>`),
        className: 'gt-marker',
        iconSize: [44, 44],
      });
    }
    // Området navngis etter landet de fleste stedene ligger i
    const countries = new Map<string, number>();
    for (const m of children) {
      const name = childPlace(m)?.name.replace(/\s*\([^)]*\)/g, '');
      const country = name?.includes(',') ? name.split(',').pop()!.trim() : undefined;
      if (country) countries.set(country, (countries.get(country) ?? 0) + 1);
    }
    const [topCountry, topCount] = [...countries].sort((a, b) => b[1] - a[1])[0] ?? [];
    const area = topCountry && topCount! >= children.length * 0.6 ? topCountry : 'Several countries';
    const names = [...clusterGames.values()].sort((a, b) => a.year - b.year).slice(0, 3)
      .map(g => `<li><b>${g.year}</b> ${escapeHtml(g.name)}</li>`).join('');
    const more = n > 3 ? `<li class="gt-cluster-more">+ ${count(n - 3, 'more game')}</li>` : '';
    // Størrelsen følger antallet, så tette områder leses som tette, men holder seg under klyngeradiusen
    // (50 px): klynger kan ligge 50 px fra hverandre, og med opptil 64 px la de seg oppå hverandre i Europa.
    // Fylte merker leses fint fra 26 til 35 px; 16 % mindre enn før 8. november 2026, så det ble luft mellom
    // klyngene i Europa og by- og landnavnene kom fram igjen
    const size = Math.round(0.84 * Math.min(42, 26 + 4.5 * Math.log2(Math.max(n, 2))));
    return L.divIcon({
      html: `<div class="gt-cluster${dim}" role="img" aria-label="${label}" style="width:${size}px;height:${size}px;font-size:${n < 100 ? 14 : 13}px">${n}${beenHere ? `<span class="gt-mark-count" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>${beenHere}</span>` : ''}</div>`
        + `<ul class="gt-cluster-peek" aria-hidden="true"><li class="gt-cluster-area">${escapeHtml(area)} · ${count(n, 'game')}</li>${names}${more}</ul>`,
      className: 'gt-cluster-icon',
      iconSize: [Math.max(size, 44), Math.max(size, 44)],
    });
  }, []);

  // Tidsspennet handlingen i de synlige spillene dekker, innenfor valgt spenn
  const issueEra = eraSpan(filteredGames.flatMap(g =>
    g.storyYears.filter(y => y >= storyYearRange[0] && y <= storyYearRange[1])));

  // Racing og sport er skjult når brukeren verken har søkt, valgt sjangeren eller slått på «All games»
  const venuesHidden = !includeVenues && !mapQuery && !selectedGenres.includes(VENUE_FAMILY);
  const catalogSize = venuesHidden ? games.length - venueGameCount : games.length;
  const yearsFull = yearRange[0] === minYear && yearRange[1] === maxYear;
  const storyFull = storyYearRange[0] === minStoryYear && storyYearRange[1] === maxStoryYear;
  // «All games» teller som et aktivt filter, så merket på Filter-knappen viser veien tilbake
  const activeFilters = (selectedGenres.length ? 1 : 0) + (yearsFull ? 0 : 1) + (storyFull ? 0 : 1) + (includeVenues ? 1 : 0) + (selectedSettings.length ? 1 : 0) + (selectedPlaceTypes.length ? 1 : 0) + (atlasFilter.place ? 1 : 0) + (atlasFilter.game ? 1 : 0);
  const introVisible = !introDismissed && !panel && !query && activeFilters === 0 && !notice && !filterOpen;

  const resetFilters = () => {
    setSelectedGenres([]);
    setSelectedSettings([]);
    setSelectedPlaceTypes([]);
    setYearRange([minYear, maxYear]);
    setStoryYearRange([minStoryYear, maxStoryYear]);
    setIncludeVenues(false);
    setAtlasFilter(NO_ATLAS_FILTER);
  };

  // Brukes når det åpne spillet er skjult av søk eller filter
  const clearSearchAndFilters = () => {
    searchTouched.current = false;
    setSearch('');
    resetFilters();
    if (openGame && isVenueGame(openGame)) setIncludeVenues(true);
  };
  // Et søk er et spørsmål, og å åpne noe er svaret: når et sted, spill, land eller en klyngeliste åpnes,
  // tømmes søkefeltet, så det som åpnes vises i full sammenheng og ikke silt gjennom et ord man har glemt.
  // Filtrene står, de er valg og ikke spørsmål. Nettleserens tilbake-knapp henter søket fra adressen.
  const endSearch = () => {
    if (!search) return;
    searchTouched.current = false;
    setSearch('');
  };
  // Om stedet ville vist spill med filtrene alene, uten søketeksten
  const shownWithoutSearch = (key: string) =>
    filterGames({ query: '', genres: selectedGenres, yearRange, storyYearRange, includeVenues, settings: selectedSettings, placeTypes: selectedPlaceTypes })
      .some(hit => hit.game.locations.some(l => posKey(l.position) === key));

  const moveMap = (move: MapMove) => setMapTarget({ ...move, seq: ++seq.current });
  const recenterPlaceOnSheetExpand = useCallback(() => {
    if (panel?.view.mode === 'place') {
      setMapTarget({ kind: 'point', position: panel.view.position, seq: ++seq.current });
    }
  }, [panel]);

  const openPanel = (next: Panel, opts: { autoFocus?: boolean; fromPanel?: boolean } = {}) => {
    const { autoFocus = true, fromPanel = false } = opts;
    // Husk hva som åpnet panelet, så fokus kan føres tilbake dit
    if (autoFocus && !fromPanel) returnFocusRef.current = document.activeElement as HTMLElement | null;
    rememberIntroDismissal(true);
    const nextSeq = ++panelSeq.current;
    const leftAt = document.querySelector<HTMLElement>('[data-panel-scroll]')?.scrollTop ?? 0;
    setPanel(prev => ({
      view: next,
      seq: nextSeq,
      autoFocus,
      history: fromPanel && prev ? [...prev.history, prev.view] : [],
      scrolls: fromPanel && prev ? [...(prev.scrolls ?? []), leftAt] : [],
    }));
    return nextSeq;
  };

  const restoreFocus = () => {
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    if (el && el.isConnected) el.focus({ preventScroll: true });
  };

  const closePanel = () => {
    setPanel(null);
    setSelectedGameId(undefined);
    restoreFocus();
  };

  // Serien som samleside: spillene i årsrekkefølge og alle stedene deres på kartet
  const showSeries = (name: string, fromPanel = true) => {
    const list = seriesGames.get(name);
    if (!list) return;
    setSelectedGameId(undefined);
    endSearch();
    if (!includeVenues && list.every(isVenueGame)) setIncludeVenues(true);
    openPanel({ mode: 'series', name }, { fromPanel });
    moveMap({ kind: 'bounds', ...gameFit(list.flatMap(g => g.locations)) });
  };

  // Arket følger det man trykket på: landflaten på kartet åpner landet med arket nede, så landet ses; en prikk
  // eller en lenke (et spills stedsliste, søket) åpner det som et sted, med arket oppe og spillene synlige.
  // Før åpnet også landprikkene (Norge, Tyskland …) med arket nede, og steder så ut til å åpne seg med et
  // minimalt ark (7. november 2026).
  const countryPeekRef = useRef(true);
  // Der landet ble klikket på kartet, så kartet flyr til den delen (Alaska, ikke fastlandet); tomt ellers
  const countryClickRef = useRef<[number, number] | undefined>(undefined);
  const openCountry = (iso: string, fromPanel = false, peek = false, at?: [number, number]) => {
    countryPeekRef.current = peek;
    countryClickRef.current = at;
    setSelectedGameId(undefined);
    endSearch();
    // Bare racing- og sportsspill i landet, og de er skjult: vis alle spill, ellers blir panelet tomt
    if (!countryContent.has(iso) && games.some(g => g.locations.some(l => countryOf(l.placeId) === iso))) setIncludeVenues(true);
    const seq = openPanel({ mode: 'country', iso }, { fromPanel });
    if (peek) setPeekFor(seq);
  };

  const activeStopKey = focusedStop && panel && focusedStop.seq === panel.seq ? focusedStop.key : undefined;
  const visitStop = (position: Position) => {
    const key = posKey(position);
    // På spillsiden, og i en liste der et spills reise vises (seriesiden), går første trykk på et stopp bare dit
    // på kartet; trykk igjen åpner stedet. Ellers forlot et trykk på «3 Nepal» reisen og åpnet hele Nepal.
    const onJourney = view?.mode === 'game' || (view?.mode === 'series' && !!focusGame?.locations.some(l => posKey(l.position) === key));
    if (onJourney && panel && activeStopKey !== key) {
      setFocusedStop({ key, seq: panel.seq });
      const place = places.get(key) ?? buildPlaces(games).get(key);
      moveMap({ kind: 'point', position, minZoom: place?.spot ? SPOT_ZOOM : place ? clearZoom(position, place) : undefined });
      return;
    }
    showPlace(position, true);
  };

  const showPlace = (position: Position, fromPanel = false) => {
    const visiblePlace = places.get(posKey(position));
    const place = visiblePlace ?? buildPlaces(games).get(posKey(position));
    if (!place) {
      // En landpost uten egne spill (Russland i My atlas, arvet fra Moskva) åpner landet
      const records = canonicalPlaces.filter(p => posKey([p.position.lat, p.position.lon]) === posKey(position));
      const country = records.find(p => p.placeType === 'country');
      const iso = country ? countryOf(country.id) : undefined;
      if (iso && countryLabel(iso)) { openCountry(iso, fromPanel); return; }
      // Et område uten egne spill (Toscana i My atlas, arvet fra Firenze) viser stedene inni det som en liste
      const ids = new Set(records.map(r => r.id));
      const inside = [...buildPlaces(games)].filter(([key, p]) => !p.spot && p.games.some(game => game.locations.some(l =>
        posKey(l.position) === key && ancestorsOf(l.placeId).some(id => ids.has(id))))).map(([, p]) => p.position);
      if (inside.length === 0) return;
      clearSearchAndFilters();
      setIncludeVenues(true);
      openPanel({ mode: 'cluster', positions: inside }, { fromPanel });
      setSelectedGameId(undefined);
      moveMap({ kind: 'bounds', positions: inside, maxZoom: 12, tight: true });
      return;
    }
    // Et punkt som er «hele landet» åpner landet
    const iso = isCountryPoint(place) ? countryOfPoint(posKey(position), place) : undefined;
    if (iso && countryLabel(iso)) { openCountry(iso, fromPanel); return; }
    // A visible game can link to a place excluded by the current filters.
    // Restore the catalogue so the destination panel has games to display.
    if (visiblePlace || (search && shownWithoutSearch(posKey(position)))) {
      endSearch();
    } else {
      clearSearchAndFilters();
      setIncludeVenues(true);
    }
    openPanel({ mode: 'place', position, name: place.name }, { fromPanel });
    // Behold reiseruten når man reiser videre langs den
    if (!focusGame?.locations.some(l => posKey(l.position) === posKey(position))) {
      setSelectedGameId(undefined);
    }
    // Et sted på nivå to vises først fra SPOT_ZOOM, så kartet går minst dit. Et sted med nivå to under seg
    // rammes inn sammen med dem, så rombene kommer fram og lista og kartet sier det samme.
    if (place.spots?.size) {
      const inside = [...new Set([...place.spots.values()].flatMap(list => list.map(loc => loc.position)))];
      moveMap({ kind: 'bounds', positions: [position, ...inside], maxZoom: 14, tight: true });
    } else {
      moveMap({ kind: 'point', position, minZoom: Math.max(placeMinZoom(place.placeTypes, place.spot), clearZoom(position, place) ?? 0) });
    }
  };
  // Den nålede prikken skal stå for seg selv: ligger en annen prikk innenfor klyngeradiusen på zoomen
  // kartet har, går kartet inn til den ikke gjør det (høyst 14). Ellers lå nåla oppå klynga med
  // stedene den nettopp var listet sammen med (Rennes-les-Bains over en «2»).
  const clearZoom = (position: Position, place: Place) => {
    const map = mapRef.current;
    if (!map) return undefined;
    const others = [...places.values()].filter(p => p !== place && !p.spot).map(p => L.latLng(p.position));
    const target = L.latLng(position);
    const crowded = (zoom: number) => {
      const here = map.project(target, zoom);
      return others.some(other => map.project(other, zoom).distanceTo(here) < CLUSTER_RADIUS + 8);
    };
    let zoom = Math.max(map.getZoom(), placeMinZoom(place.placeTypes, place.spot));
    if (!crowded(zoom)) return undefined;
    while (zoom < 14 && crowded(zoom)) zoom++;
    return zoom;
  };

  const showGame = (game: Game, fromPanel = true) => {
    endSearch();
    openPanel({ mode: 'game', id: game.id }, { fromPanel });
    setSelectedGameId(game.id);
    const route = getGameRoutes(game).find(route => route.id === routeSelections[game.id]);
    moveMap({ kind: 'bounds', ...gameFit(route?.locations ?? game.locations) });
  };

  // «Surprise me»: et tilfeldig spill blant dem som vises nå, aldri det som allerede er åpent
  // Søket teller ikke: med et søk på to treff vekslet knappen bare mellom de to. Filtrene gjelder,
  // men gir de for få spill å velge mellom, trekkes det fra hele atlaset. Søket tømmes, så spillet
  // som åpnes ikke er skjult av det.
  const surpriseMe = () => {
    setSiteMenuOpen(false);
    setFilterOpen(false);
    const playable = (list: Game[]) => list.filter(game => game.id !== openGame?.id && game.locations.some(l => isValidPosition(l.position)));
    const filtered = playable(filterGames({ query: '', genres: selectedGenres, yearRange, storyYearRange, includeVenues, settings: selectedSettings, placeTypes: selectedPlaceTypes }).map(hit => hit.game));
    const pool = filtered.length >= 2 ? filtered : playable(games.filter(game => includeVenues || !isVenueGame(game)));
    if (pool.length === 0) return;
    showGame(pool[Math.floor(Math.random() * pool.length)], false);
  };

  const selectRoute =(routeId: string | undefined) => {
    if (!openGame) return;
    const route = getGameRoutes(openGame).find(route => route.id === routeId);
    setRouteSelections(current => ({ ...current, [openGame.id]: route?.id }));
    moveMap({ kind: 'bounds', ...gameFit(route?.locations ?? openGame.locations) });
  };

  const goBack = () => {
    if (!panel || panel.history.length === 0) return;
    const back = panel.history[panel.history.length - 1];
    if (back.mode === 'game') {
      const game = gameById.get(back.id);
      setSelectedGameId(back.id);
      if (game) {
        const route = getGameRoutes(game).find(route => route.id === routeSelections[game.id]);
        moveMap({ kind: 'bounds', ...gameFit(route?.locations ?? game.locations) });
      }
    } else {
      setSelectedGameId(undefined);
      if (back.mode === 'place') moveMap({ kind: 'point', position: back.position });
      if (back.mode === 'search') {
        searchTouched.current = false;
        setSearch(back.query);
        setMapSearch(back.query);
        const hits = filterGames({ query: effectiveQuery(back.query), genres: selectedGenres, yearRange, storyYearRange, includeVenues, settings: selectedSettings, placeTypes: selectedPlaceTypes });
        moveMap({ kind: 'bounds', positions: searchPositions(hits).filter(isValidPosition) });
      }
    }
    const backSeq = ++panelSeq.current;
    const top = panel.scrolls?.[panel.scrolls.length - 1];
    setScrollRestore(top === undefined ? undefined : { seq: backSeq, top });
    setPanel({ view: back, seq: backSeq, autoFocus: true, history: panel.history.slice(0, -1), scrolls: panel.scrolls?.slice(0, -1) });
  };

  const toggleRoute = (game: Game) => {
    if (game.id === selectedGameId) {
      setSelectedGameId(undefined);
      return;
    }
    setSelectedGameId(game.id);
    setRouteSelections(current => ({ ...current, [game.id]: undefined }));
    moveMap({ kind: 'bounds', ...gameFit(game.locations) });
  };

  const handleClusterClick = (e: L.LeafletMouseEvent) => {
    if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    const cluster = e.layer as L.MarkerCluster | undefined;
    const map = mapRef.current;
    if (!cluster?.getAllChildMarkers || !map) return;

    const positions = [...new Map(cluster.getAllChildMarkers().map(marker => {
      const ll = marker.getLatLng();
      const position = normalizePosition([ll.lat, ll.lng]);
      return [posKey(position), position] as const;
    }))].map(([, position]) => position);
    const gameCount = new Set(positions.flatMap(p => places.get(posKey(p))?.games.map(g => g.id) ?? [])).size;

    // Mange spill: zoom inn til stedene skilles. Få spill, eller steder som ligger tett: vis lista med en gang.
    const bounds = cluster.getBounds();
    // Zoomer vi bare inn i klyngen, blir arket der det er; åpnes lista, går arket opp
    const pad = panel ? panelPadding(map, { afterOpen: false, tight: true }) : { paddingTopLeft: L.point(60, 60), paddingBottomRight: L.point(60, 60) };
    const fitZoom = map.getBoundsZoom(bounds, false, pad.paddingTopLeft.add(pad.paddingBottomRight));
    if (gameCount > CLUSTER_LIST_MAX_GAMES && fitZoom > map.getZoom() && fitZoom < LIST_ZOOM) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.fitBounds(bounds, { ...pad, animate: false });
      else map.flyToBounds(bounds, { ...pad, duration: 0.8 });
      return;
    }

    if (gameCount === 0) return;
    endSearch();
    openPanel({ mode: 'cluster', positions });
    setSelectedGameId(undefined);
    // Stedene i lista skal være synlige ved siden av panelet, ikke bak det, og skilt fra hverandre:
    // kartet går inn til de ligger hver for seg (høyst 14), aldri ut igjen
    moveMap({ kind: 'bounds', positions, maxZoom: Math.max(map.getZoom(), 14), tight: true });
  };

  // Klyngegruppen binder hendelser kun én gang, så klikket går via en ref til nyeste handler
  const clusterClickRef = useRef(handleClusterClick);
  useEffect(() => { clusterClickRef.current = handleClusterClick; });
  const onClusterClick = useMemo(() => (e: L.LeafletMouseEvent) => clusterClickRef.current(e), []);

  const handleNearMe = () => {
    rememberIntroDismissal(true);
    if (!('geolocation' in navigator)) {
      setNotice('Your browser cannot share your location');
      return;
    }
    setNotice('Finding you…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here: Position = [coords.latitude, coords.longitude];
        setUserPosition(here);
        const near = [...places.values()].filter(p => distanceKm(here, p.position) <= NEAR_ME_KM);
        if (near.length === 0) {
          setNotice(`No games within ${NEAR_ME_KM} km of you yet`);
          moveMap({ kind: 'point', position: here });
          return;
        }
        setNotice(null);
        openPanel({ mode: 'near', position: here });
        setSelectedGameId(undefined);
        moveMap({ kind: 'bounds', positions: [here, ...near.map(p => p.position)] });
      },
      error => setNotice(error.code === error.PERMISSION_DENIED ? 'Location access was denied' : 'Could not find your location'),
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleShare = async () => {
    const url = window.location.href;
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    // Delingsarket på telefon. Lukker du det uten å dele, avviser nettleseren med AbortError: det er ingen
    // feil (før sto det «Could not copy the link» hver gang arket ble lukket). Andre feil faller tilbake på kopiering
    if (mobile && navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    setNotice((await copyText(url)) ? 'Link copied' : 'Could not copy the link');
  };

  // Typing filters the map; selecting an autocomplete result opens its details.
  const latest = useRef(filteredHits);
  useEffect(() => { latest.current = filteredHits; });
  useEffect(() => {
    if (!searchTouched.current) return;
    const q = effectiveQuery(search);
    const timer = setTimeout(() => {
      if (!searchTouched.current) return;
      if (!q) {
        setPanel(p => (p?.view.mode === 'search' ? null : p));
        setSelectedGameId(undefined);
        return;
      }
      const hits = latest.current;
      if (hits.length === 0) {
        setSelectedGameId(undefined);
        setPanel(prev => (prev?.view.mode === 'search' ? null : prev));
        return;
      }
      setPanel(prev => (prev?.view.mode === 'search' ? null : prev));
      setSelectedGameId(hits.length === 1 ? hits[0].game.id : undefined);
      setMapTarget({ kind: 'bounds', positions: searchPositions(hits).filter(isValidPosition), seq: ++seq.current });
      // Kameraet flyr først når man har stoppet å skrive; en flytur midt i et ord gjør skrivingen hakkete
    }, 650);
    return () => clearTimeout(timer);
  }, [search]);

  // Tilbake-knappen i nettleseren: adressen som kommer tilbake leses som ved oppstart, og panelet,
  // filtrene og kartet settes deretter. Det som ble satt herfra skrives så på plass, ikke som ny oppføring.
  const restoringFromHistory = useRef(false);
  const lastPageKey = useRef<string | undefined>(undefined);
  // Rulleposisjonen tilbake-knappen gjenoppretter, for panelet med dette løpenummeret
  const [scrollRestore, setScrollRestore] = useState<{ seq: number; top: number } | undefined>(undefined);
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const url = readUrl();
      const next = initialFromUrl(url);
      restoringFromHistory.current = true;
      // Adressen vi kom tilbake til er den gjeldende siden. Ga tilbake-knappen samme tilstand som før, kjørte
      // ikke adresse-effekten, flagget ble stående, og neste sted som ble åpnet erstattet oppføringen i stedet
      // for å legge til en ny (Seattle → Antarktis, tilbake, endte på forsiden). Flagget slippes uansett.
      lastPageKey.current = pageKey(url);
      window.setTimeout(() => { restoringFromHistory.current = false; }, 0);
      // Et søk som hentes fram av tilbake-knappen er ikke skriving: ellers flyttet søkeeffekten kartet og
      // valget bort fra det som ble gjenopprettet, og la en ny oppføring som slettet historikken framover
      searchTouched.current = false;
      setSearch(next.search);
      setMapSearch(next.search);
      setSelectedGenres(next.filters.genres);
      setSelectedSettings(next.filters.settings);
      setSelectedPlaceTypes(next.filters.placeTypes);
      setYearRange(next.filters.yearRange);
      setStoryYearRange(next.filters.storyYearRange);
      setIncludeVenues(next.filters.includeVenues);
      // Panelet åpnes der leseren slapp det: rulleposisjonen ligger på historikkoppføringen (LocationFlyout lagrer den)
      const restoredSeq = ++panelSeq.current;
      const panelScroll = (event.state as { panelScroll?: unknown } | null)?.panelScroll;
      setScrollRestore(typeof panelScroll === 'number' ? { seq: restoredSeq, top: panelScroll } : undefined);
      setPanel(next.panel ? { ...next.panel, seq: restoredSeq, autoFocus: false } : null);
      setSelectedGameId(next.selectedGameId);
      if (next.selectedGameId !== undefined) setRouteSelections(current => ({ ...current, [next.selectedGameId!]: next.routeId }));
      if (next.target) setMapTarget({ ...next.target, seq: ++seq.current, instant: false });
      if (next.panel?.view.mode === 'country') { countryPeekRef.current = true; countryClickRef.current = undefined; setPeekFor(restoredSeq); }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Lenken og fanetittelen følger det som vises; et nytt sted, spill, land eller søk blir en ny oppføring
  useEffect(() => {
    const placeName = view?.mode === 'place' ? (places.get(posKey(view.position))?.name ?? view.name) : undefined;
    const state: UrlState = {
      q: search.trim() || undefined,
      genre: selectedGenres.length ? selectedGenres : undefined,
      setting: selectedSettings.length ? selectedSettings as Array<'real' | 'fictionalized' | 'imaginary'> : undefined,
      placeType: selectedPlaceTypes.length ? selectedPlaceTypes : undefined,
      released: yearsFull ? undefined : yearRange,
      set: storyFull ? undefined : storyYearRange,
      all: includeVenues || undefined,
      game: openGame ? gameSlugById.get(openGame.id) : undefined,
      route: openGame ? routeSelections[openGame.id] : undefined,
      place: placeName ? slugify(placeName) : undefined,
      country: view?.mode === 'country' ? slugify(countryTitle(view.iso)) : undefined,
      series: view?.mode === 'series' ? seriesSlug(view.name) : undefined,
      journey: view?.mode === 'series' && selectedGameId !== undefined ? gameSlugById.get(selectedGameId) : undefined,
      panel: view?.mode === 'index' ? 'places' : view?.mode === 'atlas' ? 'my-atlas' : undefined,
    };
    const key = pageKey(state);
    const push = lastPageKey.current !== undefined && key !== lastPageKey.current && !restoringFromHistory.current;
    restoringFromHistory.current = false;
    lastPageKey.current = key;
    writeUrl(state, { push });
    document.title = panelTitle && (panelGames > 0 || view?.mode === 'index') ? `${panelTitle} – Game Traveler` : DEFAULT_TITLE;
  }, [search, selectedGenres, selectedSettings, selectedPlaceTypes, yearRange, storyYearRange, yearsFull, storyFull, includeVenues, openGame, view, places, panelTitle, panelGames, routeSelections, selectedGameId]);

  // Et filter eller My atlas kan la kartet stå zoomet inn et sted uten ett eneste treff igjen (gatekart av Lhasa,
  // «37 games» i toppen). Står ingen av stedene som vises innenfor kartet, rammes de inn. Et åpent spill, sted,
  // land eller en serie styrer kartet selv og får stå.
  const filterSignature = [selectedGenres.join(), selectedSettings.join(), selectedPlaceTypes.join(), yearRange.join(), storyYearRange.join(), includeVenues, atlasFilter.place ?? '', atlasFilter.game ?? '', view?.mode ?? ''].join('|');
  const lastFilterSignature = useRef(filterSignature);
  const fitTimer = useRef<number | undefined>(undefined);
  const fitInputs = useRef({ places, view });
  useEffect(() => {
    fitInputs.current = { places, view };
    if (filterSignature === lastFilterSignature.current) return;
    lastFilterSignature.current = filterSignature;
    window.clearTimeout(fitTimer.current);
    // Kort pause, så ikke hver avkrysning i filteret flytter kartet
    fitTimer.current = window.setTimeout(() => {
      const { places: shown, view: current } = fitInputs.current;
      if (current && ['game', 'place', 'series', 'country', 'cluster', 'near'].includes(current.mode)) return;
      const map = mapRef.current;
      if (!map || shown.size === 0) return;
      const bounds = map.getBounds();
      const positions = [...shown.values()].map(place => place.position);
      const inView = positions.some(([lat, lng]) => [-360, 0, 360].some(offset => bounds.contains([lat, lng + offset])));
      if (!inView) setMapTarget({ kind: 'bounds', positions, seq: ++seq.current });
    }, 350);
  });
  useEffect(() => () => window.clearTimeout(fitTimer.current), []);

  // Korte meldinger forsvinner av seg selv
  useEffect(() => {
    if (!notice || notice.endsWith('…')) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  // Fokus inn i filteret når det åpnes
  useEffect(() => {
    if (filterOpen) filterPanelRef.current?.focus({ preventScroll: true });
  }, [filterOpen]);

  const closeFilter = () => {
    setFilterOpen(false);
    filterBtnRef.current?.focus({ preventScroll: true });
  };

  const closeSiteMenu = (restoreFocus = false) => {
    setSiteMenuOpen(false);
    if (restoreFocus) moreButtonRef.current?.focus({ preventScroll: true });
  };

  // «My atlas» ut og inn: CSV-fil, Table Editor, tømme og gjenopprette
  const toastSeq = useRef(0);
  const showAtlasToast = useCallback((toast: Omit<AtlasToast, 'seq'>) => setAtlasToast({ ...toast, seq: ++toastSeq.current }), []);
  const hideAtlasToast = useCallback(() => setAtlasToast(null), []);
  const openAtlasDialog = (dialog: AtlasDialog) => {
    setSiteMenuOpen(false);
    setFilterOpen(false);
    setAtlasDialog(dialog);
  };
  const closeAtlasDialog = () => {
    setAtlasDialog(null);
    moreButtonRef.current?.focus({ preventScroll: true });
  };
  const exportAtlasCsv = () => {
    setSiteMenuOpen(false);
    const blob = new Blob([atlasToCsv(myAtlas, atlasCatalog)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `game-traveler-my-atlas-${new Date().toLocaleDateString('sv-SE')}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const chooseAtlasCsv = () => {
    setSiteMenuOpen(false);
    csvInputRef.current?.click();
  };
  const readAtlasCsv = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      // Flyttet, slettet eller en skyfil som ikke er lastet ned
      showAtlasToast({ message: `Could not read ${file.name}. Check that the file is still there and try again.` });
      return;
    }
    openAtlasDialog({ kind: 'import', fileName: file.name, result: importCsv(text, atlasCatalog, new Date().toLocaleDateString('sv-SE')) });
  };
  const restoreClearedAtlas = () => {
    if (markCount(myAtlas) > 0) return openAtlasDialog({ kind: 'restore' });
    setSiteMenuOpen(false);
    try {
      restoreCleared('replace');
      showAtlasToast({ message: 'My atlas restored.' });
    } catch {
      window.alert('Your browser would not save the change, so nothing was restored. Storage may be full or blocked in this window.');
    }
  };

  const toggleWelcome = () => {
    closeSiteMenu(true);
    if (introVisible) {
      rememberIntroDismissal(true);
    } else {
      searchTouched.current = false;
      setSearch('');
      resetFilters();
      setFilterOpen(false);
      setPanel(null);
      setSelectedGameId(undefined);
      setMapTarget(undefined);
      setUserPosition(undefined);
      setNotice(null);
      returnFocusRef.current = null;
      mapRef.current?.setView(HOME_MAP_CENTER, homeMapZoom(), { animate: false });
      rememberIntroDismissal(false);
    }
  };

  const openPlaceIndex = () => {
    closeSiteMenu();
    setFilterOpen(false);
    setSelectedGameId(undefined);
    openPanel({ mode: 'index' });
  };

  const openAtlas = () => {
    closeSiteMenu();
    setFilterOpen(false);
    setSelectedGameId(undefined);
    openPanel({ mode: 'atlas' });
  };

  const openAboutDialog = (tab: 'about' | 'places' = 'about') => {
    setSiteMenuOpen(false);
    setFilterOpen(false);
    setInfoTab(tab);
    setAboutOpen(true);
  };

  useEffect(() => {
    if (!siteMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && moreMenuRef.current?.contains(event.target)) return;
      setSiteMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [siteMenuOpen]);

  useEffect(() => {
    const dialog = infoDialogRef.current;
    if (!dialog) return;
    if (aboutOpen && !dialog.open) dialog.showModal();
    else if (!aboutOpen && dialog.open) dialog.close();
  }, [aboutOpen]);

  // Tastatur: Escape lukker filteret først, deretter panelet. «/» går til søket. Enter/mellomrom åpner markører.
  const keyState = useRef({
    infoOpen: aboutOpen,
    siteMenuOpen,
    filterOpen,
    panelOpen: !!panel,
    closePanel,
    closeFilter,
    closeSiteMenu,
  });
  useEffect(() => {
    keyState.current = {
      infoOpen: aboutOpen,
      siteMenuOpen,
      filterOpen,
      panelOpen: !!panel,
      closePanel,
      closeFilter,
      closeSiteMenu,
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.matches('input, textarea, select');
      const k = keyState.current;
      if (e.key === 'Escape') {
        if (k.infoOpen || document.querySelector('dialog[open]')) return;
        if (k.siteMenuOpen) {
          e.preventDefault();
          k.closeSiteMenu(true);
        } else if (k.filterOpen) k.closeFilter();
        else if (k.panelOpen) k.closePanel();
      } else if (e.key === '/' && !typing) {
        const input = [...document.querySelectorAll<HTMLInputElement>('input[type=search]')].find(i => i.offsetParent !== null);
        if (input) {
          e.preventDefault();
          input.focus();
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && target.classList.contains('leaflet-marker-icon')) {
        // Markører og klynger er knapper og skal åpnes med Enter og mellomrom
        e.preventDefault();
        target.click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const searchSuggestions = useMemo<SearchSuggestion[]>(() => {
    // Et tomt felt viser veien til lista over alle steder. Den hadde en egen stripe nederst på mobil, som tok
    // mye plass fra kartet for noe få bruker; her finnes den der man uansett begynner å lete.
    if (!query) return [{ id: 'browse', kind: 'browse', label: 'Browse all places', detail: `${count(places.size, 'place')}, listed by country` }];
    const placeSuggestions = new Map<string, SearchSuggestion>();
    for (const hit of filteredHits) {
      for (const location of hit.matchedLocations) {
        const key = posKey(location.position);
        if (!placeSuggestions.has(key)) {
          placeSuggestions.set(key, {
            id: `place:${key}`,
            kind: 'place',
            label: location.name,
            detail: hit.game.name,
            position: location.position,
          });
        }
      }
    }
    const placeItems = [...placeSuggestions.values()].slice(0, 3);
    const gameItems = filteredHits.slice(0, 5).map(({ game }) => ({
      id: `game:${game.id}`,
      kind: 'game' as const,
      label: game.name,
      detail: `${game.year} · ${game.genres.slice(0, 2).join(' · ')}`,
      game,
    }));
    // Står søket i en spilltittel, skal Enter åpne spillet og ikke et av stedene
    const normalized = normalizeSearch(search);
    const titleMatch = filteredHits.slice(0, 5).some(({ game }) => normalizeSearch(game.name).includes(normalized));
    // Står søket i et serienavn («broken sword», «indiana»), kommer serien først: en snarvei til seriesiden
    // for den som allerede skriver navnet. Spillene står fortsatt under. Ikke for ett eller to tegn.
    const seriesItems: SearchSuggestion[] = normalized.length < 3 ? [] : [...seriesGames]
      .filter(([name]) => name.split('/').map(part => normalizeSearch(part)).some(part => part.startsWith(normalized) || normalized.startsWith(part)))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 1)
      .map(([name, list]) => ({
        id: `series:${name}`,
        kind: 'series' as const,
        label: `${name} series`,
        detail: `${count(list.length, 'game')} · ${list[0].year}–${list[list.length - 1].year}`,
        series: name,
      }));
    // Lista viser fem spill; flere treff får en rad som åpner alle i panelet (24 Assassin's Creed-spill)
    const allItem: SearchSuggestion[] = filteredHits.length > gameItems.length
      ? [{ id: 'all', kind: 'all', label: `Show all ${count(filteredHits.length, 'game')}`, detail: '' }]
      : [];
    return [...seriesItems, ...(titleMatch ? [...gameItems, ...placeItems] : [...placeItems, ...gameItems]), ...allItem];
  }, [filteredHits, query, search, places.size]);

  const emptyMessage = query && activeFilters > 0
    ? `No games match “${search.trim()}” with these filters.`
    : query
      ? `No games or places match “${search.trim()}”.`
      : 'No games match these filters.';
  // Forklaring og veier videre når søk og filter ikke gir treff. Mens nedtrekkslista er åpen står den
  // der, ellers på kartet, aldri begge steder samtidig.
  const emptyHelp = (
    <>
      {query && (
        <span className="text-[0.95rem] text-ink-soft">
          Game Traveler maps games set in real places, so fantasy worlds like Hyrule or Azeroth aren’t on the map.
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-4">
        {query && (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { searchTouched.current = true; setSearch(""); }} className="min-h-11 cursor-pointer font-bold text-magenta underline underline-offset-4">
            Clear search
          </button>
        )}
        {activeFilters > 0 && (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={resetFilters} className="min-h-11 cursor-pointer font-bold text-magenta underline underline-offset-4">
            Reset filters
          </button>
        )}
        {CONTRIBUTE_URL && (
          <a href={CONTRIBUTE_URL} target="_blank" rel="noopener" className="min-h-11 content-center font-semibold text-ink underline underline-offset-4">
            Suggest a game
          </a>
        )}
      </span>
    </>
  );

  const searchField = (
    <div className="relative w-full">
      <Search size={20} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
      <Autocomplete.Root
        items={searchSuggestions}
        value={search}
        itemToStringValue={item => item.id}
        filter={null}
        limit={10}
        open={searchListOpen}
        onOpenChange={setSearchListOpen}
        openOnInputClick
        autoHighlight
        onValueChange={(value, details) => {
          if (details.reason === 'item-press') {
            const suggestion = searchSuggestions.find(item => item.id === value);
            if (!suggestion) return;
            searchTouched.current = false;
            rememberIntroDismissal(true);
            if (suggestion.kind === 'browse') {
              setSearchListOpen(false);
              openPlaceIndex();
            } else if (suggestion.kind === 'all') {
              setSearchListOpen(false);
              openPanel({ mode: 'search', query: search.trim() });
              setSelectedGameId(undefined);
              moveMap({ kind: 'bounds', positions: searchPositions(filteredHits).filter(isValidPosition) });
            } else if (suggestion.kind === 'series' && suggestion.series) showSeries(suggestion.series, false);
            else if (suggestion.kind === 'game' && suggestion.game) showGame(suggestion.game, false);
            else if (suggestion.position) showPlace(suggestion.position);
            return;
          }
          if (details.reason !== 'input-change' && details.reason !== 'input-clear' && details.reason !== 'clear-press') return;
          searchTouched.current = true;
          rememberIntroDismissal(true);
          setSearch(value);
        }}
      >
        <Autocomplete.Input
          type="search"
          placeholder="Search games or places"
          aria-label="Search games or places"
          aria-keyshortcuts="/"
          // Kommer man tilbake til feltet (klikk, Tab eller «/») skal forslagene stå der igjen, ikke kreve et nytt
          // tastetrykk; et tomt felt viser «Browse all places»
          onFocus={() => setSearchListOpen(true)}
          className="h-11 w-full bg-card pr-10 pl-10 text-base text-ink placeholder:text-ink-soft focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-magenta [&::-webkit-search-cancel-button]:appearance-none"
        />
        {!search && <kbd className="atlas-search-kbd" aria-hidden="true">/</kbd>}
        {search && (
          <button
            type="button"
            onClick={() => {
              searchTouched.current = true;
              rememberIntroDismissal(true);
              setSearch('');
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-0 z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center text-ink-soft hover:text-ink"
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
        <Autocomplete.Portal>
          {/* Telefon: lista fyller bredden fra toppfeltet og ned (atlas.css, .gt-search-positioner), som søket i
              Spotify og Google Maps. Som smal boks over kartet stakk kartknappene fram ved siden av, og den sluttet
              midt i en rad. */}
          <Autocomplete.Positioner className="gt-search-positioner z-[1300] w-[var(--anchor-width)]" sideOffset={4} align="start">
            <Autocomplete.Popup className="gt-search-popup max-h-[min(60vh,28rem)] overflow-y-auto rounded-[12px] border border-ink/20 bg-sheet text-ink shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--color-shadow)_35%,transparent)]">
              <Autocomplete.Empty>
                {query ? (
                  <div className="flex flex-col gap-1 px-4 py-3">
                    <span className="font-semibold">{emptyMessage}</span>
                    {emptyHelp}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-ink-soft">Keep typing to search games and places</div>
                )}
              </Autocomplete.Empty>
              {approximate && (
                <p className="border-b border-rule px-3 py-2 text-[0.875rem] text-ink-soft">
                  Nothing matches “{search.trim()}” exactly. Similar spellings:
                </p>
              )}
              <Autocomplete.List>
                {(item: SearchSuggestion) => (
                  <Autocomplete.Item
                    key={item.id}
                    value={item}
                    className="flex min-h-14 cursor-pointer items-center gap-3 px-2.5 text-left data-[highlighted]:bg-ink/[0.07] hover:bg-ink/[0.07]"
                  >
                    {item.kind === 'browse' ? (
                      <>
                        <span className="gt-search-icon" aria-hidden="true"><List size={18} strokeWidth={1.75} /></span>
                        <span className="flex min-w-0 flex-1 flex-col py-1.5">
                          <span className="min-w-0 font-semibold leading-snug">{item.label}</span>
                          <span className="min-w-0 truncate text-sm text-ink-soft">{item.detail}</span>
                        </span>
                      </>
                    ) : item.kind === 'all' ? (
                      <span className="flex-1 py-1.5 pl-[3rem] font-bold text-magenta underline underline-offset-4">{item.label}</span>
                    ) : (
                      <>
                        {/* Ikon i stedet for ordene «Game» og «Place» i en egen grå kolonne; ordet står for skjermlesere */}
                        <span className="gt-search-icon" aria-hidden="true">
                          {item.kind === 'game' ? <Gamepad2 size={18} strokeWidth={1.75} /> : item.kind === 'series' ? <Layers size={18} strokeWidth={1.75} /> : <MapPin size={18} strokeWidth={1.75} />}
                        </span>
                        <span className="sr-only">{item.kind === 'game' ? 'Game' : item.kind === 'series' ? 'Series' : 'Place'}: </span>
                        {/* Tittelen får hele bredden og detaljene står under: side om side ble «Assassin's Creed: …»
                            tre ganger, og spillene i en serie kunne ikke skilles */}
                        <span className="flex min-w-0 flex-1 flex-col py-1.5">
                          <span className="min-w-0 font-semibold leading-snug">{item.label}</span>
                          <span className="min-w-0 truncate text-sm text-ink-soft">{item.detail}</span>
                        </span>
                      </>
                    )}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </div>
  );

  const storyActiveEra = ERAS.find(e => e.range[0] === storyYearRange[0] && e.range[1] === storyYearRange[1]);

  // Steder som skal være synlige uavhengig av klynger: aktivt sted, reisestopp og få nok søketreff
  const clusterKeys = view?.mode === 'cluster' && view.positions.length <= CLUSTER_LIST_MAX_GAMES ? view.positions.map(posKey) : [];
  // Stedene til spillet som vises tegnes for seg (se under), så de ikke kan svelges av en klynge
  // En åpen serie nåler alle sine steder, som et åpent spill; svært store serier (Nancy Drew) dempes bare
  const pinnedKeys = new Set([
    ...(activeKey ? [activeKey] : []),
    ...clusterKeys,
    ...(searchKeys.size <= 8 ? searchKeys : []),
    ...(openSeriesKeys && openSeriesKeys.size <= 40 ? openSeriesKeys : []),
  ].filter(k => places.has(k) && !focusKeys.has(k) && !hiddenCountryDots?.has(k)));
  const focusPins = [...new Map(focusStops.map(l => [posKey(l.position), l])).entries()];
  const isCountryStop = (loc: { placeId: string; placeType: PlaceType }) => {
    const iso = loc.placeType === 'country' ? countryOf(loc.placeId) : undefined;
    return !!iso && !!countryLabel(iso) && !countrySmall(iso);
  };
  // Navnelappene viser hvor stoppet ligger i ruten: et nummer i rutens farge når én rute vises,
  // eller en fargeprikk per rute når alle rutene vises samtidig
  const shownRoutes = selectedRoute ? [selectedRoute] : focusRoutes;
  const stopMarks = (loc: { placeId: string }) => {
    if (shownRoutes.length === 1) {
      const route = shownRoutes[0];
      // Et sted ruten vender tilbake til får alle numrene sine (Paris 3·5·7), ikke bare det første
      const stops = route.locations.map((l, index) => (l.placeId === loc.placeId ? index + 1 : 0)).filter(Boolean);
      if (stops.length === 0) return null;
      return <span className="gt-label-stop" style={{ backgroundColor: routeStyle(focusRoutes.indexOf(route)).color }}>{stops.join('·')}</span>;
    }
    const on = focusRoutes.map((route, index) => ({ route, index })).filter(({ route }) => route.locations.some(l => l.placeId === loc.placeId));
    if (on.length === 0) return null;
    return <span className="gt-label-routes" aria-hidden="true">{on.map(({ route, index }) => <span key={route.id} style={{ backgroundColor: routeStyle(index).color }} />)}</span>;
  };
  const clusterMarkers: ClusterMarker[] = [...places]
    .filter(([key, place]) => !place.spot && !pinnedKeys.has(key) && !focusKeys.has(key) && !hiddenCountryDots?.has(key))
    // Nøkkelen bærer forskyvningen, ikke rekkefølgen: kopiene byttes når vinduet krysser 768 px, og laget
    // gjenbruker en markør med samme nøkkel uten å flytte den
    .flatMap(([key, place]) => worldCopies(place.position).map(position => ({
      key: `${key}@${Math.round(position[1] - place.position[1])}`,
      position,
      icon: atCountryName(key, withSpotCount(withAtlasMark(
        searchKeys.has(key) ? activePlaceIcon(place) : focusGame || (countryKeysOpen && !countryKeysOpen.has(key)) ? place.approximate ? ICONS.dimmedApproximate : ICONS.dimmed : placeMarkerIcon(place),
        pointMarks.get(key)?.been ? 'been' : pointMarks.get(key)?.want ? 'want' : undefined,
      ), spotCountOf(place))),
      title: `${place.name}${spotCountOf(place) ? ` · ${count(spotCountOf(place), 'place')} inside` : ''}${pointMarks.get(key)?.been ? " · you've been here" : pointMarks.get(key)?.want ? ' · you want to go' : ''}`,
    })));



  // Forklaringen og samlingens bredde: i headeren på brede skjermer, i en stripe nederst ellers
  const summary = (
    <>
      <span className="atlas-tagline">A video game atlas</span>
      <p className="atlas-summary-counts numerals" aria-live="polite">
        <strong>{filteredGames.length === catalogSize ? catalogSize : `${filteredGames.length} of ${catalogSize}`}</strong>{' '}
        {venuesHidden ? 'story games' : filteredGames.length === 1 && catalogSize === 1 ? 'game' : 'games'}
        <span aria-hidden="true"> · </span><span className="sr-only">, </span>
        <strong>{places.size}</strong> {places.size === 1 ? 'place' : 'places'}
        {issueEra && <span className="atlas-summary-era"><span aria-hidden="true"> · </span><span className="sr-only">, set </span><span className="whitespace-nowrap">{issueEra}</span></span>}
      </p>
    </>
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <button type="button" className="atlas-skip-link" onClick={openPlaceIndex}>
        Skip the map: browse all places as a list
      </button>
      {/* Filteret ligger i toppfeltet, men må dekke et åpent stedspanel (z 1200) */}
      <header ref={mastheadRef} className={`atlas-masthead relative ${filterOpen || siteMenuOpen ? 'z-[1250]' : 'z-[1100]'}`}>
        <div className="atlas-toolbar">
          <AtlasBrand />
          {/* Forklaringen hører til navnet, så den står rett etter det */}
          <div className="atlas-summary atlas-summary-head">{summary}</div>
          <div className="atlas-search-row">
            <div className="atlas-search">{searchField}</div>
            <button
              ref={filterBtnRef}
              type="button"
              onClick={() => {
                setSiteMenuOpen(false);
                if (filterOpen) closeFilter();
                else {
                  rememberIntroDismissal(true);
                  setFilterOpen(true);
                }
              }}
              aria-expanded={filterOpen}
              aria-controls="filter-panel"
              aria-label="Filter"
              className={`atlas-filter-button relative ${filterOpen ? 'is-active' : ''}`}
            >
              <SlidersHorizontal size={19} strokeWidth={1.75} />
              <span className="atlas-filter-label">Filter</span>
              {/* Merket ligger på kanten av knappen, så søkefeltet ikke flytter seg når det dukker opp */}
              {activeFilters > 0 && (
                <span className="numerals absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-sheet bg-magenta text-sm text-on-accent">
                  {activeFilters}
                </span>
              )}
            </button>
            {/* Filteret henger rett under Filter-knappen */}
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-[-1]" onClick={closeFilter} aria-hidden="true" />
                <section
                  id="filter-panel"
                  ref={filterPanelRef}
                  tabIndex={-1}
                  aria-labelledby="filter-title"
                  className="atlas-filter-panel thin-scroll flex flex-col gap-6 overflow-y-auto bg-sheet px-6 pt-5 text-ink focus:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <h2 id="filter-title" className="text-[1.25rem] font-bold leading-tight">Filter the map</h2>
                    <button
                      type="button"
                      onClick={closeFilter}
                      aria-label="Close filters"
                      className="-mr-2 grid size-11 cursor-pointer place-items-center rounded-[10px] hover:bg-ink/7"
                    >
                      <X size={24} strokeWidth={2} />
                    </button>
                  </div>

                  {(atlasTotal(myAtlas) > 0 || atlasFilterText(atlasFilter)) && (
                    <section aria-labelledby="filter-my-atlas" className="flex shrink-0 flex-col gap-2 border-b border-rule pb-5">
                      <h3 id="filter-my-atlas" className="font-semibold text-ink">My atlas</h3>
                      <p className="-mt-1 text-sm leading-snug text-ink-muted">What you've marked, saved in this browser.</p>
                      {([
                        ['Places', 'marked on the place', [['been', 'Been here', atlasCounts.been], ['want', 'Want to go', atlasCounts.wantGo], ['not-been', 'Not been yet', undefined]] as [PlaceFilter, string, number | undefined][], 'place'],
                        ['Games', 'marked on the game', [['played', 'Played', atlasCounts.played], ['want', 'Want to play', atlasCounts.wantPlay], ['not-played', 'Not played yet', undefined]] as [GameFilter, string, number | undefined][], 'game'],
                      ] as const).map(([title, hint, options, dimension]) => (
                        <div key={title} role="group" aria-label={`${title} in My atlas`} className="mt-1">
                          <div className="flex items-baseline justify-between"><span className="text-sm font-bold">{title}</span><span className="text-[0.8125rem] text-ink-soft">{hint}</span></div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {options.map(([value, label, total]) => {
                              const on = atlasFilter[dimension] === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => setAtlasFilter(current => ({ ...current, [dimension]: on ? null : value }))}
                                  className={`${chipClass} inline-flex items-center gap-1.5 ${on ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`}
                                >
                                  {label}{total !== undefined && <span className={`numerals font-normal ${on ? 'text-on-ink/80' : 'text-ink-soft'}`}>{total}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {atlasFilter.game && <p className="text-[0.8125rem] leading-snug text-ink-soft">A games choice shows the places of those games.</p>}
                    </section>
                  )}

                  <fieldset className="flex shrink-0 flex-col gap-2">
                    <legend className="mb-2 text-sm font-semibold">Show</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {([[false, `Story games (${games.length - venueGameCount})`], [true, `All games (${games.length})`]] as const).map(([all, label]) => {
                        // Å velge Racing eller Sports som sjanger viser dem uansett, så da er «All games» det som gjelder
                        const showingAll = includeVenues || selectedGenres.includes(VENUE_FAMILY);
                        return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={showingAll === all}
                          onClick={() => {
                            setIncludeVenues(all);
                            if (!all) setSelectedGenres(current => current.filter(genre => genre !== VENUE_FAMILY));
                          }}
                          className={`${chipClass} ${showingAll === all ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`}
                        >
                          {label}
                        </button>
                        );
                      })}
                    </div>
                    <p className="text-[0.875rem] text-ink-soft">Story games leave out racing and sports, which happen on a track or a pitch rather than in a story.</p>
                  </fieldset>

                  <div className="flex flex-col gap-2">
                    <section className="border-b border-rule py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-ink">Place setting</h3>
                        <span className="text-sm text-ink-muted">{selectedSettings.length ? `${selectedSettings.length} selected` : 'All types'}</span>
                      </div>
                      <p className="mb-3 text-sm leading-snug text-ink-muted">Fictionalized places are based on real ones; imaginary places are invented.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" aria-pressed={selectedSettings.length === 0} className={`${chipClass} w-full ${selectedSettings.length === 0 ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`} onClick={() => setSelectedSettings([])}>All types</button>
                        {(['real', 'fictionalized', 'imaginary'] as const).map(value => {
                          const on = selectedSettings.includes(value);
                          const label = value === 'real' ? 'Real' : value === 'fictionalized' ? 'Fictionalized' : 'Imaginary';
                          const swatch = value === 'real' ? 'var(--color-magenta)' : value === 'fictionalized' ? 'var(--color-fictional)' : 'var(--color-imaginary)';
                          return <button key={value} type="button" aria-pressed={on} className={`${chipClass} w-full justify-center inline-flex items-center gap-2 px-2 text-[0.88rem] ${on ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`} onClick={() => setSelectedSettings(current => on ? current.filter(item => item !== value) : [...current, value])}><span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: swatch }} />{label}</button>;
                        })}
                      </div>
                    </section>
                    <section className="border-b border-rule py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-semibold text-ink">Place type</h3>
                        <span className="text-sm text-ink-muted">{selectedPlaceTypes.length ? `${selectedPlaceTypes.length} selected` : 'All types'}</span>
                      </div>
                      <p className="mb-3 text-sm leading-snug text-ink-muted">Filter the map by what a place is. This is separate from whether a game portrays it as real or fictional.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" aria-pressed={selectedPlaceTypes.length === 0} className={`${chipClass} w-full ${selectedPlaceTypes.length === 0 ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`} onClick={() => setSelectedPlaceTypes([])}>All place types</button>
                        {PLACE_TYPES.map(({ value, label }) => {
                          const on = selectedPlaceTypes.includes(value);
                          const total = facetCounts.placeTypes.get(value) ?? 0;
                          return <button key={value} type="button" aria-pressed={on} className={`${chipClass} flex w-full items-center justify-between gap-2 px-3 text-left text-[0.88rem] ${on ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`} onClick={() => setSelectedPlaceTypes(current => on ? current.filter(item => item !== value) : [...current, value])}><span>{label}</span><span className={`numerals font-normal ${on ? 'text-on-ink/80' : 'text-ink-soft'}`}>{total}</span></button>;
                        })}
                      </div>
                      <p className="mt-2 text-[0.8125rem] leading-snug text-ink-soft">Area pins use an outer ring to show that their point is approximate.</p>
                    </section>
                    <DoubleRangeSlider
                      min={minStoryYear}
                      max={maxStoryYear}
                      value={storyYearRange}
                      onChange={setStoryYearRange}
                      label="Story set in"
                      scale={STORY_SCALE}
                      disabled={minStoryYear === maxStoryYear}
                    />
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose an era">
                      {ERAS.map(era => {
                        const active = storyActiveEra === era;
                        return (
                          <button
                            key={era.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setStoryYearRange(active ? [minStoryYear, maxStoryYear] : era.range)}
                            className={`${chipClass} ${active ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`}
                          >
                            {era.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <DoubleRangeSlider
                    min={minYear}
                    max={maxYear}
                    value={yearRange}
                    onChange={setYearRange}
                    label="Released"
                  />

                  <fieldset className="flex shrink-0 flex-col gap-2">
                    <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-semibold">
                      <span>Genre</span>
                      <span className="text-[0.8125rem] font-medium text-ink-soft">
                        {selectedGenres.length ? `${selectedGenres.length} selected` : 'All genres'}
                      </span>
                    </legend>
                    {/* Knapper som brytes over flere linjer, ikke en liste som ruller inni et panel som også ruller */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        aria-pressed={selectedGenres.length === 0}
                        onClick={() => setSelectedGenres([])}
                        className={`${chipClass} ${selectedGenres.length === 0 ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`}
                      >
                        All genres
                      </button>
                      {GENRE_FAMILIES.map(({ label, genres: members }) => {
                        const on = selectedGenres.includes(label);
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={on}
                            title={members.join(', ')}
                            onClick={() => setSelectedGenres(current => on ? current.filter(genre => genre !== label) : [...current, label])}
                            className={`${chipClass} ${on ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`}
                          >
                            {label} <span className={`numerals font-normal ${on ? 'text-on-ink/80' : 'text-ink-soft'}`}>{facetCounts.genres.get(label) ?? 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>


                  {/* «Vis N spill» er alltid synlig, også når filteret er høyere enn skjermen */}
                  <div className="sticky bottom-0 z-10 -mx-6 mt-auto flex items-center justify-between gap-3 border-t border-rule bg-sheet px-6 py-4">
                    <button
                      type="button"
                      onClick={resetFilters}
                      disabled={activeFilters === 0}
                      className="min-h-11 cursor-pointer text-base font-semibold underline underline-offset-4 disabled:cursor-default disabled:text-ink-soft disabled:no-underline"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={closeFilter}
                      className="numerals h-11 cursor-pointer rounded-[10px] bg-magenta px-5 font-bold text-on-accent transition-colors hover:bg-magenta-deep"
                    >
                      Show {count(filteredGames.length, 'game')}
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
          <span className="atlas-toolbar-spacer" aria-hidden="true" />
          <button
            type="button"
            onClick={openAtlas}
            aria-pressed={view?.mode === 'atlas'}
            title="My atlas: places you've been and games you've played"
            className={`atlas-toolbar-button atlas-my-atlas ${view?.mode === 'atlas' ? 'is-active' : ''}`}
          >
            <BookMarked size={19} strokeWidth={1.75} aria-hidden="true" />
            <span className="atlas-my-atlas-label">My atlas</span>
          </button>
          <button type="button" onClick={openPlaceIndex} className="atlas-toolbar-button atlas-all-places">
            <List size={19} strokeWidth={1.75} aria-hidden="true" />
            All places
          </button>
          <div ref={moreMenuRef} className="atlas-more relative">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => {
                if (siteMenuOpen) setSiteMenuOpen(false);
                else {
                  setFilterOpen(false);
                  setSiteMenuOpen(true);
                }
              }}
              aria-expanded={siteMenuOpen}
              aria-controls="site-menu"
              aria-label="More options"
              title="More options"
              className="atlas-toolbar-button"
            >
              <MoreHorizontal size={20} strokeWidth={1.75} />
            </button>
            <div id="site-menu" hidden={!siteMenuOpen} className="atlas-more-menu" role="group" aria-label="More options">
              <button
                type="button"
                onClick={toggleWelcome}
                aria-pressed={introVisible}
                title={introVisible ? undefined : 'Clears search and filters and shows the welcome again'}
              >
                {introVisible
                  ? <Check size={18} strokeWidth={1.75} aria-hidden="true" />
                  : <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" />}
                <span>{introVisible ? 'Hide welcome' : 'Start over'}</span>
              </button>
              <button type="button" onClick={() => openAboutDialog('places')}>
                <Compass size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>How places are chosen</span>
              </button>
              <button type="button" onClick={() => openAboutDialog('about')}>
                <Info size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>About &amp; credits</span>
              </button>
              <a href="https://truben.no/privacy/" target="_blank" rel="noopener" onClick={() => setSiteMenuOpen(false)}>
                <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>Privacy</span>
              </a>
              {/* Støtte til prosjektet; nederst blant lenkene, uten farge, så den ikke presser seg fram */}
              <a href="https://buymeacoffee.com/truben" target="_blank" rel="noopener" onClick={() => setSiteMenuOpen(false)}>
                <Coffee size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>Buy me a coffee</span>
              </a>
              {/* Tema: følger systemet som standard; et valg bytter med en gang, også kartet (theme.ts) */}
              <div className="atlas-more-theme">
                <span id="theme-label" className="atlas-more-theme-label">Appearance</span>
                <div className="atlas-more-theme-options" role="radiogroup" aria-labelledby="theme-label">
                  {(['system', 'light', 'dark'] as ThemeChoice[]).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      role="radio"
                      aria-checked={themeChoice === choice}
                      onClick={() => {
                        setThemeChoice(choice);
                        saveThemeChoice(choice);
                      }}
                    >
                      {choice === 'system' ? 'System' : choice === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </header>

      <main className="relative min-h-0 flex-1">
        <MapContainer
          ref={mapRef}
          center={HOME_MAP_CENTER}
          zoom={homeMapZoom()}
          minZoom={minZoomFor()}
          zoomSnap={zoomSnapFor()}
          // Ett hakk på musehjulet er fortsatt omtrent ett nivå med kvarte trinn (Leaflets kurve ga 0,75)
          wheelPxPerZoomLevel={isDesktop() ? 40 : 60}
          maxZoom={18}
          zoomControl={false}
          worldCopyJump
          className="absolute inset-0 z-0"
        >
          <MapWorldBoundary sheetOpen={!!panel && panelVisible} />
          <Basemap />
          <CountryShapes
            countries={countryShapes}
            been={shadedCountries}
            onSelect={(iso, at) => openCountry(iso, false, true, at)}
            fit={view?.mode === 'country' && panel ? { iso: view.iso, seq: panel.seq, points: [...(countryContent.get(view.iso)?.keys ?? [])].map(key => places.get(key)!.position), at: countryClickRef.current } : undefined}
            fitOptions={() => countryPadding(mapRef.current!, countryPeekRef.current)}
          />
          <ZoomControl position="bottomright" />
          <MapPinchZoom />
          <MapPolarBands />
          <MapShapesVisibility onChange={setCountryShapesVisible} />
          <MapMover target={mapTarget} />
          <MapLabelLayout />
          <MapDoubleTapZoom />
          <MapTapHandler onTap={() => {
            if (panel && window.matchMedia('(max-width: 767px)').matches) setMapTapCount(count => count + 1);
          }} />
          {focusRoutes.flatMap((route, index) => (!selectedRoute || route.id === selectedRoute.id
            ? [-360, 0, 360].map(offset => <RouteLine key={`${focusGame!.id}-${route.id}-${offset}`} route={route} index={index} longitudeOffset={offset} />)
            : []))}
          {/* Klikk på klynge zoomer inn, eller åpner panelet når stedene ligger tett */}
          <PlaceClusterLayer
            markers={clusterMarkers}
            iconCreateFunction={clusterIcon}
            onClusterClick={onClusterClick}
            onMarkerClick={showPlace}
            groupRef={clusterGroupRef}
          />
          <SpotLayer
            spots={[...places].filter(([key, p]) => p.spot && !focusKeys.has(key)).map(([, p]) => p)}
            always={new Set(panelPlace?.spots ? [...panelPlace.spots.values()].flatMap(list => list.map(loc => posKey(loc.position))) : [])}
            onClick={showPlace}
          />
          {/* Aktivt sted, reisestopp og søketreff ligger utenfor klyngene; de to første med navnelapp */}
          {[...pinnedKeys].flatMap(key => {
            const place = places.get(key)!;
            return worldCopies(place.position).map((position, copyIndex) => (
              <Marker
                key={`pin-${key}-${copyIndex}`}
                position={position}
                icon={atCountryName(key, withAtlasMark(activePlaceIcon(place), pointMarks.get(key)?.been ? 'been' : pointMarks.get(key)?.want ? 'want' : undefined))}
                keyboard={false}
                zIndexOffset={1000}
                eventHandlers={{ click: () => showPlace(place.position) }}
              >
                {key === activeKey ? (
                  <Tooltip permanent direction="top" offset={[0, -14]} opacity={1} className="gt-label">{shortName(place.name)}</Tooltip>
                ) : (
                  <Tooltip direction="top" offset={[0, -14]} className="gt-label gt-country-hover">{place.name}</Tooltip>
                )}
              </Marker>
            ));
          })}
          <StopLabelLayout positions={focusPins.map(([, loc]) => loc.position)} names={focusPins.map(([, loc]) => shortName(loc.name))}>
            {labels => focusPins.flatMap(([key, loc], index) => worldCopies(loc.position).map((position, copyIndex) => {
              const mark = stopMarks(loc);
              const { direction, compact } = labels[index];
              // Uten rutenummer må navnet stå uansett
              const showName = !compact || !mark;
              return (
              <Marker
                key={`stop-${key}-${copyIndex}`}
                position={position}
                icon={isCountryStop(loc) ? ICONS.countryStop : withAtlasMark(spotParentOf(loc) ? ACTIVE_SPOT_ICON : activePlaceIcon(places.get(key) ?? placeForLocation(loc), loc.settingType), pointMarks.get(key)?.been ? 'been' : pointMarks.get(key)?.want ? 'want' : undefined)}
                title={`${loc.name}${loc.scale !== 'site' ? ' · approximate area' : ' · specific site'}`}
                keyboard={false}
                zIndexOffset={1500}
                eventHandlers={{ click: () => showPlace(loc.position, view?.mode === 'game') }}
              >
                {/* Nøkkelen bytter lappen ut når retningen endres; react-leaflet oppdaterer ikke retningen alene */}
                <Tooltip key={`${direction}-${showName}`} permanent direction={direction} offset={LABEL_OFFSET[direction]} opacity={1} className={`gt-label ${showName ? '' : 'is-compact'}`}>
                  {mark}{showName && shortName(loc.name)}
                </Tooltip>
              </Marker>
              );
            }))}
          </StopLabelLayout>
          {userPosition && worldCopies(userPosition).map((position, copyIndex) => (
            <Marker key={`user-${copyIndex}`} position={position} icon={ICONS.user} title="You are here" zIndexOffset={2000} interactive={false}>
              <Tooltip permanent direction="top" offset={[0, -10]} className="gt-label">You</Tooltip>
            </Marker>
          ))}
        </MapContainer>
        {/* Kartknapper: et tilfeldig spill og spill nær deg, over zoomen */}
        <div className="atlas-map-tools">
          <button type="button" onClick={surpriseMe} aria-label="Surprise me: open a random game" title="Surprise me: open a random game" className="atlas-map-button atlas-map-surprise">
            <Shuffle size={20} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={handleNearMe} aria-label="Games near me" title="Games near me" className="atlas-map-button">
            <LocateFixed size={20} strokeWidth={1.75} />
          </button>
        </div>

        {introVisible && (
          <section className="atlas-intro" aria-labelledby="atlas-intro-title">
            <div className="atlas-intro-heading">
              <h2 id="atlas-intro-title">Places you’ve<br /><em>played before.</em></h2>
              <button
                type="button"
                onClick={() => {
                  rememberIntroDismissal(true);
                  moreButtonRef.current?.focus({ preventScroll: true });
                }}
                aria-label="Dismiss welcome panel"
                title="Dismiss welcome panel"
                className="atlas-intro-close"
              >
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <p>Find the places behind your favourite games. The numbers count the games set in each area: pick one, search for a title, or start with a city.</p>
            <nav aria-label="Start exploring a place">
              {START_PLACES.map(({ name, label }) => {
                const place = [...places.values()].find(p => p.name === name);
                return place ? <button key={name} type="button" onClick={() => showPlace(place.position)}>{label}<ArrowUpRight size={14} aria-hidden="true" /></button> : null;
              })}
            </nav>
          </section>
        )}

        <div className="atlas-map-notices pointer-events-none absolute inset-x-4 top-6 z-[900] flex flex-col items-center gap-2">
          {notice && (
            // Samme form som bekreftelsene nederst (.atlas-toast): avrundet, fylt med blekk, myk skygge
            <div role="status" className="atlas-notice pointer-events-auto">
              {notice.endsWith('…') && <LocateFixed className="atlas-notice-pulse" size={16} strokeWidth={1.75} aria-hidden="true" />}
              <span>{notice}</span>
            </div>
          )}
          {atlasFilterText(atlasFilter) && (
            <div role="status" className="pointer-events-auto flex flex-wrap items-center gap-x-3 rounded-[12px] border border-ink/20 bg-sheet py-1 pr-1 pl-4 text-[0.95rem] shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--color-shadow)_35%,transparent)]">
              <span>My atlas: showing only {atlasFilterText(atlasFilter)}.</span>
              <button type="button" onClick={() => setAtlasFilter(NO_ATLAS_FILTER)} className="min-h-11 cursor-pointer rounded-[10px] px-3 font-bold text-magenta underline underline-offset-4 hover:bg-ink/7">Show everything</button>
            </div>
          )}
          {approximate && !notice && view?.mode !== 'game' && !searchListOpen && (
            <div role="status" className="pointer-events-auto rounded-[12px] border border-ink/20 bg-sheet px-4 py-2 text-[0.95rem] shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--color-shadow)_35%,transparent)]">
              Nothing matches “{search.trim()}” exactly. Showing similar spellings.
            </div>
          )}
          {filteredGames.length === 0 && !(searchListOpen && query) && (
            <div role="status" className="pointer-events-auto flex max-w-xl flex-col gap-1 rounded-[14px] border border-ink/20 bg-sheet px-5 py-3 shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--color-shadow)_35%,transparent)]">
              <span className="font-semibold">{emptyMessage}</span>
              {emptyHelp}
            </div>
          )}
        </div>

        {panel && panelVisible && (
          <LocationFlyout
            title={panelTitle}
          placeType={panelPlaceType}
          placeTypeVaries={!!panelPlace && panelPlace.placeTypes.size > 1}
            variant={view?.mode === 'game' ? 'game' : view?.mode === 'index' ? 'index' : view?.mode === 'atlas' ? 'atlas' : view?.mode === 'series' ? 'series' : 'list'}
            onOpenSeries={showSeries}
            atlasContent={view?.mode === 'atlas' ? (
              <MyAtlasPanel
                games={games}
                filter={atlasFilter}
                onFilter={setAtlasFilter}
                totals={atlasTotals}
                onExport={exportAtlasCsv}
                onImport={chooseAtlasCsv}
                onTable={() => openAtlasDialog({ kind: 'table' })}
                onRestore={restoreClearedAtlas}
                onClear={() => openAtlasDialog({ kind: 'clear' })}
              />
            ) : undefined}
            sections={sections}
            placeIndex={placeIndex}
            placeIds={panelPlaceIds}
            wikipediaUrl={canonicalPlaces.find(p => p.id === panelRecordIds[0])?.wikipediaUrl}
            mapsUrl={(() => { const record = canonicalPlaces.find(p => p.id === panelRecordIds[0]); return record ? googleMapsUrl(record) : undefined; })()}
            description={canonicalPlaces.find(p => p.id === panelRecordIds[0])?.description}
            autoFocus={panel.autoFocus}
            focusRequest={panel.seq}
            restoreScrollTop={scrollRestore?.seq === panel.seq ? scrollRestore.top : undefined}
            backLabel={panel.history.length ? backTitle(panel.history[panel.history.length - 1], places) : undefined}
            selectedGameId={selectedGameId}
            selectedRouteId={selectedRouteId}
            onSelectRoute={selectRoute}
            hiddenByFilters={openGameHidden}
            onShowHidden={clearSearchAndFilters}
            minimizeRequest={mapTapCount}
            peekFor={peekFor}
            nearby={nearby}
            sameEra={sameEra}
            contributeUrl={CONTRIBUTE_URL}
            onBack={goBack}
            onOpenGame={game => showGame(game)}
            onToggleRoute={toggleRoute}
            onClose={closePanel}
            onLocationClick={visitStop}
            activeStopKey={activeStopKey}
            onExpandFromPeek={recenterPlaceOnSheetExpand}
            onShare={handleShare}
          />
        )}

        <AtlasToastMessage key={atlasToast?.seq} toast={atlasToast} onDone={hideAtlasToast} onToast={showAtlasToast} />
        <AtlasDialogs
          dialog={atlasDialog}
          catalog={atlasCatalog}
          siteUrl={new URL(import.meta.env.BASE_URL, window.location.origin).href}
          onClose={closeAtlasDialog}
          onChooseFile={() => csvInputRef.current?.click()}
          onExport={exportAtlasCsv}
          onToast={showAtlasToast}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void readAtlasCsv(file);
          }}
        />

        <dialog
          ref={infoDialogRef}
          className="atlas-info-dialog"
          aria-labelledby="info-dialog-title"
          aria-describedby="about-dialog-description"
          onCancel={event => {
            event.preventDefault();
            setAboutOpen(false);
          }}
          onClose={() => {
            setAboutOpen(false);
            moreButtonRef.current?.focus({ preventScroll: true });
          }}
          onClick={event => {
            if (event.target === event.currentTarget) setAboutOpen(false);
          }}
        >
          {aboutOpen && (
            <>
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink/15 px-6 py-5">
                <h2 id="info-dialog-title" className="text-[1.25rem] font-bold leading-tight">{infoTab === 'places' ? 'How places are chosen' : 'About the project'}</h2>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAboutOpen(false)}
                  aria-label="Close dialog"
                  className="-mr-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] hover:bg-ink/7"
                >
                  <X size={24} strokeWidth={2} aria-hidden="true" />
                </button>
              </header>
              {infoTab === 'places' ? (
                <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-6">
                  <PlaceGuide contributeUrl={CONTRIBUTE_URL} />
                </div>
              ) : (
              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-6">
                <p id="about-dialog-description">
                  Game Traveler is an interactive atlas connecting video games to the real-world places and eras behind their stories.
                </p>
                <p className="mt-4">
                  <button type="button" onClick={() => setInfoTab('places')} className="cursor-pointer font-semibold text-magenta underline underline-offset-4 hover:text-magenta-deep">How places are chosen</button>
                </p>
                <p className="mt-4">
                  A project by{' '}
                  <a
                    href="https://truben.no"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-magenta underline underline-offset-4 hover:text-magenta-deep"
                  >
                    Truben.no
                  </a>.
                </p>
                <section className="mt-6 border-t border-rule pt-4">
                  <h3 className="text-base font-bold">Credits</h3>
                  <p className="mt-2">Game and location sources are linked in each game’s panel.</p>
                  <p className="mt-2">
                    Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-magenta">OpenStreetMap contributors</a>; tiles by{' '}
                    <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-magenta">OpenFreeMap</a> and{' '}
                    <a href="https://www.openmaptiles.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-magenta">OpenMapTiles</a>.
                  </p>
                  <p className="mt-2">Cover art from IGDB where available. Typefaces: Archivo and Newsreader.</p>
                </section>
              </div>
              )}
            </>
          )}
        </dialog>
      </main>
      {/* Under 1360 px står tellingen ikke i headeren; den leses fortsatt opp når søk og filter endrer den */}
      <footer className="atlas-footer">
        <div className="atlas-summary">{summary}</div>
      </footer>
    </div>
  );
}

// Kort navn på forrige visning, til «Back to …»-knappen
function backTitle(view: Panel, places: Map<string, Place>): string {
  if (view.mode === 'place') return shortName(places.get(posKey(view.position))?.name ?? view.name);
  if (view.mode === 'game') return shortName(gameById.get(view.id)?.name ?? 'the game');
  if (view.mode === 'search') return `“${view.query}”`;
  if (view.mode === 'near') return 'places near you';
  if (view.mode === 'atlas') return 'My atlas';
  if (view.mode === 'country') return shortName(countryTitle(view.iso));
  if (view.mode === 'series') return `the ${view.name} series`;
  return 'the list';
}

export default App;

// Hvordan stedene velges og vises: det samme som CONTRIBUTING.md og DESIGN.md sier, i leserens ord
function PlaceGuide({ contributeUrl }: { contributeUrl?: string }) {
  const h = 'mt-6 text-base font-bold first:mt-0';
  const p = 'mt-2 leading-relaxed';
  return (
    <div className="text-[0.95rem]">
      <p className={p}>Every pin is a place the game actually takes you: somewhere you play through, explore or stand in. A place that is only mentioned in dialogue is not on the map.</p>
      <h3 className={h}>Real, fictionalized, imaginary</h3>
      <p className={p}><span className="font-semibold">Real</span> places are the real thing, as in A Date in the Park’s Lisbon park. <span className="font-semibold">Fictionalized</span> places are invented but sit inside a real region, or are real places the game reshapes: Dowerton in Dorset, Los Santos as Los Angeles. <span className="font-semibold">Imaginary</span> places come from legend, like Atlantis, and are pinned where the legend puts them. Worlds with no real geography at all, such as Hyrule, are not in the atlas.</p>
      <h3 className={h}>Dots, sites and shapes</h3>
      <p className={p}>A dot with an outer ring marks a representative point for a city or region, so the panel says “pin marks the area”. A dot without a ring is a specific site. A game set in a whole country gets a ringed dot in the middle of the country, and the country itself is a shape you can open, listing every game set anywhere inside it.</p>
      <h3 className={h}>Places within places</h3>
      <p className={p}>A park, castle or square inside a city is listed under the city, as “At …”. On the map it appears as a diamond with its name once you zoom in close, so the world view stays readable.</p>
      <h3 className={h}>Journeys</h3>
      <p className={p}>When a story moves from place to place in a fixed order, the game page has a journey you can show on the map, with numbered stops.</p>
      <h3 className={h}>Links and sources</h3>
      <p className={p}>Every place links to the Wikipedia article about the place itself, or about the place it is modelled on, never to the game. Each game links to its own source, and a location note cites a walkthrough or review when the game’s article does not say where a scene happens.</p>
      <h3 className={h}>My atlas</h3>
      <p className={p}>Been here, Want to go, Played and Want to play are saved in this browser only. Marking a place counts for the places above it: Bangkok counts as Thailand.</p>
      {contributeUrl && (
        <p className={`${p} mt-6`}>
          Missing a game or a place? <a href={contributeUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-magenta underline underline-offset-4 hover:text-magenta-deep">Suggest it</a>.
        </p>
      )}
    </div>
  );
}
