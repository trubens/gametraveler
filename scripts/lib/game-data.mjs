import fs from 'node:fs';
import path from 'node:path';

export const GAME_DATA_DIRECTORY = 'src/data/games';
export const PLACE_DATA_DIRECTORY = 'src/data/places';

function readRecords(directory, filenamePattern) {
  if (!fs.existsSync(directory)) throw new Error(`Data directory not found: ${directory}`);
  return fs.readdirSync(directory)
    .filter(file => filenamePattern.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')));
}

export function readGameRecords() {
  return readRecords(GAME_DATA_DIRECTORY, /^\d{7}\.json$/);
}

export function readPlaces() {
  return readRecords(PLACE_DATA_DIRECTORY, /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
}

// Holdes i synk med placeLabel i src/gameData.ts: «(fictional)» står ikke i navnet, det lages her
export const placeLabel = place => place.legendary ? `${place.name} (legendary)` : place.fictional ? `${place.name} (fictional)` : place.name;

export function readGames() {
  const placesByKey = new Map(readPlaces().map(place => [place.id, place]));
  return readGameRecords().map(game => ({
    ...game,
    locations: game.locations.map(reference => {
      const place = placesByKey.get(reference.placeId);
      if (!place) throw new Error(`${game.name} refers to missing place key ${reference.placeId}`);
      return {
        placeId: place.id,
        name: placeLabel(place),
        scale: place.scale,
        parentId: place.parentId,
        aliases: [...new Set([...(place.aliases ?? []), ...(reference.aliases ?? [])])],
      position: toMapPosition(reference.positionOverride ?? place.position),
        fictional: place.fictional,
        legendary: place.legendary,
        settingType: reference.settingType,
        note: reference.note,
        source: reference.source ?? place.source,
      };
    }),
  }));
}

export function writeGames(games) {
  for (const game of games) {
    const file = path.join(GAME_DATA_DIRECTORY, `${String(game.id).padStart(7, '0')}.json`);
    fs.writeFileSync(file, `${JSON.stringify(game, null, 2)}\n`);
  }
}

export function writePlaces(places) {
  for (const place of places) {
    const file = path.join(PLACE_DATA_DIRECTORY, `${place.id}.json`);
    fs.writeFileSync(file, `${JSON.stringify(place, null, 2)}\n`);
  }
}

function toMapPosition(position) {
  return [position.lat, position.lon];
}
