// Landgrensene (public/data/countries-*.json, laget av scripts/build-countries.mjs) sendes til nettleseren i en
// kompakt form: hvert koordinatpar som heltall (grader × scale) og som avstand fra forrige punkt i ringen.
// «-3,12» er kortere enn «178.73,-16.07», så 1:50m-filen blir halvparten så stor, også gzippet, og raskere å lese.
// Kodingen er tapsfri: scale velges slik at hvert koordinat blir et helt tall (vite.config.ts koder, CountryShapes.tsx leser).
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type CountryProperties = { iso: string; name: string; label: [number, number] };
// [iso, navn, navnepunkt, 'P' (Polygon) eller 'M' (MultiPolygon), polygoner → ringer → [dx, dy, dx, dy, …]]
type CompactCountry = [string, string, [number, number], 'P' | 'M', number[][][]];
export type CompactCountries = { scale: number; countries: CompactCountry[] };

const ringsOf = (geometry: Polygon | MultiPolygon) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);

// Minste tierpotens (opptil en million) som gjør alle koordinatene til hele tall
const scaleFor = (values: number[]) => {
  for (let scale = 1; scale <= 1e6; scale *= 10) {
    if (values.every(value => Math.round(value * scale) / scale === value)) return scale;
  }
  throw new Error('Country coordinates have more than six decimals.');
};

export function encodeCountries(collection: FeatureCollection<Polygon | MultiPolygon, CountryProperties>): CompactCountries {
  const values: number[] = [];
  for (const feature of collection.features) for (const polygon of ringsOf(feature.geometry)) for (const ring of polygon) for (const [x, y] of ring) values.push(x, y);
  const scale = scaleFor(values);
  const encodeRing = (ring: number[][]) => {
    const out: number[] = [];
    let px = 0;
    let py = 0;
    for (const [x, y] of ring) {
      const ix = Math.round(x * scale);
      const iy = Math.round(y * scale);
      out.push(ix - px, iy - py);
      px = ix;
      py = iy;
    }
    return out;
  };
  return {
    scale,
    countries: collection.features.map(({ properties: { iso, name, label }, geometry }) => [
      iso, name, label, geometry.type === 'Polygon' ? 'P' : 'M', ringsOf(geometry).map(polygon => polygon.map(encodeRing)),
    ]),
  };
}

export function decodeCountries({ scale, countries }: CompactCountries): Feature<Polygon | MultiPolygon, CountryProperties>[] {
  const decodeRing = (deltas: number[]) => {
    const ring: number[][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < deltas.length; i += 2) {
      x += deltas[i];
      y += deltas[i + 1];
      ring.push([x / scale, y / scale]);
    }
    return ring;
  };
  return countries.map(([iso, name, label, kind, polygons]) => {
    const coordinates = polygons.map(polygon => polygon.map(decodeRing));
    const geometry: Polygon | MultiPolygon = kind === 'P' ? { type: 'Polygon', coordinates: coordinates[0] } : { type: 'MultiPolygon', coordinates };
    return { type: 'Feature', properties: { iso, name, label }, geometry };
  });
}
