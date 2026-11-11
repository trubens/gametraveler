import Fuse from 'fuse.js';
import type { Game, Location } from './gameData.ts';

// `exact` is false when the hit only matches a near spelling of the query.
export type SearchHit = { game: Game; matchedLocations: Location[]; exact?: boolean };
export type SearchFilters = {
  genres: string[];
  yearRange: [number, number];
  // Undefined includes games without a known story year.
  storyYearRange?: [number, number];
};

export const normalizeSearch = (value: string): string => value
  .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/ł/g, 'l')
  .replace(/['’ʻ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Country aliases supplement the English map labels; fictional names belong
// to individual game locations so "Liberty City" doesn't match every NYC game.
const countryAliases: Record<string, string[]> = {
  norway: ['Norge'], sweden: ['Sverige'], denmark: ['Danmark'],
  germany: ['Tyskland'], france: ['Frankrike'], spain: ['Spania'],
  italy: ['Italia'], greece: ['Hellas'], austria: ['Østerrike'],
  switzerland: ['Sveits'], netherlands: ['Nederland'], poland: ['Polen'],
  usa: ['United States', 'United States of America', 'Amerika'],
  uk: ['United Kingdom', 'Britain', 'Storbritannia'],
};

// Romertall i titler og notater kan også skrives med sifre: «Mafia II» = «mafia 2», «World War II» = «world war 2»
const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8', ix: '9', x: '10' };
const withDigits = (text: string) => text.split(' ').map(word => ROMAN[word] ?? word).join(' ');

// Flere måter å skrive det samme navnet på. Teksten er allerede normalisert.
function spellings(text: string, original: string): string[] {
  const out = new Set([text, withDigits(text)]);
  // «Spider-Man» kan skrives «spiderman», «Half-Life» «halflife»
  if (/\p{L}-\p{L}/u.test(original)) out.add(normalizeSearch(original.replace(/(\p{L})-(\p{L})/gu, '$1$2')));
  // «St. Petersburg» og «Saint Petersburg» er samme sted
  if (/(^| )st( |$)/.test(text)) out.add(text.replace(/(^| )st( |$)/g, '$1saint$2'));
  if (/(^| )saint( |$)/.test(text)) out.add(text.replace(/(^| )saint( |$)/g, '$1st$2'));
  return [...out];
}

// Vanlige forkortelser i søket skrives ut
const QUERY_WORDS: Record<string, string> = { ww1: 'world war 1', ww2: 'world war 2', wwi: 'world war 1', nyc: 'new york' };
// «world war ii», «world war two», «world war i» og «world war one» skrives om til tall, som notatene
// (withDigits) og NAMED_ERAS bruker; uten dette ga «world war ii» null treff og «wwi» traff WWII-titler.
// «wwii» står urørt, siden titler som Call of Duty: WWII skal treffe på tittel.
const WORLD_WAR = /\bworld war (ii|two|i|one)\b/g;
const WORLD_WAR_NUMBER: Record<string, string> = { ii: '2', two: '2', i: '1', one: '1' };
const normalizeQuery = (query: string) => normalizeSearch(query).split(' ').map(word => QUERY_WORDS[word] ?? word).join(' ')
  .replace(WORLD_WAR, (_, n: string) => `world war ${WORLD_WAR_NUMBER[n]}`);
// Perioder man søker på med navn, som spillene sjelden nevner i teksten, men har som handlingsår
const NAMED_ERAS: Record<string, [number, number]> = {
  'world war 1': [1914, 1918], 'first world war': [1914, 1918],
  'world war 2': [1939, 1945], 'second world war': [1939, 1945], wwii: [1939, 1945],
  'cold war': [1947, 1991],
};

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

// A typo is one wrong letter in short words and two in long ones. Fuse alone
// also accepts letters scattered across a long title ("mario" in "WRC 8").
// The last word may still be half typed, so it may also be the exact start of a word ("sherlok hol").
function nearSpelling(term: string, words: string[], last: boolean): boolean {
  const allowed = term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0;
  return words.some(word => (last && word.startsWith(term))
    || (Math.abs(word.length - term.length) <= allowed && editDistance(term, word) <= allowed));
}

type SearchDocument = {
  game: Game;
  location: Location;
  titles: string[];
  places: string[];
  aliases: string[];
  notes: string;
  genres: string;
  years: string;
  // Alt søkbart i ett, og som ord
  text: string;
  words: string[];
};

export function createGameSearch(games: Game[]) {
  const documents: SearchDocument[] = games.flatMap(game => game.locations.map(location => {
    const name = normalizeSearch(location.name);
    const country = name.split(' ').pop() ?? '';
    return {
      game, location,
      // Første tittel og første sted er selve navnet; resten er aliaser og andre skrivemåter
      titles: [...new Set([game.name, ...(game.aliases ?? [])].flatMap(t => spellings(normalizeSearch(t), t)))],
      places: [...new Set([location.name, ...(location.aliases ?? []), ...(countryAliases[country] ?? [])].flatMap(t => spellings(normalizeSearch(t), t)))],
      aliases: [...(game.aliases ?? []), ...(location.aliases ?? []), ...(countryAliases[country] ?? [])].map(normalizeSearch),
      notes: withDigits(normalizeSearch(location.note ?? '')) + ' ' + normalizeSearch(location.note ?? ''),
      genres: normalizeSearch(game.genres.join(' ')),
      // Handlingsår og tiår, så «1944» og «1940s» finner spill som foregår da
      years: [...new Set(game.storyYears.flatMap(year => year > 0 ? [String(year), `${Math.floor(year / 10) * 10}s`] : []))].join(' '),
    };
  })).map(doc => {
    const text = [...doc.titles, ...doc.places, ...doc.aliases, doc.notes, doc.genres, doc.years].join(' ');
    return { ...doc, text, words: text.split(' ') };
  });
  // Built once for the static catalogue, not on each keystroke.
  // Notatene søkes ordrett i første runde, men ikke uklart: de er lange, og det uklare søket over dem tok mer enn en halv sekund
  // når katalogen vokste. Uklart søk gjelder titler, steder og sjanger.
  const index = new Fuse(documents, {
    useTokenSearch: true,
    tokenMatch: 'all',
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    threshold: 0.3,
    keys: [
      { name: 'titles', weight: 0.45 },
      { name: 'places', weight: 0.4 },
      { name: 'genres', weight: 0.05 },
    ],
  });

  const run = (query: string): SearchHit[] => {
    if (!query.trim()) return games.map(game => ({ game, matchedLocations: [] }));
    const normalized = normalizeQuery(query);
    if (!normalized) return [];
    const exactAlias = documents.some(doc => doc.aliases.includes(normalized));
    const terms = normalized.split(' ');
    // Don't treat a sequel number or a one-letter word as a substring of
    // another word (e.g. "GTA V" must not match the V in "Vice City").
    // Det siste ordet er det brukeren holder på å skrive, så et kort siste ord matcher begynnelsen
    // av et ord («pa» → Paris, «post m» → Post Mortem). Korte ord før det må være hele ord.
    // Med flere ord må hvert ord treffe begynnelsen av et ord, ellers blir «world war 2» til
    // «open-world», «Edward» og 2013. Et enkelt langt ord kan stå inne i et ord («watch» i Firewatch).
    // I det uklare søket sjekker nearSpelling de lange ordene, så der gjelder regelen bare korte ord.
    const shortMatches = (words: string[], fuzzy = false) => terms.every((term, i) => {
      if (term.length > 2 && (terms.length === 1 || fuzzy)) return true;
      if (term.length <= 2 && i < terms.length - 1) return words.includes(term);
      return words.some(word => word.startsWith(term));
    });
    // Treff i begynnelsen av et ord rangeres over treff inne i et ord («pa» → Paris før Part)
    const atWordStart = (text: string) => text.startsWith(normalized) || text.includes(` ${normalized}`);
    const rankOf = (doc: SearchDocument) => doc.titles.includes(normalized) ? 0
      : doc.titles.some(atWordStart) ? 1
      : doc.titles.some(title => title.includes(normalized)) ? 2
      : doc.places.some(atWordStart) ? 3
      : doc.places.some(place => place.includes(normalized)) ? 4 : 5;
    const grouped = new Map<number, SearchHit & { rank: number; score: number; exact: boolean }>();
    const add = (doc: SearchDocument, score: number, exact: boolean, placeMatched: boolean) => {
      const rank = rankOf(doc);
      const hit = grouped.get(doc.game.id) ?? { game: doc.game, matchedLocations: [], rank, score, exact };
      if (rank < hit.rank || (rank === hit.rank && score < hit.score)) {
        hit.rank = rank;
        hit.score = score;
      }
      hit.exact ||= exact;
      if (placeMatched) hit.matchedLocations.push(doc.location);
      grouped.set(doc.game.id, hit);
    };

    // En forkortelse («COD», «AC») begrenser treffene til det den står for, men ikke bort fra
    // titler og steder som faktisk begynner slik («Codename», «Acropolis», «United States»).
    // Bare selve navnet teller her; aliaset «gta vice city» skal ikke gjøre «gta v» til et prefikssøk.
    const outsideAlias = (doc: SearchDocument) => exactAlias && !doc.aliases.includes(normalized)
      && !atWordStart(doc.titles[0]) && !atWordStart(doc.places[0]);

    // Ordrette treff trenger ikke det uklare søket, som er tregt på lange titler
    for (const doc of documents) {
      if (outsideAlias(doc)) continue;
      if (!terms.every(term => doc.text.includes(term)) || !shortMatches(doc.words)) continue;
      // Stedet er en del av treffet når det inneholder noe av søket, og resten finnes i tittel, sjanger eller notat
      const inPlace = terms.filter(term => doc.places.some(place => place.includes(term)));
      const elsewhere = (term: string) => [...doc.titles, doc.genres, doc.notes, doc.years].some(field => field.includes(term));
      add(doc, 0, true, inPlace.length > 0 && terms.every(term => inPlace.includes(term) || elsewhere(term)));
    }
    const era = NAMED_ERAS[normalized];
    if (era) {
      for (const doc of documents) {
        if (doc.game.storyYears.some(year => year >= era[0] && year <= era[1])) add(doc, 0, true, false);
      }
    }
    if (grouped.size === 0) {
      for (const result of index.search(normalized)) {
        const doc = result.item;
        if (outsideAlias(doc)) continue;
        if (!shortMatches(doc.words, true) || !terms.every((term, i) => nearSpelling(term, doc.words, i === terms.length - 1))) continue;
        add(doc, result.score ?? 1, false, !!result.matches?.some(match => match.key === 'places'));
      }
    }
    // Near spellings are only shown when nothing matches the query as typed
    return [...grouped.values()]
      .sort((a, b) => a.rank - b.rank || a.score - b.score || a.game.year - b.game.year || a.game.name.localeCompare(b.game.name))
      .map(({ game, matchedLocations, exact }) => ({ game, matchedLocations, exact }));
  };

  // Samme søk kjøres flere ganger for hvert tastetrykk (treffene, tellingene per sjanger og stedstype, kartet), og det uklare
  // søket går over alle notatene. Svaret huskes per søketekst; treffene leses bare, de endres aldri etterpå.
  const cache = new Map<string, SearchHit[]>();
  return (query: string): SearchHit[] => {
    const cached = cache.get(query);
    if (cached) return cached;
    const result = run(query);
    if (cache.size >= 60) cache.delete(cache.keys().next().value as string);
    cache.set(query, result);
    return result;
  };
}

export function filterSearchResults(hits: SearchHit[], filters: SearchFilters): SearchHit[] {
  const { genres, yearRange, storyYearRange } = filters;
  return hits.filter(({ game }) => (genres.length === 0 || genres.some(genre => game.genres.includes(genre)))
    && game.year >= yearRange[0] && game.year <= yearRange[1]
    && (!storyYearRange || game.storyYears.some(year => year >= storyYearRange[0] && year <= storyYearRange[1])));
}

// Shared by typed searches and restored links, so both focus the same places.
export function searchPositions(hits: SearchHit[]): [number, number][] {
  const matched = hits.flatMap(hit => hit.matchedLocations);
  const locations = matched.length ? matched : hits.flatMap(hit => hit.game.locations);
  return [...new Map(locations.map(location => [location.position.join(','), location.position])).values()];
}
