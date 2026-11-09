type Position = [number, number];

// Kartet tegner verden tre ganger side om side, så et utsnitt kan gå over datolinjen. Japan og Hawaii
// (Persona 5) ble rammet inn den lange veien rundt jorda, over Europa og Amerika, med Japan i kanten.
// Her flyttes punktene vest for det største tomrommet én verden østover når det gir et smalere spenn.
export function shortestLongitudeSpan(positions: Position[]): Position[] {
  if (positions.length < 2) return positions;
  const lngs = [...new Set(positions.map(p => p[1]))].sort((a, b) => a - b);
  if (lngs.length < 2) return positions;
  let gap = 360 - (lngs[lngs.length - 1] - lngs[0]);
  let cut: number | undefined;
  for (let i = 0; i < lngs.length - 1; i++) {
    const inner = lngs[i + 1] - lngs[i];
    if (inner > gap) { gap = inner; cut = lngs[i]; }
  }
  if (cut === undefined) return positions;
  // Bare når det virkelig går over datolinjen: steder spredt over hele verden (New York, London, Tokyo,
  // Sydney) blir et par grader smalere over Stillehavet, men leses best med Atlanteren i midten som før
  const before = lngs[lngs.length - 1] - lngs[0];
  const after = 360 - gap;
  if (after >= 180 || before - after < 20) return positions;
  const edge = cut;
  return positions.map(([lat, lng]) => (lng <= edge ? [lat, lng + 360] : [lat, lng]));
}
