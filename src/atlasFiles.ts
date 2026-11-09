// «My atlas» ut og inn av nettleseren: CSV-fil og tabell til Table Editor.
// Rene funksjoner som får katalogen inn, så de kan testes uten Vite (scripts/atlas-files.test.mjs).
import LZString from 'lz-string';
import type { Atlas, GameMark, PlaceMark } from './myAtlas.ts';
import { slugify } from './format.ts';

export type CatalogPlace = { id: string; name: string; placeType: string; position: { lat: number; lon: number }; aliases?: string[] };
export type CatalogGame = { id: number; name: string; year: number; slug: string; venue?: boolean };
export type AtlasCatalog = { places: CatalogPlace[]; games: CatalogGame[] };

export const CSV_COLUMNS = ['type', 'id', 'name', 'been_here', 'want_to_go', 'played', 'want_to_play', 'updated'] as const;
export const TABLE_EDITOR_URL = 'https://truben.no/table/';
// Table Editor åpner ikke lenker med flere celler enn dette (MAX_SHARE_CELLS i table-editor-2)
export const TABLE_EDITOR_MAX_CELLS = 50_000;

const pointKey = (place: CatalogPlace) => `${place.position.lat.toFixed(5)},${place.position.lon.toFixed(5)}`;
const commas = (name: string) => name.split(',').length;

// Steder på samme punkt (London, UK / London, England, UK) er ett sted for brukeren.
// Raden får navnet med mest detaljer; importen markerer alle id-ene på punktet igjen.
export type PlacePoint = { key: string; id: string; name: string; ids: string[] };
export function placePoints(catalog: AtlasCatalog): { points: PlacePoint[]; byId: Map<string, PlacePoint> } {
  const byKey = new Map<string, PlacePoint>();
  for (const place of catalog.places) {
    const key = pointKey(place);
    const point = byKey.get(key);
    if (!point) byKey.set(key, { key, id: place.id, name: place.name, ids: [place.id] });
    else {
      point.ids.push(place.id);
      if (commas(place.name) > commas(point.name)) Object.assign(point, { id: place.id, name: place.name });
    }
  }
  const points = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { points, byId: new Map(points.flatMap(point => point.ids.map(id => [id, point] as const))) };
}

type PlaceRow = { point: PlacePoint; been: boolean; want: boolean; at: string };
type GameRow = { game: CatalogGame; played: boolean; want: boolean; at: string };

const latest = (dates: string[]) => dates.filter(Boolean).sort().pop() ?? '';

export function markedRows(atlas: Atlas, catalog: AtlasCatalog) {
  const { points } = placePoints(catalog);
  const places: PlaceRow[] = [];
  for (const point of points) {
    const marks = point.ids.map(id => atlas.places[id]).filter((mark): mark is PlaceMark => !!mark);
    const been = marks.some(mark => mark.been);
    const want = !been && marks.some(mark => mark.want);
    if (been || want) places.push({ point, been, want, at: latest(marks.map(mark => mark.at)) });
  }
  const games: GameRow[] = [];
  for (const game of [...catalog.games].sort((a, b) => a.name.localeCompare(b.name))) {
    const mark = atlas.games[String(game.id)];
    if (mark?.played || mark?.want) games.push({ game, played: !!mark.played, want: !!mark.want, at: mark.at });
  }
  return { places, games };
}

// ---- CSV ----

const csvCell = (value: string) => /[",;\t\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const yes = (on: boolean) => on ? 'yes' : '';

// UTF-8 med BOM, så Excel leser æøå riktig; CRLF som RFC 4180
export function atlasToCsv(atlas: Atlas, catalog: AtlasCatalog): string {
  const { places, games } = markedRows(atlas, catalog);
  const rows: string[][] = [
    [...CSV_COLUMNS],
    ...places.map(row => ['place', row.point.id, row.point.name, yes(row.been), yes(row.want), '', '', row.at]),
    ...games.map(row => ['game', row.game.slug, row.game.name, '', '', yes(row.played), yes(row.want), row.at]),
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    // Excel i norsk/tysk oppsett lagrer med semikolon
    else if (char === ',' || char === ';' || char === '\t') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(cells => cells.some(value => value.trim()));
}

export type AtlasImport = {
  atlas: Atlas;
  places: number; been: number; wantGo: number;
  games: number; played: number; wantPlay: number;
  // Rader som ikke fant noe sted eller spill, med navnet slik det står i filen
  skipped: string[];
};

const YES = /^(yes|y|true|1|x|✓|✔|ja)$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function importCsv(text: string, catalog: AtlasCatalog, today: string): AtlasImport | { error: string } {
  const rows = parseCsv(text);
  const header = rows[0]?.map(cell => cell.trim().toLowerCase().replace(/[\s-]+/g, '_')) ?? [];
  const column = (name: string) => header.indexOf(name);
  const at = { type: column('type'), id: column('id'), name: column('name'), been: column('been_here'), wantGo: column('want_to_go'), played: column('played'), wantPlay: column('want_to_play'), updated: column('updated') };
  if (at.type < 0 || (at.id < 0 && at.name < 0)) {
    return { error: "This file doesn't look like a My atlas export. The first row needs the columns type, id and name." };
  }

  const { byId } = placePoints(catalog);
  const placeBySlug = new Map<string, PlacePoint>();
  for (const place of catalog.places) {
    const point = byId.get(place.id)!;
    placeBySlug.set(slugify(place.name), point);
  }
  // Også de andre navnene et sted er kjent under: en eksport fra før London-postene ble slått sammen
  // sier «London, England, UK», som nå er et alias på London, UK. Navnet selv vinner over alias.
  for (const place of catalog.places) {
    for (const alias of place.aliases ?? []) {
      const slug = slugify(alias);
      // Et alias uten latinske tegn (翠華中學) blir en tom slug og ville fanget alt ukjent
      if (slug && !placeBySlug.has(slug)) placeBySlug.set(slug, byId.get(place.id)!);
    }
  }
  const gameBySlug = new Map<string, CatalogGame>();
  const baseCount = new Map<string, number>();
  for (const game of catalog.games) baseCount.set(slugify(game.name), (baseCount.get(slugify(game.name)) ?? 0) + 1);
  for (const game of catalog.games) {
    gameBySlug.set(game.slug, game);
    gameBySlug.set(String(game.id), game);
    if (baseCount.get(slugify(game.name)) === 1) gameBySlug.set(slugify(game.name), game);
  }

  const atlas: Atlas = { v: 1, places: {}, games: {} };
  const skipped: string[] = [];
  const points = new Map<string, { been: boolean; want: boolean }>();
  const result = { places: 0, been: 0, wantGo: 0, games: 0, played: 0, wantPlay: 0 };
  const get = (cells: string[], index: number) => index < 0 ? '' : (cells[index] ?? '').trim();

  for (const cells of rows.slice(1)) {
    const type = get(cells, at.type).toLowerCase();
    const id = get(cells, at.id);
    const name = get(cells, at.name);
    const updated = get(cells, at.updated);
    const date = DATE.test(updated) ? updated : today;
    if (type === 'place') {
      // Står begge på samme rad, vinner «been here»
      const been = YES.test(get(cells, at.been));
      const want = !been && YES.test(get(cells, at.wantGo));
      if (!been && !want) continue;
      const point = byId.get(id) ?? placeBySlug.get(slugify(id)) ?? placeBySlug.get(slugify(name));
      if (!point) { skipped.push(name || id); continue; }
      const seen = points.get(point.key) ?? { been: false, want: false };
      for (const placeId of point.ids) {
        const mark: PlaceMark = { ...atlas.places[placeId], at: date };
        if (been) { mark.been = true; delete mark.want; }
        else if (!mark.been) mark.want = true;
        atlas.places[placeId] = mark;
      }
      points.set(point.key, { been: seen.been || been, want: !(seen.been || been) && (seen.want || want) });
    } else if (type === 'game') {
      const played = YES.test(get(cells, at.played));
      const want = !played && YES.test(get(cells, at.wantPlay));
      if (!played && !want) continue;
      const game = gameBySlug.get(id) ?? gameBySlug.get(slugify(id)) ?? gameBySlug.get(slugify(name));
      if (!game) { skipped.push(name || id); continue; }
      const mark: GameMark = { ...atlas.games[String(game.id)], at: date };
      if (played) { mark.played = true; delete mark.want; }
      else if (!mark.played) mark.want = true;
      atlas.games[String(game.id)] = mark;
    } else if (type || id || name) {
      skipped.push(name || id || type);
    }
  }
  for (const mark of points.values()) {
    result.places++;
    if (mark.been) result.been++;
    if (mark.want) result.wantGo++;
  }
  for (const mark of Object.values(atlas.games)) {
    result.games++;
    if (mark.played) result.played++;
    if (mark.want) result.wantPlay++;
  }
  return { atlas, ...result, skipped };
}

// ---- Table Editor ----

// "London, England, UK" -> ["London", "England, UK"]; komma inne i en parentes deler ikke navnet
const splitName = (name: string): [string, string] => {
  const first = name.match(/^(?:[^,(]|\([^)]*\))+/)?.[0].trim() ?? name;
  return [first, name.slice(name.indexOf(first) + first.length).replace(/^\s*,\s*/, '').trim()];
};

export type TableOptions = { places: boolean; games: boolean; links: boolean; siteUrl: string; caption: string };

export function atlasTable(atlas: Atlas, catalog: AtlasCatalog, options: TableOptions): string[][] {
  const { places, games } = markedRows(atlas, catalog);
  // TRUE/FALSE er det Table Editor leser som avkrysning (checkbox-formatet settes i tableEditorUrl)
  const check = (on: boolean) => on ? 'TRUE' : 'FALSE';
  const site = options.siteUrl.replace(/\/$/, '');
  const header = ['Type', 'Name', 'Area', 'Year', 'Been here', 'Want to go', 'Played', 'Want to play'];
  if (options.links) header.push('Link');
  const rows = [header];
  if (options.places) for (const row of places) {
    const { point } = row;
    const [name, area] = splitName(point.name);
    const cells = ['Place', name, area, '', check(row.been), check(row.want), '', ''];
    if (options.links) cells.push(`${site}/place/${slugify(point.name)}`);
    rows.push(cells);
  }
  if (options.games) for (const row of games) {
    const cells = ['Game', row.game.name, '', String(row.game.year), '', '', check(row.played), check(row.want)];
    if (options.links) cells.push(`${site}/game/${row.game.slug}`);
    rows.push(cells);
  }
  return rows;
}

// Samme format som Table Editor selv deler i (#d=, kompakt format v2). Ingen o=, så Table Editor velger
// utdataformat selv; op=0 åpner med utdatapanelet lukket, så tabellen får hele vinduet.
// Cellene med TRUE/FALSE får checkbox-formatet (cf) og kolonnene sentreres (ca).
const CHECKBOX_FORMAT = { numberFormat: { kind: 'checkbox', decimals: 0, grouping: false, locale: 'en-US', currency: 'USD' } };
export function tableEditorUrl(rows: string[][], caption: string): string {
  const cf: [number, number, typeof CHECKBOX_FORMAT][] = [];
  const checkboxColumns = new Set<number>();
  rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell === 'TRUE' || cell === 'FALSE') { cf.push([r, c, CHECKBOX_FORMAT]); checkboxColumns.add(c); }
  }));
  const columns = rows[0]?.length ?? 0;
  const ca = Array.from({ length: columns }, (_, c) => checkboxColumns.has(c) ? 'c' : null);
  const compact = { v: 2, s: [rows.length, columns], d: rows, h: [1, 0], c: caption, ...(cf.length ? { cf, ca } : {}) };
  return `${TABLE_EDITOR_URL}#d=${LZString.compressToEncodedURIComponent(JSON.stringify(compact))}&op=0`;
}
