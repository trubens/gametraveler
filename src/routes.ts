import type { Game, Location } from './gameData.ts';
import { getPalette } from './theme.ts';

export type GameRoute = {
  id: string;
  name: string;
  characters?: string[];
  storyYears?: number[];
  // Ordered place references. Repeated references represent return visits.
  stops: string[];
  note?: string;
  source?: string;
};

export type ResolvedRoute = GameRoute & { locations: Location[] };

export function getGameRoutes(game: Pick<Game, 'routes' | 'route' | 'locations'>): ResolvedRoute[] {
  if (game.routes !== undefined) {
    const byId = new Map(game.locations.map(location => [location.placeId, location]));
    return game.routes.map(route => ({
      ...route,
      locations: route.stops.map(id => {
        const location = byId.get(id);
        if (!location) throw new Error(`Route ${route.id} refers to unknown game location ${id}`);
        return location;
      }),
    }));
  }
  return game.route && game.locations.length > 1
    ? [{ id: 'journey', name: 'The journey', stops: game.locations.map(location => location.placeId), locations: game.locations }]
    : [];
}

export const hasOrderedRoute = (game: Pick<Game, 'routes' | 'route' | 'locations'>) => getGameRoutes(game).length > 0;

// Leses når ruten tegnes, så fargene følger temaet når det byttes
export const routeStyle = (index: number) => {
  const palette = getPalette();
  return [
    { color: palette.accent },
    { color: palette.fictional },
    { color: palette.imaginary },
    { color: palette.ochre },
  ][index % 4];
};
