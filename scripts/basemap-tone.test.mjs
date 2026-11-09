import test from 'node:test';
import assert from 'node:assert/strict';
import { paintNight, parseColor, toneColorText, toneStyle } from '../src/basemapTone.ts';

const rounded = color => color.map(v => Math.round(v * 100) / 100);

test('parses the colour forms the basemap styles use', () => {
  assert.deepEqual(parseColor('#fff'), [1, 1, 1, 1]);
  assert.deepEqual(rounded(parseColor('#ff000080')), [1, 0, 0, 0.5]);
  assert.deepEqual(parseColor('rgb(255, 0, 0)'), [1, 0, 0, 1]);
  assert.deepEqual(parseColor('rgba(255,255,255,0.7)'), [1, 1, 1, 0.7]);
  assert.deepEqual(rounded(parseColor('hsl(0,0%,50%)')), [0.5, 0.5, 0.5, 1]);
  assert.equal(parseColor('interpolate'), undefined);
  assert.equal(parseColor('zoom'), undefined);
});

test('tones colours the way the old canvas filter did, and leaves expression words alone', () => {
  // Rødt blir nesten grått: 85 % gråtone, så litt sepia (0.05 siden november 2026, derfor litt mindre grått enn før)
  const red = parseColor(toneColorText('#ff0000'));
  assert.ok(Math.abs(red[0] - red[1]) < 0.15 && Math.abs(red[1] - red[2]) < 0.15, `red should be near grey, got ${red}`);
  // Hvitt blir et svakt varmt lys, ikke mørkere enn 0.85
  const white = parseColor(toneColorText('#ffffff'));
  assert.ok(white[0] >= 0.9 && white[2] >= 0.85, `white should stay light, got ${white}`);
  assert.equal(toneColorText('interpolate'), 'interpolate');
  const style = toneStyle({ layers: [{ paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 5, '#ff0000', 10, 'rgb(0,0,255)'], 'fill-opacity': 0.5 } }] });
  const value = style.layers[0].paint['fill-color'];
  assert.equal(value[0], 'interpolate');
  assert.ok(String(value[4]).startsWith('rgba('));
  assert.equal(style.layers[0].paint['fill-opacity'], 0.5);
});

test('the night map leaves no light fill or line behind, and turns dark text light', () => {
  // Et utsnitt av Positron med de lyseste fargene: hvite veier, nesten hvitt land, isbre, svart tekst
  const style = paintNight({ layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
    { id: 'landcover_glacier', type: 'fill', 'source-layer': 'landcover', paint: { 'fill-color': 'hsl(0,0%,98%)' } },
    { id: 'aeroway-runway', type: 'line', 'source-layer': 'aeroway', paint: { 'line-color': 'rgba(255, 255, 255, 1)' } },
    { id: 'highway_motorway_subtle', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5.8, 'hsla(0,0%,85%,0.53)', 6, '#fff'] } },
    { id: 'label_city', type: 'symbol', 'source-layer': 'place', paint: { 'text-color': '#000', 'text-halo-color': '#fff' } },
    { id: 'highway-name-minor', type: 'symbol', 'source-layer': 'transportation_name', paint: { 'text-color': '#666', 'text-halo-color': '#f8f4f0' } },
  ] });
  const lum = text => { const [r, g, b] = parseColor(text); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const colours = value => typeof value === 'string' ? (parseColor(value) ? [value] : []) : Array.isArray(value) ? value.flatMap(colours) : [];
  let checked = 0;
  for (const layer of style.layers) {
    for (const [key, value] of Object.entries(layer.paint)) {
      if (!key.endsWith('-color')) continue;
      for (const c of colours(value)) {
        checked++;
        if (key === 'text-color') assert.ok(lum(c) > 0.3, `${layer.id} ${key} ${c} should be light`);
        else assert.ok(lum(c) < 0.3, `${layer.id} ${key} ${c} should be dark`);
      }
    }
  }
  assert.ok(checked >= 9, `checked ${checked} colours`);
});
