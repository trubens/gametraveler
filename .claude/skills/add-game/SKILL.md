---
name: add-game
description: Add a video game to the Game Traveler atlas, or review the games already there, with the real places the player visits, places of interest inside cities, routes in story order, series membership and notes that say what happens at each place. Use this whenever the user names a game or a series to add or check ("kan du legge inn X", "gå gjennom Y-spillene", "hva med Z", "er dette riktig for …", a Wikipedia or MobyGames link to a game), asks whether a game's places, pins, spots or route are correct, or asks for places of interest in a game. It researches the sources, writes the JSON records, has an independent subagent with no context double-check the result, then validates, deploys and checks the live site.
---

# Add or review a game in Game Traveler

Game Traveler is a map of the real places video games are set in. Readers come for two things: what game happened here, and where did this game take me. Every record serves those two questions, so a place is only worth adding if the player actually experiences it, and every note says what happens there.

The user writes Norwegian and reads the final report in Norwegian. The data is English.

## The data

All records are JSON files, one per record, two spaces indented, UTF-8, `\n` line endings.

- `src/data/games/NNNNNNN.json`: one game. File name is the zero-padded id; new ids come from `catalog.py nextid` (1000xxx range).
- `src/data/places/<id>.json`: one place. The id is a slug of the name, for example `kutna-hora-czech-republic`.
- `src/data/redirects.json`: when a place record is retired or merged, map its old id to the new one under `place`, so old addresses keep working.
- Schemas: `src/data/game.schema.json`, `src/data/place.schema.json`, `src/data/genre.schema.json` (the allowed genres; "Racing" and "Sports" games are hidden by default as venue games).

A game:

```json
{
  "id": 1000341, "name": "Far Cry 5", "year": 2018,
  "series": "Far Cry",
  "aliases": ["FC5"],
  "developer": "Ubisoft Montreal", "publisher": "Ubisoft",
  "genres": ["First-Person Shooter"],
  "storyYears": [2018],
  "source": "https://en.wikipedia.org/wiki/Far_Cry_5",
  "locations": [
    { "placeId": "hope-county-fictional-montana-usa", "settingType": "fictionalized",
      "note": "A junior deputy is caught when the arrest of cult leader Joseph Seed goes wrong, and fights Eden's Gate across Hope County." }
  ],
  "routes": [
    { "id": "jason", "name": "Jason Brody", "characters": ["Jason Brody"],
      "stops": ["bangkok-thailand", "rook-islands-fictional"], "note": "From the Bangkok holiday to the islands.",
      "source": "https://en.wikipedia.org/wiki/Far_Cry_3" }
  ]
}
```

- `storyYears`: the years the story is set in; negative for BC. Empty if the game gives none.
- `series`: set it whenever the game belongs to a series in the catalogue (`catalog.py series <name>`), with the exact series name already used. Two games are enough. The series page, the search suggestion and the "Part of the … series" line all come from this field.
- `aliases`: other titles the game is known by (Circle of Blood for Broken Sword).
- `settingType` on a location: `real` (the default, leave it out), `fictionalized` (a real place reshaped, or an invented place pinned at its basis), `imaginary` (pure invention like Atlantis).
- `routes`: the journey in story order. Stops are placeIds from this game's own `locations`; a stop may repeat for a return visit. A route needs two stops or more. Never use the legacy `"route": true` together with `routes`; delete it. The route `source` stays in the data as documentation and is not shown on the page.

A place:

```json
{ "id": "tiwanaku-bolivia", "name": "Tiwanaku, Bolivia", "position": { "lat": -16.5546, "lon": -68.6735 },
  "scale": "area", "parentId": "bolivia", "placeType": "landmark",
  "aliases": ["Tiahuanaco"], "wikipediaUrl": "https://en.wikipedia.org/wiki/Tiwanaku",
  "description": "The ruined pre-Inca capital on the altiplano south of Lake Titicaca.", "descriptionSource": "wikipedia" }
```

- `placeType`: country, city, region, neighborhood, island, natural_feature, body_of_water, landmark, venue, area.
- `scale`: `site` for a single spot (a building, a crossing, a circuit), `area` for anything larger.
- `parentId` must point to an existing record. A `site` whose parent is a city or neighborhood becomes a place of interest ("level two"): it shows as a diamond inside its city from zoom 11 and is listed under the city. A site under a region or country is a standalone place.
- `description`: one sentence, at most 400 characters, about the place itself, not the game. Real places get `"descriptionSource": "wikipedia"`.
- Country records: if a country has no record yet, `npm run build:countries` creates it from Natural Earth. Do not invent country records by hand; leave `parentId` out and run the build.
- Google Maps links are generated from the record (coordinates for sites and cities, name search for regions and countries). Nothing to add.

## What goes in

These rules come from the user's corrections over many sessions; they are what makes the atlas trustworthy.

1. **Only places the player experiences.** A level, a hub, a mission, a watched cutscene all count. A place named in dialogue, on the box or in the title does not. Chicago 90 (a grid labelled Chicago) and Test Drive II's scenery disks (generic roads labelled with six countries) were taken out for this reason.
2. **The most concrete real place the sources support.** Prefer the town, the landmark or the circuit over the country. A country pin is right only when the game itself names nothing smaller. Rally games pin each rally's base town for that season, not the country.
3. **One record per real place.** Before creating a place, search the catalogue (`catalog.py place <word>`, including aliases and local spellings). Giza the city and the Giza pyramid complex are different records; the pyramids, when the game is at the pyramids, are the pyramid complex. If you find two records for the same thing, merge them: move the games, retire the loser to `redirects.json`.
4. **Invented places get their own record**, named `"<Name>, <Region>"` with `"fictional": true` (or `"legendary": true` for a place from legend), pinned at the real basis the sources name (Contradiction's Edenton on Great Budworth, where it was filmed) or, failing that, where the game puts it. The description says what the place is, what it is based on and why the pin is where it is, and says plainly when the placement is a guess. A game whose world is an invented country with no stated real basis (Bad Company's Serdaristan, Nick Bounty's unnamed big city) is left out rather than pinned on a guess at continent scale. Conventions for these records:
   - `wikipediaUrl` points to the article about the real basis (Kenya for Far Cry 2's country, Miami for Palm City), or is left out when there is none. Never the game's own article: the place page already links the games, and a place link that opens a game article confused readers. `catalog.py lint` flags it.
   - `parentId` is the region the game puts it in (Watery is in Washington in the game, though pinned on Astoria, Oregon).
   - An invented country or state (Kyrat, Outer Heaven) gets `placeType: "region"`, never `"country"`: the map treats every `country` record as a real country shape to open, and an invented one would open the real country it sits in.
   - A real city under a new name (Liberty City = New York, Vice City = Miami, Los Santos = Los Angeles, Saint Denis = New Orleans) is NOT an invented place: the game points at the real city with `"settingType": "fictionalized"`, the in-game name goes in that location's `aliases` (`"aliases": ["Liberty City"]` on the game's location, so search finds exactly those games), and the note uses the in-game name and ties it to the real place at first mention ("In San Fierro, the game's San Francisco, …"; "Kamurocho, the series' Kabukicho"), because the app shows the note on the real place's page and does not show the alias. Only a town with no one real city behind it gets its own record.
   - An invented place gets its own record only when a source places it more precisely than a country or a state. When the game says only "in Greece" or "in Illinois", the game points at that country or state with `"settingType": "fictionalized"` and the invented name in the location's `aliases` (Nancy Drew: Labyrinth of Lies points at `greece` with alias "Phidias Cultural Center"). Never pick a plausible spot inside the region ("beside Athens", "near Munich", "on the Sognefjord") without a source naming it: the pin reads as a claim.
   - An invented place's own name also goes in its `aliases` ("Kamurocho"): search treats an exact alias as the whole answer. `npm test` checks this with "Liberty City".
   - The real basis's name goes in `aliases` when readers might search for it ("Twede's Cafe" for the Oh Deer Diner).
   - A place of interest inside an invented town is fine when it has a real model of its own.
   - Give the record a `source` (the page that states the basis).
   - Never write a category into the name ("(fictional)", "(fictionalized)"): the app generates the "(fictional)" label from the field, and `validate:data` rejects names that carry it. Nor how a game uses a place ("Mexico (Landrush)", "Panama (alternative route)"): that belongs in the game's note, and the game points at the real place. Brackets are only for the place's other real name ("Gdańsk (Danzig)").
5. **States that no longer exist are not places.** A game set in the Soviet Union, Prussia (the kingdom), Rhodesia, Yugoslavia or Zaire points at the present-day country it happens in, with the old name as an alias on the location ("Prussia" on Amnesia's `germany`); a record's name uses today's country ("Angola–DR Congo border", alias "Angola–Zaire border region"). When the sources do not say which present-day country, use the one the game itself hints at, and say in the report that it is a hint. A "Soviet Union" record pinned near Moscow was removed for this on 3 November 2026. A historical *region* that is still geography (Bavaria, the Prussia region on the Baltic) is fine.
6. **Places of interest** belong inside cities: add a `site` record under the city when the game uses a recognisable landmark there (Fallout 4's Fenway Park as Diamond City, Assassin's Creed III's Old State House). They are what makes a city page interesting, so look for them in every city-heavy game.
7. **Routes** for any story with an order. Put stops in the order the story visits them, with returns repeated, and write the route note as one sentence about the journey itself ("From UNATCO on Liberty Island to the end at Area 51"). Never say in the note what was left off, which parts can be played in any order, or what a source says: readers see the note under the route, and that is talk about our data, not the story. Report such choices to the user instead. `catalog.py lint` flags it. Open-world games without a fixed order get no route.
8. **Story games versus venues.** Racing and sports games list real circuits and venues; their notes can be short and factual, but never filler ("The base game includes a playable recreation of this circuit"). A season game says which event the venue was in that season ("Raced as the European Grand Prix, round 14 of 16 in the 1994 season"; "Rally Argentina, round 6 of 14 of the 2002 World Rally Championship"), taken from the season article's calendar; a cancelled race says so. A track-list game says what this game does with the venue: its layouts, the real event it recreates (24 Hours of Le Mans, Bathurst), night or rain, new to the series, a special mode. Story games need story notes.

## Writing notes

A note is one or two sentences in English about what happens at that place in this game, in the game's own terms, as specific as the sources allow: who, what, which mission.

- Good: "Lucy Thorne flees to the Tower with the key to the Shroud's vault; Evie infiltrates it and kills her."
- Don't restate where it is ("The Italian stop: …", "The Greek level …"): the reader is already looking at Venice.
- Don't cite the source in the note ("named by the publisher", "the source identifies"); the source lives in the `source` fields.
- Never explain why a real place is pinned where it is. For an invented place the note may say why in a few words; the place's own description always does.
- No template sentences ("The campaign includes a mission in X", "One of the cities in the game").
- Mind the search: notes are searched, and "ww2" is read as "world war", so a note with "world" in a game titled "… War" turns up in war searches. The test suite catches this.

## Workflow

Work through these in order. Keep a short list of what is sourced and what comes from your own knowledge of the game; the final report needs it.

### 1. See what is there

```bash
python .claude/skills/add-game/scripts/catalog.py game "<name>"      # does it exist? (also under another spelling?)
python .claude/skills/add-game/scripts/catalog.py series "<series>"  # the rest of the series, for consistency
python .claude/skills/add-game/scripts/catalog.py place <word> ...   # existing records for every place you expect
python .claude/skills/add-game/scripts/catalog.py nextid
python .claude/skills/add-game/scripts/catalog.py unreviewed --story  # what nobody has checked yet
```

A game can already exist under a curly apostrophe, a subtitle or a year suffix; a duplicate record gives a `-2015` suffix to the address, which is the giveaway. Merge rather than add.

### 2. Research

Start with Wikipedia: the plot, setting and gameplay sections, and the "Video games set in …" categories.

```bash
python .claude/skills/add-game/scripts/wiki.py section "<Article_title>" Plot Setting   # read the plot whole first
python .claude/skills/add-game/scripts/wiki.py context "<Article_title>" "keyword,keyword,…"
python .claude/skills/add-game/scripts/wiki.py categories "<Article_title>"
python .claude/skills/add-game/scripts/wiki.py coords "<Place article>" "<Place article>"
python .claude/skills/add-game/scripts/wiki.py search "<query>"
```

`context` shows every keyword's hits, so put in every place you suspect and see which have 0 hits. For a game whose article is thin, use WebSearch and WebFetch: Adventure Game Hotspot reviews, walkthroughs (well-played, walkthroughking), developer pages and press kits, national-language Wikipedias (de, nl, cs …). Fandom wikis, MobyGames and some news sites refuse fetches (402, 403, redirect loops). Rely on search-result summaries of them and say in the report that the claim rests on a summary; do not try curl, cookies or other ways around a site's bot check. For series with many games, a parallel fork per game saves time.

When a route's order comes from several sources (a non-linear game alternating two characters, a walkthrough's chapter list), put the main one in the route's `source` and name the chapters or the other source in the route `note` if it helps the next person check it.

Coordinates come from the Wikipedia article of the place (`wiki.py coords`), rounded to four decimals.

### 3. Write the records

Write a Python script in the session's scratchpad and run it from the repo root. A file written with the Write tool is the safe choice for anything longer than a few lines: notes are full of apostrophes, and inline heredocs have broken on quotes and backslashes in this environment. A short heredoc with a quoted `'EOF'` is fine for a small edit. Load and save JSON with `ensure_ascii=False, indent=2` and a trailing newline. When editing an existing game, rewrite its `locations` and `routes` deliberately rather than appending blindly, and update route `stops` whenever a placeId changes.

### 4. Check it yourself

```bash
python .claude/skills/add-game/scripts/catalog.py lint <game ids>
npm run validate:data
npm run build:countries     # whenever a place was added; creates missing country records
npm test
```

Fix every lint finding or be ready to say why it is fine.

### 5. Independent review

Spawn a fresh `general-purpose` subagent that knows nothing about this conversation. Its value is that it is not anchored on your reading, so give it the game and the records, never your sources, reasoning or doubts. Use this prompt, filled in:

```
You are checking data in a map of the real places video games are set in. Do not edit any files.

Game(s): <name (year)>
Records to check (read them):
- src/data/games/<file>.json
- src/data/places/<id>.json  (every place the game uses, new or not)

Independently find out, from Wikipedia and other reliable sources (reviews, walkthroughs, developer
material), which real places the player actually visits or sees in this game, in what order, and
what happens at each. Then compare with the records and report, with a source for each point:
1. Places in the records that the game does not actually take the player to, or that are the wrong
   place (a different town of the same name, a city when the game is at a specific landmark, a
   duplicate of another record).
2. Real places the player visits that are missing, including recognisable landmarks inside cities.
3. Pins that are clearly in the wrong spot (check coordinates against the place's Wikipedia article).
4. Route order that does not match the story.
5. Notes that are factually wrong about what happens there.
Say how confident you are in each point, and separate what a source states from what you infer.
Keep the report under 400 words.
```

For several games, one reviewer per game, launched together. When the report comes back, check each claim against a source before acting: fix what holds up, and note what you rejected and why. A reviewer can be wrong too (it may confuse two games in a series or pick a different town of the same name).

When a game's places, notes, route and story years have been checked this way, set `"reviewed": "YYYY-MM-DD"` (today) in its record, right after `source`. `catalog.py unreviewed --story` lists the games nobody has checked yet, by series, so the next round can start there.

### 6. Publish and check live

```bash
npm run build && npm run deploy:ftp
```

Deploy after every finished change without asking (the user's standing instruction). Never print the contents of `.ftp-deploy.local`. Do not commit; there is no remote. The deploy prints "Removed N obsolete files" when pages disappeared, for instance a retired place or a slug that changed; that is expected, but check that the removed pages are ones you meant to remove (another session may be working in parallel).

Then check the live pages. Slugs come from names, not ids: `ls dist/game | grep <word>` and `ls dist/place | grep <word>` give the exact addresses (an invented place's page is like `bright-falls-washington-usa-fictional`). Open https://truben.no/gametraveler/game/<slug>/ in a browser (the Playwright MCP tools: navigate, then read the console messages and evaluate the page) and confirm it loads without errors, the stops are listed and the route draws. `curl -s <url> | grep -o "<title>[^<]*"` is a quick check that a prerendered page exists.

### 7. Report

In Norwegian, short, leading with what changed. Per game: what was added or corrected, places of interest, the route. Then, plainly:
- what the independent reviewer found and what you changed because of it,
- what is left out and why (invented country, no source, only mentioned in dialogue),
- which claims rest on your own knowledge of the game rather than a source, and which pins are guesses.

If a new rule came out of the work (a kind of place that should or should not go in), add it to `DESIGN.md` and mention it.
