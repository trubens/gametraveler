import { MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import L from 'leaflet';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react';
import './App.css';

import { games, Game } from './gameData';
import { Basemap } from './Basemap';
import { LocationFlyout, NearbyPlace, PanelSection } from './LocationFlyout';
import { DoubleRangeSlider, Scale } from './DoubleRangeSlider';
import { count, distanceKm, eraSpan, shortName, slugify } from './format';
import { readUrl, writeUrl, UrlState } from './url';
import { createGameSearch, filterSearchResults, searchPositions, type SearchHit } from './search';

type Position = [number, number];
type Place = { position: Position; name: string; games: Game[] };

const posKey = (p: Position) => `${p[0]},${p[1]}`;

// Gyldige koordinater (ikke [0,0] og ikke undefined)
const isValidPosition = (pos: Position) =>
  Array.isArray(pos) && pos.length === 2 &&
  typeof pos[0] === 'number' && typeof pos[1] === 'number' &&
  (pos[0] !== 0 || pos[1] !== 0);

// Markør-ikoner per tilstand, opprettet én gang. 44px treffområde for touch.
const makeIcon = (className: string, size: number) =>
  L.divIcon({ className, html: '<span></span>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
const ICONS = {
  normal: makeIcon('gt-marker', 44),
  active: makeIcon('gt-marker is-active', 44),
  dimmed: makeIcon('gt-marker is-dimmed', 44),
  user: makeIcon('gt-user', 24),
};

// Spilldata er statisk, så verdier for filtrene beregnes én gang
const years = Array.from(new Set(games.map(g => g.year))).sort((a, b) => a - b);
const minYear = years[0] ?? 1980;
const maxYear = years[years.length - 1] ?? 2025;
// Merk: år 0 og negative år (BC) er gyldige her
const storyYearsList = Array.from(new Set(games.flatMap(g => g.storyYears))).sort((a, b) => a - b);
const minStoryYear = storyYearsList[0] ?? minYear;
const maxStoryYear = storyYearsList[storyYearsList.length - 1] ?? maxYear;
const genres = Array.from(new Set(games.map(g => g.genre))).sort();
const gameBySlug = new Map(games.map(g => [slugify(g.name), g]));
const gameById = new Map(games.map(g => [g.id, g]));
const searchGames = createGameSearch(games);

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

// Klynger åpner lista først når stedene ligger så tett at kartet ikke kan skille dem
const LIST_ZOOM = 10;
// Radius for «Nearby» og «Near me»
const NEARBY_KM = 600;
const NEAR_ME_KM = 800;

const CONTRIBUTE_URL = (import.meta.env.VITE_CONTRIBUTE_URL as string | undefined) || undefined;
const DEFAULT_TITLE = 'Game Traveller – where video games take place';

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

type MapMove =
  | { kind: 'point'; position: Position }
  | { kind: 'bounds'; positions: Position[] };
type MapTarget = MapMove & { seq: number; instant?: boolean };

// Hva panelet viser. Det husker steder, ikke spill, slik at innholdet følger søk og filter.
type Panel =
  | { mode: 'place'; position: Position; name: string }
  | { mode: 'cluster'; positions: Position[] }
  | { mode: 'search' }
  | { mode: 'game'; id: number }
  | { mode: 'near'; position: Position };
type PanelState = { view: Panel; seq: number; autoFocus: boolean; history: Panel[] };

const panelPadding = (size: L.Point) => isDesktop()
  ? { paddingTopLeft: L.point(470, 60), paddingBottomRight: L.point(80, 60) }
  : { paddingTopLeft: L.point(40, 40), paddingBottomRight: L.point(40, size.y * 0.62 + 30) };

type Filters = { query: string; genre: string; yearRange: [number, number]; storyYearRange: [number, number] };

function filterGames({ query, genre, yearRange, storyYearRange }: Filters): SearchHit[] {
  // Fullt spenn betyr ingen avgrensning, også for spill uten oppgitt år i handlingen
  const storyFull = storyYearRange[0] === minStoryYear && storyYearRange[1] === maxStoryYear;
  return filterSearchResults(searchGames(query), {
    genre, yearRange, storyYearRange: storyFull ? undefined : storyYearRange,
  });
}

// Ett kartpunkt per unike sted, med alle spillene som utspiller seg der
function buildPlaces(list: Game[]): Map<string, Place> {
  const byKey = new Map<string, Place>();
  for (const game of list) {
    for (const loc of game.locations) {
      if (!isValidPosition(loc.position)) continue;
      const key = posKey(loc.position);
      const place = byKey.get(key) ?? { position: loc.position, name: loc.name, games: [] };
      if (!place.games.includes(game)) place.games.push(game);
      byKey.set(key, place);
    }
  }
  return byKey;
}

const clampRange = (range: [number, number] | undefined, min: number, max: number): [number, number] =>
  range ? [Math.max(min, range[0]), Math.min(max, range[1])] : [min, max];

// Startstilstand fra en delt lenke
function initialFromUrl(url: UrlState) {
  const filters: Filters = {
    query: (url.q ?? '').toLowerCase(),
    genre: url.genre && genres.includes(url.genre) ? url.genre : '',
    yearRange: clampRange(url.released, minYear, maxYear),
    storyYearRange: clampRange(url.set, minStoryYear, maxStoryYear),
  };
  const hits = filterGames(filters);
  const places = buildPlaces(hits.map(hit => hit.game));
  let panel: PanelState | null = null;
  let selectedGameId: number | undefined;
  let target: MapTarget | undefined;
  const game = url.game ? gameBySlug.get(url.game) : undefined;
  const place = url.place ? [...places.values()].find(p => slugify(p.name) === url.place) : undefined;
  if (game) {
    panel = { view: { mode: 'game', id: game.id }, seq: 1, autoFocus: false, history: [] };
    selectedGameId = game.id;
    target = { kind: 'bounds', positions: game.locations.map(l => l.position).filter(isValidPosition), seq: 1, instant: true };
  } else if (place) {
    panel = { view: { mode: 'place', position: place.position, name: place.name }, seq: 1, autoFocus: false, history: [] };
    target = { kind: 'point', position: place.position, seq: 1, instant: true };
  } else if (url.q && places.size > 0) {
    panel = { view: { mode: 'search' }, seq: 1, autoFocus: false, history: [] };
    selectedGameId = hits.length === 1 ? hits[0].game.id : undefined;
    target = { kind: 'bounds', positions: searchPositions(hits).filter(isValidPosition), seq: 1, instant: true };
  }
  return { filters, search: url.q ?? '', panel, selectedGameId, target };
}

// Flytter kartet, og tar hensyn til at panelet dekker venstre side (desktop) eller bunnen (mobil)
function MapMover({ target }: { target?: MapTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const size = map.getSize();
    const animate = !target.instant;
    if (target.kind === 'point') {
      const zoom = Math.max(map.getZoom(), 5);
      const shift = isDesktop() ? L.point(210, 0) : L.point(0, -size.y * 0.31);
      const center = map.unproject(map.project(target.position, zoom).subtract(shift), zoom);
      if (animate) map.flyTo(center, zoom, { duration: 0.8 });
      else map.setView(center, zoom, { animate: false });
    } else if (target.positions.length > 0) {
      const bounds = L.latLngBounds(target.positions);
      const options = { ...panelPadding(size), maxZoom: 6 };
      if (animate) map.flyToBounds(bounds, { ...options, duration: 1 });
      else map.fitBounds(bounds, { ...options, animate: false });
    }
  }, [target, map]);

  return null;
}

// Reiseruten tegnes inn som én sammenhengende strek
function RouteLine({ game }: { game: Game }) {
  const positions = game.locations.map(l => l.position).filter(isValidPosition);
  if (positions.length < 2) return null;
  return (
    <Polyline
      key={game.id}
      positions={positions}
      pathOptions={{ color: '#d4006f', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round', className: 'gt-route', interactive: false }}
      eventHandlers={{ add: e => (e.target as L.Polyline).getElement()?.setAttribute('pathLength', '1') }}
    />
  );
}

function App() {
  const [initial] = useState(() => initialFromUrl(readUrl()));

  // Filtre
  const [search, setSearch] = useState(initial.search);
  const [genre, setGenre] = useState(initial.filters.genre);
  const [yearRange, setYearRange] = useState<[number, number]>(initial.filters.yearRange);
  const [storyYearRange, setStoryYearRange] = useState<[number, number]>(initial.filters.storyYearRange);
  const [filterOpen, setFilterOpen] = useState(false);

  const [panel, setPanel] = useState<PanelState | null>(initial.panel);
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(initial.selectedGameId);
  const [mapTarget, setMapTarget] = useState<MapTarget | undefined>(initial.target);
  const [userPosition, setUserPosition] = useState<Position | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const seq = useRef(initial.target?.seq ?? 0);
  const mapRef = useRef<L.Map>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Søkeeffekten skal bare reagere på det brukeren skriver, ikke på søk hentet fra lenken
  const searchTouched = useRef(false);

  const query = search.trim().toLowerCase();
  const filteredHits = useMemo(
    () => filterGames({ query, genre, yearRange, storyYearRange }),
    [query, genre, yearRange, storyYearRange],
  );
  const filteredGames = useMemo(() => filteredHits.map(hit => hit.game), [filteredHits]);
  const places = useMemo(() => buildPlaces(filteredGames), [filteredGames]);

  const view = panel?.view;
  const openGame = view?.mode === 'game' ? gameById.get(view.id) : undefined;
  const selectedGame = filteredGames.find(game => game.id === selectedGameId);
  const routeKeys = new Set(selectedGame?.locations.map(l => posKey(l.position)) ?? []);
  const activeKey = view?.mode === 'place' ? posKey(view.position) : undefined;
  // Steder som matcher søket markeres på kartet
  const searchKeys = new Set(filteredHits.flatMap(hit => hit.matchedLocations.map(l => posKey(l.position))));

  // Andre steder i nærheten, nærmest først
  const nearbyOf = (origins: Position[], exclude: Set<string>, limit = 6): NearbyPlace[] =>
    [...places]
      .filter(([key]) => !exclude.has(key))
      .map(([, p]) => ({ name: p.name, position: p.position, games: p.games.length, km: Math.min(...origins.map(o => distanceKm(o, p.position))) }))
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
    sections = [{ position: view.position, games: [...(place?.games ?? [])].sort(byYear) }];
    nearby = nearbyOf([view.position], new Set([posKey(view.position)]));
  } else if (view?.mode === 'cluster') {
    // Hvert spill vises én gang, under stedet med flest spill
    const seen = new Set<number>();
    const clusterPlaces = view.positions
      .map(p => places.get(posKey(p)))
      .filter((p): p is Place => p !== undefined)
      .sort((a, b) => b.games.length - a.games.length);
    sections = clusterPlaces.map(p => {
      const own = p.games.filter(g => !seen.has(g.id)).sort(byYear);
      own.forEach(g => seen.add(g.id));
      return { title: p.name, position: p.position, games: own };
    }).filter(s => s.games.length > 0);
    panelTitle = sections.length === 1 ? sections[0].title! : sections.length ? `${shortName(sections[0].title!)} area` : "";
  } else if (view?.mode === 'search') {
    // Behold relevansrekkefølgen fra søket; steds- og klyngepaneler sorteres fortsatt på år.
    panelTitle = `“${search.trim()}”`;
    sections = [{ games: filteredGames }];
  } else if (view?.mode === 'game' && openGame) {
    panelTitle = openGame.name;
    sections = [{ games: [openGame] }];
    const own = openGame.locations.map(l => l.position).filter(isValidPosition);
    nearby = nearbyOf(own, new Set(own.map(posKey)));
    // Spill med handling innenfor ti år av dette
    const years = openGame.storyYears;
    const closeness = (g: Game) => Math.min(...g.storyYears.flatMap(y => years.map(gy => Math.abs(y - gy))));
    sameEra = years.length
      ? games.filter(g => g.id !== openGame.id && g.storyYears.some(y => years.some(gy => Math.abs(y - gy) <= 10)))
          .sort((a, b) => closeness(a) - closeness(b) || byYear(a, b))
          .slice(0, 5)
      : undefined;
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

  // Klynger som inneholder et sted på reiseruten farges, så ruten ikke forsvinner i dem
  const clusterGroupRef = useRef<L.MarkerClusterGroup>(null);
  const routeKeysRef = useRef(routeKeys);
  useEffect(() => {
    routeKeysRef.current = routeKeys;
    clusterGroupRef.current?.refreshClusters();
  });

  // Klyngeikonet viser antall spill, ikke antall steder
  const placesRef = useRef(places);
  useEffect(() => { placesRef.current = places; }, [places]);
  const clusterIcon = useMemo(() => (cluster: L.MarkerCluster) => {
    const ids = new Set<number>();
    const children = cluster.getAllChildMarkers();
    for (const m of children) {
      const ll = m.getLatLng();
      placesRef.current.get(posKey([ll.lat, ll.lng]))?.games.forEach(g => ids.add(g.id));
    }
    const n = ids.size;
    const label = `${count(n, 'game')} in ${count(children.length, 'place')}`;
    // Ett spill på flere steder i nærheten vises som en prikk, ikke som et tall
    if (n === 1) {
      return L.divIcon({
        html: `<div class="gt-cluster is-single" role="img" aria-label="${label}" style="width:20px;height:20px"></div>`,
        className: 'gt-marker',
        iconSize: [44, 44],
      });
    }
    const size = n < 10 ? 38 : n < 50 ? 46 : 54;
    return L.divIcon({
      html: `<div class="gt-cluster" role="img" aria-label="${label}" style="width:${size}px;height:${size}px;font-size:${n < 100 ? 17 : 15}px">${n}</div>`,
      className: '',
      iconSize: [Math.max(size, 44), Math.max(size, 44)],
    });
  }, []);

  // Tidsspennet handlingen i de synlige spillene dekker, innenfor valgt spenn
  const issueEra = eraSpan(filteredGames.flatMap(g =>
    g.storyYears.filter(y => y >= storyYearRange[0] && y <= storyYearRange[1])));

  const yearsFull = yearRange[0] === minYear && yearRange[1] === maxYear;
  const storyFull = storyYearRange[0] === minStoryYear && storyYearRange[1] === maxStoryYear;
  const activeFilters = (genre ? 1 : 0) + (yearsFull ? 0 : 1) + (storyFull ? 0 : 1);

  const resetFilters = () => {
    setGenre("");
    setYearRange([minYear, maxYear]);
    setStoryYearRange([minStoryYear, maxStoryYear]);
  };

  const moveMap = (move: MapMove) => setMapTarget({ ...move, seq: ++seq.current });

  const openPanel = (next: Panel, opts: { autoFocus?: boolean; fromPanel?: boolean } = {}) => {
    const { autoFocus = true, fromPanel = false } = opts;
    // Husk hva som åpnet panelet, så fokus kan føres tilbake dit
    if (autoFocus && !fromPanel) returnFocusRef.current = document.activeElement as HTMLElement | null;
    setPanel(prev => ({
      view: next,
      seq: (prev?.seq ?? 0) + 1,
      autoFocus,
      history: fromPanel && prev ? [...prev.history, prev.view] : [],
    }));
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

  const showPlace = (position: Position, fromPanel = false) => {
    const place = places.get(posKey(position));
    if (!place) return;
    openPanel({ mode: 'place', position, name: place.name }, { fromPanel });
    // Behold reiseruten når man reiser videre langs den
    if (!selectedGame?.locations.some(l => posKey(l.position) === posKey(position))) {
      setSelectedGameId(undefined);
    }
    moveMap({ kind: 'point', position });
  };

  const showGame = (game: Game, fromPanel = true) => {
    openPanel({ mode: 'game', id: game.id }, { fromPanel });
    setSelectedGameId(game.id);
    moveMap({ kind: 'bounds', positions: game.locations.map(l => l.position).filter(isValidPosition) });
  };

  const goBack = () => {
    setPanel(prev => {
      if (!prev || prev.history.length === 0) return prev;
      const back = prev.history[prev.history.length - 1];
      if (back.mode === 'place') moveMap({ kind: 'point', position: back.position });
      if (back.mode !== 'game') setSelectedGameId(undefined);
      return { view: back, seq: prev.seq + 1, autoFocus: true, history: prev.history.slice(0, -1) };
    });
  };

  const toggleRoute = (game: Game) => {
    if (game.id === selectedGameId) {
      setSelectedGameId(undefined);
      return;
    }
    setSelectedGameId(game.id);
    moveMap({ kind: 'bounds', positions: game.locations.map(l => l.position).filter(isValidPosition) });
  };

  const handleClusterClick = (e: L.LeafletMouseEvent) => {
    if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    const cluster = e.layer as L.MarkerCluster | undefined;
    const map = mapRef.current;
    if (!cluster?.getAllChildMarkers || !map) return;

    // Kartet er navigasjonen: zoom inn til stedene skilles, og vis lista først når de ligger tett
    const bounds = cluster.getBounds();
    const pad = panel ? panelPadding(map.getSize()) : { paddingTopLeft: L.point(60, 60), paddingBottomRight: L.point(60, 60) };
    const fitZoom = map.getBoundsZoom(bounds, false, pad.paddingTopLeft.add(pad.paddingBottomRight));
    if (fitZoom > map.getZoom() && fitZoom < LIST_ZOOM) {
      map.flyToBounds(bounds, { ...pad, duration: 0.8 });
      return;
    }

    const positions = cluster.getAllChildMarkers().map(m => [m.getLatLng().lat, m.getLatLng().lng] as Position);
    if (!positions.some(p => places.has(posKey(p)))) return;
    openPanel({ mode: 'cluster', positions });
    setSelectedGameId(undefined);
  };

  // Klyngegruppen binder hendelser kun én gang, så klikket går via en ref til nyeste handler
  const clusterClickRef = useRef(handleClusterClick);
  useEffect(() => { clusterClickRef.current = handleClusterClick; });
  const onClusterClick = useMemo(() => (e: L.LeafletMouseEvent) => clusterClickRef.current(e), []);

  const handleNearMe = () => {
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
    try {
      if (mobile && navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice('Link copied');
    } catch {
      setNotice('Could not copy the link');
    }
  };

  // Søket svarer: kartet flyr til treffene og panelet lister dem. Ett entydig spill får reiseruten sin.
  const latest = useRef(filteredHits);
  useEffect(() => { latest.current = filteredHits; });
  useEffect(() => {
    if (!searchTouched.current) return;
    const q = search.trim();
    const timer = setTimeout(() => {
      if (!q) {
        setPanel(p => (p?.view.mode === 'search' ? null : p));
        setSelectedGameId(undefined);
        return;
      }
      const hits = latest.current;
      if (hits.length === 0) {
        setSelectedGameId(undefined);
        setPanel(null);
        return;
      }
      setPanel(prev => ({ view: { mode: 'search' }, seq: (prev?.seq ?? 0) + 1, autoFocus: false, history: [] }));
      setSelectedGameId(hits.length === 1 ? hits[0].game.id : undefined);
      setMapTarget({ kind: 'bounds', positions: searchPositions(hits).filter(isValidPosition), seq: ++seq.current });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Lenken og fanetittelen følger det som vises
  useEffect(() => {
    const placeName = view?.mode === 'place' ? (places.get(posKey(view.position))?.name ?? view.name) : undefined;
    writeUrl({
      q: search.trim() || undefined,
      genre: genre || undefined,
      released: yearsFull ? undefined : yearRange,
      set: storyFull ? undefined : storyYearRange,
      game: openGame ? slugify(openGame.name) : undefined,
      place: placeName ? slugify(placeName) : undefined,
    });
    document.title = panelTitle && panelGames > 0 ? `${panelTitle} – Game Traveller` : DEFAULT_TITLE;
  }, [search, genre, yearRange, storyYearRange, yearsFull, storyFull, openGame, view, places, panelTitle, panelGames]);

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

  // Tastatur: Escape lukker filteret først, deretter panelet. «/» går til søket. Enter/mellomrom åpner markører.
  const keyState = useRef({ filterOpen, panelOpen: !!panel, closePanel, closeFilter });
  useEffect(() => { keyState.current = { filterOpen, panelOpen: !!panel, closePanel, closeFilter }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.matches('input, textarea, select');
      const k = keyState.current;
      if (e.key === 'Escape') {
        if (k.filterOpen) k.closeFilter();
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

  const searchField = (
    <label className="relative block w-full">
      <span className="sr-only">Search games or places</span>
      <Search size={20} strokeWidth={2.25} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
      <input
        type="search"
        placeholder="Search games or places"
        value={search}
        onChange={e => { searchTouched.current = true; setSearch(e.target.value); }}
        aria-keyshortcuts="/"
        className="h-11 w-full bg-white pr-10 pl-10 text-base text-ink placeholder:text-ink-soft focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-yellow [&::-webkit-search-cancel-button]:appearance-none"
      />
      {search && (
        <button
          type="button"
          onClick={() => { searchTouched.current = true; setSearch(""); }}
          aria-label="Clear search"
          className="absolute top-1/2 right-0 grid size-11 -translate-y-1/2 cursor-pointer place-items-center text-ink-soft hover:text-ink"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      )}
    </label>
  );

  const storyActiveEra = ERAS.find(e => e.range[0] === storyYearRange[0] && e.range[1] === storyYearRange[1]);

  // Steder som skal være synlige uavhengig av klynger: aktivt sted, reisestopp og få nok søketreff
  const pinnedKeys = new Set([
    ...routeKeys,
    ...(activeKey ? [activeKey] : []),
    ...(searchKeys.size <= 8 ? searchKeys : []),
  ].filter(k => places.has(k)));

  const emptyMessage = query && activeFilters > 0
    ? `No games match “${search.trim()}” with these filters.`
    : query
      ? `No games or places match “${search.trim()}”.`
      : 'No games match these filters.';

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className="relative z-[1100] bg-ink text-white">
        <div className="flex h-16 items-center gap-3 px-4 md:gap-5 md:px-6">
          <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-baseline md:gap-5">
            <h1 className="headline shrink-0 text-[1.6rem] leading-none whitespace-nowrap uppercase md:text-[1.9rem]">
              Game <span className="text-yellow">Traveller</span>
            </h1>
            <p className="numerals truncate text-[0.8125rem] leading-none font-semibold text-white md:text-base" aria-live="polite">
              {filteredGames.length === games.length ? games.length : `${filteredGames.length} of ${games.length}`} games
              {' · '}{count(places.size, 'place')}
              {issueEra && <span className="text-yellow">{' · '}{issueEra}</span>}
            </p>
          </div>
          <div className="ml-auto hidden w-full max-w-md md:block">{searchField}</div>
          <button
            type="button"
            onClick={handleNearMe}
            aria-label="Games near me"
            title="Games near me"
            className="ml-auto flex h-11 shrink-0 cursor-pointer items-center gap-2 bg-white/10 px-3 font-bold text-white transition-colors hover:bg-white/20 md:ml-0 md:px-3.5"
          >
            <LocateFixed size={20} strokeWidth={2.25} />
            <span className="hidden lg:inline">Near me</span>
          </button>
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => (filterOpen ? closeFilter() : setFilterOpen(true))}
            aria-expanded={filterOpen}
            aria-controls="filter-panel"
            className={`flex h-11 shrink-0 cursor-pointer items-center gap-2 px-3.5 font-bold transition-colors ${
              filterOpen ? 'bg-yellow text-ink' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <SlidersHorizontal size={20} strokeWidth={2.25} />
            Filter
            {activeFilters > 0 && (
              <span className="numerals grid size-6 place-items-center rounded-full bg-magenta text-sm text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
        <div className="px-4 pb-3 md:hidden">{searchField}</div>

        {filterOpen && (
          <>
            <div className="fixed inset-0 z-[-1]" onClick={closeFilter} aria-hidden="true" />
            <section
              id="filter-panel"
              ref={filterPanelRef}
              tabIndex={-1}
              aria-labelledby="filter-title"
              className="gt-panel absolute top-full right-0 flex max-h-[calc(100dvh-8rem)] w-full flex-col gap-6 overflow-y-auto border-b-[3px] border-ink bg-sheet p-6 text-ink focus:outline-none md:right-6 md:w-[400px] md:border-x-[3px]"
            >
              <div className="flex items-center justify-between">
                <h2 id="filter-title" className="headline text-[1.6rem] leading-none uppercase">Filter</h2>
                <button
                  type="button"
                  onClick={closeFilter}
                  aria-label="Close filters"
                  className="-mr-2 grid size-11 cursor-pointer place-items-center hover:bg-yellow"
                >
                  <X size={24} strokeWidth={2.5} />
                </button>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Genre</span>
                <span className="relative">
                  <select
                    value={genre}
                    onChange={e => setGenre(e.target.value)}
                    className="h-11 w-full cursor-pointer appearance-none border-2 border-ink bg-white pr-10 pl-3 text-base font-medium"
                  >
                    <option value="">All genres</option>
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown size={20} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
                </span>
              </label>

              <DoubleRangeSlider
                min={minYear}
                max={maxYear}
                value={yearRange}
                onChange={setYearRange}
                label="Released"
              />

              <div className="flex flex-col gap-2">
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
                        className={`min-h-11 cursor-pointer border-2 px-3 text-[0.95rem] font-semibold transition-colors md:min-h-9 ${
                          active ? 'border-ink bg-ink text-white' : 'border-rule text-ink hover:border-ink'
                        }`}
                      >
                        {era.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-rule pt-5">
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
                  className="numerals h-11 cursor-pointer bg-magenta px-5 font-bold text-white transition-colors hover:bg-magenta-deep"
                >
                  Show {count(filteredGames.length, 'game')}
                </button>
              </div>
            </section>
          </>
        )}
      </header>

      <main className="relative flex-1">
        <MapContainer
          ref={mapRef}
          center={[30, 10]}
          zoom={isDesktop() ? 3 : 2}
          minZoom={2}
          maxZoom={18}
          zoomControl={false}
          worldCopyJump
          className="absolute inset-0 z-0"
        >
          <Basemap />
          <ZoomControl position="bottomright" />
          <MapMover target={mapTarget} />
          {selectedGame && <RouteLine game={selectedGame} />}
          <MarkerClusterGroup
            ref={clusterGroupRef}
            // Klikk på klynge zoomer inn, eller åpner panelet når stedene ligger tett
            zoomToBoundsOnClick={false}
            showCoverageOnHover={false}
            spiderfyOnMaxZoom={false}
            maxClusterRadius={50}
            iconCreateFunction={clusterIcon}
            onClick={onClusterClick}
          >
            {[...places].filter(([key]) => !pinnedKeys.has(key)).map(([key, place]) => (
              <Marker
                key={key}
                position={place.position}
                icon={searchKeys.has(key) ? ICONS.active : selectedGame ? ICONS.dimmed : ICONS.normal}
                title={place.name}
                eventHandlers={{ click: () => showPlace(place.position) }}
              />
            ))}
          </MarkerClusterGroup>
          {/* Aktivt sted, reisestopp og søketreff ligger utenfor klyngene; de to første med navnelapp */}
          {[...pinnedKeys].map(key => {
            const place = places.get(key)!;
            return (
              <Marker
                key={`pin-${key}`}
                position={place.position}
                icon={ICONS.active}
                title={place.name}
                zIndexOffset={1000}
                eventHandlers={{ click: () => showPlace(place.position) }}
              >
                {(routeKeys.has(key) || key === activeKey) && (
                  <Tooltip permanent direction="top" offset={[0, -14]} className="gt-label">{shortName(place.name)}</Tooltip>
                )}
              </Marker>
            );
          })}
          {userPosition && (
            <Marker position={userPosition} icon={ICONS.user} title="You are here" zIndexOffset={2000} interactive={false}>
              <Tooltip permanent direction="top" offset={[0, -10]} className="gt-label">You</Tooltip>
            </Marker>
          )}
        </MapContainer>

        <div className="pointer-events-none absolute inset-x-4 top-6 z-[900] flex flex-col items-center gap-2">
          {notice && (
            <div role="status" className="pointer-events-auto border-[3px] border-ink bg-ink px-5 py-3 font-semibold text-white">
              {notice}
            </div>
          )}
          {filteredGames.length === 0 && (
            <div role="status" className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-1 border-[3px] border-ink bg-sheet px-5 py-3">
              <span className="font-semibold">{emptyMessage}</span>
              {query && (
                <button type="button" onClick={() => { searchTouched.current = true; setSearch(""); }} className="min-h-11 cursor-pointer font-bold text-magenta underline underline-offset-4">
                  Clear search
                </button>
              )}
              {activeFilters > 0 && (
                <button type="button" onClick={resetFilters} className="min-h-11 cursor-pointer font-bold text-magenta underline underline-offset-4">
                  Reset filters
                </button>
              )}
              {CONTRIBUTE_URL && (
                <a href={CONTRIBUTE_URL} target="_blank" rel="noopener" className="font-semibold text-ink-soft underline underline-offset-4">
                  Suggest a game
                </a>
              )}
            </div>
          )}
        </div>

        {panel && panelGames > 0 && (
          <LocationFlyout
            key={panel.seq}
            title={panelTitle}
            variant={view?.mode === 'game' ? 'game' : 'list'}
            sections={sections}
            autoFocus={panel.autoFocus}
            backLabel={panel.history.length ? backTitle(panel.history[panel.history.length - 1], places) : undefined}
            selectedGameId={selectedGameId}
            nearby={nearby}
            sameEra={sameEra}
            contributeUrl={CONTRIBUTE_URL}
            onBack={goBack}
            onOpenGame={game => showGame(game)}
            onToggleRoute={toggleRoute}
            onClose={closePanel}
            onLocationClick={position => showPlace(position, true)}
            onShare={handleShare}
          />
        )}
      </main>
    </div>
  );
}

// Kort navn på forrige visning, til «Back to …»-knappen
function backTitle(view: Panel, places: Map<string, Place>): string {
  if (view.mode === 'place') return shortName(places.get(posKey(view.position))?.name ?? view.name);
  if (view.mode === 'game') return shortName(gameById.get(view.id)?.name ?? 'the game');
  if (view.mode === 'search') return 'search';
  if (view.mode === 'near') return 'places near you';
  return 'the list';
}

export default App;
