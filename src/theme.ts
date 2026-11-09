import { useSyncExternalStore } from 'react';

// Temaet følger systemet, eller leserens valg under Appearance i «…»-menyen. Skriptet i index.html setter
// data-theme før siden tegnes; herfra byttes det mens siden er åpen, uten omlasting. Fargene som må være ekte
// verdier (SVG-attributter, Leaflet-linjer og vektorkartet, der var() ikke virker) leses med getPalette() når de
// brukes, og komponentene som tegner dem lytter med useIsDark() og maler på nytt når temaet skifter.

// Samme verdier som --color-* i index.css
const LIGHT = { ink: '#1b2a41', accent: '#c0432a', fictional: '#23787a', imaginary: '#6b5b95', ochre: '#93661a', dimmed: '#9aa0aa' };
const DARK = { ink: '#efe6d4', accent: '#d8735a', fictional: '#3a9fa1', imaginary: '#9686cf', ochre: '#d19a3a', dimmed: '#6b645a' };
const THEME_COLOR = { light: '#fdfaf2', dark: '#221f1b' };

let dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';
const listeners = new Set<() => void>();

export const getIsDark = () => dark;
export const getPalette = () => (dark ? DARK : LIGHT);
export const subscribeTheme = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useIsDark = () => useSyncExternalStore(subscribeTheme, getIsDark, getIsDark);

const applyTheme = (next: boolean) => {
  if (next === dark) return;
  dark = next;
  const root = document.documentElement;
  if (next) root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', next ? THEME_COLOR.dark : THEME_COLOR.light);
  listeners.forEach(listener => listener());
};

export type ThemeChoice = 'system' | 'light' | 'dark';
export const readThemeChoice = (): ThemeChoice => {
  try {
    const stored = localStorage.getItem('gt-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
};

const systemQuery = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined;

// Lagrer valget og bytter temaet med en gang
export const saveThemeChoice = (choice: ThemeChoice) => {
  try {
    if (choice === 'system') localStorage.removeItem('gt-theme');
    else localStorage.setItem('gt-theme', choice);
  } catch {
    // Uten lagring gjelder valget bare denne visningen
  }
  applyTheme(choice === 'dark' || (choice === 'system' && !!systemQuery?.matches));
};

// Følger systemet mens siden er åpen (mørk modus om kvelden), så lenge leseren ikke har valgt selv
systemQuery?.addEventListener?.('change', event => {
  if (readThemeChoice() === 'system') applyTheme(event.matches);
});
