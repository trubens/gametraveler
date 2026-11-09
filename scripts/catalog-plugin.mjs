// Katalogen i to deler: kjernen (navn, år, steder, koordinater, ruter) som kartet trenger for å tegne seg, og
// detaljene (notatene om hva som skjer på hvert sted, kilder, Wikipedia-lenker og stedsbeskrivelser) som lastes
// rett etter. Detaljene er omtrent halve katalogen, og den lå i sin helhet foran første visning.
//
// import core from 'virtual:catalog-core'      → { games: GameRecord[], places: PlaceRecord[] } uten detaljfeltene
// import('virtual:catalog-details')            → { games: { [id]: GameDetails }, places: { [id]: PlaceDetails } }
import fs from 'node:fs';
import path from 'node:path';

export const GAME_DETAIL_FIELDS = ['source', 'publisherUrl', 'developerUrl'];
export const LOCATION_DETAIL_FIELDS = ['note', 'source'];
export const ROUTE_DETAIL_FIELDS = ['note', 'source'];
export const PLACE_DETAIL_FIELDS = ['description', 'descriptionSource', 'source', 'wikipediaUrl', 'wikidataId'];

const pick = (record, fields) => {
  const out = {};
  for (const field of fields) if (record[field] !== undefined) out[field] = record[field];
  return Object.keys(out).length ? out : undefined;
};
const omit = (record, fields) => {
  const out = { ...record };
  for (const field of fields) delete out[field];
  return out;
};

// Ren funksjon, testet i scripts/catalog-split.test.mjs: kjerne + detaljer gir tilbake de opprinnelige postene
export function splitCatalog(games, places) {
  const core = { games: [], places: [] };
  const details = { games: {}, places: {} };
  for (const game of games) {
    core.games.push({
      ...omit(game, GAME_DETAIL_FIELDS),
      locations: game.locations.map(location => omit(location, LOCATION_DETAIL_FIELDS)),
      ...(game.routes ? { routes: game.routes.map(route => omit(route, ROUTE_DETAIL_FIELDS)) } : {}),
    });
    const own = pick(game, GAME_DETAIL_FIELDS) ?? {};
    const locations = game.locations.map(location => pick(location, LOCATION_DETAIL_FIELDS) ?? null);
    const routes = (game.routes ?? []).map(route => pick(route, ROUTE_DETAIL_FIELDS) ?? null);
    details.games[game.id] = { ...own, ...(locations.some(Boolean) ? { locations } : {}), ...(routes.some(Boolean) ? { routes } : {}) };
  }
  for (const place of places) {
    core.places.push(omit(place, PLACE_DETAIL_FIELDS));
    const own = pick(place, PLACE_DETAIL_FIELDS);
    if (own) details.places[place.id] = own;
  }
  return { core, details };
}

const CORE_ID = 'virtual:catalog-core';
const DETAILS_ID = 'virtual:catalog-details';

export function catalog({ dataDir = 'src/data' } = {}) {
  let root = process.cwd();
  const readDir = dir => fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()
    .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
  const load = () => {
    const gamesDir = path.resolve(root, dataDir, 'games');
    const placesDir = path.resolve(root, dataDir, 'places');
    return { split: splitCatalog(readDir(gamesDir), readDir(placesDir)), gamesDir, placesDir };
  };
  // JSON.parse av en streng: V8 parser det flere ganger raskere enn objektlitteraler av samme størrelse
  const asModule = value => `export default JSON.parse(${JSON.stringify(JSON.stringify(value))});`;
  return {
    name: 'game-traveller-catalog',
    configResolved(config) { root = config.root; },
    resolveId(id) {
      if (id === CORE_ID || id === DETAILS_ID) return `\0${id}`;
    },
    load(id) {
      if (id !== `\0${CORE_ID}` && id !== `\0${DETAILS_ID}`) return;
      const { split, gamesDir, placesDir } = load();
      // Endringer i en datafil laster modulen på nytt under utvikling
      for (const dir of [gamesDir, placesDir]) for (const name of fs.readdirSync(dir)) this.addWatchFile(path.join(dir, name));
      return asModule(id === `\0${CORE_ID}` ? split.core : split.details);
    },
    handleHotUpdate({ file, server }) {
      const normalized = file.replace(/\\/g, '/');
      if (!normalized.includes(`/${dataDir}/games/`) && !normalized.includes(`/${dataDir}/places/`)) return;
      // Kjernen og detaljene bygges av alle filene; enklest og sikrest er å laste siden på nytt
      for (const id of [`\0${CORE_ID}`, `\0${DETAILS_ID}`]) {
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
