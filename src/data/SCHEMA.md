# Game data format

Game records live in `src/data/games/<id>.json`, one record per file. `id` is a unique positive integer and the filename is the same ID padded to seven digits, for example `0012345.json`. Places are shared records in `src/data/places/<place-key>.json`; each has a readable, stable key such as `paris-france`.

Every game needs a title, release year, one or more genre labels, developer, publisher, at least one location, story-year array, and a `source` URL. The source should support the game's setting and release details. Add a location-level `source` when a different source supports that particular place or its coordinates. Store genres as separate strings in the `genres` array; do not combine them into a comma- or slash-separated label. Canonical labels live in `src/data/genre.schema.json`.

Every game location references a canonical place with `placeId`, using its readable key (for example, `paris-france`). Names, aliases, scale, place type, parent and shared map point live in the place record, so one correction updates every game that uses it. Keep a place's key and filename stable after creation, even if its display name changes. `placeType` describes the geographic entity: `country`, `city`, `region`, `neighborhood` (including districts and boroughs), `island`, `natural_feature`, `body_of_water`, `landmark`, `venue`, or the broader `area` when a more specific type is not supported. It is separate from `settingType`, which describes how a game treats the place. Coordinates use named decimal-degree fields: `position: { "lat": 48.8566, "lon": 2.3522 }`. `lat` is latitude and `lon` is longitude. Set `scale` to `area` for a point representing a wider extent. Use `site` for a specific venue or landmark. A `parentId` may point to the closest larger place in the catalog; leave it out when no matching parent is known. Parent links must form an acyclic hierarchy. An area's coordinate is representative, not its boundary or an exact game scene. A site's coordinate points to the venue, not necessarily the precise playable spot inside it.

A game location may use `positionOverride` only for a game-specific point more than 1 km from the canonical point. Explain why in `note` and provide a location-level `source` that supports the refined map pin; the game-level `source` should also support the setting. `settingType` belongs on the game-place relationship because a real place can be fictionalized in one game and literal in another. Use `real` for real locations (or omit it), `fictionalized` for invented locations anchored to a recognizable real-world geography, and `imaginary` for wholly invented or mythical places such as Atlantis. Do not classify a place as fictional just because an otherwise real city contains a fictional building or character.

Place records may include `wikipediaUrl` and `wikidataId` as optional, curated references. Use a direct Wikipedia article URL only after checking that it describes the same real-world place; do not guess article URLs or assign a real-world entity ID to a fictionalized place. Wikidata IDs use the `Q…` form and are stable cross-language identifiers. These fields support discovery and verification; our curated place record remains authoritative for Game Traveler's map point, scale, and parent relationship. Wikipedia text is not copied into this dataset.

Run `npm run validate:data` before submitting data changes. The validator checks required fields, IDs, file names, place references, URLs, and coordinate ranges. It reports any game-specific coordinate overrides for review.

## Character routes

Keep `locations` as the complete set of places in a game. Add `routes` for independently verified journeys; never connect two characters merely because their scenes alternate. Each route has a stable `id`, a display `name`, and ordered `stops` referencing `placeId` values in this game's locations. Repeating a stop records a return visit. A referenced place must occur exactly once in `locations` so overrides resolve unambiguously.

Optional `characters` lists one or more travelers (a shared journey can list both George and Nico); `storyYears` describes that route's time period. Use `note` to explain partial journeys, approximations or story context, and `source` to support the sequence (otherwise the game's source applies). Routes need at least two distinct places. A character with only one known place stays in the ordinary place list until a journey can be documented.

```json
{
  "id": "shared-return",
  "name": "The return journey",
  "characters": ["Character A", "Character B"],
  "storyYears": [1997],
  "stops": ["paris-france", "london-uk", "paris-france"]
}
```

This example illustrates the format, not a claim about a game's story. Existing `route: true` entries retain their original single journey; do not combine `route` and `routes`. New entries should use `routes`. The map draws each route independently, with matching named controls and different line styles. Game links can select one route with `?route=<id>`; omitting it shows all routes and all game locations.
