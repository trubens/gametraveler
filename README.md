# Game Traveler

A world map of the real places video games are set in. Browse by city, country and era, open a game to see its journey drawn across the map, and share any place or game as a link.

Use the **More** menu to toggle the welcome panel. **Reset all** returns to the unfiltered map with the welcome card; **Hide welcome** hides it and remembers your choice. The menu also opens project details and credits.

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

Set these build-time environment variables when building the deployed site. Local development and previews show an ad placeholder and never request AdSense:

| Variable | Purpose |
| --- | --- |
| `VITE_SITE_URL` | Public URL without trailing slash. Used for canonical links, Open Graph tags and `sitemap.xml`. |
| `VITE_CONTRIBUTE_URL` | Where "Suggest a game" links (a GitHub issue template, a form, …). Hidden when empty. |
| `VITE_ADSENSE_CLIENT_ID` | Optional Google AdSense publisher ID (`ca-pub-…`). |
| `VITE_ADSENSE_DETAIL_SLOT_ID` | Optional numeric AdSense display-unit ID. The labeled ad slot appears in game/place details only when both AdSense values are set. |

The AdSense unit stays out of the map and welcome view. Before enabling it for visitors in the EEA, UK, or Switzerland, configure Google's required certified consent messaging for the site in AdSense; the analytics preference is separate and does not grant advertising consent.

The supplied publisher and slot IDs are stored in the ignored `.env.production.local` for local production builds. Ad requests are disabled on localhost and private network hosts, so local previews keep showing the placeholder. If production builds run on a hosting service, set both AdSense variables in that service's build environment instead.

## Deploy

The build is static. Upload `dist/` to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel, S3). Every place and game has its own folder (`dist/place/<slug>/index.html`, `dist/game/<slug>/index.html`), so links work without server rewrites. If your host supports it, also add a fallback from unknown paths to `/index.html`.

For FTP, FTPS or SFTP hosting, run `npm run deploy:ftp:setup` to enter the host, port, username, password, protocol and remote directory. The setup stores them in the Git-ignored `.ftp-deploy.local` file. The first SFTP upload asks you to confirm the server's host-key fingerprint and saves it for later checks. Then run `npm run deploy:ftp` to publish the existing `dist/` folder; build first with `npm run build`. On its first run, SFTP reuses existing Vite content-hashed assets and uploads the remaining files to initialize a hidden deployment manifest. Later it compares SHA-256 checksums with that manifest and uploads only new or changed files, with HTML published after assets. It removes only obsolete files listed in its own previous manifest and leaves unmanaged remote files alone. FTP/FTPS uploads every file and does not remove remote files. On One.com, point `remoteDir` inside the domain's public `webroots/...` folder; the SFTP home is private.

## Data

Game records live in [`src/data/games/`](src/data/games/), one JSON file per game. Canonical places live separately in [`src/data/places/`](src/data/places/), one file per place. Games refer to places by readable stable key, so a correction to a shared city or landmark updates every game consistently. Game filenames use seven-digit numeric IDs; place filenames use readable keys such as `paris-france`. This layout keeps most pull requests scoped to the individual game or place being changed. See the [game schema](src/data/game.schema.json), [place schema](src/data/place.schema.json), and [data guidance](src/data/SCHEMA.md).

A record looks like this:

```json
{
  "id": 3,
  "name": "Broken Sword: The Shadow of the Templars",
  "genres": ["Adventure"],
  "year": 1996,
  "publisher": "Virgin Interactive",
  "publisherUrl": "https://en.wikipedia.org/wiki/Virgin_Interactive",
  "developer": "Revolution Software",
  "developerUrl": "https://en.wikipedia.org/wiki/Revolution_Software",
  "source": "https://en.wikipedia.org/wiki/Broken_Sword:_The_Shadow_of_the_Templars",
  "coverUrl": "https://images.igdb.com/igdb/image/upload/t_cover_big/....jpg",
  "locations": [
    { "placeId": "paris-france", "note": "Opens with a café bombing that pulls George Stobbart into a Templar conspiracy." }
  ],
  "storyYears": [1996]
}
```

- Each `placeId` points to a canonical place record containing its name, aliases, geographic `scale`, optional parent, and named `position` fields: `{ "lat": 48.8566, "lon": 2.3522 }`. An `area` point is representative; a `site` point marks a venue or landmark. Search `src/data/places/` before adding a place.
- A `positionOverride` can locate a game-specific venue more than 1 km from its canonical point; explain the exception in `note` and add a location-level `source` when the game source does not support it.
- `id` is a unique numeric game record ID; name the file with that ID padded to seven digits, such as `0000003.json`.
- Set `fictional: true` on the game-place relationship when the in-game place is invented or deliberately fictionalized. A `note` should explain its relation to real geography.
- `storyYears` are the years the story is set in; negative numbers are BC. Leave it empty when the game has no stated year.
- `note` is one sentence on why the place matters in the game. It shows in the panel and on the prerendered pages.
- Use `routes` for verified journeys with stable IDs, names, optional characters and years, and ordered `stops` referencing the game's places. Routes can share stops and revisit places. Each route is drawn separately; the game panel lets visitors choose all routes or one, and `?route=<id>` preserves the selection in shared game links. See [the route format](src/data/SCHEMA.md#character-routes). Legacy `route: true` still follows the location list; do not combine it with `routes` or infer journeys from an unordered place list.
- `source` is the page the entry was checked against, such as a developer or publisher page, an official store description, or English Wikipedia.
- `genres` is a non-empty array of labels from [`src/data/genre.schema.json`](src/data/genre.schema.json). A game can have multiple labels; keep each label separate instead of joining them with commas or slashes.
- `developerUrl` and `publisherUrl` are optional Wikipedia links to the company pages when they are known; the app shows them next to the developer and publisher names.
- Games and game-place relationships can have optional `aliases` arrays. Put fictional city names on the relevant relationship, not on every game in the real city.
- `coverUrl` is optional. Fetch covers from IGDB with `npm run covers` (needs `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from the [Twitch developer console](https://dev.twitch.tv/console/apps)). Covers are hotlinked and credited in the panel.

Run `npm run validate:data` before opening a pull request. It checks required fields, stable IDs, references, source URLs, and coordinate bounds. Only add places the player visits or explores, not places that are only mentioned.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the review process and source expectations.

## Search

Fuse.js runs locally in the browser with a reusable index. Search covers titles, aliases, places, location notes and genres, with titles and places weighted highest. Exact title matches come first; exact known aliases (such as GTA, Liberty City or Norge) stay within their intended entries. Matching ignores accents and punctuation variants and tolerates modest spelling errors. All query words must match, so `racing Tokyo` narrows across fields. Genre, release-year and story-year filters apply afterward and preserve relevance order.

Map focus and highlights use the matched locations, including fuzzy place matches and fictional names. Searching for a game title shows its full set of locations. Search URLs use the same matching and map-focus logic as typed searches.

## Sharing and SEO

The URL always reflects what is on screen: `/place/paris-france`, `/game/broken-sword-the-shadow-of-the-templars`, `?q=tokyo`, `?set=1900..1999`. `scripts/prerender.mjs` writes those pages as static HTML with titles, descriptions and Open Graph tags, plus `sitemap.xml` and `robots.txt`.

## Checks and contributions

Pull requests run the data validator, tests, lint, and production build through GitHub Actions. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add or correct a game. Keep `.env` private; use `.env.example` as the safe starting point.

The Open Graph image and icons in `public/` are rendered from `scripts/og-card.html`. To regenerate them, copy the file into `public/`, run `npm run dev`, screenshot `#card` (1200×630) and the `#i32`/`#i180`/`#i192`/`#i512` images, then remove the copy.

## Keyboard

`/` focuses search, `Enter`/`Space` opens a marker or cluster, `Esc` closes the filter and then the panel.

## Credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, tiles by [OpenFreeMap](https://openfreemap.org) and [OpenMapTiles](https://www.openmaptiles.org/). Cover art from [IGDB](https://www.igdb.com) when fetched. Type: Archivo.
