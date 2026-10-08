# Game Traveller

A world map of the real places video games are set in. Browse by city, country and era, open a game to see its journey drawn across the map, and share any place or game as a link.

Built with React 19, Vite, Tailwind 4, Leaflet (marker clustering) and MapLibre vector tiles from [OpenFreeMap](https://openfreemap.org).

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check, bundle, then prerender a page per place and game into dist/
npm run preview  # serve the production build
npm run lint
npm test         # search regressions (Node.js 22.18+)
```

Copy `.env` values before building for production:

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Public URL without trailing slash. Used for canonical links, Open Graph tags and `sitemap.xml`. |
| `VITE_CONTRIBUTE_URL` | Where "Suggest a game" links (a GitHub issue template, a form, …). Hidden when empty. |

## Deploy

The build is static. Upload `dist/` to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel, S3). Every place and game has its own folder (`dist/place/<slug>/index.html`, `dist/game/<slug>/index.html`), so links work without server rewrites. If your host supports it, also add a fallback from unknown paths to `/index.html`.

## Data

All games live in [`src/data/games.json`](src/data/games.json):

```json
{
  "id": 3,
  "name": "Broken Sword: The Shadow of the Templars",
  "genre": "Adventure",
  "year": 1996,
  "publisher": "Virgin Interactive",
  "developer": "Revolution Software",
  "source": "https://en.wikipedia.org/wiki/Broken_Sword:_The_Shadow_of_the_Templars",
  "coverUrl": "https://images.igdb.com/igdb/image/upload/t_cover_big/....jpg",
  "locations": [
    { "name": "Paris, France", "position": [48.8566, 2.3522], "note": "Opens with a café bombing that pulls George Stobbart into a Templar conspiracy." }
  ],
  "storyYears": [1996]
}
```

- `position` is `[latitude, longitude]`. Places with the same coordinates are merged into one marker, so reuse coordinates for the same city.
- `storyYears` are the years the story is set in; negative numbers are BC. Leave it empty when the game has no stated year.
- `note` is one sentence on why the place matters in the game. It shows in the panel and on the prerendered pages.
- `source` is the page the entry was checked against, such as a developer or publisher page, an official store description, or English Wikipedia.
- Games and individual locations can have optional `aliases` arrays. Put fictional city names on the relevant game's location, not on every game in the real city.
- `coverUrl` is optional. Fetch covers from IGDB with `npm run covers` (needs `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from the [Twitch developer console](https://dev.twitch.tv/console/apps)). Covers are hotlinked and credited in the panel.

Only add games where the real place is recognisable in the game, not just mentioned.

## Search

Fuse.js runs locally in the browser with a reusable index. Search covers titles, aliases, places, location notes and genres, with titles and places weighted highest. Exact title matches come first; exact known aliases (such as GTA, Liberty City or Norge) stay within their intended entries. Matching ignores accents and punctuation variants and tolerates modest spelling errors. All query words must match, so `racing Tokyo` narrows across fields. Genre, release-year and story-year filters apply afterward and preserve relevance order.

Map focus and highlights use the matched locations, including fuzzy place matches and fictional names. Searching for a game title shows its full set of locations. Search URLs use the same matching and map-focus logic as typed searches.

## Sharing and SEO

The URL always reflects what is on screen: `/place/paris-france`, `/game/broken-sword-the-shadow-of-the-templars`, `?q=tokyo`, `?set=1900..1999`. `scripts/prerender.mjs` writes those pages as static HTML with titles, descriptions and Open Graph tags, plus `sitemap.xml` and `robots.txt`.

The Open Graph image and icons in `public/` are rendered from `scripts/og-card.html`. To regenerate them, copy the file into `public/`, run `npm run dev`, screenshot `#card` (1200×630) and the `#i32`/`#i180`/`#i192`/`#i512` images, then remove the copy.

## Keyboard

`/` focuses search, `Enter`/`Space` opens a marker or cluster, `Esc` closes the filter and then the panel.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, tiles by [OpenFreeMap](https://openfreemap.org) and [OpenMapTiles](https://www.openmaptiles.org/). Cover art from [IGDB](https://www.igdb.com) when fetched. Type: Archivo.
