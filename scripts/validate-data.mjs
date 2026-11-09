import fs from 'node:fs';
import path from 'node:path';
import { GAME_DATA_DIRECTORY, PLACE_DATA_DIRECTORY, readGameRecords, readPlaces } from './lib/game-data.mjs';
import { validateRoutes } from './lib/validate-routes.mjs';

const gameFiles = fs.readdirSync(GAME_DATA_DIRECTORY).filter(file => file.endsWith('.json'));
const placeFiles = fs.readdirSync(PLACE_DATA_DIRECTORY).filter(file => file.endsWith('.json'));
const games = readGameRecords();
const places = readPlaces();
const gameSchema = JSON.parse(fs.readFileSync('src/data/game.schema.json', 'utf8'));
const placeSchema = JSON.parse(fs.readFileSync('src/data/place.schema.json', 'utf8'));
const genreSchema = JSON.parse(fs.readFileSync('src/data/genre.schema.json', 'utf8'));
const allowedGenres = new Set(genreSchema.enum);
const errors = [];
const gameIds = new Set();
const placeIds = new Set();
const referencedPlaceIds = new Set();
let overrideCount = 0;

const error = (record, field, message) => errors.push(`${record?.name ?? 'record'} (${record?.id ?? '?'}).${field}: ${message}`);
const isHttpUrl = value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
};
const validPosition = value => value !== null && typeof value === 'object'
  && Object.keys(value).length === 2 && Number.isFinite(value.lat) && Number.isFinite(value.lon)
  && value.lat >= -90 && value.lat <= 90 && value.lon >= -180 && value.lon <= 180
  && !(value.lat === 0 && value.lon === 0);
const distanceKm = ({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) => {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const checkFilename = (files, id, record, padded = true) => {
  const expected = `${padded ? String(id).padStart(7, '0') : id}.json`;
  if (!files.includes(expected)) error(record, 'id', `filename must be ${expected}`);
};

for (const place of places) {
  if (typeof place.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(place.id)) error(place, 'id', 'must be a readable lowercase slug');
  if (placeIds.has(place.id)) error(place, 'id', 'must be unique');
  placeIds.add(place.id);
  checkFilename(placeFiles, place.id, place, false);
  for (const key of placeSchema.required) if (place[key] === undefined) error(place, key, 'is required by src/data/place.schema.json');
  for (const key of Object.keys(place)) if (!placeSchema.properties[key]) error(place, key, 'unknown property; update the schema and consumer deliberately');
  if (typeof place.name !== 'string' || !place.name.trim()) error(place, 'name', 'must be a non-empty string');
  // «(fictional)» er en kategori, ikke en del av navnet: sett fictional/legendary, så lager appen merkelappen
  if (/\((fictional|fictionalized|fictionalised|legendary|imaginary)\b/i.test(place.name ?? '')) error(place, 'name', 'must not carry a category such as "(fictional)"; set "fictional": true or "legendary": true instead');
  for (const key of ['fictional', 'legendary']) if (place[key] !== undefined && place[key] !== true) error(place, key, 'must be true when set');
  if (!validPosition(place.position)) error(place, 'position', 'must be { lat, lon } with valid coordinate bounds, excluding { lat: 0, lon: 0 }');
  if (!['area', 'site'].includes(place.scale)) error(place, 'scale', 'must be either "area" or "site"');
  if (!['country', 'city', 'region', 'neighborhood', 'island', 'natural_feature', 'body_of_water', 'landmark', 'venue', 'area'].includes(place.placeType)) error(place, 'placeType', 'must be a supported geographic entity type');
  if (place.aliases !== undefined && (!Array.isArray(place.aliases) || place.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))) error(place, 'aliases', 'must be an array of non-empty strings');
  if (place.source !== undefined && !isHttpUrl(place.source)) error(place, 'source', 'must be an absolute http(s) URL');
}

const placeById = new Map(places.map(place => [place.id, place]));
for (const place of places) {
  if (place.parentId !== undefined && (!placeIds.has(place.parentId) || place.parentId === place.id)) error(place, 'parentId', 'must refer to a different existing place key');
  const ancestors = new Set([place.id]);
  let parentId = place.parentId;
  while (parentId && placeById.has(parentId)) {
    if (ancestors.has(parentId)) {
      error(place, 'parentId', 'place hierarchy must not contain cycles');
      break;
    }
    ancestors.add(parentId);
    parentId = placeById.get(parentId).parentId;
  }
}

for (const game of games) {
  if (!Number.isInteger(game.id) || game.id < 1) error(game, 'id', 'must be a positive integer');
  if (gameIds.has(game.id)) error(game, 'id', 'must be unique');
  gameIds.add(game.id);
  checkFilename(gameFiles, game.id, game);
  for (const key of gameSchema.required) if (game[key] === undefined) error(game, key, 'is required by src/data/game.schema.json');
  for (const key of Object.keys(game)) if (!gameSchema.properties[key]) error(game, key, 'unknown property; update the schema and consumer deliberately');
  if (game.reviewed !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(game.reviewed)) error(game, 'reviewed', 'must be a date, YYYY-MM-DD');
  for (const key of ['name', 'publisher', 'developer']) if (typeof game[key] !== 'string' || !game[key].trim()) error(game, key, 'must be a non-empty string');
  if (!Array.isArray(game.genres) || game.genres.length === 0) error(game, 'genres', 'must be a non-empty array of canonical genre labels');
  else {
    if (new Set(game.genres).size !== game.genres.length) error(game, 'genres', 'must not contain duplicate labels');
    for (const genre of game.genres) if (!allowedGenres.has(genre)) error(game, 'genres', `unknown genre "${genre}"; add its canonical label to src/data/genre.schema.json`);
  }
  if (!isHttpUrl(game.source)) error(game, 'source', 'must be an absolute http(s) URL supporting the game record');
  if (!Number.isInteger(game.year) || game.year < 1950 || game.year > new Date().getFullYear() + 2) error(game, 'year', 'must be a plausible release year');
  if (!Array.isArray(game.locations) || game.locations.length === 0) error(game, 'locations', 'must contain at least one location');
  if (!Array.isArray(game.storyYears) || game.storyYears.some(year => !Number.isInteger(year))) error(game, 'storyYears', 'must be an array of integer story years');
  if (game.route !== undefined && typeof game.route !== 'boolean') error(game, 'route', 'must be true or false');
  if (game.route === true && (!Array.isArray(game.locations) || game.locations.length < 2)) error(game, 'route', 'requires at least two locations');
  for (const message of validateRoutes(game)) error(game, 'routes', message);
  for (const key of ['publisherUrl', 'developerUrl', 'coverUrl']) if (game[key] !== undefined && !isHttpUrl(game[key])) error(game, key, 'must be an absolute http(s) URL');
  if (game.aliases !== undefined && (!Array.isArray(game.aliases) || game.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))) error(game, 'aliases', 'must be an array of non-empty strings');

  for (const [index, location] of (game.locations ?? []).entries()) {
    const field = `locations[${index}]`;
    for (const key of gameSchema.properties.locations.items.required) if (location[key] === undefined) error(game, `${field}.${key}`, 'is required by src/data/game.schema.json');
    for (const key of Object.keys(location)) if (!gameSchema.properties.locations.items.properties[key]) error(game, `${field}.${key}`, 'unknown property; update the schema and consumer deliberately');
    if (typeof location.placeId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(location.placeId) || !placeIds.has(location.placeId)) error(game, `${field}.placeId`, 'must refer to an existing place key');
    referencedPlaceIds.add(location.placeId);
    if (location.fictional !== undefined && typeof location.fictional !== 'boolean') error(game, `${field}.fictional`, 'must be true or false');
    if (location.note !== undefined && (typeof location.note !== 'string' || !location.note.trim())) error(game, `${field}.note`, 'must be a non-empty string');
    if (location.source !== undefined && !isHttpUrl(location.source)) error(game, `${field}.source`, 'must be an absolute http(s) URL');
    if (location.aliases !== undefined && (!Array.isArray(location.aliases) || location.aliases.some(alias => typeof alias !== 'string' || !alias.trim()))) error(game, `${field}.aliases`, 'must be an array of non-empty strings');
    if (location.positionOverride !== undefined) {
      overrideCount += 1;
      if (!validPosition(location.positionOverride)) error(game, `${field}.positionOverride`, 'must be { lat, lon } with valid coordinate bounds, excluding { lat: 0, lon: 0 }');
      const place = places.find(candidate => candidate.id === location.placeId);
      if (!location.note) error(game, `${field}.positionOverride`, 'requires a note explaining the exception');
      if (!location.source) error(game, `${field}.source`, 'is required for a positionOverride to support the refined map pin');
      if (place && validPosition(location.positionOverride) && validPosition(place.position) && distanceKm(place.position, location.positionOverride) <= 1) error(game, `${field}.positionOverride`, 'must be more than 1 km from the canonical place point');
    }
  }
}

const knownGameFiles = new Set(games.map(game => `${String(game.id).padStart(7, '0')}.json`));
for (const file of gameFiles) {
  if (!/^\d{7}\.json$/.test(file)) errors.push(`${path.join(GAME_DATA_DIRECTORY, file)}: filename must be a seven-digit game ID plus .json`);
  if (!knownGameFiles.has(file)) errors.push(`${path.join(GAME_DATA_DIRECTORY, file)}: filename ID does not match its record or could not be read`);
}
const knownPlaceFiles = new Set(places.map(place => `${place.id}.json`));
for (const file of placeFiles) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(file)) errors.push(`${path.join(PLACE_DATA_DIRECTORY, file)}: filename must use the stable place key plus .json`);
  if (!knownPlaceFiles.has(file)) errors.push(`${path.join(PLACE_DATA_DIRECTORY, file)}: filename does not match its record or could not be read`);
}

if (errors.length) {
  console.error(`Data validation failed with ${errors.length} error(s):\n${errors.map(item => `- ${item}`).join('\n')}`);
  if (typeof process !== 'undefined') process.exitCode = 1;
} else {
  const contextualPlaceIds = new Set(referencedPlaceIds);
  for (const placeId of referencedPlaceIds) {
    let parentId = placeById.get(placeId)?.parentId;
    while (parentId && placeById.has(parentId) && !contextualPlaceIds.has(parentId)) {
      contextualPlaceIds.add(parentId);
      parentId = placeById.get(parentId).parentId;
    }
  }
  const unused = places.filter(place => !contextualPlaceIds.has(place.id));
  console.log(`Validated ${games.length} games, ${places.length} canonical places, and ${games.reduce((sum, game) => sum + game.locations.length, 0)} game-place references.`);
  if (overrideCount) console.log(`Validated ${overrideCount} documented coordinate overrides with location-specific sources.`);
  if (unused.length) console.warn(`${unused.length} place records are unused by games or place hierarchy: ${unused.map(place => `${place.id} (${place.name})`).join(', ')}.`);
}
