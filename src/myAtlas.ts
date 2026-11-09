// «My atlas»: steder du har vært og vil til, spill du har spilt og vil spille.
// Alt ligger bare i denne nettleseren (localStorage). Steder lagres på den stabile sted-id-en fra dataene,
// spill på spill-id-en. Å tømme flytter verdien til en egen nøkkel, så det kan angres.
import { useSyncExternalStore } from 'react';
import redirects from './data/redirects.json';
// Steds-id-er som er slått sammen eller omdøpt (London fantes tre ganger): et merke satt på den gamle id-en
// følger med til den nye, så ingen mister «Been here» når katalogen ryddes
const movedPlaceIds: Record<string, string> = (redirects as { place: Record<string, string> }).place;
const currentPlaceId = (id: string) => movedPlaceIds[id] ?? id;


export const ATLAS_KEY = 'game-traveller:my-atlas';
export const CLEARED_KEY = 'game-traveller:my-atlas:cleared';

// Et sted er enten «Been here» eller «Want to go», et spill enten «Played» eller «Want to play»,
// aldri begge; det du har gjort, vinner over det du vil
export type PlaceMark = { been?: true; want?: true; at: string };
export type GameMark = { played?: true; want?: true; at: string };
export type Atlas = { v: 1; places: Record<string, PlaceMark>; games: Record<string, GameMark> };
export type ClearedAtlas = { clearedAt: string; reason: 'clear' | 'import-replace'; atlas: Atlas };

export const emptyAtlas = (): Atlas => ({ v: 1, places: {}, games: {} });
const today = () => new Date().toISOString().slice(0, 10);

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Bare kjente felt slipper gjennom, så en ødelagt eller manipulert verdi ikke kan knekke appen
export function normalizeAtlas(value: unknown): Atlas {
  const atlas = emptyAtlas();
  if (!isRecord(value)) return atlas;
  if (isRecord(value.places)) {
    for (const [id, mark] of Object.entries(value.places)) {
      if (!isRecord(mark)) continue;
      const next: PlaceMark = { at: typeof mark.at === 'string' ? mark.at : today() };
      if (mark.been === true) next.been = true;
      else if (mark.want === true) next.want = true;
      if (!(next.been || next.want)) continue;
      const current = currentPlaceId(id);
      // Flere gamle id-er kan lande på samme nye: det tidligste merket står
      if (!atlas.places[current] || atlas.places[current].at > next.at) atlas.places[current] = next;
    }
  }
  if (isRecord(value.games)) {
    for (const [id, mark] of Object.entries(value.games)) {
      if (!isRecord(mark)) continue;
      const next: GameMark = { at: typeof mark.at === 'string' ? mark.at : today() };
      if (mark.played === true) next.played = true;
      else if (mark.want === true) next.want = true;
      if (next.played || next.want) atlas.games[id] = next;
    }
  }
  return atlas;
}

const readKey = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let state: Atlas = typeof window === 'undefined' ? emptyAtlas() : normalizeAtlas(readKey(ATLAS_KEY));
let cleared: ClearedAtlas | null = typeof window === 'undefined' ? null : readCleared();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

function readCleared(): ClearedAtlas | null {
  const value = readKey(CLEARED_KEY);
  if (!isRecord(value) || typeof value.clearedAt !== 'string') return null;
  return { clearedAt: value.clearedAt, reason: value.reason === 'import-replace' ? 'import-replace' : 'clear', atlas: normalizeAtlas(value.atlas) };
}

// Kaster hvis nettleseren nekter å lagre (fullt lager, privat modus); da endres ingenting
function persist(next: Atlas) {
  window.localStorage.setItem(ATLAS_KEY, JSON.stringify(next));
  state = next;
  notify();
}

if (typeof window !== 'undefined') {
  // Hold flere åpne faner i takt
  window.addEventListener('storage', event => {
    if (event.key === ATLAS_KEY || event.key === null) state = normalizeAtlas(readKey(ATLAS_KEY));
    if (event.key === CLEARED_KEY || event.key === null) cleared = readCleared();
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useMyAtlas = () => useSyncExternalStore(subscribe, () => state, emptyAtlas);
export const useClearedAtlas = () => useSyncExternalStore(subscribe, () => cleared, () => null);
export const getAtlas = () => state;

export const markCount = (atlas: Atlas) => Object.keys(atlas.places).length + Object.keys(atlas.games).length;

// Et punkt på kartet kan samle flere sted-id-er; det regnes som markert når én av dem er det
export const placeMark = (atlas: Atlas, ids: Iterable<string>) => {
  let been = false;
  let want = false;
  for (const id of ids) {
    const mark = atlas.places[id];
    if (mark?.been) been = true;
    if (mark?.want) want = true;
  }
  return { been, want: want && !been };
};

export const gameMark = (atlas: Atlas, id: number | string) => atlas.games[String(id)] ?? { at: '' };

export function togglePlace(ids: string[], field: 'been' | 'want') {
  if (ids.length === 0) return;
  const on = placeMark(state, ids)[field];
  const places = { ...state.places };
  for (const id of ids) {
    const next: PlaceMark = { ...(places[id] ?? { at: today() }), at: today() };
    if (on) delete next[field];
    else {
      // Å velge det ene fjerner det andre
      next[field] = true;
      delete next[field === 'been' ? 'want' : 'been'];
    }
    if (next.been || next.want) places[id] = next;
    else delete places[id];
  }
  persist({ ...state, places });
}

export function toggleGame(id: number | string, field: 'played' | 'want') {
  const key = String(id);
  const next: GameMark = { ...(state.games[key] ?? { at: today() }), at: today() };
  if (state.games[key]?.[field]) delete next[field];
  else {
    next[field] = true;
    delete next[field === 'played' ? 'want' : 'played'];
  }
  const games = { ...state.games };
  if (next.played || next.want) games[key] = next;
  else delete games[key];
  persist({ ...state, games });
}

// Flytter dagens atlas til «cleared»-nøkkelen før det erstattes; bare én slik kopi beholdes
function moveAside(reason: ClearedAtlas['reason']) {
  const copy: ClearedAtlas = { clearedAt: new Date().toISOString(), reason, atlas: state };
  window.localStorage.setItem(CLEARED_KEY, JSON.stringify(copy));
  cleared = copy;
}

export function clearAtlas() {
  moveAside('clear');
  persist(emptyAtlas());
}

export function replaceAtlas(next: Atlas) {
  moveAside('import-replace');
  persist(normalizeAtlas(next));
}

export function mergeAtlas(atlas: Atlas, extra: Atlas): Atlas {
  const merged = normalizeAtlas(atlas);
  for (const [id, mark] of Object.entries(extra.places)) merged.places[id] = { ...merged.places[id], ...mark };
  for (const [id, mark] of Object.entries(extra.games)) merged.games[id] = { ...merged.games[id], ...mark };
  // Ble et sted både «been» og «want» i sammenslåingen, rydder normalizeAtlas det
  return normalizeAtlas(merged);
}

export function addToAtlas(extra: Atlas) {
  persist(mergeAtlas(state, extra));
}

// Angre og «Restore»: legger den tømte kopien tilbake. «merge» beholder også det som er markert siden.
// «replace» over markeringer som finnes nå, legger dem til side i stedet, så også det kan angres.
export function restoreCleared(mode: 'replace' | 'merge' = 'replace') {
  if (!cleared) return;
  const current = state;
  const restored = mode === 'merge' ? mergeAtlas(cleared.atlas, current) : cleared.atlas;
  // Det som står nå legges til side før atlaset byttes ut: feiler lagringen (full), er ingenting endret,
  // slik meldingen sier. Før ble atlaset byttet først, og markeringene som skulle legges til side gikk tapt.
  if (mode === 'replace' && markCount(current) > 0) {
    const copy: ClearedAtlas = { clearedAt: new Date().toISOString(), reason: 'clear', atlas: current };
    const previous = window.localStorage.getItem(CLEARED_KEY);
    window.localStorage.setItem(CLEARED_KEY, JSON.stringify(copy));
    try {
      persist(restored);
    } catch (error) {
      if (previous === null) window.localStorage.removeItem(CLEARED_KEY);
      else window.localStorage.setItem(CLEARED_KEY, previous);
      throw error;
    }
    cleared = copy;
  } else {
    persist(restored);
    window.localStorage.removeItem(CLEARED_KEY);
    cleared = null;
  }
  notify();
}
