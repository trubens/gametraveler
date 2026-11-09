import { useEffect, useRef, useState } from 'react';
import { setGlFailed, setGlMap } from './glMap';
import { paintAtlas, paintNight, toneStyle } from './basemapTone';
import { getIsDark, useIsDark } from './theme';
import type { Map as GlMap } from 'maplibre-gl';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre finner ikke sin egen worker når Vite har pakket biblioteket, så Vite bygger den som en egen fil
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// OpenFreeMap: gratis vektorfliser uten API-nøkkel eller trafikkgrense (openfreemap.org).
// OpenStreetMaps egne flisservere tillater ikke apper med mye trafikk, så de er bare reserve.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Engelske stedsnavn der de finnes, ellers latinsk skrivemåte
const ENGLISH_NAME = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];

type StyleLayer = { id: string; type: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> };
type Style = { layers?: StyleLayer[] };

// Atlastonen (lyst) eller natten (mørkt) regnes inn i fargene (basemapTone.ts) i stedet for et CSS-filter på lerretet
const paintFor = (base: Style, dark: boolean): Style => {
  const style = structuredClone(base) as Parameters<typeof paintNight>[0];
  if (dark) return paintNight(style) as Style;
  return paintAtlas(toneStyle(style)) as Style;
};

// Byer, tettsteder og landsbyer står rett over punktet sitt i Positron, akkurat der prikkene våre ligger
// («Visby» dekket Visby-prikken). Navnet skyves så langt ut at det klarer en prikk med ring, og kan legge
// seg under eller ved siden av når plassen over er tatt.
const PLACE_LABELS = new Set(['label_city', 'label_city_capital', 'label_town', 'label_village']);


// Kartlerretet skal stå på hele skjermpiksler. Tillegget gjør laget 20 % større enn kartet uten å runde av
// (948 px × 1,2 = 1137,6 px) og runder posisjonen til hele CSS-piksler, som med 125 % skalering i Windows er
// en kvart skjermpiksel (−97 px × 1,25 = −121,25): nettleseren måtte da forskyve og skalere hele kartbildet,
// og all teksten i kartet ble uskarp. Størrelsen velges så den går opp i skjermpiksler, og posisjonen
// legges så midten av laget faller på midten av kartet, rundet til nærmeste skjermpiksel.
type SnappableLayer = { options: { padding: number }; getSize: () => L.Point; _roundPoint: (p: L.Point) => { x: number; y: number } };
const PADDING = 0.1;
function snapToDevicePixels(layer: L.MaplibreGL, map: L.Map) {
  const snappable = layer as unknown as SnappableLayer;
  const devicePixelRatio = () => window.devicePixelRatio || 1;
  // Minste hele CSS-størrelse ≥ want som også er et helt antall skjermpiksler (1,25 → delelig med 4)
  const whole = (want: number) => {
    const ratio = devicePixelRatio();
    for (let n = Math.ceil(want); n < Math.ceil(want) + 8; n++) if (Math.abs(n * ratio - Math.round(n * ratio)) < 1e-6) return n;
    return Math.ceil(want);
  };
  snappable.options.padding = PADDING;
  snappable.getSize = () => {
    const size = map.getSize();
    return L.point(whole(size.x * (1 + PADDING * 2)), whole(size.y * (1 + PADDING * 2)));
  };
  snappable._roundPoint = () => {
    const ratio = devicePixelRatio();
    const size = map.getSize();
    const layerSize = snappable.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]).subtract(layerSize.subtract(size).divideBy(2));
    // Hvor laget havner på skjermen: kartets plass på siden + kartflatens forskyvning + lagets posisjon
    const rect = map.getContainer().getBoundingClientRect();
    const pane = map.containerPointToLayerPoint([0, 0]).multiplyBy(-1);
    const snap = (value: number, base: number) => Math.round((value + base) * ratio) / ratio - base;
    return { x: snap(topLeft.x, rect.left + pane.x), y: snap(topLeft.y, rect.top + pane.y) };
  };
}

export function Basemap() {
  const map = useMap();
  const [failed, setFailed] = useState(false);
  // Den umalte stilen og den som vises, så et temabytte kan male om bare fargene som endres
  const baseStyle = useRef<Style | undefined>(undefined);
  const shownStyle = useRef<Style | undefined>(undefined);
  const vectorMapRef = useRef<GlMap | undefined>(undefined);
  const dark = useIsDark();

  // Temabytte uten omlasting: hvert lags paint settes på nytt med setPaintProperty. setStyle ville fjernet
  // landflatene og de andre lagene vi har lagt inn i kartet.
  useEffect(() => {
    const base = baseStyle.current;
    const shown = shownStyle.current;
    const vectorMap = vectorMapRef.current;
    if (!base || !shown || !vectorMap) return;
    const next = paintFor(base, dark);
    const before = new Map((shown.layers ?? []).map(layer => [layer.id, layer.paint ?? {}]));
    for (const layer of next.layers ?? []) {
      if (!vectorMap.getLayer(layer.id)) continue;
      const old = before.get(layer.id) ?? {};
      const paint = layer.paint ?? {};
      for (const key of new Set([...Object.keys(old), ...Object.keys(paint)])) {
        if (JSON.stringify(old[key]) === JSON.stringify(paint[key])) continue;
        vectorMap.setPaintProperty(layer.id, key as never, paint[key] as never);
      }
    }
    shownStyle.current = next;
  }, [dark]);

  useEffect(() => {
    let layer: L.MaplibreGL | undefined;
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const fallback = () => {
      if (cancelled) return;
      if (layer) {
        map.removeLayer(layer);
        layer = undefined;
        map.attributionControl.removeAttribution(ATTRIBUTION);
      }
      setGlFailed();
      setFailed(true);
    };

    (async () => {
      try {
        // Kartbiblioteket lastes separat, så resten av appen ikke venter på det
        const [plugin, maplibre, response] = await Promise.all([
          import('@maplibre/maplibre-gl-leaflet'),
          import('maplibre-gl'),
          fetch(STYLE_URL, { signal: AbortSignal.timeout(15000) }),
        ]);
        maplibre.setWorkerUrl(workerUrl);
        if (!response.ok) throw new Error(`Style ${response.status}`);
        const style = await response.json();
        for (const l of (style.layers ?? []) as StyleLayer[]) {
          if (l.type === 'symbol' && l.layout?.['text-field'] && JSON.stringify(l.layout['text-field']).includes('name')) {
            l.layout['text-field'] = ENGLISH_NAME;
          }
          if (PLACE_LABELS.has(l.id) && l.layout) {
            delete l.layout['text-anchor'];
            delete l.layout['text-offset'];
            l.layout['text-variable-anchor'] = ['bottom', 'top', 'left', 'right'];
            l.layout['text-radial-offset'] = 1.2;
          }
        }
        baseStyle.current = structuredClone(style);
        const painted = paintFor(style, getIsDark());
        shownStyle.current = painted;
        if (cancelled) return;
        layer = plugin.default({ style: painted as never, attributionControl: false });
        snapToDevicePixels(layer, map);
        layer.addTo(map);
        map.attributionControl.addAttribution(ATTRIBUTION);
        // Deles med lagene som tegner i vektorkartet (glMap.ts)
        setGlMap(layer.getMaplibreMap());
        vectorMapRef.current = layer.getMaplibreMap();
        loadTimer = setTimeout(fallback, 20000);
        const vectorMap = layer.getMaplibreMap();
        // Stilen er lastet: kartet virker, også om første utsnitt er tomt hav (der ga idle ingen treff, og et
        // fungerende vektorkart ble byttet ut med rasterfliser etter 20 sekunder)
        vectorMap.once('load', () => clearTimeout(loadTimer));
        layer.getMaplibreMap().once('webglcontextlost', fallback);
      } catch {
        // Landflatene tegnes da som SVG; uten setGlFailed ventet de på et vektorkart som aldri kom
        if (!cancelled) { setGlFailed(); setFailed(true); }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
      if (layer) {
        map.removeLayer(layer);
        map.attributionControl.removeAttribution(ATTRIBUTION);
      }
      setGlMap(undefined);
      vectorMapRef.current = undefined;
    };
  }, [map]);

  if (failed) {
    return <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution={OSM_ATTRIBUTION} />;
  }
  return null;
}
