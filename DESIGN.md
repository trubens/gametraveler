---
name: Game Traveler
description: Video games placed on a world map by where their stories happen, printed like a voyage chart: midnight ink and vermilion on ivory, with a smoke-blue sea.
colors:
  ink: "#1b2a41"
  ink-soft: "#4f5a6b"
  paper: "#ece5d5"
  sheet: "#fdfaf2"
  rule: "#d2d1c2"
  rule-strong: "#868c97"
  magenta: "#c0432a"
  magenta-deep: "#97321e"
  cyan: "#d3e0e6"
  yellow: "#e0c07c"
  map-ground: "#f6f0e3"
  marker-dimmed: "#9aa0aa"
  cluster-dimmed: "#6b717c"
  place-real: "#c0432a"
  place-fictionalized: "#23787a"
  place-imaginary: "#6b5b95"
  place-mixed: "#7a5c43"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.08
    fontVariation: "\"wdth\" 85"
  masthead:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 80"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  masthead-compact:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    lineHeight: 1.05
  game-title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  game-title-compact:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  numeral:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
    fontVariation: "\"wdth\" 68"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-data:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  tag:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.025em"
  cluster-numeral:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 750
    lineHeight: 1
    fontFeature: "\"tnum\""
    fontVariation: "\"wdth\" 80"
  map-label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.5
    fontVariation: "\"wdth\" 85"
  attribution:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0px"
  full: "9999px"
spacing:
  tight: "8px"
  gutter-mobile: "16px"
  row: "20px"
  gutter: "24px"
  control-height: "44px"
  masthead-height: "64px"
components:
  masthead:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.masthead}"
    height: "{spacing.masthead-height}"
    padding: "12px 28px"
  button-primary:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "{spacing.control-height}"
  button-primary-hover:
    backgroundColor: "{colors.magenta-deep}"
  button-toolbar:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-toolbar-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body-data}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  input-search:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 40px"
    height: "{spacing.control-height}"
  panel:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "420px"
  map-marker:
    backgroundColor: "{colors.magenta}"
    rounded: "{rounded.full}"
    size: "16px"
  map-marker-active:
    backgroundColor: "{colors.magenta}"
    size: "22px"
  map-cluster:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.cluster-numeral}"
    rounded: "{rounded.full}"
    size: "39-64px"
  map-label:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.map-label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
---

# Design System: Game Traveler

## Overview

**Creative North Star: "The Voyage Chart"**

Game Traveler is a reference atlas for video games. The world is printed faintly on ivory with a smoke-blue sea, like a steamship chart, and everything a reader can act on is overprinted in two inks: deep midnight blue for structure and vermilion for destinations. The chrome is the atlas's furniture: a cream title bar with the wordmark and a live index line ("598 games / 685 places · 3100 BC–2310"), a sheet that docks to the left on desktop or rises as a bottom sheet on phones, and a list of every place by country for readers who would rather use the index than the map.

The type is one family, Archivo, in several widths. Titles and game names are condensed and heavy, release years are big tabular numerals in their own column, and controls and running text stay at normal width. The only other face is Newsreader italic, used for «Traveler» in the wordmark and for the line «A video game atlas»; everything else, including the welcome heading, is Archivo.

The audience is 30 to 60, so app text never drops below 13px (0.8125rem), touch targets are 44px, and every text pair passes WCAG AA. UI copy is English and speaks plainly: "Games in this area", not "cluster"; "The pin marks the area, not an exact spot", not "Representative map point".

**Key Characteristics:**
- Faint, desaturated basemap; colour only where there is something to act on.
- Vermilion (`magenta` token) is the one action, destination and route colour.
- Midnight ink (`ink`) for text, rules, clusters and pressed controls.
- Condensed heavy Archivo for titles, names and years; normal width for UI.
- Square corners everywhere except things printed on the map.
- The map shows games, not just numbers: clusters list their games on hover, and small clusters open as a list.

Token names (`magenta`, `cyan`, `yellow`) are historical. They come from an earlier magazine design and are kept so the code does not churn. Read them as roles, not hues.

## Colors

The Fogg palette (since 3 November 2026; the name is Phileas Fogg's): midnight-blue ink, a vermilion accent like a postmark, ivory sheets and a smoke-blue sea, with sea and brass tints for highlights. It replaced survey green and terracotta, which with a pale sea-green read as calm but stale; the brief was adventure, Around the World in Eighty Days, and still stylish. Rejected alongside it: Verdigris (green ink, copper-green sea), Orient Express (plum ink, saffron, lavender sea).

- **Vermilion** (`magenta`, #c0432a): place dots, the single-game dot, the route line, the primary button, the active-filter badge, slider fill, the global focus ring (search field included), journey step numbers, the final folded-map panel, the second line of the welcome heading, and the hover colour of links and names.
- **Deep vermilion** (`magenta-deep`): hover on primary buttons.
- **Midnight ink** (`ink`, #1b2a41): all text, cluster bullets, the outline of active markers, map caption labels, pressed chips and toolbar buttons, rules and the status notice. 11.7:1 on sheet.
- **Soft ink** (`ink-soft`, #4f5a6b): secondary text such as meta lines, "Set in" lines and placeholders. 6.5:1 on sheet.
- **Sheet** (`sheet`, #fdfaf2): panels, the masthead, the filter, notices and the consent strip.
- **Paper** (`paper`, #ece5d5): the page behind the app, the search field and hover fill on index rows.
- **Rule** (`rule`): 1px dividers. **Strong rule** (`rule-strong`, 3.1:1): the border of an unpressed chip.
- **Sea tint** (`cyan`, #d3e0e6) and **brass tint** (`yellow`, #e0c07c): genre tags, hover fills on icon buttons, text selection and the selected game row (brass at 30%). Never interactive meaning on their own.
- **Place setting marker colours**: real (#c0432a, the vermilion of every place dot; it was a separate hot pink, #e33479, until 3 November 2026 and clashed with the dots it described), fictionalized (#23787a), imaginary (#6b5b95), and mixed (#7a5c43). These established marker colours describe how games portray a place; they stay separate from the place's geographic type. An outer ring marks a representative area pin while a plain dot marks a specific site.
- **Dimmed grey**: `marker-dimmed` for place dots and `cluster-dimmed` for clusters off the shown route. The cluster grey is darker so its white numeral keeps 4.9:1.

### Named Rules
**The One Accent Rule.** Vermilion means "a place", "act here" or "this is the route". Never use it for genre or decoration.

**The Faint Map Rule.** Tiles are always desaturated (`grayscale(0.85) sepia(0.05) contrast(0.9) brightness(1.03)`, baked into the style in basemapTone.ts) so labels sit behind markers, not beside them; land is ivory (#f6f0e3) and the sea smoke blue (#b7cbd2), set after the tone. Rejected (3 November 2026): sepia 0.18 and contrast 0.78, which yellowed the whole map like newsprint, and a grey-beige sea barely darker than the land. Woods, parks, built-up areas and buildings take warm tints of the land (woods and parks with a faint green cast), and roads are white with a warm casing; Positron's own cool greys, toned, lay on the ivory as blurry grey smudges and the map read as out of focus (rejected 3 November 2026). Country boundaries in the basemap are a faint ink line. The vector map's canvas sits on whole screen pixels at any display scaling (Basemap.tsx, snapToDevicePixels): the Leaflet plugin made the layer 20% larger than the map without rounding and placed it on whole CSS pixels, a quarter screen pixel at 125% Windows scaling, so the browser resampled the whole map image and every map name looked soft. Map names have a crisp halo in the land colour and no halo blur, countries and capitals in midnight ink; Positron's blurred white glow (`text-halo-blur` 1) made country names look out of focus (rejected 3 November 2026). Town and city names sit 1.2em off their point (variable anchor), so they never cover the place dot on it.

## Typography

**Font:** Archivo Variable (self-hosted, width axis), with system-ui as the only fallback. Newsreader Variable italic is reserved for the wordmark and the tagline, and ships as a self-hosted 22KB instance of the variable file: optical size pinned at 20, weight axis kept at 450–500, basic Latin only (the full opsz file was 144KB for two lines of text).

### Hierarchy
- **Display** (700, 2.5rem from md / 1.6rem on phone, 85% width, sentence case): the panel title. Titles longer than 36 characters drop to 1.9rem on desktop so they don't push everything else below the fold. On phone the title clamps to two lines.
- **Name:** Game Traveler, American spelling, since 26 October 2026. The catalogue and the interface already use American English (fictionalized, color, center), "traveler" has the larger global search volume, and search engines treat the two spellings as variants. The site moved from truben.no/gametraveller/ to truben.no/gametraveler/ the same day; the old folder holds only an .htaccess that 301-redirects every old address to the new one, and local-storage keys keep their old prefix (storage is per origin, so My atlas survives the move). Known collision: GAME TRAVELER is RDS Industries' registered mark for Nintendo-licensed Switch cases, so the bare name's search results are theirs; titles always carry the tagline. Rejected: Gaming Atlas and Game Atlas (crowded by Games Atlas, gamesatlas.app, VGMaps "The Video Game Atlas" and The Gamer's Atlas, and "atlas" in gaming means a collection of level maps, not travel to real places); keeping "Traveller" (inconsistent with the rest of the English on the site).
- **What the map shows at each zoom** (from a scripted walkthrough of Paris, London and Rennes-le-Château on a phone and a desktop): country shapes to zoom 6, gone from 7 when a country fills the screen; clusters at every zoom, splitting as dots come 50px apart, so Paris is a "43" ring to zoom 8 and a single dot from 9; the dot carries a diamond-and-number badge for the places inside it; the diamonds themselves appear from zoom 11 and their names from 12. Rejected: diamonds from 12, which left zooms 9 to 11 as three steps where the city was one dot and nothing new appeared; and a bare number badge, which read like a cluster's game count.
- **A spot stays a diamond when pinned:** the places inside a city keep their diamond on the game page and the place page, drawn larger with the sheet ring and green edge of the active dot but still in ink: vermilion is the colour of place dots and routes, and a red diamond read as a third kind of thing. Rejected: the round active dot for everything, which made Baker Street look like a place of the same kind as London.
- **Opening a game frames its places by their spread:** places within about 60 km of each other (a case that stays in London) are fitted up to zoom 13, so the spots stand apart with their labels; any wider journey is fitted to fill the map up to zoom 10, and one across oceans lands far out on its own. Rejected (3 November 2026): a cap of 6 for every journey beyond 60 km, which left Valiant Hearts (stops a couple of hundred kilometres apart in northern France) as a small knot in the middle of half of Europe. A lone city stays at 6 with its country around it; a lone spot goes in until the diamonds show. Rejected: one cap of 6 for everything, which showed all of Greater London for five Sherlock Holmes addresses eight kilometres apart.
- **Stops on a game page move the map first:** tapping a stop in the journey list or the place list of an open game pans the map to it and marks the stop (vermilion, underlined) while the game and its route stay on screen; tapping the marked stop again opens the place. The mark belongs to that panel, so a new game starts fresh. Rejected: opening the place on the first tap, which threw the reader off the route every time they wanted to look at a stop.
- **Route stops in order:** the chips under a route list every stop in sequence with its number, repeats included (George in The Sleeping Dragon: 1 Congo, 2 Glastonbury, 3 Paris, 4 Congo, 5 Paris, 6 Prague, 7 Paris, 8 Egypt, 9 Glastonbury), and a map label for a place the route returns to carries all its numbers (Paris 3·5·7). Rejected: one chip per place in first-visit order, which read as a wrong itinerary.
- **Google Maps link:** every real place links to Google Maps at the end of its meta line, right after Wikipedia and in the same quiet link style: the two are the place's references, read about it and go there. Cities, buildings and sites link by their coordinates (`maps?q=lat,lon&z=`, zoom 16 for a site, 11 for a city), so the pin lands exactly where ours stands. Countries, regions, islands, natural features and seas link by name (`maps/search/?query=`), since 1 November 2026: a coordinate in the middle of a country is an empty point, while a name search gives Google's own outline and place card. For sites a name search was rejected because it can land on a street, a shop or a namesake. Invented places get no link, since their pin is ours. Rejected: a third icon in the title row (a third of the title width on a phone), and a segment in the Been here / Want to go control (that control is the reader's own atlas, not an outbound action).
- **One record per real place:** a city exists once in the catalogue, whatever a game calls it (London, England, UK and London, UK were three records; Chicago, Boston, Miami, Las Vegas, San Francisco, Detroit, Seattle, Hong Kong, Istanbul and others were two). When records are merged the dropped names become aliases, the old page URLs redirect, a saved Been here on the old id follows to the kept one when the atlas loads, and a CSV export that still says «London, England, UK» imports by alias. A real city or district under a new name (Liberty City, Vice City, Los Santos, San Fierro, Saint Denis, the Need for Speed cities, Yakuza's Kamurocho = Kabukichō and Sotenbori = Dōtonbori) is not a place of its own either: since 2 November 2026 the game points at the real city, marked fictionalized, with the in-game name as an alias on the game's location (so search for "Liberty City" finds the GTA games) and in the note ("Niko Bellic steps off a cargo ship in Liberty City …"). Only a town the game invents, with no one real city behind it (Edenton, Greenvale, Bright Falls), gets its own record. And only when a source places it more precisely than a country or a state: an invented place the game puts only "in Greece" points at Greece, with its name as an alias (Nancy Drew's Phidias Cultural Center, since 3 November 2026: it was pinned beside Athens on no evidence, and the pin read as a claim). A finer pin needs a source that names the town, coast or valley; a guess at a plausible spot is not one.
- **States that no longer exist** (since 3 November 2026): a game set in the Soviet Union, the Kingdom of Prussia, Rhodesia or Zaire points at the present-day country, with the old name as an alias, as Yugoslavia already pointed at Croatia. A "Soviet Union" record pinned near Moscow was the only exception and was removed; its old address redirects to Russia. Rejected: historical states as their own pins, which put an area the size of a continent on one point and sat oddly beside every other present-day place.
- **Series pages** (since 1 November 2026): a game that belongs to a series carries a `series` field in its data (89 series, from Nancy Drew's 36 games to pairs like Barrow Hill); the title-based guess is only a fallback for grouping rows in place lists. The series page, `/series/broken-sword`, lists the games in year order with the same rows as a place list and pins every place of every game on the map (series with more than 40 places only dim the rest). It is reached from one quiet line under the game's credits, "Part of the Broken Sword series · 5 games", and from "Open the series" on a collapsed series row in a place list. No routes are drawn on a series page (five Broken Sword journeys would be spaghetti). The page is prerendered as "Where the Broken Sword games take place" and sits in the sitemap. In a place list a series of three or more games is one row: its name opens the series page (there is no separate "Open the series" button), its count line ("› 6 games · 1989–2014", a vermilion chevron that turns down when open, 44px tall though it reads as text; the beige "Show all N" chip under it competed with the title and was dropped on 4 November 2026) unfolds the games onto a shared tinted panel hanging from a 2px rule under the series heading, so it is clear which games belong to it and where the group ends (since 4 November 2026; unfolded, the games looked like ordinary rows under a detached heading). Search offers the series as its first suggestion, "Broken Sword series · 5 games · 1996–2013", when the query starts a series name (three letters or more); the games follow below it. Rejected: a series filter or index (the series is a way onward from a game, not an entrance), and grouping sub-series separately (Call of Duty: Black Ops stays inside Call of Duty).
- **Invented places link to their basis** (since 1 November 2026): a fictional place record's Wikipedia link goes to the article about the real place it is modelled on (Kenya for Far Cry 2's country, Miami for Palm City), or is left out when the game names none. It never links the game's own article; the place page already lists the games.
- **Route sources are data, not interface** (since 1 November 2026): every route keeps a `source` in the data so the order can be re-checked, but the page shows no "Route source" link. Two in three pointed to the same Wikipedia article as the game's own link in the header.
- **Game aliases:** a game record may carry `aliases`, the other titles it is known by (Circle of Blood for Broken Sword in the United States, Secrets of the Ark for The Angel of Death, numbered short forms). They are searchable, shown as one quiet "Also known as" line under the game page's credits, and written into the prerendered page for search engines.
- **Place description:** one or two sentences on what the place is; a city gets a single clause ("The capital of the United Kingdom.", "A hilltop city above a bend of the Tagus."), since the game list is the point of the page, under the meta line and above the marks, with no credit line even when they come from the article's summary (scripts/enrich-place-descriptions.mjs, CC BY-SA, `descriptionSource: "wikipedia"` in the record): the Wikipedia link in the meta line right above is the attribution, and a credit after every paragraph was noise; invented places get a hand-written line saying what the place is, what it is based on and why the pin sits where it does, never naming the game (the game list under it says which games are set there, so "one of the locations in X" is noise) (Mêlée Island among the Lesser Antilles, Dowerton in central Dorset). Rejected: no description (a landmark page named a memorial house and said nothing about who Gárdonyi was).
- **Place header:** the meta line carries everything that describes the place, including its Wikipedia link as the last item (type · setting · games · era · Wikipedia); under it sits one segmented control, Been here | Want to go, a 38px pill with a hairline border and no fill, because the two marks exclude each other and belong in one frame; the chosen side fills with ink. The Wikipedia link is set like the rest of the meta line (soft ink, medium weight, a faint underline), so it reads as a reference, not a call to action. In the game rows the Played and Want-to-play marks are two round 40px hairline buttons at the right end of the row's meta line (bottom-aligned), and the journey button, when there is one, gets its own line below; they used to share a line that existed only for them, one extra row per game on a phone. Rejected: full-width buttons plus the link on its own line (three rows before the first game on a phone); buttons and link sharing a wrapping row (the link still broke to its own line at 412px, and a reference link does not belong with personal actions).
- **Masthead** (Game: Archivo 720, 88% width, -0.025em; Traveler: Newsreader italic 500, opsz 24, 1.1× the size, -0.01em): the wordmark, 1.3125rem on desktop and tablet, 1.1875rem on phone and 1.0625rem below 360px. No trailing full stop.
- **Tagline** (Newsreader italic 450, 1rem, ink): «A video game atlas», above the counts (0.8125rem, soft ink, numbers in ink).
- **Headline** (800, 1.6rem, 68% width): the welcome heading and the "Filter the map" and "About the project" headings. Sentence case, never uppercase.
- **Game title** (800, 1.375rem on phone / 1.5rem from md, 68% width): game names in a list. Kept a step below the panel title.
- **Numeral** (800, 1.9rem, 68% width, tabular): the release-year column.
- **Section heading** (700, 1rem): "Nearby", "Set in the same era", "The journey", place sub-headings and country headings in the index.
- **Body** (400, 1rem) and **Body Data** (500, 0.95rem): running text, credits and chips.
- **Label** (600, 0.875rem): the index line, field legends and section meta.
- **Tag** (700, 0.8125rem, uppercase, +0.025em): genre tags only. They are the one uppercase style left.
- **Cluster numeral**, **Map label** and **Attribution** as in the tokens. Attribution (12px) is third-party chrome and never a model for app text.

### Named Rules
**The Ramp Rule.** Sizes come from 2.5 / 1.9 / 1.6 / 1.5 / 1.375 / 1 / 0.95 / 0.875 / 0.8125 rem, plus 1.25rem for the brand below 360px, 17/15px cluster numerals, 14px map text and 12px attribution.

**The Tabular Years Rule.** Every year, count and range uses tabular lining figures. Years before 0 read "N BC".

## Layout

A full-height column: the masthead (64px on desktop: wordmark, a hairline, the caption «A video game atlas» over the collection counts, a hairline, the white search field with Filter beside it, then All places and More; 105px on phone in two rows: wordmark and More, then search and Filter). Below 1360px the caption and All places move to a 56px strip under the map. Surprise me (shuffle) and Near me sit as 44px map buttons above the zoom, bottom right on desktop and top right on phone, the index line beneath it, and the map filling the rest.

- **Desktop:** the panel docks left at 420px under the masthead. The camera keeps targets clear of it (470px left padding). The filter is a 400px card that hangs 8px under the Filter button, right-aligned to it, with 14px corners, a 1px tinted border and the soft floating shadow; its chips use 10px corners and a 1px border, pressed fills ink. Zoom controls sit bottom right. The consent strip sits bottom right, left of the zoom controls and clear of the panel.
- **Phone:** the panel is a bottom sheet with snap points at 104px, 62% and full height. At full height it covers the masthead and search, as Google Maps does; a drag down brings them back. (It used to stop under the search bar, and with the header that left one game row on screen.) Games and places are the content, so the phone list is tight: the year sits in the title line instead of its own column, the meta line gets the full width, the route button and the two mark icons share one row, the header reads as a map legend, not a cover page: a 28px handle zone, the title at 1.25rem, meta and description at 0.875rem (meta says "set in", not "stories set in"), a 36px Been here / Want to go segment at 0.875rem, and "Played 1 of 4" beside it instead of under it. Marks are secondary and never get a row of their own. A game row in a place list carries only what belongs to the place: the note, the setting (real / fictionalized) and "set in" years. Genre, place count and the Wikipedia link live on the game page, one tap away. The filter spans the full width under the masthead and is capped so its footer ("Show N games") is always on screen.
- **Stacking (z-index):** map layers < intro (850) < notices (900) < masthead (1100) < sheet (1200) < consent (1210) < masthead with filter open (1250) < autocomplete (1300) < skip link (1400). Never let two overlays overlap: the consent prompt waits while the welcome card is visible.

## Elevation & Depth

Nearly flat. The masthead and the panel header end in a single 1px hairline. Docked panels have no shadow. Only things that float over the map (welcome card, menus, suggestions, consent strip, map buttons) get a small soft shadow (0 8px 24px -12px ink at 35%), and map dots and cluster bullets keep their small halos.

## Shapes

Docked surfaces (masthead, side panel, bottom sheet, filter panel, index) have square edges and end in 1px hairlines. Things that float over the map (welcome card, More menu, search suggestions, consent strip, Near me and zoom) and the masthead controls (search field, Filter) have soft corners: 10px for controls, 12–14px for cards, with a 1px ink-tinted border and a small soft shadow. Circles stay reserved for things printed on the map, the filter badge and slider thumbs. Metadata lines (place type · setting · counts) flow as running text with middle dots, never as stacked rows or boxed badges.

## Components

### Masthead brand
- The master folded-map SVG is `src/assets/atlas-mark.svg`, with a tight `0 0 120 96` viewBox. Four panels share equal vertical height, mirrored angles, and consistent four-unit fold gaps. The first three panels are midnight ink; the last is vermilion.
- Header and app icons share this drawing. `scripts/generate-icons.py` renders complete, centred app marks on paper backgrounds, and favicons with wider gaps for small sizes on a rounded paper tile (14/64 corner), so the mark keeps its contrast on dark and light tabs alike. Rejected (3 November 2026): a transparent favicon whose green switched to cream with `prefers-color-scheme`; the query follows the operating system, not the browser theme, so on a dark tab under a light system the green mark all but vanished.
- **Share card** (`public/og.png`, 1200×630): drawn by `scripts/og-card.mjs` from the catalogue as a still of the app itself: the sheet on the left with the wordmark, «A video game atlas», the headline «Where video games take place» and the counts; the map on the right in the atlas tones, every story place as a dimmed dot, and Indiana Jones and the Fate of Atlantis's journey as the vermilion route with numbered stops and a floating route card. Rerun the script and screenshot `#card` (instructions at the top of the script) when the counts move. Rejected: the earlier black, yellow and magenta card from the magazine design, which no longer matched anything on the site.
- **Map cards per page** (since 9 November 2026): every game and place page has its own 1200×630 card, `map.png` in the page's folder, in the share card's layout: the sheet with the wordmark, a kicker («Where it takes place», «The journey» for a game with one route, «Video games set in» for a place), the name, and two lines (year · developer, then «7 places in France and Italy»; for a place the rest of its name and «4 games, 2014–2018»). The map shows the game's places as vermilion dots over the rest of the atlas as faint grey dots; a single route gets its line and numbered stops, unless stops overlap, then only the line. A single place gets at least 14° of land around it, a region or sea 24°, and a country is framed on its largest landmass (Russia, the contiguous USA). Several places are shown at 6° or wider; dots that overlap merge into one pin with the number of places (not stops), and a game that stays in one city becomes that one pin at 14°, with all the game's places counted, also those its route skips. Zooming in to street level (tried 9 November 2026) gave an empty beige sheet with a river that nobody recognised as Paris. Game cards name the pins in Archivo Semi with a halo (biggest clusters first, right, left, above or below, dropped when nothing fits; a cluster is named by the city most of its places share, else its country, else nothing); place cards have the name in the title and no label. Place cards tint the place's own outline in vermilion (13 %, a thin edge): countries from Natural Earth admin-0, states and provinces from admin-1 (Alaska, Texas, Bavaria), natural regions from geography_regions_polys (Siberia, Patagonia; drawn roughly, so fill only, clipped to land), matched on name or alias inside the same country and containing the pin; the card is framed on the outline's largest landmass. Place cards also name up to three big cities nearby in grey (populated_places, by rank), never on the pin, each other or the edge. Places without a matching outline (Scottish Highlands is «Highland» in the data, Amazon) keep the plain pin. Pins are sized for a phone-width thumbnail (18 px single, 13 px dots, 20 px numbers). Views under 20° use Natural Earth 1:10m straight from the source (`.cache/`, downloaded on first build), with lakes and rivers, so an inland city has the Seine or the Thames to place it; the public 1:50m file is simplified for the web map and looked jagged up close. Drawn at build time by `scripts/lib/og-maps.mjs` (SVG from the Natural Earth shapes, rendered by resvg with static Archivo and Newsreader cuts in `scripts/fonts`, then a 64-colour palette by sharp, about 20 kB each) and cached on content in `node_modules/.cache/gt-og`, so unchanged cards are not redrawn or re-uploaded. Each card is the page's og:image, an `<img>` with alt text under the static page's h1, the JSON-LD `image`, and an `image:image` in sitemap.xml; pages carry `max-image-preview:large`. For search: Google and Bing Images, the thumbnail beside a result, Discover and link previews. Rejected: photos of the places (rights, and they would not set us apart from Wikipedia), game art (covers on hold), and screenshots of the live map at build time (an hour per build, and tile licensing).
- The symbol is 1.05em high (about the type size) with a 0.43em gap to the name, so it scales with the wordmark. No rule, frame or vignette between symbol and name.
- There is no subtitle under the name. «A video game atlas» and the collection size and time span sit as a two-line caption in the header (or in the bottom strip on narrower screens).
- A 1px rule separates the brand from the search field on desktop. The masthead ends in a single 1px hairline.
- Search, Filter, Near me and zoom use white or sheet fills, a 1px ink-tinted border and 10px corners; toolbar buttons are borderless with a faint tint on hover.
- **Surprise me** (shuffle icon in ink, a map button above Near me; the dice it replaced on 3 November 2026 was a square inside the square button and read as a stray box) opens a random game from the current filters (ignoring the search text, which it clears), never the one already open. If the filters leave fewer than two games it draws from the whole atlas.
- **Routes on the game page:** "N routes through the story" shows one card per route (route-colour stroke, name, characters, "6 stops · Berlin → Antarctica"); choosing one shows pills to switch routes and the route as a line in its colour with numbered round stops, each with its note and "Also on ‹other route›" where routes share a place. Places not on any route follow as "Also in the game". On the map, stop labels carry the stop number in the route colour when one route is shown, or one colour dot per route when all are shown; the pin itself keeps its setting colour.
- **Several routes:** when a list row shows a game with more than one route, each route gets a legend line (route colour stroke, name, characters) with its own place chips, and "Follow one route at a time" opens the game page.

### Map overprint (signature)
- **Place dot:** 16px vermilion with a white ring in a 44px hit area.
- **Pin precision:** area-scale places sit on a soft 30px halo in their setting colour at 20%, shown from zoom 6 (`gt-zoom-halos`; at the world and continent views the halos read as pink smudges); site-scale places keep the plain dot. Rejected (3 November 2026): a 27px outlined ring, which made every city a target symbol and the map busy. The place panel spells out that an area pin is approximate.
- **Hover names:** a place dot, a spot diamond or a pinned dot shows its name in the map's own label style the moment the pointer is over it (`gt-label gt-country-hover`, the same lapp the country hover uses), with "N places inside" and your mark where they apply, never "approximate area" (a city is not approximate; the ring on the dot and the place panel already say the pin marks an area); the browser's native `title` bubble was dropped because it came a second late and in a foreign style. While the pointer is over a dot, a cluster or a label the country hover stays off, so Bordeaux never reads "France". Since 29 October 2026.
- **World copies:** on desktop every marker is drawn three times (−360°, 0, +360°) so the map can be dragged across the date line without a gap. On phones only the one copy is drawn (since 30 October 2026): a 390px screen never shows a copy, and the copies tripled the cluster tree and the icon DOM at boot. The first batch of markers is added one task after the map's first frame, so the basemap appears before the cluster tree is built. Measured: the catalogue's JSON parse costs 1–8 ms; the boot cost is the cluster tree, marker icons and MapLibre's shader compile, not bytes.
- **Active / pinned dot:** 22px vermilion with a sheet ring and a 2px midnight-ink outline, so it stays the colour of a place dot, only louder. The active place, up to eight search hits and the places of an open cluster list are pinned outside clusters.
- **The shown game's places:** the game open in the panel (or chosen in a list) always has every location pinned and labelled, whatever the search or filter, and a shared game link opens on them. Locations without a set order read "Places in the game · N" with pin icons; an ordered journey reads "The journey · N places" with step numbers and a route line.
- **Cluster bullet:** a small flat filled badge like a passport stamp: midnight-ink fill, sheet numeral (number of games, not places), no edge and only a faint shadow (since 8 November 2026; the 2px sheet edge and heavier shadow were the last borders on the map, and the badges shouted over it), 16% smaller than before (26–35px); it turns vermilion on hover. Rejected (3 November 2026): a sheet-filled disc with an ink ring, which turned Europe on a phone into a field of large white circles. Size follows the count on a log scale from 30px (2 games) to 42px, below the 50px cluster radius. Rejected (3 November 2026): 39 to 64px, which let neighbouring clusters lie on top of each other across Europe on a phone (75 hiding 64). On hover it shows a peek card headed by the area ("France · 137 games", or "Several countries" when no country holds 60% of the places), then the three earliest games ("1994 The Clue!") and "+ N more games". Clicking a cluster with 12 games or fewer, or one whose places can't be separated, opens the list right away and fits the map to its places beside the panel, zooming in until they separate (up to zoom 14, never out); bigger clusters zoom in. A cluster holding one game is drawn as a place dot with the number of places in the corner (the same ink count a city with spots carries), so it never passes for a single place, and its list shows the game under every place (elsewhere a game is listed once per cluster, under the place with most games): the point of that list is what happens at each place, and deduplicating collapsed it to one place's heading.
- **Dimmed:** while a game is shown, other dots turn grey and clusters shrink to 80% at 55% opacity, so they never cover the game's labels.
- **Caption label:** ink box, white 14px bold at 85% width, on route stops, the active place and "You".
- **Map labels:** ink boxes with white text, 8px corners like the buttons, 5px vertical and 7/11px horizontal padding, the stop number in a coloured pill with 8px to the name. Rejected: square corners with 3/8px padding (the label clashed with the rounded chrome and the number pill touched the edges).
- **Positioning:** Leaflet owns marker placement, transforms, and standard `Tooltip` placement. Do not give marker icons relative positioning or embed captions in their HTML. Labels use Leaflet's pointer, a 14px anchor offset, and wrap at 240px. Font-load and map-resize events call the public tooltip `update()` API to remeasure their size.
- **Route line:** 4px vermilion, each leg a voyage arc (a quadratic curve in the Mercator plane, bowed 12% of the leg's length, every arc toward the north like flight paths on a world map; a due north–south leg bows east; an out-and-back trip follows the same arc). Rejected (3 November 2026): bowing 18% to the left of travel, which drew eye shapes where a route went there and back and S-bends where legs changed direction (Valiant Hearts), drawn in from the first stop to the last over 1100ms (`.gt-route` with `pathLength` 1). Rejected (3 November 2026): straight segments, which read as a diagram rather than a journey; the draw-in animation had silently stopped working because the class never reached the path.
- Markers are not keyboard tab stops. Keyboard and screen-reader users get the search and the place index instead (see Navigation).

### Story games (default)
Racing and sports happen on a track or a pitch, not in a story, so they are hidden by default (444 of 598 games). The index line then reads "444 story games". The only control is the filter's first choice, "Show: Story games / All games", with a one-line explanation. "All games" counts as an active filter, so the Filter badge shows it and "Reset" brings the story view back. Racing and sports appear anyway when the reader searches, picks one of those genres, or opens a link to such a game or circuit (which adds `?all=1`). Choosing "All games" is kept in the URL.

### Panel
- **List:** a year column and an article per game: the title button, its note (what happens here), then one flowing line of genres · setting · story years · place count · "Wikipedia ↗", and the journey toggle ("Show the journey") for games with a route. The toggle is 36px tall in both states, like the Been here | Want to go control, and never wraps its text; the count lives in the line above so the button stays short beside the Played / Want to play icons, also with large system text. While the route is shown the toggle turns a light vermilion tint ("Journey on the map") and the stops follow as one wrapping line, "① Belém  ② Amazon rainforest  ③ Vilcabamba" (no chevrons between them: the numbers carry the order, and a chevron at the start of a wrapped line looked broken), with the map's numbered discs in the route colour, short names, the current place in bold and the others as quiet underlined links. Rejected (7 November 2026): a filled vermilion toggle plus one 44px chip per stop, which put three stops on three lines on a phone and looked like more buttons of the same kind. No disclosure: everything a row has is visible.
- **Series:** three or more games of one series at the same place collapse into one row ("F1 series · 24 games · 1996–2025 · Show all 24"). The series name is the title before a colon with one trailing number or numeral removed. A series containing the selected game opens by itself.
- **Hidden by filters:** when search or filters exclude the open game, a sand strip at the top of the panel says so and offers "Clear search and filters".
- **Game:** the header carries the year, place count and story years, then one line of genres and credits ("Adventure · by Daedalic Entertainment"), then "Read on Wikipedia". The body is only the places: the journey as a numbered list. Each place has one quiet line under its name: place type · setting dot · "pin marks the area" for approximate pins. No sand fill and no double rule in the game panel; the panel header ends in a 1px hairline like the masthead. Each stop then has only its note, what happens there. No Wikipedia link per stop (since 29 October 2026): the place's own page, one tap away, carries it, and a link under every stop made the list read as a reference table instead of a journey. All metadata about the game lives in the fixed header; the scrolling part is only places.
- **Panel header on phones:** the header must stay short, or the route starts below the fold. Share and Close sit in the top-right corner over the title (absolute, not a flex column), so the lines under the title use the full width. The buttons are centred on the title's first line (or on the Back link when there is one), not on the header's top edge. The genre joins the first line ("2014 · First-Person Shooter · 6 places · set in 1946–1960"), developer and publisher move to the bottom of the panel, and "Played / Want to play" share one row with "Read on Wikipedia" when they fit. Mark buttons never wrap their text: with large system text they drop under each other instead. Checked at 412px with 16px and 20px root font.
- **Index ("All places"):** every place grouped by country (parenthetical notes are ignored when finding the country), with sticky country headings and rows of place name plus game count.
- **Place names:** "Place, Area" for real places; invented ones end with "(fictional)" after the area, as in "Atlantis, Atlantic (fictional)", so the map label (the part before the first comma) stays short. No explanatory parentheses in names; that belongs in the location note.
- **Place type:** canonical geography records have one entity type. Regions, islands, landmarks, circuits and natural features are typed as such, never as "City / town" (a 2026-10-25 sweep fixed 67 records). The place panel and index show it beside the name; the filter can limit the map by type. This facet never replaces or changes per-game real, fictionalized, or imaginary status.
- **Advertisement:** in lists of six rows or more it sits after the fourth row; otherwise at the end, after Nearby and the same-era list, with 24px above it. It always carries the "Advertisement" label and a rule above and below, and never appears on the map, in the masthead, in the filter or in the welcome card. When Google reports the slot unfilled, the whole unit (label and rules) is hidden, so a list never shows an empty box.

### Controls
- **Map buttons** ("Surprise me", "Near me"): the same ink colour on the same white card; the shuffle icon is not an accent.
- **Toolbar buttons** ("Near me", "Filter", "More"): 44px, no visible frame at rest; hover shows a paper fill with a rule border, and an open control fills ink.
- **Index line:** numbers in ink, their labels in uppercase 0.8125rem with 0.06em tracking in soft ink ("486 STORY GAMES / 555 PLACES"), like a map legend. Each number stays on one line with its label. The filter count badge sits on the button's corner so the search field never shifts.
- **Place chips** in the panel: a paper fill without a frame, so a list of places does not become a stack of boxes; hover adds a vermilion border and text. The current place is ink-filled.
- **Chips:** Show, eras and genres share one style: 2px strong-rule border, 0.95rem semibold, 44px on touch and 36px from md, pressed fills ink. Genres wrap as chips, with no nested scroll box.
- **Genre families:** the filter offers six families, not the 22 detailed genres in the data: Adventure, Action, Shooter, RPG, Strategy, Racing & sports (plus "Other" if a new genre is not yet mapped). Each chip shows its game count, and its tooltip lists the genres it covers. Cards keep the detailed genre tag. Links with a detailed genre (`?genre=Stealth`) open its family.
- **Filter order:** Show, Story set in (with era chips), Released, Genre. Time comes before genre. The footer ("Reset", "Show N games") sticks to the bottom above everything that scrolls.
- **Primary** ("Show N games", "Allow"): vermilion fill, white bold, 44px.
- **Focus:** 3px vermilion outline everywhere, including the search field.
- **Skip link:** "Skip the map: browse all places as a list", hidden until focused, first in the tab order.

### Notices
Framed strips at the top centre of the map with a 1px ink border.
- **Status** ("Link copied"): ink fill.
- **Near spelling:** "Nothing matches “firewath” exactly. Showing similar spellings."
- **Empty:** names the problem, explains that fantasy worlds aren't mapped, and offers Clear search, Reset filters and Suggest a game (when configured).

### Search behaviour
- **A search ends when you open something.** Typing filters the map and the suggestions live. Opening a game, a place, a country or a cluster list, from the suggestions, the map, a panel link or the results, clears the text and empties the field, so the thing you opened shows in full: every game at the place, every place in the game. The genre, year and setting filters stay; they are choices, the search was a question. The browser's back button returns to the search (the address held `?q=`), and the panel's own Back restores the query it came from. Typing replaces the address in place, so one search is one history entry whatever was typed on the way. Rejected: keeping the query as a filter after opening (readers tapped a city, then the next city, and saw "no games" because a word they had typed a minute earlier was still filtering); clearing the filters as well (resetting a year range because you opened a place is a surprise, and the "Hidden by filters" strip already handles the rare case).
- **The list comes back with focus:** the suggestion list opens while typing and closes on Escape, on a tap elsewhere or on Tab. Returning to the field with text still in it, by click, Tab or the `/` shortcut, opens it again; it used to need another keystroke. The popup is controlled (`open` + `onOpenChange`, `openOnInputClick`, and `onFocus` opens it when there is a query).
- When the query appears in a suggested game title, games are listed first (up to five), then up to three places, so Enter opens the game. The "Nothing matches … exactly" line sits at the top of the dropdown as well as on the map, and leaves the map once a game is open.

Near spellings (one wrong letter in short words, two in long) are shown only when nothing matches as typed, and are flagged with the notice above. Letters scattered across a long title are not a match.

### Welcome and consent
- **Welcome card:** bottom left. "Places you've / played before." in condensed Archivo, the second line vermilion. The text explains what the numbers mean, followed by three start cities. "More → Start over" brings it back.
- **Consent strip:** one short sentence with Reject / Allow. It waits until the welcome card is gone.

### My atlas
Personal marks, stored only in this browser (`localStorage` key `game-traveller:my-atlas`). Nothing is sent anywhere.
- **Marks live on the game page, not in lists** (since 30 October 2026): a game row in a place list shows no buttons, only a quiet "Played" or "Want to play" pill if the reader has marked it. The two icon-only buttons (a tick and a flag) on every row were not understood, and marks are a secondary feature most readers never touch. Marking a game means opening it, where the buttons carry their words.
- **Names:** places get **Been here** and **Want to go**; games get **Played** and **Want to play**. The feature is **My atlas** everywhere (header button, panel, filter section, menu). Never "visited", "wishlist", "favourites" or "Played" on a place.
- **Privacy line:** "Saved in this browser only, nothing is sent anywhere. Export a copy to keep it or move it." stands above Export and Import, where it explains why one would export, not under the panel title, where it pushed the numbers down (moved 1 November 2026).
- **Header button:** "My atlas" with its icon, no counter; the number of marks says nothing useful there. The numbers live in the panel.
- **Countries are places, drawn as shapes:** every country with a game inside it is a clickable shape (Natural Earth borders, public domain: 1:110m in the world view, 1:50m from zoom 4, both loaded on first use and repeated on the world copies). At rest a country is a faint ink hairline (20% at 1:50m, 14% in the world view); it turns vermilion only when open or active. Rejected (3 November 2026): vermilion hairlines at rest, which drew red borders across all of Europe; it fills on hover, as a search hit, and when open (2px outline, 16% fill). Opening a country shows every game with a place in it, grouped by place, and the map flies to the shape; places outside the country are dimmed, as they are when a game is open (a cluster is dimmed when none of its places lies in the country), so the map shows what the panel lists without hiding the neighbours. A game set in a whole country (Turkey, Poland) gets a ringed dot, like a region, 20px below the country's label point so it sits under the basemap's country name rather than on its first letter; it counts in the clusters and opens the country. While that country is open and its outline is drawn, the dot is left out (outline and dot together were too much, 8 November 2026); zoomed in to 7 or closer, where the shapes are no longer drawn, the dot is back. Since 7 November 2026: without it a phone, which has no hover, showed Iceland with one dot at Vík while two more games were set in the whole country, and cluster numbers left those games out. Countries you have been to, directly or inherited from a place inside, get an 8% ink tint with no border: a quiet scratch map under the pins. A country stop on a route keeps its numbered label but no dot. Countries without a record of their own (United States, United Kingdom, Russia…) get one from Natural Earth so they can be opened and marked; `scripts/build-countries.mjs` creates them, decides which country every place lies in (point in polygon, then the name), and feeds the "N countries" line on the Been here tile. Rejected until 7 November 2026: no dot for a whole country (the shape alone was invisible on touch screens). A country that fills the screen is background, not a target: after every move 25 points across the map are sampled, and when 80% of them hit one country it takes neither hover nor click (since 3 November 2026; zoomed in on Kansas the whole map was one "United States · 249 games" label and any click opened the country).
- **Micro-states keep their pin:** a country under 2 square degrees (Malta, Singapore, Bahrain, Kiribati, Cyprus, Jamaica…) is a speck as a shape in the world view, so its country-level place keeps the pin as well; the pin opens the country. Countries missing at 1:110m are copied in from 1:50m, so every country exists at every zoom, and a country code that Natural Earth puts on several records (Australia and its ocean territories) keeps only the largest.
- **Countries with only racing and sports games** (Finland, Bahrain, Estonia…): opening the country switches on "All games" by itself, as a place link does, so the panel is never empty.
- **Country address:** `?country=<slug>` (no prerendered page yet); `/place/turkey` opens the country too.
- **Been here is inherited upwards:** Bangkok marks Thailand, London marks England and the UK, wherever those places exist in the atlas (via `parentId` and via the name's trailing parts). The inherited place shows the check on the map, counts in "Been here", lists as "Thailand · via Bangkok", and its panel shows a pressed, non-clickable "Been here" with "Counts as visited: you've been to Bangkok." Only the place you marked is stored and exported; unmarking it clears the inheritance. Want to go is never inherited.
- **Only places you can visit:** a place shown only as imaginary (Atlantis, invented islands), or one the game made up (a record named «… (fictional)», such as the Big Shell or Shadow Moses), has no Been here / Want to go, no pill, and is left out of "Not been yet" and of the total the Been here share counts against (since 1 November 2026: the Big Shell offered Been here on a pin that is only our guess). Fictionalized versions of real places keep them (Los Santos has Los Angeles behind it), and so does a real city that holds an invented spot.
- **Route notes tell the journey:** the note under a route is one sentence about where the story goes. It never says what was left off the route, which parts can be played in any order, or what a source says (1 November 2026: 40 notes ended with "… is left off"). Such choices are reported, not shown.
- **No categories in names:** a place's name is only its name. Whether the game invented it is the field `fictional: true` (`legendary: true` for Zerzura), and the label "(fictional)" is generated from it (`placeLabel`) wherever the full name is shown or becomes an address, so the old page addresses stand. Since 1 November 2026: 137 names carried "(fictional)" or "(fictionalized)" written by hand, in two spellings for the same thing. The 35 addresses that said "fictionalized" redirect to the generated "fictional" one. `validate:data` rejects a category in a name. Nor does a name carry how one game uses the place: "Mexico (Landrush)", "Panama (alternative route)", "Pakistan (including Karachi)" and nine more were merged into the real place or the town in the brackets on 1 November 2026, with redirects. Brackets stay only for a place's other real name ("Gdańsk (Danzig)", "Stalingrad (Volgograd)").
- **Invented places in the title:** the place panel shows an invented place's name without «(fictional)» and says it in the meta line instead ("Invented venue · …", "Legendary" for legends). With the parenthesis "Big Shell, New York (fictional)" broke over two lines beside the share and close buttons on a phone. Page titles, slugs and search keep the full name. A place that is real in one game and imaginary in another keeps them, but the pill is hidden on the imaginary location.
- **One or the other:** a place is Been here *or* Want to go, a game Played *or* Want to play; choosing one clears the other. If both arrive (import, merge, old data), what you did wins.
- **Icon weight:** Lucide at stroke 1.75 for buttons, menus and links; 2 for close, chevrons and other small marks; 2.25–2.5 only for ticks and pills under 16px. The 2.25–2.75 used before 8 November 2026 looked heavy beside the text, above all in dark mode.
- **Icons:** one shape per meaning, the same on buttons, tiles, pills and map badges: a check for what you did (Been here, Played), a flag for what you want (Want to go, Want to play). Rejected: a pin with a check (too fiddly at 18px), a gamepad for Played (reads as "play this game" when it stands alone in a list row), a bookmark for Want to play (a third metaphor).
- **Places are points:** a mark is saved on every place id at the map point (London, UK / London, England, UK), and counts, lists, CSV rows and the Table Editor table count points, not records.
- **Map:** the dot keeps its colour for real/fictionalized/imaginary; a 16px corner badge says what you did there: ink circle with a check for Been here, white circle with a vermilion flag for Want to go (Been here wins if both). Clusters carry an ink "✓N" pill with how many of their places you have been to. Games have no badge on the map.
- **Filter:** "My atlas" is the first filter section, shown once something is marked. Places (Been here / Want to go / Not been yet) and Games (Played / Want to play / Not played yet) are independent; a games choice shows the places of those games. The panel's number tiles toggle the same filter, and a notice on the map says what is hidden, with "Show everything".
- **Everything in the panel, nothing in More:** My atlas is what gets exported and imported, so it all lives there. The More menu stays Start over, About, Privacy, plus Appearance at the bottom (since 8 November 2026): System · Light · Dark as a filled three-way switch; System (the default) follows prefers-color-scheme, the choice is kept in localStorage, and switching is live, without a reload: the CSS tokens follow `data-theme`, the vector map is repainted layer by layer with setPaintProperty (setStyle would drop the country shapes and other layers added to the map), and the route lines, country shapes and polar areas read their colours from `getPalette()` when drawn and repaint on the change (`useIsDark`). With System chosen, the page also follows the device when it switches while the page is open. Rejected: a reload on every switch, which lost the map view and the panel's scroll position and flashed the screen. The panel is three groups, each under a rule: the four tiles (Been here and Played carry their share on a third line, "of 597 places · <1%", counted against places you can visit and story games, as in the header; no space before % in English); the file actions Export CSV · Import CSV… as two buttons (Import only while empty), with "Open as a table… on truben.no/table, where you can sort it and copy it." as a quiet link under them, since "Table Editor" means nothing to a visitor (an ellipsis on what opens a dialog, no ↗ since the dialog opens the tab); and at the bottom Restore cleared atlas and Clear my atlas… in the same bordered button style, Clear in red. Countries are not counted: too many places lack a country link for the number to be right. Rejected: one list per tile under the file actions (removed 8 November 2026: the tiles already filter the map to the same places and games, and the lists made a long panel nobody scrolled), the hint "Select a number to show only those on the map" (the tiles' tooltip says it; a notice still says how to undo when a filter is on), a separate "Been there, played it" list (it repeated the Been here rows) and the names "Next trips", "Places you've been", "Games you've played" (second names for the tile concepts).
- **CSV:** `type,id,name,been_here,want_to_go,played,want_to_play,updated`, UTF-8 with BOM, "yes" or empty. The id is the place id or the game page slug; import falls back to the name and lists skipped rows. Import offers Add (default) or Replace.
- **Table Editor:** opens truben.no/table with the table in the link (`#d=`, compact format v2, header row, Been here / Want to go / Played / Want to play as checkbox cells (TRUE/FALSE with the checkbox format, centred columns), `op=0` so the output panel starts closed, caption "My atlas · Game Traveler · <date>"). No output format is set in the link; Table Editor chooses it. Limit 50,000 cells.
- **Clearing:** "Clear my atlas?" names the counts, puts focus on "Keep my atlas", and the red button names the exact number. Clearing (and Import › Replace) moves the old value to `game-traveller:my-atlas:cleared` first; a 10-second "Undo" message follows, and More › Restore brings it back later (Merge or Replace if new marks exist; Replace sets the current marks aside so it can be undone too). Only one cleared copy is kept. If the browser refuses to save, nothing changes and the reader is told.

### Stop labels on the map
Each numbered stop label is placed away from its nearest other stop (left/right when the neighbour is mostly beside it, above/below otherwise), then the first direction wins that keeps the label on the visible map (above the bottom sheet on phones, clear of the map buttons top right) and off the labels already placed. When no side is free for the full name, the label shrinks to the route number alone (the name returns on zooming in); only when not even that fits does a full label sit where it must. Recomputed on zoom, move, resize and when the sheet finishes sliding. Rejected: alternating above/below by stop number (stops stacked vertically collided).

### Motion
One easing curve (expo-out). Opening a place keeps the current zoom when you are already close and otherwise zooms in to a floor that depends on the place: 8 for a city, town, landmark, venue or island (the city and its neighbours fill the view), 6 for a region, river or sea, 11 for a spot inside a city; it never zooms out. Before 29 October 2026 the floor was 5 for everything, and a click on Brest from the Europe view left it a dot among the clusters. The panel slides in over 260–420ms, the camera flies in 0.8–1s, and the route draws in 1.1s. Everything collapses under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep the basemap faint and overprint only what can be acted on.
- **Do** explain the rules to the reader: the More menu has "How places are chosen", a second tab of the info dialog, which restates in plain words what counts as a place, the three settings, dots versus sites versus country shapes, places within places, journeys, the link policy and My atlas. The About tab links to it.
- **Do** give buttons and fields a filled surface instead of a border, in both themes (since 8 November 2026; dark mode first, 7 November): the search field, filter button, Been here | Want to go, the round marks, the journey toggle and the filter chips use `--control` (ink 6% on the sheet; 8% light on dark), selected states keep their solid fill, and what floats over the map (map buttons, zoom) is a white card with a soft shadow, a lighter surface in dark mode. Hairlines use `--line` (10% ink; 9% in dark mode), the sheet has no side borders, the basemap's country borders are 20% (light) or 13% (dark), and countries with games carry no hairline at rest, since the basemap already draws the border. Rejected: borders on every control and two border lines on top of each other, which read as a net of strokes. Where the world is shorter than the map (fully zoomed out on a phone), the area above 85°N is drawn as sea and below 85°S as ice in the map's own colours, not the land colour the basemap fills in there.
- **Do** keep only the title row of a panel fixed (back arrow, title, share, close); the place or game details (meta line, description, Been here | Want to go) are the first part of the scrolling list and scroll away with it, one to one with the finger. A hairline and a soft shadow appear under the title row once anything lies beneath it. The way back is an arrow before the title, named "Back to …" for screen readers and on hover. Since 7 November 2026. Rejected: a fixed header that collapsed in one 117px animated step once the list was scrolled (and grew back at the top): on short lists (Belém, one game) the step was larger than the list could scroll, and on every list the content jumped while the finger moved; also a separate "Back to …" row above the title, which cost a line in every panel.
- **Do** reopen a panel where the reader left it: the panel's scroll position is written to the history entry while scrolling (url.ts, rememberPanelScroll) and kept when the address is only replaced, so the browser's back button restores it; the panel's own "Back to …" keeps a scroll position per step. A new panel still opens at the top, or at the game being followed (since 4 November 2026).
- **Do** give the browser's back button something to go back to: opening a place, game, country or search pushes a history entry (filters, route choice and map moves replace the address in place), and popstate rebuilds the panel, filters and map from the address exactly as a page load does. Rejected: replaceState for everything (the back button left the site after any number of taps).
- **Do** draw the country shapes in the vector basemap (MapLibre, on the GPU), not as Leaflet SVG: Leaflet re-projected every polygon vertex on every zoom change, and that, not clustering, was most of what a zoom cost (333ms of a 4-zoom profile). The shapes are one GeoJSON source per scale keyed by ISO code; games, open, been and hover are feature state, so nothing is re-sent when the selection changes, and the layers sit under the basemap's labels. Hover and click come from the Leaflet map and are looked up with queryRenderedFeatures. The SVG layer remains only as the fallback when the vector basemap fails. The atlas tone of the basemap (grayscale 0.85, sepia 0.18, contrast 0.78, brightness 1.08) is baked into the style's colours at load (basemapTone.ts) instead of a CSS filter on the canvas: the filter desaturated everything drawn in the canvas, including the vermilion country shapes, and cost a full-canvas filter pass per frame. The same filter still applies to the raster tile fallback. The 1:50m borders are also simplified at build time to 0.02° (under a pixel at zoom 6.75, the last level before the shapes hide at 7; 100k vertices became 52k) and the 1:110m ones to 0.03°.
- **Do** keep the catalogue in its own script chunk, parsed with JSON.parse (several times faster than object literals for a megabyte of records), preloaded next to the app; and ship the italic wordmark face as a 23KB instance (opsz 20, weight 450–500, basic Latin) instead of the 144KB variable file.
- **Do** zoom a touchpad pinch fractionally around the cursor. A pinch arrives as ctrl+wheel events with small deltas; Leaflet's wheel handler batches them and rounds each batch up to a whole level, so a pinch on a Windows laptop hopped level by level. While the pinch lasts the layers are scaled with CSS, the way Leaflet's own finger pinch works (map._move with pinch), and the map lands on a zoom level with a single zoomend when it stops; setting the zoom per event cost 20 to 240 ms each, because every zoomend rebuilds clusters and labels. About one level per 40px of pinch. The desktop map snaps to quarter levels (phones to halves), so fits land closer to their places. Scroll-wheel notches still step about one level.
- **Do** keep a second level of places, spots, inside cities: a site record (park, castle, square) whose parent is a city or neighbourhood, and only those: a church in Cornwall or a castle in Bavaria stands on its own, since a region is not a place you are "inside" the way you are inside Lisbon (with regions on the list, Barrow Hill's page grew an invented "Cornwall, England" row with the stone circle nested under it). The game rolls up to the city, which lists it with an "At …" row of chips naming the spots, and the spot itself appears on the map only from zoom 12 as an ink diamond with its name under it, so the world and country views stay as they are. Opening a spot zooms to at least 12. Opening any place zooms in until no other dot lies within the cluster radius of it (up to 14), so the pinned dot never sits on top of a cluster of the places it was just listed with (Rennes-les-Bains opened over a "2"). A city that has spots under it carries a small count in the corner of its dot below zoom 12, and opening it frames the city with its spots (up to zoom 14) and shows those spots at whatever zoom the frame lands on, so a dot never hides five places behind it (Rennes-le-Château looked like one place with five sites underneath). On the game page the list says where you are and where in it: the city is the row, and its spots sit indented under it with a diamond, each clickable; a journey stays a flat, numbered list. A game set wholly in one spot lists only the spot, so with the game open the map marks the park, not the park and the city on top of each other; the city row on the game page is synthesised from the catalogue. A city and its spots are one place at two sizes: "Nearby" on a city leaves out its own spots (they are its "At …" chips) and on a spot leaves out its city, and a city whose games all come through its spots (Incheon via Songdo, Siena, Masyaf) still gets its own prerendered page (since 3 November 2026; before, those addresses returned 404). Rejected: spots as ordinary pins at every zoom (a dozen dots on top of Lisbon at the world view); spots only in the list (nothing to find on the map).
- **Do** let the world scroll as far south as the phone sheet covers, so the strip above the sheet can show Antarctica and large countries; otherwise every southern fly gets panned back north and the country ends up under the sheet. A panel that is open in React but whose sheet is not yet in the DOM counts as a sheet at 62%, both for fits and for the world limit; otherwise the limit centres the world in the full map for a moment before the sheet arrives and the stops end up under it. The world limit is enforced in pixels on `moveend` (not with Leaflet's `maxBounds`: Mercator clamps latitude at 85°, so a limit below the world cannot be expressed as a LatLngBounds). Country shapes (the selected country, the been shading) are drawn only below zoom 7: closer in, the country is larger than the screen and its fill became a veil over the whole map (8 still felt late: at 7 a country already fills most of a phone screen). A country opened on a phone by tapping its shape (or from its address) puts the sheet at its peek height (104px) and fits the country to the whole map above it with 16px margins; a country opened from its dot or a link (a game's place list, search) opens like a place, with the sheet at 62% and the country fitted above it, since 7 November 2026: the sheet follows what was tapped. Any other new content lifts the sheet back up. The peek belongs to that one panel (its sequence number), not a counter: a counter was re-read every time the panel was rebuilt, so after one country every place opened later came up as a strip. A tap on a dot, cluster or label never also opens the country under it. Rejected: fitting a country above a 62% sheet (the strip is about 180px on a phone: Norway was a speck at zoom 3 and the United Kingdom a 60px sliver under two clusters). Phones zoom in half steps down to 1 (desktop: whole steps from 2), because the strip is small: Russia fits at 1.5 and a route round the whole world (an F1 season) at 1; when the world is shorter than the map it is centred in the strip rather than pinned to the top. The minimum zoom never changes while the map lives: the cluster layer builds one grid per zoom level down to the map's minimum when it is added, and a minimum that moves afterwards either hides the pins that stand alone (Hawke's Bay vanished on desktop when the layer was built for 1 and the map's minimum was 2) or crashes when such a pin is removed (Murmansk, the other way round). Rejected: min zoom 1 only while a sheet is open, 2 otherwise. Fits for a sheet are always computed for the 62% sheet, whatever the sheet is doing: a sheet at peek goes back up when new content opens, and a sheet at 90% covers nearly the whole map, so a fit computed for it zoomed Norway out to the world. A cluster list is fitted with pin margins only (24px left, 32px top, 16px above the sheet, 72px right for the map buttons), not the 56/60px label margins that routes get: the strip above the sheet is about 180px on a phone, and with label margins the Oslo-area cluster stayed exactly as tight as it had been clustered. Every fit keeps at least 80px of height even when the sheet covers more, so it never collapses to the minimum zoom. The panel's sequence number only ever grows, also after the panel has been closed: the country layer remembers the sequence it last fitted, and when the count restarted at 1 after a close, the next country tapped got the same number and was never fitted (zoom in a little, tap Brazil, and only its top showed above the sheet). A point that is a whole country opens the country even when a fictionalised area record shares its coordinates (Greece, India); country records sit on the country's label point, not on a city (Germany's sat on Trier, Turkey's on Marmaris, Kenya's on the Safari Rally). The fit covers the country's main part (the polygon holding its label point), the other parts within 8° of the label (archipelagos: the Bahamas, Palau, both islands of New Zealand, Crete, Corsica) and its places with games within 12° of the label: Norway's mainland without Svalbard (16° north of the label) or Jan Mayen (18° west; it cost a zoom level on phones and showed mostly sea, and it stays in the panel), Greece with Crete, France without French Guiana, the USA without Hawaii, Easter Island left to the panel. Rejected: all parts within 35° (Svalbard forced Norway to zoom out to the whole North Atlantic); the main part alone (the Bahamas, Palau and Kiribati were framed on one island with the rest of the chain off screen, and New Zealand on the South Island only).
- **Do** let the map go round the world: panning east past Japan arrives in the Americas (`worldCopyJump`), and markers, routes and pins repeat on each copy. Only latitude is bounded, so there is no grey void above the Arctic or below Antarctica. Rejected: a longitude limit at ±180° (it stopped the map at the date line).
- **Do** show games, not just counts, as early as possible.
- **Do** keep every overlay docked to an edge and never stack two over each other.
- **Do** offer a non-map path (search, place index) to everything on the map.
- **Do** set titles and years in condensed Archivo, and controls and text at normal width.

### Don't:
- **Don't** use Newsreader outside the wordmark and tagline, or fall back to a system serif.
- **Don't** use uppercase for headings; only genre tags are uppercase.
- **Don't** put shadows on docked panels, or use heavy shadows anywhere; only floating elements get the one soft shadow.
- **Don't** show raw coordinates or cartographer jargon to readers.
- **Don't** add a game just because a real place is in its title or on its box. The place has to be depicted: a recognisable street, landscape or landmark the player moves through. Chicago 90 (a grid labelled Chicago) and Test Drive II's scenery disks (generic roads labelled with six countries) were added on 30 October 2026 and taken out the same day; Test Drive III stays because its Northern California run from the coast to Yosemite is drawn as that landscape.
- **Don't** open a location note by restating where it is ("The Italian stop", "The Swiss stop", "The Greek level"): the reader is looking at Venice, so the note starts with what happens there. Don't cite the source in the note either ("named by the publisher", "the source identifies"); the note says what happens, the source field says where we got it.
- **Don't** explain pin placement in a location note when the place is real ("the pin marks the country", "representative anchor"): the quiet line under the place already says "pin marks the area", and the note says what happens there. When the pin is an interpretation, that is, the place is invented and we chose where to put it, the note may say why in a few words ("pinned on Duloe stone circle, which the designer walked"), and the fictional place's own record always does. Refined 30 October 2026: the explanation is allowed for invented places, never required, and never for real ones.
- **Don't** place ads before the reader has seen any games.
- **Don't** fabricate imagery; IGDB covers are the only pictures.
