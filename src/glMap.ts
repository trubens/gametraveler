// Vektorkartet (MapLibre) deles med lag som tegner i det (landflatene i CountryShapes): Basemap setter det
// når laget er lagt på kartet, og tar det bort når det fjernes eller faller tilbake til rasterfliser
import { useSyncExternalStore } from 'react';
import type { Map as GlMap } from 'maplibre-gl';

let glMap: GlMap | undefined;
let glFailed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const setGlMap = (map: GlMap | undefined) => { glMap = map; notify(); };
export const setGlFailed = () => { glMap = undefined; glFailed = true; notify(); };
export const useGlMap = () => useSyncExternalStore(subscribe, () => glMap);
export const useGlFailed = () => useSyncExternalStore(subscribe, () => glFailed);
