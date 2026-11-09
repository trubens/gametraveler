// Land på kartet. Hvert land med spill i seg er en klikkbar flate: hårstrek i terracotta, fylt når pekeren
// er over, åpent eller et søketreff. Land du har vært i får en svak tone under, som et skrapekart.
// Grensene (Natural Earth) hentes først når de trengs: grove (1:110m) i verdensutsnittet, finere (1:50m) fra regionnivå.
// Flatene tegnes i vektorkartet (MapLibre, på GPU-en): som Leaflet-SVG projiserte de 50 000 punkter på nytt
// for hvert zoomtrinn, og det var det meste av tiden et zoom kostet. SVG-en er reserve når vektorkartet feiler.
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { ExpressionSpecification, Map as GlMap } from 'maplibre-gl';
import countryShapeUrls from 'virtual:country-shapes';
import { decodeCountries, type CompactCountries } from './countryShapeCodec';
import { useGlFailed, useGlMap } from './glMap';
import { getPalette, useIsDark } from './theme';

type CountryFeature = Feature<Polygon | MultiPolygon, { iso: string; name: string; label: [number, number] }>;
export type CountryState = 'normal' | 'active' | 'selected' | 'dimmed';
export type CountryPlace = { iso: string; name: string; games: number; state: CountryState };

type Scale = '110m' | '50m';
const DETAIL_ZOOM = 4;
// Nærmere enn dette er landet større enn skjermen, og flaten ble bare et slør over kartet: ingen landflater
export const COUNTRY_SHAPES_HIDE_ZOOM = 7;
const HIDE_ZOOM = COUNTRY_SHAPES_HIDE_ZOOM;
const loading: Partial<Record<Scale, Promise<CountryFeature[]>>> = {};
// Filene har hash i navnet og kompakt koding (vite.config.ts, src/countryShapeCodec.ts)
const loadCountries = (scale: Scale) => {
  loading[scale] ??= fetch(countryShapeUrls[scale])
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(`countries ${res.status}`))))
    .then((data: CompactCountries) => decodeCountries(data) as CountryFeature[]);
  return loading[scale]!;
};

// Flatene gjentas for verdenskopiene, som markørene
const OFFSETS = [-360, 0, 360];
// Om landet har en bit innenfor 90° av datolinja (Russland, USA, New Zealand, Fiji); regnes én gang per flate
const datelineCache = new WeakMap<CountryFeature, boolean>();
const nearDateline = (feature: CountryFeature) => {
  let near = datelineCache.get(feature);
  if (near !== undefined) return near;
  near = false;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  outer: for (const polygon of polygons) for (const ring of polygon) for (const [lon] of ring) if (Math.abs(lon) > 90) { near = true; break outer; }
  datelineCache.set(feature, near);
  return near;
};
const shifted = (geometry: Polygon | MultiPolygon, offset: number): Geometry => {
  const move = (ring: number[][]) => ring.map(([x, y]) => [x + offset, y]);
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: geometry.coordinates.map(move) }
    : { type: 'MultiPolygon', coordinates: geometry.coordinates.map(poly => poly.map(move)) };
};

// Innrammingen dekker landets hoveddel (polygonet navnepunktet ligger i), de andre delene som ligger innen
// 8° av navnepunktet (øyriker: Bahamas, Palau, begge øyene på New Zealand, Kreta, Korsika) og stedene i
// landet som har spill, så lenge de ligger innen 12°. Jan Mayen (18° vest for Norges navnepunkt) kostet
// Norge et zoomtrinn på telefon og ga mest hav; øya står i panelet uansett. Frankrike i dataene omfatter også Fransk Guyana og
// Réunion, USA Hawaii og Norge Svalbard (16° nord for navnepunktet); tas de med, havner utsnittet midt i
// havet eller zoomet helt ut. Påskeøya og Hawaii står i panelet, men ligger for langt unna for rammen.
const NEAR_DEGREES = 12;
const PART_DEGREES = 8;
const inRing = ([x, y]: [number, number], ring: number[][]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const ringArea = (ring: number[][]) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(sum) / 2;
};
const mainPart = (geometry: Polygon | MultiPolygon, [lat, lon]: [number, number]): Polygon => {
  if (geometry.type === 'Polygon') return geometry;
  const withLabel = geometry.coordinates.find(poly => inRing([lon, lat], poly[0]));
  const largest = [...geometry.coordinates].sort((a, b) => ringArea(b[0]) - ringArea(a[0]))[0];
  return { type: 'Polygon', coordinates: withLabel ?? largest };
};
const nearLabel = ([lat, lon]: [number, number], [labelLat, labelLon]: [number, number]) => {
  const dLon = Math.abs(lon - labelLon);
  return Math.max(Math.min(dLon, 360 - dLon), Math.abs(lat - labelLat)) <= NEAR_DEGREES;
};
const nearbyParts = (geometry: Polygon | MultiPolygon, label: [number, number]): Polygon | MultiPolygon => {
  if (geometry.type !== 'MultiPolygon') return geometry;
  const main = mainPart(geometry, label);
  const [lat, lon] = label;
  const near = geometry.coordinates.filter(poly => {
    if (poly === main.coordinates) return true;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [x, y] of poly[0]) { minLon = Math.min(minLon, x); maxLon = Math.max(maxLon, x); minLat = Math.min(minLat, y); maxLat = Math.max(maxLat, y); }
    const dLon = Math.max(0, minLon - lon, lon - maxLon);
    const dLat = Math.max(0, minLat - lat, lat - maxLat);
    return Math.max(Math.min(dLon, 360 - dLon), dLat) <= PART_DEGREES;
  });
  return { type: 'MultiPolygon', coordinates: near };
};
// Klikkpunktet som [lat, lon], med lengdegraden tilbake i -180..180 (kartet har kopier av verden side om side)
const clickedAt = (latlng: L.LatLng): [number, number] => [latlng.lat, ((((latlng.lng + 180) % 360) + 360) % 360) - 180];
// Et klikk på en annen del av landet enn hoveddelen (Alaska, Hawaii, Svalbard) flyr dit, ikke til fastlandet
const fitAnchor = (feature: CountryFeature, at?: [number, number]): [number, number] => {
  const label = feature.properties.label;
  if (!at || feature.geometry.type !== 'MultiPolygon') return label;
  const point: [number, number] = [at[1], at[0]];
  const clicked = feature.geometry.coordinates.find(poly => inRing(point, poly[0]));
  const main = mainPart(feature.geometry, label).coordinates;
  if (!clicked || clicked === main) return label;
  // Datolinjen deler Tsjukotka fra resten av Russland i dataene; den delen hører til fastlandet
  const touches = (poly: number[][][], edge: number) => poly[0].some(([x]) => Math.abs(x - edge) < 0.01);
  if ((touches(clicked, -180) && touches(main, 180)) || (touches(clicked, 180) && touches(main, -180))) return label;
  return at;
};
const fitBoundsFor = (feature: CountryFeature, points: [number, number][], at?: [number, number]): L.LatLngBounds => {
  const anchor = fitAnchor(feature, at);
  const bounds = contiguousBounds(nearbyParts(feature.geometry, anchor));
  const centerLon = bounds.getCenter().lng;
  for (const point of points) {
    if (!nearLabel(point, anchor)) continue;
    // Samme verdenskopi som hoveddelen, så Russland ikke spenner over datolinjen
    let lon = point[1];
    if (lon - centerLon > 180) lon -= 360;
    if (centerLon - lon > 180) lon += 360;
    bounds.extend([point[0], lon]);
  }
  return bounds;
};

// Russland, USA og Fiji krysser datolinjen, så den rå avgrensningen spenner over hele kloden.
// Den mindre delen flyttes en verdensbredde, så landet henger sammen og kartet flyr dit det ligger.
const contiguousBounds = (geometry: Polygon | MultiPolygon): L.LatLngBounds => {
  const points: [number, number][] = [];
  const collect = (ring: number[][]) => ring.forEach(([x, y]) => points.push([x, y]));
  if (geometry.type === 'Polygon') geometry.coordinates.forEach(collect);
  else geometry.coordinates.forEach(poly => poly.forEach(collect));
  const lons = points.map(([x]) => x);
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    const east = points.filter(([x]) => x > 0).length;
    const west = points.length - east;
    for (const point of points) {
      if (east >= west && point[0] < 0) point[0] += 360;
      else if (east < west && point[0] > 0) point[0] -= 360;
    }
  }
  const lats = points.map(([, y]) => y);
  const shiftedLons = points.map(([x]) => x);
  return L.latLngBounds([Math.min(...lats), Math.min(...shiftedLons)], [Math.max(...lats), Math.max(...shiftedLons)]);
};

// Fargene leses når de brukes, så landflatene følger temaet når det byttes
const INK = () => getPalette().ink;
// Ingen hårstrek rundt land med spill i hvile: kartet tegner allerede grensene, og to streker oppå hverandre gjorde
// verdenskartet til et nett (mørk modus 7. november, lyst tema 8. november 2026). Åpent land og søketreff får vermilion.
const REST_LINE = { detail: 0, world: 0 };
const TERRACOTTA = () => getPalette().accent;
const DIMMED = () => getPalette().dimmed;

// Hårstreken er svakere i verdensutsnittet, der nesten hvert land har spill
const styleFor = (state: CountryState, detail: boolean, hover = false): L.PathOptions => {
  switch (state) {
    case 'selected': return { color: TERRACOTTA(), weight: 2, opacity: 0.95, fillColor: TERRACOTTA(), fillOpacity: 0.16 };
    case 'active': return { color: TERRACOTTA(), weight: 1.5, opacity: 0.9, fillColor: TERRACOTTA(), fillOpacity: 0.14 };
    case 'dimmed': return { color: DIMMED(), weight: detail ? 1 : 0.8, opacity: 0.3, fillColor: DIMMED(), fillOpacity: hover ? 0.08 : 0 };
    // Grensene er en svak blekkstrek; vermilion er for landet som er åpnet eller pekt på. Røde grenser over
    // hele Europa gjorde kartet urolig og gammeldags.
    default: return { color: INK(), weight: detail ? 1 : 0.8, opacity: detail ? REST_LINE.detail : REST_LINE.world, fillColor: TERRACOTTA(), fillOpacity: hover ? 0.1 : 0 };
  }
};
const beenStyle = (): L.PathOptions => ({ stroke: false, fillColor: INK(), fillOpacity: 0.08 });

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

export function CountryShapes({ countries, been, onSelect, fit, fitOptions, fitAt }: {
  countries: Map<string, CountryPlace>;
  been: Set<string>;
  onSelect: (iso: string, at?: [number, number]) => void;
  // Når et land åpnes, flyr kartet til flaten og landets steder med spill; seq skiller to åpninger av samme land
  fit?: { iso: string; seq: number; points: [number, number][] };
  fitOptions: () => L.FitBoundsOptions;
  // Der landet ble klikket, lest når kartet flyr (en ref i App, så den leses ikke under tegningen)
  fitAt?: () => [number, number] | undefined;
}) {
  const map = useMap();
  const gl = useGlMap();
  const glFailed = useGlFailed();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const detail = zoom >= DETAIL_ZOOM;
  const scale: Scale = detail ? '50m' : '110m';
  const [loaded, setLoaded] = useState<Partial<Record<Scale, CountryFeature[]>>>({});
  const wanted = countries.size > 0 || been.size > 0;
  useEffect(() => {
    if (!wanted || loaded[scale]) return;
    let active = true;
    loadCountries(scale).then(list => { if (active) setLoaded(current => ({ ...current, [scale]: list })); }).catch(error => console.error(error));
    return () => { active = false; };
  }, [wanted, scale, loaded]);
  // De fine grensene kan komme etter zoomen; de grove duger i mellomtiden
  const features = loaded[scale] ?? loaded[detail ? '110m' : '50m'];

  // Én flytur per åpning: når de fine grensene kommer midt i flyturen, skal ikke kartet fly en gang til
  const fitted = useRef<number>(undefined);
  useEffect(() => {
    if (!fit || !features || fitted.current === fit.seq) return;
    const feature = features.find(f => f.properties.iso === fit.iso);
    if (!feature) return;
    fitted.current = fit.seq;
    map.flyToBounds(fitBoundsFor(feature, fit.points, fitAt?.()), { ...fitOptions(), maxZoom: 6, duration: 0.8 });
    // fitOptions leser panelets høyde i det øyeblikket; seq er det som skal utløse flyttingen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.iso, fit?.seq, features, map]);

  if (!wanted) return null;
  if (gl) return <GlCountries gl={gl} loaded={loaded} countries={countries} been={been} onSelect={onSelect} />;
  if (glFailed && features) return <SvgCountries features={features} detail={detail} zoom={zoom} countries={countries} been={been} onSelect={onSelect} />;
  return null;
}

// ---- Vektorkartet -----------------------------------------------------------------------------
// Én kilde per målestokk med landkoden som id, så tilstanden (spill, åpent, vært der, peker over) settes
// med setFeatureState uten å sende geometrien på nytt. Vektorkartet ligger ett zoomnivå under Leaflet
// (512 px-fliser), så Leaflet-zoom z er vektorzoom z − 1.
const SOURCES: Record<Scale, string> = { '110m': 'gt-countries-110m', '50m': 'gt-countries-50m' };
const GL_RANGE: Record<Scale, { minzoom: number; maxzoom: number }> = {
  '110m': { minzoom: 0, maxzoom: DETAIL_ZOOM - 1 },
  '50m': { minzoom: DETAIL_ZOOM - 1, maxzoom: HIDE_ZOOM - 1 },
};
const layerIds = (scale: Scale) => ({ been: `gt-been-${scale}`, fill: `gt-fill-${scale}`, line: `gt-line-${scale}` });
const FILL_LAYERS = (['110m', '50m'] as Scale[]).map(scale => layerIds(scale).fill);
const stateIs = (value: CountryState): ExpressionSpecification => ['==', ['coalesce', ['feature-state', 'state'], 'none'], value];
const flag = (name: string): ExpressionSpecification => ['boolean', ['feature-state', name], false];
const glStyle = (scale: Scale) => {
  const detail = scale === '50m';
  const ids = layerIds(scale);
  const source = SOURCES[scale];
  const range = GL_RANGE[scale];
  const dimmedColor: ExpressionSpecification = ['case', stateIs('dimmed'), DIMMED(), TERRACOTTA()];
  return [
    { id: ids.been, type: 'fill', source, ...range, paint: { 'fill-color': INK(), 'fill-opacity': ['case', flag('been'), 0.08, 0] } },
    { id: ids.fill, type: 'fill', source, ...range, paint: {
      'fill-color': dimmedColor,
      'fill-opacity': ['case', ['!', flag('withGames')], 0, stateIs('selected'), 0.16, stateIs('active'), 0.14, ['all', stateIs('dimmed'), flag('hover')], 0.08, flag('hover'), 0.1, 0],
    } },
    { id: ids.line, type: 'line', source, ...range, paint: {
      // Svak blekkstrek til vanlig, vermilion for landet som er åpnet (se styleFor)
      'line-color': ['case', stateIs('dimmed'), DIMMED(), ['any', stateIs('selected'), stateIs('active')], TERRACOTTA(), INK()],
      'line-width': ['case', stateIs('selected'), 2, stateIs('active'), 1.5, detail ? 1 : 0.8],
      'line-opacity': ['case', ['!', flag('withGames')], 0, stateIs('selected'), 0.95, stateIs('active'), 0.9, stateIs('dimmed'), 0.3, detail ? REST_LINE.detail : REST_LINE.world],
    } },
  ];
};

function GlCountries({ gl, loaded, countries, been, onSelect }: {
  gl: GlMap;
  loaded: Partial<Record<Scale, CountryFeature[]>>;
  countries: Map<string, CountryPlace>;
  been: Set<string>;
  onSelect: (iso: string, at?: [number, number]) => void;
}) {
  const map = useMap();
  const [ready, setReady] = useState(false);
  const countriesRef = useRef(countries);
  useEffect(() => { countriesRef.current = countries; }, [countries]);

  // Kilder og lag legges inn under kartets første tekstlag, så stedsnavnene ligger over flatene
  useEffect(() => {
    let active = true;
    const setup = () => {
      if (!active) return;
      const before = gl.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
      for (const scale of ['110m', '50m'] as Scale[]) {
        if (!gl.getSource(SOURCES[scale])) gl.addSource(SOURCES[scale], { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'iso' });
        for (const layer of glStyle(scale)) if (!gl.getLayer(layer.id)) gl.addLayer(layer as never, before);
      }
      setReady(true);
    };
    if (gl.isStyleLoaded()) setup(); else gl.once('style.load', setup);
    return () => {
      active = false;
      setReady(false);
      if (!gl.getStyle()) return;
      for (const scale of ['110m', '50m'] as Scale[]) {
        for (const id of Object.values(layerIds(scale))) if (gl.getLayer(id)) gl.removeLayer(id);
        if (gl.getSource(SOURCES[scale])) gl.removeSource(SOURCES[scale]);
      }
    };
  }, [gl]);

  // Temabytte: lagene ligger i kartet, så bare fargene males om (de står som ekte verdier i lagenes paint)
  const dark = useIsDark();
  useEffect(() => {
    if (!ready) return;
    for (const scale of ['110m', '50m'] as Scale[]) {
      for (const layer of glStyle(scale)) {
        if (!gl.getLayer(layer.id)) continue;
        for (const [key, value] of Object.entries(layer.paint)) gl.setPaintProperty(layer.id, key as never, value as never);
      }
    }
  }, [gl, ready, dark]);

  // Geometrien sendes én gang per målestokk; tilstanden settes for hvert land etterpå
  const states = useMemo(() => {
    const result = new Map<string, { withGames: boolean; state: CountryState; been: boolean }>();
    for (const [iso, country] of countries) result.set(iso, { withGames: true, state: country.state, been: been.has(iso) });
    for (const iso of been) if (!result.has(iso)) result.set(iso, { withGames: false, state: 'normal', been: true });
    return result;
  }, [countries, been]);
  const applied = useRef(new Map<string, Set<string>>());
  useEffect(() => {
    if (!ready) return;
    for (const scale of ['110m', '50m'] as Scale[]) {
      const features = loaded[scale];
      const source = gl.getSource(SOURCES[scale]) as { setData?: (data: FeatureCollection) => void; _data?: unknown } | undefined;
      if (!features || !source?.setData) continue;
      const known = applied.current.get(scale) ?? new Set<string>();
      if (known.size === 0) {
        source.setData({ type: 'FeatureCollection', features: features.map(f => ({ type: 'Feature', id: f.properties.iso, properties: { iso: f.properties.iso, name: f.properties.name }, geometry: f.geometry })) });
        applied.current.set(scale, known);
      }
      for (const feature of features) {
        const iso = feature.properties.iso;
        const state = states.get(iso) ?? { withGames: false, state: 'normal' as CountryState, been: false };
        gl.setFeatureState({ source: SOURCES[scale], id: iso }, state);
        known.add(iso);
      }
    }
  }, [gl, ready, loaded, states]);

  // Peker over og klikk går via Leaflet-kartet (vektorlaget tar ikke hendelser selv) og slås opp i det som er tegnet
  const hovered = useRef<string | undefined>(undefined);
  const tooltip = useRef<L.Tooltip | undefined>(undefined);
  const setHover = (iso: string | undefined, latlng?: L.LatLng) => {
    if (hovered.current !== iso) {
      for (const scale of ['110m', '50m'] as Scale[]) {
        if (!gl.getSource(SOURCES[scale])) continue;
        if (hovered.current) gl.setFeatureState({ source: SOURCES[scale], id: hovered.current }, { hover: false });
        if (iso) gl.setFeatureState({ source: SOURCES[scale], id: iso }, { hover: true });
      }
      hovered.current = iso;
      map.getContainer().style.cursor = iso ? 'pointer' : '';
    }
    const country = iso ? countriesRef.current.get(iso) : undefined;
    if (country && latlng) {
      tooltip.current ??= L.tooltip({ className: 'gt-label gt-country-hover', direction: 'top', offset: [0, -8] });
      tooltip.current.setLatLng(latlng).setContent(`${escapeHtml(country.name)} · ${country.games} ${country.games === 1 ? 'game' : 'games'}`);
      if (!tooltip.current.isOpen()) tooltip.current.openOn(map);
    } else if (tooltip.current?.isOpen()) {
      tooltip.current.close();
    }
  };
  // Lerretet er større enn Leaflet-kartet (polstring rundt), så punktet regnes i vektorkartets egne piksler
  const rawCountryAt = (latlng: L.LatLng) => {
    if (!ready) return undefined;
    const point = gl.project([latlng.lng, latlng.lat]);
    const hits = gl.queryRenderedFeatures([point.x, point.y], { layers: FILL_LAYERS.filter(id => gl.getLayer(id)) });
    return hits.map(hit => String(hit.id)).find(iso => countriesRef.current.has(iso));
  };
  // Et land som fyller skjermen er bakgrunn, ikke et mål: zoomet inn på Kansas var hele kartet én «United
  // States · 249 games»-lapp, og et klikk hvor som helst åpnet landet. Etter hver flytting prøves 25 punkter
  // over kartet; treffer minst 80 % samme land, tar det verken peker eller klikk (Belgia ved siden av gjør det).
  const filling = useRef<string | undefined>(undefined);
  const measureFilling = () => {
    const size = map.getSize();
    const counts = new Map<string, number>();
    let samples = 0;
    for (let i = 1; i <= 5; i++) {
      for (let j = 1; j <= 5; j++) {
        samples++;
        const iso = rawCountryAt(map.containerPointToLatLng([size.x * (i / 6), size.y * (j / 6)]));
        if (iso) counts.set(iso, (counts.get(iso) ?? 0) + 1);
      }
    }
    const [top, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    filling.current = top && count! >= samples * 0.8 ? top : undefined;
  };
  useEffect(() => {
    if (!ready) return;
    measureFilling();
    gl.once('idle', measureFilling);
    // measureFilling leser kartet i øyeblikket; nye landdata eller klarsignal er det som skal utløse den
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loaded]);
  const countryAt = (latlng: L.LatLng) => {
    const iso = rawCountryAt(latlng);
    return iso && iso === filling.current ? undefined : iso;
  };
  useMapEvents({
    moveend: () => { if (!ready) return; measureFilling(); gl.once('idle', measureFilling); },
    // Over en prikk, en klynge eller en lapp hører pekeren til stedet, ikke landet under: ingen landlapp der
    mousemove: event => {
      const target = event.originalEvent?.target as HTMLElement | null;
      if (target?.closest?.('.leaflet-marker-icon, .marker-cluster, .leaflet-tooltip')) { setHover(undefined); return; }
      setHover(countryAt(event.latlng), event.latlng);
    },
    mouseout: () => setHover(undefined),
    // Et trykk på en prikk, en klynge eller en lapp gjelder stedet, ikke landet under. Uten denne sjekken åpnet
    // landet seg oppå stedet (med arket nede) ved hvert trykk på en prikk så lenge landflatene vises (zoom < 7).
    click: event => {
      const target = event.originalEvent?.target as HTMLElement | null;
      if (target?.closest?.('.leaflet-marker-icon, .marker-cluster, .leaflet-tooltip')) return;
      const iso = countryAt(event.latlng);
      if (iso) onSelect(iso, clickedAt(event.latlng));
    },
  });
  useEffect(() => () => { tooltip.current?.close(); map.getContainer().style.cursor = ''; }, [map]);
  return null;
}

// ---- Reserve: SVG i Leaflet, brukt når vektorkartet ikke kom opp ----------------------------
function SvgCountries({ features, detail, zoom, countries, been, onSelect }: {
  features: CountryFeature[];
  detail: boolean;
  zoom: number;
  countries: Map<string, CountryPlace>;
  been: Set<string>;
  onSelect: (iso: string, at?: [number, number]) => void;
}) {
  const dark = useIsDark();
  const signature = `${dark ? 'n' : 'l'}|${detail ? 'd' : 'o'}|` + [...countries].map(([iso, c]) => `${iso}:${c.state}:${c.games}`).sort().join(',') + '|' + [...been].sort().join(',');
  const { placeFeatures, beenFeatures } = useMemo(() => {
    const placeFeatures: CountryFeature[] = [];
    const beenFeatures: CountryFeature[] = [];
    for (const feature of features) {
      const iso = feature.properties.iso;
      // Verdenskopiene trengs bare nær datolinja når kartet er zoomet inn (utsnittet er smalere enn
      // 180°, og worldCopyJump holder sentrum i verden); hver kopi projiseres på nytt ved hvert zoom
      const offsets = detail && !nearDateline(feature) ? [0] : OFFSETS;
      if (been.has(iso)) for (const offset of offsets) beenFeatures.push({ ...feature, geometry: shifted(feature.geometry, offset) as Polygon | MultiPolygon });
      if (countries.has(iso)) for (const offset of offsets) placeFeatures.push({ ...feature, geometry: shifted(feature.geometry, offset) as Polygon | MultiPolygon });
    }
    return { placeFeatures, beenFeatures };
    // signature dekker alt som endrer utvalget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, signature]);
  if (zoom >= HIDE_ZOOM) return null;

  return (
    <>
      {beenFeatures.length > 0 && (
        <GeoJSON key={`been-${signature}`} data={{ type: 'FeatureCollection', features: beenFeatures } as FeatureCollection} interactive={false} style={beenStyle()} />
      )}
      {placeFeatures.length > 0 && (
        <GeoJSON
          key={`places-${signature}`}
          data={{ type: 'FeatureCollection', features: placeFeatures } as FeatureCollection}
          style={feature => styleFor(countries.get((feature as CountryFeature | undefined)?.properties.iso ?? '')?.state ?? 'normal', detail)}
          onEachFeature={(feature, layer) => {
            const country = countries.get((feature as CountryFeature).properties.iso);
            if (!country) return;
            const path = layer as L.Path;
            layer.on('click', event => onSelect(country.iso, clickedAt((event as L.LeafletMouseEvent).latlng)));
            layer.on('mouseover', () => path.setStyle(styleFor(country.state, detail, true)));
            layer.on('mouseout', () => path.setStyle(styleFor(country.state, detail)));
            layer.bindTooltip(`${escapeHtml(country.name)} · ${country.games} ${country.games === 1 ? 'game' : 'games'}`, { sticky: true, className: 'gt-label gt-country-hover', direction: 'top', offset: [0, -8] });
          }}
        />
      )}
    </>
  );
}
