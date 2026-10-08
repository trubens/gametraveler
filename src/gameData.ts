// Spilldataene ligger i src/data/games.json slik at skript (verifisering, covers, forhåndsrendring) kan lese og skrive dem direkte
import data from './data/games.json';

export type Location = {
  name: string;
  // Alternative navn, inkludert stedets navn i spillet.
  aliases?: string[];
  position: [number, number];
  // Én setning om hvorfor stedet er med i spillet
  note?: string;
};

export type Game = {
  id: number;
  name: string;
  aliases?: string[];
  genre: string;
  year: number;
  publisher: string;
  developer: string;
  // Settes av scripts/fetch-covers.mjs
  coverUrl?: string;
  // Kilden dataene er sjekket mot
  source?: string;
  locations: Location[];
  storyYears: number[];
};

export const games: Game[] = data as unknown as Game[];
