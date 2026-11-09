export function validateRoutes(game) {
  const errors = [];
  if (game.routes === undefined) return errors;
  if (game.route !== undefined) errors.push('routes: cannot be combined with legacy route');
  if (!Array.isArray(game.routes) || game.routes.length === 0) return [...errors, 'routes: must be a non-empty array'];
  const ids = new Set();
  const placeCounts = new Map();
  for (const location of Array.isArray(game.locations) ? game.locations : []) {
    placeCounts.set(location.placeId, (placeCounts.get(location.placeId) ?? 0) + 1);
  }
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const fields = new Set(['id', 'name', 'characters', 'storyYears', 'stops', 'note', 'source']);
  for (const [index, route] of game.routes.entries()) {
    const fail = message => errors.push(`routes[${index}]: ${message}`);
    if (!route || typeof route !== 'object' || Array.isArray(route)) { fail('must be an object'); continue; }
    for (const key of Object.keys(route)) if (!fields.has(key)) fail(`unknown property ${key}`);
    if (typeof route.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route.id)) fail('id must be a lowercase slug');
    if (ids.has(route.id)) fail('id must be unique within the game');
    ids.add(route.id);
    if (!text(route.name)) fail('name must be non-empty');
    if (route.characters !== undefined && (!Array.isArray(route.characters) || !route.characters.length || route.characters.some(value => !text(value)) || new Set(route.characters).size !== route.characters.length)) fail('characters must contain unique non-empty names');
    if (route.storyYears !== undefined && (!Array.isArray(route.storyYears) || route.storyYears.some(year => !Number.isInteger(year)))) fail('storyYears must contain integer years');
    if (route.note !== undefined && !text(route.note)) fail('note must be non-empty');
    if (route.source !== undefined) {
      try { if (!['http:', 'https:'].includes(new URL(route.source).protocol)) fail('source must be an http(s) URL'); }
      catch { fail('source must be an http(s) URL'); }
    }
    if (!Array.isArray(route.stops) || route.stops.length < 2) { fail('stops must contain at least two place references'); continue; }
    for (const stop of route.stops) {
      if (typeof stop !== 'string' || placeCounts.get(stop) !== 1) fail(`stop ${String(stop)} must reference exactly one of the game's locations`);
    }
    if (new Set(route.stops).size < 2) fail('stops must visit at least two distinct places');
  }
  return errors;
}
