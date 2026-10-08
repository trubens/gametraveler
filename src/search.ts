import Fuse from 'fuse.js';
import type { Game, Location } from './gameData.ts';

export type SearchHit = { game: Game; matchedLocations: Location[] };
export type SearchFilters = {
  genre: string;
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

type SearchDocument = {
  game: Game;
  location: Location;
  titles: string[];
  places: string[];
  aliases: string[];
  notes: string;
  genre: string;
};

export function createGameSearch(games: Game[]) {
  const documents: SearchDocument[] = games.flatMap(game => game.locations.map(location => {
    const name = normalizeSearch(location.name);
    const country = name.split(' ').pop() ?? '';
    return {
      game, location,
      titles: [game.name, ...(game.aliases ?? [])].map(normalizeSearch),
      places: [location.name, ...(location.aliases ?? []), ...(countryAliases[country] ?? [])].map(normalizeSearch),
      aliases: [...(game.aliases ?? []), ...(location.aliases ?? []), ...(countryAliases[country] ?? [])].map(normalizeSearch),
      notes: normalizeSearch(location.note ?? ''),
      genre: normalizeSearch(game.genre),
    };
  }));
  // Built once for the static catalogue, not on each keystroke.
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
      { name: 'notes', weight: 0.1 },
      { name: 'genre', weight: 0.05 },
    ],
  });

  return (query: string): SearchHit[] => {
    if (!query.trim()) return games.map(game => ({ game, matchedLocations: [] }));
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    const exactAlias = documents.some(doc => doc.aliases.includes(normalized));
    const shortTerms = normalized.split(' ').filter(term => term.length <= 2);
    const grouped = new Map<number, SearchHit & { rank: number; score: number }>();
    for (const result of index.search(normalized)) {
      const doc = result.item;
      if (exactAlias && !doc.aliases.includes(normalized)) continue;
      // Don't treat a sequel number or a one-letter word as a substring of
      // another word (e.g. "GTA V" must not match the V in "Vice City").
      const words = [...doc.titles, ...doc.places, doc.notes, doc.genre].join(' ').split(' ');
      if (!shortTerms.every(term => words.includes(term))) continue;
      const rank = doc.titles.includes(normalized) ? 0
        : doc.titles.some(title => title.includes(normalized)) ? 1
        : doc.places.some(place => place.includes(normalized)) ? 2 : 3;
      const score = result.score ?? 1;
      const hit = grouped.get(doc.game.id) ?? { game: doc.game, matchedLocations: [], rank, score };
      if (rank < hit.rank || (rank === hit.rank && score < hit.score)) {
        hit.rank = rank;
        hit.score = score;
      }
      if (result.matches?.some(match => match.key === 'places')) hit.matchedLocations.push(doc.location);
      grouped.set(doc.game.id, hit);
    }
    return [...grouped.values()]
      .sort((a, b) => a.rank - b.rank || a.score - b.score || a.game.year - b.game.year || a.game.name.localeCompare(b.game.name))
      .map(({ game, matchedLocations }) => ({ game, matchedLocations }));
  };
}

export function filterSearchResults(hits: SearchHit[], filters: SearchFilters): SearchHit[] {
  const { genre, yearRange, storyYearRange } = filters;
  return hits.filter(({ game }) => (!genre || game.genre === genre)
    && game.year >= yearRange[0] && game.year <= yearRange[1]
    && (!storyYearRange || game.storyYears.some(year => year >= storyYearRange[0] && year <= storyYearRange[1])));
}

// Shared by typed searches and restored links, so both focus the same places.
export function searchPositions(hits: SearchHit[]): [number, number][] {
  const matched = hits.flatMap(hit => hit.matchedLocations);
  const locations = matched.length ? matched : hits.flatMap(hit => hit.game.locations);
  return [...new Map(locations.map(location => [location.position.join(','), location.position])).values()];
}
