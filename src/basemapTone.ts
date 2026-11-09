// Grunnkartet trykkes i én grå tone så markører, ruter og landflater står fram. Det var et CSS-filter på
// lerretet (grayscale(0.85) sepia(0.18) contrast(0.78) brightness(1.08), nå mykere: se tone), men da ble alt som tegnes i
// vektorkartet (landflatene i CountryShapes) også grått. Her regnes det samme filteret inn i stilens
// farger i stedet, farge for farge: filterne er affine per kanal, så resultatet er det samme etter
// blanding, og nettleseren slipper å filtrere hele lerretet for hver ramme.
type Rgba = [number, number, number, number];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

// Samme matriser som Filter Effects-spesifikasjonen, i sRGB som CSS-kortformene bruker
const grayscale = ([r, g, b, a]: Rgba, amount: number): Rgba => {
  const k = 1 - amount;
  return [
    (0.2126 + 0.7874 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 - 0.0722 * k) * b,
    (0.2126 - 0.2126 * k) * r + (0.7152 + 0.2848 * k) * g + (0.0722 - 0.0722 * k) * b,
    (0.2126 - 0.2126 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 + 0.9278 * k) * b,
    a,
  ];
};
const sepia = ([r, g, b, a]: Rgba, amount: number): Rgba => {
  const k = 1 - amount;
  return [
    (0.393 + 0.607 * k) * r + (0.769 - 0.769 * k) * g + (0.189 - 0.189 * k) * b,
    (0.349 - 0.349 * k) * r + (0.686 + 0.314 * k) * g + (0.168 - 0.168 * k) * b,
    (0.272 - 0.272 * k) * r + (0.534 - 0.534 * k) * g + (0.131 + 0.869 * k) * b,
    a,
  ];
};
const contrast = ([r, g, b, a]: Rgba, amount: number): Rgba => {
  const shift = 0.5 - 0.5 * amount;
  return [r * amount + shift, g * amount + shift, b * amount + shift, a];
};
const brightness = ([r, g, b, a]: Rgba, amount: number): Rgba => [r * amount, g * amount, b * amount, a];

export const tone = (color: Rgba): Rgba => {
  // Mindre sepia og mer kontrast enn det gamle filteret: med sepia 0.18 og kontrast 0.78 ble land, veier og
  // navn gulnet og grumsete som avispapir. Fargene er fortsatt nesten grå, så overprinten står fram.
  const toned = brightness(contrast(sepia(grayscale(color, 0.85), 0.05), 0.9), 1.03);
  return [clamp(toned[0]), clamp(toned[1]), clamp(toned[2]), color[3]];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
};

// Fargene stilene bruker: #rgb, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(). Alt annet (uttrykksord
// som "interpolate", navn, mønstre) sendes tilbake uendret.
export const parseColor = (text: string): Rgba | undefined => {
  const value = text.trim();
  const hex = value.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map(d => d + d).join('') : hex;
    if (digits.length !== 6 && digits.length !== 8) return undefined;
    const n = (i: number) => Number.parseInt(digits.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), digits.length === 8 ? n(6) : 1];
  }
  const fn = value.match(/^(rgba?|hsla?)\(\s*([^)]+)\)$/i);
  if (!fn) return undefined;
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean).map(part => (part.endsWith('%') ? { v: Number.parseFloat(part) / 100, pct: true } : { v: Number.parseFloat(part), pct: false }));
  if (parts.length < 3 || parts.some(part => Number.isNaN(part.v))) return undefined;
  const alpha = parts[3] ? clamp(parts[3].v) : 1;
  if (fn[1].toLowerCase().startsWith('rgb')) {
    const channel = (part: { v: number; pct: boolean }) => clamp(part.pct ? part.v : part.v / 255);
    return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
  }
  const [r, g, b] = hslToRgb(((parts[0].v % 360) + 360) % 360, clamp(parts[1].v), clamp(parts[2].v));
  return [r, g, b, alpha];
};

export const formatColor = ([r, g, b, a]: Rgba) => `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.round(a * 1000) / 1000})`;

export const toneColorText = (text: string) => {
  const parsed = parseColor(text);
  return parsed ? formatColor(tone(parsed)) : text;
};

const toneValue = (value: unknown): unknown => {
  if (typeof value === 'string') return toneColorText(value);
  if (Array.isArray(value)) return value.map(toneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, toneValue(inner)]));
  return value;
};

type ToneableStyle = { layers?: { paint?: Record<string, unknown> }[] };
// Alle fargeegenskapene i stilens lag (fill-color, line-color, text-color, text-halo-color, …), også inne i
// zoom-uttrykk og gamle stops-objekter
export const toneStyle = <T extends ToneableStyle>(style: T): T => {
  for (const layer of style.layers ?? []) {
    if (!layer.paint) continue;
    for (const [key, value] of Object.entries(layer.paint)) {
      if (key.endsWith('-color')) layer.paint[key] = toneValue(value);
    }
  }
  return style;
};

// Hav og land får palettens egne farger etter atlastonen (Fogg-paletten: midnattsblått blekk, vermilion,
// røykblått hav). Tonet ble havet en grumsete grå-beige nesten like lys som landet, og kartet så dødt ut;
// røykblått mot elfenben skiller hav og land som på et sjøkart og holder seg svakt nok til at prikkene står fram.
export const LAND = '#f6f0e3';
export const WATER = '#b7cbd2';
export const WATERWAY = '#a3bcc5';
export const WATER_LABEL = '#3f5a6e';
// Skog, park, boligområder og bygninger i varme toner fra landfargen. Positrons kalde grå (tonet) lå som
// utflytende flekker på elfenbenslandet, og kartet så uskarpt ut. Skog og park får et svakt grønt skjær.
const LAND_FILLS: Record<string, string> = {
  park: '#e6eadb',
  landcover_wood: '#e9e9d8',
  landuse_residential: '#f1eadb',
  building: '#ece4d3',
  road_area_pier: LAND,
};
// Veiene: hvite med varm kant i stedet for grå kant og grå småveier, som gjorde streken uklar mot elfenben
const ROAD_CASING = '#d8cebb';
const LAND_LINES: Record<string, string> = {
  road_pier: LAND,
  highway_minor: '#e5ddcc',
  highway_path: '#e9e2d3',
  highway_major_casing: ROAD_CASING,
  highway_motorway_casing: ROAD_CASING,
  highway_motorway_bridge_casing: ROAD_CASING,
  tunnel_motorway_casing: ROAD_CASING,
  railway: '#d6ccba',
  railway_transit: '#d6ccba',
  railway_service: '#d6ccba',
  // Dempet 8. november 2026, som i mørk modus: med 32 % og vår egen hårstrek oppå ble verdenskartet et nett av grenser
  boundary_2: 'rgba(27,42,65,0.2)',
  boundary_3: 'rgba(27,42,65,0.1)',
  boundary_disputed: 'rgba(27,42,65,0.1)',
};

type AtlasStyle = { layers?: { id?: string; type?: string; 'source-layer'?: string; paint?: Record<string, unknown> }[] };
export const paintAtlas = <T extends AtlasStyle>(style: T): T => {
  for (const layer of style.layers ?? []) {
    if (!layer.paint && layer.type !== 'background') continue;
    layer.paint ??= {};
    const source = layer['source-layer'];
    if (layer.type === 'background') layer.paint['background-color'] = LAND;
    else if (layer.type === 'fill' && layer.id && LAND_FILLS[layer.id]) {
      layer.paint['fill-color'] = LAND_FILLS[layer.id];
      if (layer.id === 'building') layer.paint['fill-outline-color'] = '#ddd3c0';
    }
    else if (layer.type === 'line' && layer.id && LAND_LINES[layer.id]) layer.paint['line-color'] = LAND_LINES[layer.id];
    else if (layer.type === 'fill' && source === 'water') layer.paint['fill-color'] = WATER;
    else if (layer.type === 'line' && source === 'waterway') layer.paint['line-color'] = WATERWAY;
    else if (layer.type === 'symbol' && (source === 'water_name' || source === 'waterway')) layer.paint['text-color'] = WATER_LABEL;
    else if (layer.type === 'symbol') {
      // Skarpe navn: Positron gir alle stedsnavn en uskarp hvit glød (text-halo-blur 1), så land- og bynavn
      // så utflytende ut. Nå en skarp glorie i landfargen og tekst i blekkfargen.
      layer.paint['text-halo-blur'] = 0;
      layer.paint['text-halo-color'] = 'rgba(246,240,227,0.92)';
      if (layer.id?.startsWith('label_country') || layer.id === 'label_city_capital') layer.paint['text-color'] = '#1b2a41';
      else if (source === 'place') layer.paint['text-color'] = '#2f3a4c';
      if (source === 'place' && !layer.paint['text-halo-width']) layer.paint['text-halo-width'] = 1.2;
    }
  }
  return style;
};

// Mørk modus: samme kart om natten. Positron er lyst i alle lag, så hver farge flyttes inn i en mørk skala
// etter hvor lys den var (lys vei over mørkere land, som før), og tekst snus til lys tekst. Lagene vi kjenner
// får egne farger som i paintAtlas: varmt mørkt land, kjølig mørkt hav, varme lyse navn.
export type NightPalette = {
  land: string; water: string; fills: Record<string, string>; casing: string; lines: Record<string, string>;
  low: string; high: string; buildingOutline: string; waterway: string; halo: string; waterHalo: string;
};
const nightLines = (land: string, casing: string, path: string, minor: string, major: string, motorway: string, railway: string) => ({
  road_pier: land,
  highway_path: path,
  highway_minor: minor,
  highway_major_inner: major,
  highway_motorway_inner: motorway,
  highway_motorway_bridge_inner: motorway,
  highway_major_casing: casing,
  highway_motorway_casing: casing,
  highway_motorway_bridge_casing: casing,
  tunnel_motorway_casing: casing,
  railway,
  railway_transit: railway,
  railway_service: railway,
  // Lyse streker på mørkt land leses mye sterkere enn mørke på elfenben: med 30 % ble verdenskartet et nett av
  // grenser. Flatene (land mot hav) skal bære kartet, grensene bare anes.
  boundary_2: 'rgba(239,230,212,0.13)',
  boundary_3: 'rgba(239,230,212,0.07)',
  boundary_disputed: 'rgba(239,230,212,0.07)',
});
const nightFills = (land: string, park: string, wood: string, residential: string, building: string, ice: string) => ({
  park, landcover_wood: wood, landuse_residential: residential, building, road_area_pier: land,
  // Isbreer og shelfis bare litt lysere enn landet; i den generelle skalaen lyste Grønland som en flekk
  landcover_glacier: ice, landcover_ice_shelf: ice,
});
// Varm brunsvart («espresso»), i slekt med elfenbenet i det lyse temaet; havet kjølig skifer så kysten skilles.
// Forkastet 7. november 2026: midnattsblått land og hav (så billig og standard ut) og nøytral grafitt.
export const NIGHT: NightPalette = {
  land: '#1d1a17', water: '#0c0e10', casing: '#151310', low: '#16130f', high: '#3f382e',
  fills: nightFills('#1d1a17', '#1e2019', '#1d2018', '#211e1a', '#26221d', '#23201c'),
  lines: nightLines('#1d1a17', '#151310', '#27231e', '#2b2621', '#332e28', '#3d372f', '#2e2924'),
  buildingOutline: '#2d2823', waterway: '#121618', halo: 'rgba(29,26,23,0.92)', waterHalo: 'rgba(12,14,16,0.8)',
};
export const NIGHT_LAND = NIGHT.land;

const mixRgb = (from: Rgba, to: Rgba, t: number): Rgba => {
  const k = clamp(t);
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k, 1];
};
const TEXT_LIGHT = parseColor('#e6dfd0')!;
const TEXT_DIM = parseColor('#6f7a88')!;
const luminance = ([r, g, b]: Rgba) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Positrons lyse skala (0,6–1) legges over den mørke; tekst (mørk i Positron) blir lys
export const nightColorText = (text: string, isText: boolean, night: NightPalette = NIGHT) => {
  const parsed = parseColor(text);
  if (!parsed) return text;
  const g = luminance(parsed);
  const out = isText ? mixRgb(TEXT_LIGHT, TEXT_DIM, g / 0.7) : mixRgb(parseColor(night.low)!, parseColor(night.high)!, (g - 0.6) / 0.4);
  return formatColor([out[0], out[1], out[2], parsed[3]]);
};

const nightValue = (value: unknown, isText: boolean, night: NightPalette): unknown => {
  if (typeof value === 'string') return nightColorText(value, isText, night);
  if (Array.isArray(value)) return value.map(inner => nightValue(inner, isText, night));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, inner]) => [key, nightValue(inner, isText, night)]));
  return value;
};

export const paintNight = <T extends AtlasStyle>(style: T, night: NightPalette = NIGHT): T => {
  for (const layer of style.layers ?? []) {
    if (!layer.paint && layer.type !== 'background') continue;
    layer.paint ??= {};
    const paint = layer.paint;
    const source = layer['source-layer'];
    for (const [key, value] of Object.entries(paint)) {
      if (key.endsWith('-color')) paint[key] = nightValue(value, key === 'text-color', night);
    }
    if (layer.type === 'background') paint['background-color'] = night.land;
    else if (layer.type === 'fill' && layer.id && night.fills[layer.id]) {
      paint['fill-color'] = night.fills[layer.id];
      if (layer.id === 'building') paint['fill-outline-color'] = night.buildingOutline;
    }
    else if (layer.type === 'line' && layer.id && night.lines[layer.id]) paint['line-color'] = night.lines[layer.id];
    else if (layer.type === 'fill' && source === 'water') paint['fill-color'] = night.water;
    else if (layer.type === 'line' && source === 'waterway') paint['line-color'] = night.waterway;
    else if (layer.type === 'symbol' && (source === 'water_name' || source === 'waterway')) {
      paint['text-color'] = '#7d97ab';
      paint['text-halo-color'] = night.waterHalo;
    }
    else if (layer.type === 'symbol') {
      paint['text-halo-blur'] = 0;
      paint['text-halo-color'] = night.halo;
      if (layer.id?.startsWith('label_country') || layer.id === 'label_city_capital') paint['text-color'] = '#efe6d4';
      else if (source === 'place') paint['text-color'] = '#c9c3b6';
      if (source === 'place' && !paint['text-halo-width']) paint['text-halo-width'] = 1.2;
    }
  }
  return style;
};
