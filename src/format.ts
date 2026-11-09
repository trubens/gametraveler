type Position = [number, number];

// Negative år er før vår tidsregning
export function formatYear(year: number): string {
  // Fem sifre får tusenskille («10,000 BC»), fire gjør det ikke («1500 BC», «2023»)
  const digits = (n: number) => (n >= 10000 ? n.toLocaleString('en-US') : String(n));
  return year < 0 ? `${digits(-year)} BC` : digits(year);
}

// Tidsspennet handlingen dekker, f.eks. "1940–1998" eller "49 BC–2017"
export function eraSpan(storyYears: number[]): string | null {
  if (storyYears.length === 0) return null;
  const min = Math.min(...storyYears);
  const max = Math.max(...storyYears);
  return min === max ? formatYear(min) : `${formatYear(min)}–${formatYear(max)}`;
}

// "1 game", "15 games"
export function count(n: number, noun: string, plural = `${noun}s`): string {
  return `${n} ${n === 1 ? noun : plural}`;
}

// "Paris, France" -> "Paris"; komma inne i en parentes deler ikke navnet:
// "Atlantis (fictional, Atlantic)" forblir hele
// Navnet i en liste der året alt står ved siden av: «Medal of Honor (1999)» skiller spillet fra
// 2010-utgaven på spillsiden, men i rader med årskolonne ble det «1999 Medal of Honor (1999)»
export const listName = (game: { name: string; year: number }) =>
  game.name.endsWith(` (${game.year})`) ? game.name.slice(0, -` (${game.year})`.length) : game.name;

export const shortName = (name: string) => name.match(/^(?:[^,(]|\([^)]*\))+/)?.[0].trim() ?? name;

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

// "2026-10-24T14:02:11Z" -> "24 Oct 2026"
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
