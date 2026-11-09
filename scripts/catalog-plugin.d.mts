import type { Plugin } from 'vite';

// Typer for vite.config.ts (prosjektet har ikke Node-typene, så pluginen er ren JS)
export function catalog(options?: { dataDir?: string }): Plugin;
