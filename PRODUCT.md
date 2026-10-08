# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gamers aged roughly 30–60 who grew up with games from the late 1980s onward. They come to explore and reminisce: browse the world map, rediscover games they played, and discover games set in places and eras they care about. Used on both phone (casual, couch) and desktop (longer exploration sessions).

## Product Purpose

Game Traveller places video games on a world map by where their stories take place. Success is a visitor recognizing a favorite, following it to its locations, and stumbling onto other games set nearby or in the same era.

## Positioning

A geographic and historical lens on game history: games found by where and when they happen, not by store rank or genre lists.

## Operating Context

Single-page map app. Visitors pan/zoom the map, click markers or clusters to open a panel listing the games at that location, and narrow the map with a filter (free-text search on game or place, genre, release-year range, in-story year range including BC years).

## Capabilities and Constraints

- Data is a static list in `src/gameData.ts` (206 games on 264 places as of 2026-10-08): name, genre, release year, publisher, developer, locations with coordinates, story years. Optional `screenshotUrl` exists in the type but is not populated.
- Cover art comes from IGDB via `scripts/fetch-covers.mjs` (optional `coverUrl` per game, credited in the panel). No screenshots; do not fabricate images.
- Stack: React 19, Vite 8, Tailwind 4 (no component library), lucide-react icons, Archivo Variable (self-hosted), Leaflet via react-leaflet 5 with marker clustering.
- Map tiles: OpenFreeMap vector tiles (free, no API key, no traffic limit) rendered through MapLibre inside Leaflet, with English labels. OpenStreetMap raster tiles are only a fallback if the style fails to load.
- UI copy is English (international audience). Each location may carry a one-line `note` on why the place matters in the game, and each game a `source` URL it was verified against.

## Brand Commitments

Name: "Game Traveller". Favicon and Open Graph image live in `public/` (marker-and-route mark on ink black).

## Evidence on Hand

Only the game dataset, verified against English Wikipedia (see `source` per game). No user numbers, testimonials, or press.

## Product Principles

- The map is the product; chrome stays out of its way.
- Recognition first: game names must be instantly scannable for someone looking for an old favorite.
- Time is as important as place: era and release year are first-class, not footnotes.
- Works one-handed on a phone as well as with a mouse.

## Accessibility & Inclusion

Audience up to ~60: generous text sizes, strong contrast, and large touch targets matter more than density.
