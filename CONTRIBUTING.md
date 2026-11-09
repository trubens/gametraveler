# Contributing

Thanks for helping improve Game Traveler. Small, focused pull requests are easiest to review.

## Adding or correcting a game

1. Add or edit one file in `src/data/games/`; choose the next unused numeric game ID and pad the filename to seven digits. Never renumber or reuse an existing game ID.
2. Include a source URL for the game and use location-level `source` when the place or coordinates need separate support.
3. Include only places the player actually visits or explores. A place mentioned in dialogue alone is not enough.
4. Search `src/data/places/` for a matching canonical place before creating one. Reuse its `placeId` instead of duplicating its name or coordinates.
5. For a new place, use a readable lowercase key based on its name and context, such as `paris-france`, for both the `id` and filename. Keep that key stable after creation. Set `scale` to `area` or `site`; include `parentId` when the containing place is already in the catalog. Store coordinates as named fields, for example `{ "lat": 48.8566, "lon": 2.3522 }`, and cite the place record with `source`. Area coordinates are representative map anchors; site coordinates point to a venue or landmark.
6. A place inside a city (a park, a castle, a square) is a `site` record with `parentId` set to the city, neighbourhood, region or island it lies in. The app rolls the game up to that parent (the city lists it with an "At …" chip per site) and shows the site itself on the map only from zoom 12, as a diamond. List the city itself as a location only when the game also plays out across the city; a game set wholly in one spot (A Date in the Park) lists only the spot, and the city still shows it through the roll-up, so the map marks just the spot when the game is open.
7. Use `positionOverride` only when a game-specific location is more than 1 km from the canonical point. Include a location note explaining the difference; add a location-level source when the game source does not support the specific venue or coordinates.
8. Add `fictional: true` to the game-place relationship when the in-game setting is invented or intentionally fictionalized. Use `note` to explain its relation to real geography when that is not obvious.
9. Use one or more exact labels from `src/data/genre.schema.json`; add a new canonical label there if needed. Keep labels as separate array values, not a comma- or slash-separated string.
10. Renaming a place changes its page address (`/place/<slug>` comes from the name). Add the old slug to `src/data/redirects.json` so the old address redirects to the new one.
11. A place may carry a `description`: one or two sentences on what it is. `npm run enrich-place-descriptions` fills missing ones from the Wikipedia summary (shown with a Wikipedia credit); write your own when the summary is wrong or when the place has no article. After adding places, run `npm run enrich-place-wikipedia` to look up a Wikipedia article for each new place (set `wikipediaUrl` yourself when the lookup picks the wrong page or finds none; the app shows no link otherwise, never a search). After adding or moving places, run `npm run build:countries`. It records which country each place lies in (`src/data/generated/place-countries.json`), refreshes the border files under `public/data/`, and creates a country record under `src/data/places/` for any country that now has games but no record. Commit what it writes.
12. Run `npm run validate:data`, `npm test`, `npm run lint`, and `npm run build`.

If another pull request adds the same place key while yours is open, reuse that record or coordinate with the author before merging. Keep each contribution focused so game edits do not conflict with unrelated catalog records.

Please keep prose in your own words, link sources rather than copying their descriptions, and do not add cover art or other third-party media unless its license allows redistribution.

## Project checks

Pull requests run the data validator, tests, linter, and production build in GitHub Actions. The data validator checks canonical place references and reports game-specific coordinate overrides for review; a broad region may intentionally use a different representative point, but the reason should be documented.

## Repository layout

- `src/data/games/`: one JSON file per game, referencing canonical places.
- `src/data/places/`: one shared JSON file per place, named by its stable readable key and containing its scale, optional parent, canonical map point and name variants.
- `src/`: application, search and map components.
- `scripts/lib/`: shared Node helpers used by catalog scripts.
- `scripts/`: prerendering, data maintenance and validation tools.
