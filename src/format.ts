type Position = [number, number];

// Negative år er før vår tidsregning
export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : String(year);
}

// Tidsspennet handlingen dekker, f.eks. "1940–1998" eller "49 BC–2017"
export function eraSpan(storyYears: number[]): string | null {
  if (storyYears.length === 0) return null;
  const min = Math.min(...storyYears);
  const max = Math.max(...storyYears);
  return min === max ? formatYear(min) : `${formatYear(min)}–${formatYear(max)}`;
}

// "1 game", "15 games"
export function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

// "Paris, France" -> "Paris"
export const shortName = (name: string) => name.split(',')[0];

// URL-vennlig slug: "Sainte-Mère-Église, France" -> "sainte-mere-eglise-france".
// Holdes i synk med scripts/prerender.mjs.
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Avstand langs jordoverflaten i kilometer
export function distanceKm(a: Position, b: Position): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Sjangre får faste prosessfarger slik at de er gjenkjennelige på tvers av panelet.
// Magenta er forbeholdt handlinger og reiseruten.
const GENRE_INKS = [
  'bg-cyan text-ink',
  'bg-yellow text-ink',
  'bg-ink text-white',
  'border-2 border-ink text-ink',
] as const;

export function genreInk(genre: string): string {
  let hash = 0;
  for (const ch of genre) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return GENRE_INKS[hash % GENRE_INKS.length];
}
