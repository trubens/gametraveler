// Appens tilstand speiles i URL-en slik at steder, spill og søk kan deles som lenker.
// Pene stier (/place/paris-france, /game/broken-sword) matcher sidene scripts/prerender.mjs lager.

export type UrlState = {
  q?: string;
  genre?: string;
  released?: [number, number];
  set?: [number, number];
  place?: string;
  game?: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Årsspenn skrives "1990..2000" fordi negative år gjør bindestrek tvetydig
const parseRange = (value: string | null): [number, number] | undefined => {
  if (!value) return undefined;
  const [a, b] = value.split('..').map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [Math.min(a, b), Math.max(a, b)] : undefined;
};

export function readUrl(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.slice(BASE.length).replace(/\/$/, '');
  const [, kind, slug] = path.split('/');
  return {
    q: params.get('q')?.trim() || undefined,
    genre: params.get('genre') || undefined,
    released: parseRange(params.get('released')),
    set: parseRange(params.get('set')),
    place: kind === 'place' && slug ? slug : params.get('place') || undefined,
    game: kind === 'game' && slug ? slug : params.get('game') || undefined,
  };
}

export function buildUrl(state: UrlState): string {
  const path = state.game ? `${BASE}/game/${state.game}` : state.place ? `${BASE}/place/${state.place}` : `${BASE}/`;
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.genre) params.set('genre', state.genre);
  if (state.released) params.set('released', `${state.released[0]}..${state.released[1]}`);
  if (state.set) params.set('set', `${state.set[0]}..${state.set[1]}`);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function writeUrl(state: UrlState) {
  const url = buildUrl(state);
  if (url !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, '', url);
  }
}
