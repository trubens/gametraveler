import React from "react";
import { formatYear } from "./format";

// Knekkpunkter [år, posisjon 0–1] for en ikke-lineær skala
export type Scale = [number, number][];

interface DoubleRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  disabled?: boolean;
  label: string;
  scale?: Scale;
}

const STEPS = 1000;

const interpolate = (x: number, from: number[], to: number[]) => {
  for (let i = 1; i < from.length; i++) {
    if (x <= from[i] || i === from.length - 1) {
      const t = from[i] === from[i - 1] ? 0 : (x - from[i - 1]) / (from[i] - from[i - 1]);
      return to[i - 1] + Math.min(Math.max(t, 0), 1) * (to[i] - to[i - 1]);
    }
  }
  return to[0];
};

export const DoubleRangeSlider = ({ min, max, value, onChange, disabled = false, label, scale }: DoubleRangeSliderProps) => {
  // Kun knekkpunkter innenfor spennet brukes, med endene lagt til
  const points: Scale = [[min, 0], ...(scale ?? []).filter(([y]) => y > min && y < max), [max, 1]];
  const yearsAt = points.map(p => p[0]);
  const posAt = points.map(p => p[1] * STEPS);
  const toPos = (year: number) => Math.round(interpolate(year, yearsAt, posAt));
  const toYear = (pos: number) => Math.round(interpolate(pos, posAt, yearsAt));

  // Et tastetrykk skal alltid flytte minst ett år, også der skalaen er strukket ut
  const stepYear = (pos: number, current: number) => {
    const year = toYear(pos);
    const dir = Math.sign(pos - toPos(current));
    return year === current && dir !== 0 ? Math.min(Math.max(current + dir, min), max) : year;
  };

  // Håndtakene kan ikke krysse hverandre
  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange([Math.min(stepYear(Number(e.target.value), value[0]), value[1]), value[1]]);
  };
  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange([value[0], Math.max(stepYear(Number(e.target.value), value[1]), value[0])]);
  };
  const left = (toPos(value[0]) / STEPS) * 100;
  const right = 100 - (toPos(value[1]) / STEPS) * 100;

  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
        <span className="text-ink">{label}</span>
        <span className="numerals text-ink-soft">
          {formatYear(value[0])} – {formatYear(value[1])}
        </span>
      </legend>
      <div className="relative h-11">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-rule" />
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 bg-magenta"
          style={{ left: `${left}%`, right: `${right}%` }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={toPos(value[0])}
          onChange={handleMinChange}
          aria-label={`${label} fra`}
          aria-valuetext={formatYear(value[0])}
          className="gt-range absolute inset-0 h-full w-full"
          // Når håndtakene står helt til høyre må min-håndtaket ligge øverst for å kunne dras tilbake
          style={{ zIndex: toPos(value[0]) >= STEPS * 0.98 ? 3 : 2 }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={toPos(value[1])}
          onChange={handleMaxChange}
          aria-label={`${label} til`}
          aria-valuetext={formatYear(value[1])}
          className="gt-range absolute inset-0 h-full w-full"
          style={{ zIndex: 2 }}
        />
      </div>
    </fieldset>
  );
}
