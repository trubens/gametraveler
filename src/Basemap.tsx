import { useEffect, useState } from 'react';
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

type StyleLayer = { type: string; layout?: Record<string, unknown> };

export function Basemap() {
  const map = useMap();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let layer: L.Layer | undefined;
    let cancelled = false;

    (async () => {
      try {
        // Kartbiblioteket lastes separat, så resten av appen ikke venter på det
        const [plugin, maplibre, response] = await Promise.all([
          import('@maplibre/maplibre-gl-leaflet'),
          import('maplibre-gl'),
          fetch(STYLE_URL),
        ]);
        maplibre.setWorkerUrl(workerUrl);
        if (!response.ok) throw new Error(`Style ${response.status}`);
        const style = await response.json();
        for (const l of (style.layers ?? []) as StyleLayer[]) {
          if (l.type === 'symbol' && l.layout?.['text-field'] && JSON.stringify(l.layout['text-field']).includes('name')) {
            l.layout['text-field'] = ENGLISH_NAME;
          }
        }
        if (cancelled) return;
        layer = plugin.default({ style, attributionControl: false });
        layer.addTo(map);
        map.attributionControl.addAttribution(ATTRIBUTION);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (layer) {
        map.removeLayer(layer);
        map.attributionControl.removeAttribution(ATTRIBUTION);
      }
    };
  }, [map]);

  if (failed) {
    return <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution={OSM_ATTRIBUTION} />;
  }
  return null;
}
