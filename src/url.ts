// Appens tilstand speiles i URL-en slik at steder, spill og søk kan deles som lenker.
// Pene stier (/place/paris-france/, /game/broken-sword/) matcher sidene scripts/prerender.mjs lager. Skråstreken
// til slutt er med fordi sidene ligger som <sti>/index.html: uten den svarte serveren med en omdirigering.

export type UrlState = {
  q?: string;
  genre?: string[];
  setting?: Array<'real' | 'fictionalized' | 'imaginary'>;
  placeType?: string[];
  released?: [number, number];
  set?: [number, number];
  place?: string;
  // Et land som sted, uten egen side: ?country=united-kingdom
  country?: string;
  // En spillserie: /series/broken-sword
  series?: string;
  // En epoke med navn (andre verdenskrig, den kalde krigen): /era/world-war-2/. Setter «Story set in» til epokens år.
  era?: string;
  game?: string;
  route?: string;
  // Stedslista og My atlas har egne adresser, så tilbake-knappen går til dem og de kan deles
  panel?: 'places' | 'my-atlas';
  // Reisen som vises på en serieside: /series/uncharted/?journey=uncharted-2-among-thieves
  journey?: string;
  // Racing og sport er skjult som standard; ?all=1 viser hele katalogen
  all?: boolean;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Årsspenn skrives "1990..2000" fordi negative år gjør bindestrek tvetydig
const parseRange = (value: string | null): [number, number] | undefined => {
  if (!value) return undefined;
  // Number('') er 0, så «..2000» ble år 0–2000; et spenn uten begge ender leses ikke
  const parts = value.split('..');
  if (parts.length !== 2 || parts.some(part => part.trim() === '')) return undefined;
  const [a, b] = parts.map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [Math.min(a, b), Math.max(a, b)] : undefined;
};

export function readUrl(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.slice(BASE.length).replace(/\/$/, '');
  const [, kind, slug] = path.split('/');
  return {
    q: params.get('q')?.trim() || undefined,
    genre: params.getAll('genre').filter(Boolean),
    setting: params.getAll('setting').filter((value): value is 'real' | 'fictionalized' | 'imaginary' => ['real', 'fictionalized', 'imaginary'].includes(value)),
    placeType: params.getAll('type').filter(Boolean),
    released: parseRange(params.get('released')),
    set: parseRange(params.get('set')),
    place: kind === 'place' && slug ? slug : params.get('place') || undefined,
    game: kind === 'game' && slug ? slug : params.get('game') || undefined,
    series: kind === 'series' && slug ? slug : params.get('series') || undefined,
    era: kind === 'era' && slug ? slug : undefined,
    country: params.get('country') || undefined,
    route: params.get('route') || undefined,
    journey: params.get('journey') || undefined,
    panel: kind === 'places' ? 'places' : kind === 'my-atlas' ? 'my-atlas' : undefined,
    all: params.get('all') === '1' || undefined,
  };
}

export function buildUrl(state: UrlState): string {
  const path = state.game ? `${BASE}/game/${state.game}/` : state.place ? `${BASE}/place/${state.place}/` : state.series ? `${BASE}/series/${state.series}/` : state.era ? `${BASE}/era/${state.era}/` : state.panel ? `${BASE}/${state.panel}/` : `${BASE}/`;
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.country && !state.game && !state.place) params.set('country', state.country);
  if (state.game && state.route) params.set('route', state.route);
  if (state.series && !state.game && state.journey) params.set('journey', state.journey);
  state.genre?.forEach(genre => params.append('genre', genre));
  state.setting?.forEach(setting => params.append('setting', setting));
  state.placeType?.forEach(type => params.append('type', type));
  if (state.released) params.set('released', `${state.released[0]}..${state.released[1]}`);
  if (state.set) params.set('set', `${state.set[0]}..${state.set[1]}`);
  if (state.all) params.set('all', '1');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

// Det som er «en side» i nettleserens historikk: stedet, spillet, landet eller søket som vises.
// Filtre og rutevalg endrer bare adressen på plass. Et søk er én side uansett hva som står i det:
// hvert tastetrykk byttet adressen ut på plass, ellers gikk tilbake-knappen gjennom «pari», «par», «pa».
export const pageKey = (state: UrlState) => [state.game ?? '', state.place ?? '', state.country ?? '', state.series ?? '', state.panel ?? '', state.q ? 'q' : ''].join('|');

// push: ny oppføring i historikken, så tilbake-knappen går til forrige sted; ellers byttes adressen på plass
export function writeUrl(state: UrlState, { push = false } = {}) {
  const url = buildUrl(state);
  if (url !== window.location.pathname + window.location.search) {
    if (push) window.history.pushState(null, '', url);
    // Tilstanden på oppføringen (panelets rulleposisjon) følger med når adressen byttes på plass
    else window.history.replaceState(window.history.state, '', url);
  }
}

// Panelets rulleposisjon lagres på historikkoppføringen leseren står på, så tilbake-knappen åpner panelet der
// det ble forlatt. Den skrives mens man ruller, ikke når noe nytt åpnes: da er det nye panelet alt tegnet fra toppen.
export function rememberPanelScroll(top: number) {
  try {
    window.history.replaceState({ ...(window.history.state ?? {}), panelScroll: Math.round(top) }, '', window.location.href);
  } catch {
    // Noen nettlesere begrenser hvor ofte historikken kan skrives; posisjonen er en bekvemmelighet
  }
}
