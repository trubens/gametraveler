---
name: Game Traveller
description: Video games placed on a world map by where their stories happen, printed like a 1990s games-magazine fold-out.
colors:
  ink: "#121214"
  ink-soft: "#46464d"
  paper: "#f7f7f5"
  sheet: "#ffffff"
  rule: "#d9d9dc"
  magenta: "#d4006f"
  magenta-deep: "#a8005a"
  cyan: "#00a3e0"
  yellow: "#ffe100"
  map-ground: "#e4e4e6"
  marker-dimmed: "#9a9aa0"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  masthead:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
  numeral:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
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
  subhead:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.025em"
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
  snug: "6px"
  tight: "8px"
  gutter-mobile: "16px"
  row: "20px"
  gutter: "24px"
  control-height: "44px"
  masthead-height: "64px"
components:
  masthead:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.masthead}"
    height: "{spacing.masthead-height}"
    padding: "0 24px"
  button-primary:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "{spacing.control-height}"
  button-primary-hover:
    backgroundColor: "{colors.magenta-deep}"
  button-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-outline-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  button-outline-pressed:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.sheet}"
  button-masthead:
    backgroundColor: "rgb(255 255 255 / 0.1)"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "{spacing.control-height}"
  button-masthead-open:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
  button-icon-hover:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    size: "44px"
  button-zoom:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "44px"
  button-zoom-hover:
    backgroundColor: "{colors.yellow}"
  input-search:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 40px"
    height: "{spacing.control-height}"
  slider-thumb:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.full}"
    size: "24px"
  slider-thumb-active:
    backgroundColor: "{colors.yellow}"
  chip-place:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body-data}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  chip-place-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  chip-era:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body-data}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "{spacing.control-height}"
  chip-era-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  tag-genre-cyan:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  tag-genre-yellow:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
  tag-genre-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  tag-genre-outline:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
  panel-spread:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "420px"
  panel-subhead:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.subhead}"
    padding: "16px 24px 8px"
  panel-filter:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px"
    width: "400px"
  cover-image:
    rounded: "{rounded.none}"
    width: "64px"
    height: "85px"
  notice-status:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  notice-empty:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  map-marker:
    backgroundColor: "{colors.magenta}"
    rounded: "{rounded.full}"
    size: "16px"
  map-marker-active:
    backgroundColor: "{colors.ink}"
    size: "22px"
  map-marker-dimmed:
    backgroundColor: "{colors.marker-dimmed}"
  map-cluster:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.cluster-numeral}"
    rounded: "{rounded.full}"
    size: "38px"
  map-cluster-single:
    backgroundColor: "{colors.magenta}"
    size: "20px"
  map-user:
    backgroundColor: "{colors.cyan}"
    rounded: "{rounded.full}"
    size: "18px"
  map-label:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.map-label}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
---

# Design System: Game Traveller

## Overview

**Creative North Star: "The Fold-Out Supplement"**

The map is the centre spread of a 1990s games magazine, pulled out and laid flat. The world is printed in a single grey ink, and everything the reader can act on is overprinted in CMYK process colour: magenta dots for places, black numbered bullets for clusters, a magenta route line for the selected game's journey, and small black caption labels naming the stops along it. Chrome sits at the edges like a magazine's furniture: a black masthead strip across the top, and a feature spread that docks to the left (desktop) or rises as a bottom sheet (phone).

The type is Archivo in two widths. Headlines are condensed and heavy, the way magazine features set their titles. UI text stays at normal width. Release years carry as much weight as game names, set as large tabular numerals in their own column. Depth comes from ink rules, never from soft shadows or floating cards: heavy 3px rules mark seams, 2px rules frame controls, 1px hairlines divide rows. Every corner is square. The only round forms are the dots printed on the map and the few marks that echo them. The one kind of picture in the product is a game's cover from IGDB, printed small and framed in ink like a thumbnail in a review column.

The density is generous on purpose. The audience is 30 to 60, so app text never drops below 13px (only Leaflet's attribution line is smaller, at 12px), interactive targets are 44px tall on touch, and contrast is ink on white. UI copy is English.

**Key Characteristics:**
- Grey single-ink map; colour only where there is something to act on.
- Magenta is the one action and route colour; cyan, yellow and black sort genres.
- Condensed heavy Archivo caps for titles, normal-width Archivo for UI.
- Ink rules for seams and edges, square corners on everything except map dots.
- The year comes first: tabular numerals in their own column.
- Place names on the map are set as captions: ink boxes, white condensed bold, no arrow.

## Colors

Glossy white stock, black ink, and the four process inks, with the map knocked back to one grey.

### Primary
- **Process Magenta** (`magenta`): the single action and route colour. Map place dots, the single-game cluster dot, the route polyline, the primary button, the pressed route toggle, the active-filter count badge, slider fill, the global focus ring, the step numbers in a game's journey list, the "Clear search" and "Reset filters" links in the empty notice, and the hover colour of game names, place names, sub-headings and place chips. It is also the route in the favicon and the Open Graph image.
- **Deep Magenta** (`magenta-deep`): hover state of the primary button only.

### Secondary
- **Process Yellow** (`yellow`): the highlight ink. "Traveller" in the masthead, the era span in the issue line, hover fill on icon buttons (Share, Close) and zoom controls, the open Filter button, the ring on active and pinned markers, the slider thumb while dragged, text selection, and (at 30% opacity) the selected game row. On the black masthead it is also the focus outline for the search field. In the brand marks it is the ring of the terminal dot and "TRAVELLER" on the Open Graph image.

### Tertiary
- **Process Cyan** (`cyan`): genre tags and the reader's own position dot. Neither is a control: cyan has no interactive meaning.

### Neutral
- **Ink** (`ink`): all text, the masthead strip, cluster bullets, active markers, map caption labels, the transient status notice, every structural rule, the current-place chip, the active era chip, the cover frame, the field of the favicon and Open Graph image, and one of the genre tag inks.
- **Soft Ink** (`ink-soft`): secondary text such as definition-list terms, the meta line under a title, "Set in" lines, section meta ("5 games", "120 km away"), location notes in the journey list, the "Back to …" button, the panel footer, placeholders and icons in fields, the disabled Reset button, the scrollbar thumb, and (at 50%) the bottom-sheet handle.
- **Sheet White** (`sheet`): panel and filter surfaces, input fields, the empty-state notice, marker and cluster rings, and (at 85%) the attribution strip.
- **Paper** (`paper`): the root page background behind the app frame.
- **Hairline Grey** (`rule`): 1px row dividers, the unfilled slider track, and the 2px border of an idle era chip.
- **Map Ground** (`map-ground`): Leaflet's backdrop before tiles load. Tiles are OpenFreeMap "Positron" vector tiles drawn by MapLibre inside Leaflet, with labels forced to English, then desaturated through `grayscale(1) contrast(0.92) brightness(1.04)` on the GL canvas (and on the raster tile pane if the style fails and OpenStreetMap tiles take over).
- **Dimmed Dot** (`marker-dimmed`): places off the current route while a route is shown.

### Named Rules
**The One Action Ink Rule.** Magenta means "act here" or "this is the route". Never use it for genre, decoration or a passive label.

**The Process Ink Rule.** Genre tags take one of four fixed treatments: cyan, yellow, black, or a 2px black outline, assigned by a stable hash of the genre name so a genre always looks the same. Magenta is never in that set.

**The Single Grey Map Rule.** Map tiles are always desaturated, whatever renders them. The map must not compete with the overprinted dots, labels and route.

## Typography

**Display Font:** Archivo Variable, width axis at 68% (with system-ui, sans-serif)
**Body Font:** Archivo Variable at normal width (with system-ui, sans-serif)

**Character:** One family in two widths. Condensed weight 800 gives magazine-cover headlines. Normal width keeps controls and data plain and easy to read. Map captions and cluster numerals sit between the two, at 85% and 80% width.

### Hierarchy
- **Display** (800, 2.5rem from md up / 1.6rem on phone, 0.95, condensed, uppercase, balanced wrap): the title at the top of the spread (place, game, search term, "Near you"). On phone it clamps to two lines.
- **Masthead** (800, 1.9rem from md up / 1.6rem on phone, 1, condensed, uppercase): the "GAME TRAVELLER" nameplate and the "Filter" heading (1.6rem at every width).
- **Headline** (800, 1.6rem, 1.05, condensed, sentence case as in data): game names in the spread.
- **Numeral** (800, 1.9rem, 1, condensed, tabular lining figures): release year in the left column of each game row.
- **Subhead** (700, 0.95rem, +0.025em, uppercase): sticky place sub-headings inside a multi-place spread, and the "Nearby", "Set in the same era", "The journey" and "Where it takes place" headings.
- **Body** (400, 1rem, 1.5): desktop issue line, the meta line under a title, field text, notices. At weight 700 it sets the place names in a journey list and the game names in the same-era list; at 600 the Reset text button and the release year beside a same-era game.
- **Body Data** (500, 0.95rem): developer and publisher values, chip and route-button text, era chips (600), the "Back to …" button (600), location notes (400, line-height 1.375, in ink in a place list and soft ink in a journey list).
- **Label** (600, 0.875rem): field labels, slider legends, the active-filter badge, section meta, journey step numbers (700, magenta); story-year lines and the panel footer use 0.875rem regular in soft ink. The mobile issue line is 0.8125rem semibold.
- **Tag** (700, 0.8125rem, +0.025em, uppercase): genre tags only.
- **Cluster Numeral** (750, 17px, 15px from 100 games up, 80% width, tabular): the game count inside a cluster bullet.
- **Map Label** (700, 14px, 85% width): caption labels on route stops, the active place and the reader's position.
- **Attribution** (400, 12px): Leaflet's attribution line only. This is the single step below the 13px floor; it is third-party chrome and never a model for app text.

### Named Rules
**The Two Widths Rule.** Condensed widths are for titles, names and years. Controls, data and running text stay at normal width.

**The Tabular Years Rule.** Every year, count and range readout uses tabular lining numerals. Years before 0 are written as "N BC", and spans as "49 BC–2017".

**The Ramp Rule.** Sizes come from this ramp and nowhere else: 2.5 / 1.9 / 1.6 / 1 / 0.95 / 0.875 / 0.8125 rem in the chrome, plus 17 and 15px cluster numerals, 14px map captions and the 12px attribution line on the map.

## Layout

The frame is a full-height column (`100dvh`): a black masthead 64px tall, with the map filling everything below it edge to edge. Overlays never float as cards. They dock flush to an edge and are separated from the map by a 3px ink rule. Stacking is fixed: masthead above the spread, spread above the notices, notices above every map layer.

- **Desktop (≥768px):** the issue line sits on the nameplate's baseline. Search (max 448px wide), the "Near me" button and the Filter button align right in the masthead with 20px gaps. The location spread docks left at 420px and runs the full height of the map; the camera shifts a target 210px to the right so it lands beside the spread, and fits bounds with 470px of padding on the left. The filter sheet hangs from the masthead 24px in from the right edge, 400px wide with 3px ink rules on both sides and the bottom, capped at `100dvh − 8rem` and scrolling inside. The "Near me" label appears only from lg (≥1024px); below that the button is icon-only.
- **Phone (<768px):** nameplate and issue line stack, "Near me" and Filter stay top right, and search drops to its own row inside the masthead (16px gutters, 12px below). The spread becomes a bottom sheet capped at 62% of the map height with a 3px top rule; tapping the handle at its top expands it to 90%. The camera shifts a target up by 31% of the map height so it sits above the sheet. The filter sheet spans the full width under the masthead with a 3px bottom rule.
- **Rhythm:** a 4px Tailwind base. Spread gutters are 24px, mobile masthead gutters 16px, game rows 20px top and bottom, chips and tags 8px apart, era chips 6px apart, filter fields 24px apart. Game rows use a two-column grid: a 4.25rem year column and the article. The same-era list reuses that grid; the journey list uses a 1.5rem number column.
- **Map furniture:** the zoom control sits bottom right, the attribution bottom right beneath it. Notices stack top centre, 24px down and 16px in from the sides, 8px apart.

## Elevation & Depth

The chrome is flat. Depth is expressed as printed rules, not light: a heavy 3px ink rule marks every seam between chrome and map, and the spread header uses a heavy rule with a 1px hairline beneath it, like the double rule under a magazine article title. Place sub-headings stick to the top of the scrolling list on a sheet background with a 1px ink rule beneath. Rows are divided by 1px hairlines in `rule` grey.

The only shadows in the system are small halos under the map dots and cluster bullets. Together with their white rings, they keep the overprint readable on the grey map. They are scoped to map markers and must not migrate to panels, buttons, cards, labels or slider thumbs. The reader's position dot draws a hard 2px ink ring with a zero-blur box-shadow; it is an outline, not a shadow.

### Shadow Vocabulary
- **Dot halo** (`box-shadow: 0 1px 3px rgb(18 18 20 / 0.45)`): single place dot at rest. Removed when dimmed.
- **Bullet halo** (`box-shadow: 0 2px 6px rgb(18 18 20 / 0.35)`): cluster bullet, including the single-game dot.
- **User ring** (`box-shadow: 0 0 0 2px var(--color-ink)`): the ink outline around the cyan position dot's white ring. No blur.

### Named Rules
**The Ink Rule Rule.** Seams are rules, not shadows. Use 3px ink for structural edges (masthead to panel, panel to map, filter frame, notices), 2px ink for control frames and the cover image, and 1px for dividers (hairline grey between rows, ink under a sticky sub-heading).

## Shapes

Every surface, button, field, chip, tag, label and image has square corners (0px). Circles (full radius) are reserved for things printed on the map (place dots, cluster bullets, the single-game dot and the reader's position dot) and two small data marks that echo them: the active-filter count badge and the 24px slider thumbs. Borders come in three ink weights: 3px, 2px and 1px. Era chips carry a 2px border in hairline grey that turns ink on hover and fills ink when pressed. Place chips use a 1px border in soft ink at 40% opacity. The bottom-sheet handle is a 48px by 4px bar in soft ink at 50%.

## Components

### Buttons
Tactile, square, ink-framed.
- **Primary** ("Show N games"): magenta fill, white bold text, 44px tall, 20px side padding, square. Hover deepens to deep magenta.
- **Outline / route toggle** ("Show the journey (N places)"): 2px ink frame, ink bold text with a route icon. Hover inverts to an ink fill with white text. When pressed (`aria-pressed`) it fills magenta with a magenta border and reads "Journey shown on the map". 44px tall on touch, 36px from md up.
- **Masthead buttons** ("Near me" with a locate icon, "Filter" with a sliders icon): white at 10% over the black strip (20% on hover), bold white label, 44px tall, 12–14px side padding. Filter carries a magenta count badge (24px circle, 0.875rem) and fills yellow with ink text while open. "Near me" shows only its icon below lg.
- **Icon buttons** (Share, Close, filter Close): 44px square, no frame, ink icon at 22–26px. Hover fills yellow.
- **Text buttons** ("Reset", "Back to …"): semibold text; Reset is underlined with a 4px offset and drops the underline and turns soft ink when disabled; Back is soft ink with an arrow and turns magenta on hover. Inside the empty notice, "Clear search" and "Reset filters" are bold magenta underlined links, 44px tall.
- **Zoom** (+ / −): 44px square buttons inside a 2px ink frame with no shadow or radius. Hover fills yellow.
- **Focus:** a global 3px magenta outline offset 2px. The search field on the black masthead uses a 3px yellow outline instead.

### Chips
- **Place chip:** 1px soft-ink border, map-pin icon, 0.95rem medium text, 44px tall on touch (36px from md up). Hover turns border and text magenta. Clicking travels to that place.
- **Current place:** solid ink fill, white semibold text, not interactive.
- **Nearby chip:** a place chip with the game count and distance appended in regular soft-ink tabular figures ("Lyon · 2 games · 390 km"). Distances under 10 km keep one decimal.
- **Era chip** ("Ancient", "Medieval", "1500s–1700s", "1800s", "1900s", "Today", "Future"): 2px hairline-grey border, 0.95rem semibold ink text, 44px tall on touch (36px from md up), 6px apart. Hover turns the border ink; pressed (`aria-pressed`) fills ink with white text. Pressing a chip sets the story-year slider to that era; pressing it again clears it.
- **Genre tag:** a printed label, not a control. 0.8125rem bold uppercase in one of the four process treatments (see Colors).

### Cards / Containers
There are no cards. Containers are docked sheets.
- **Location spread (list variant):** sheet white, square, 420px docked left on desktop and a bottom sheet on phone, joined to the map by a 3px ink rule. Header: an optional "Back to …" button, the condensed title, then a meta line in soft ink with the count in ink semibold ("19 games · set 1481–2310"), with Share and Close icon buttons at the right, over the heavy-plus-hairline double rule. The body scrolls with a thin scrollbar. When the spread covers several places (a cluster, or "Near you"), each place gets a sticky sub-heading: the place name as a subhead button (hover magenta) on the left, its game count or distance in soft-ink label on the right, 1px ink rule beneath. Game rows are a year column and an article: the name as a headline button (hover magenta with a 2px underline), the genre tag and "Set in …" line, an optional one-line location note in ink, the developer/publisher list, then the route toggle and place chips.
- **Game spread (game variant):** the same sheet showing one game. The meta line reads "1996 · 4 places · set 1996". The row has no name button and no route toggle; the route is already drawn. Below the credits sits "The journey · N places" (or "Where it takes place" for a single place): a numbered list with magenta step numbers, bold place-name buttons and one-line notes in soft ink. Then "Nearby" chips and a compact "Set in the same era" list: soft-ink year in the year column, bold game name with its era span in regular soft ink, hairlines between rows.
- **Cover image:** optional, right of the game name, 64 by 85px, object-fit cover, 2px ink frame, lazy-loaded, empty alt. The footer credits "Cover art from IGDB" whenever one is shown.
- **Panel footer:** 0.875rem soft ink, 20px by 24px padding. "Missing a game or a place? Suggest it" (ink semibold underlined link, hover magenta) when a contribute URL is configured, and the IGDB credit.
- **Filter sheet:** sheet white, 24px padding, 24px gap between fields, footer separated by a hairline, with 3px ink rules on both sides and the bottom (desktop) or the bottom only (phone). An invisible full-screen backdrop closes it on click.
- **Notices:** framed strips at the top centre of the map, 20px by 12px padding, 3px ink border. The transient status notice ("Link copied", "Finding you…", "Location access was denied") prints white semibold on ink and clears itself after 2.5s unless it ends in an ellipsis. The empty-state notice ("No games match these filters.") prints semibold ink on sheet with magenta reset links and a soft-ink "Suggest a game" link.

### Inputs / Fields
- **Search:** white field with no border on the black masthead, 44px tall, a search icon on the left and a clear button on the right, both soft ink. Placeholder "Search games or places" in soft ink. Focus shows a 3px yellow outline. "/" focuses it from anywhere.
- **Select (genre):** 2px ink frame, white, 44px, medium text, custom chevron. First option "All genres".
- **Double range slider** ("Released", "Story set in"): 4px hairline-grey track with a magenta fill between the handles inside a 44px-tall strip. Thumbs are 24px white circles with a 3px ink ring and no shadow; they turn yellow while dragged and show a magenta focus ring. The legend shows the label on the left and the range in tabular soft ink on the right ("3100 BC – 2310"). The story-year slider is non-linear: year 0 sits at 12% of the track, 1000 at 24%, 1500 at 34%, 1800 at 44%, 1900 at 54%, 2000 at 80% and 2030 at 88%, so the centuries most games are set in get most of the travel. A keypress always moves at least one year. Era chips sit under it.

### Navigation
- **Masthead:** black strip, 64px. The condensed uppercase nameplate (1.6rem on phone, 1.9rem from md up) has "Traveller" in yellow. The live issue line ("206 games · 286 places · 3100 BC–2310", or "12 of 206 games" when filtered) is set in semibold tabular figures, 0.8125rem on phone and 1rem on desktop, with the story-era span in yellow. It sits above every map layer. Keyboard: Escape closes the filter first, then the spread; Enter and Space open focused markers.

### Map Overprint (signature)
- **Place dot:** a 16px magenta dot with a 2.5px white ring inside a 44px hit area. It scales to 1.3× on hover (200ms, expo-out).
- **Active / pinned dot:** a 22px ink dot with a 3.5px yellow ring. Route stops, the active place and up to eight search hits are pinned outside the cluster group so they can never be swallowed by a bullet.
- **Dimmed dot:** grey fill with no halo, used for places off the shown route.
- **Caption label:** route stops, the active place and the reader's position carry a permanent label above the dot: ink box, 3px by 8px padding, white 14px bold at 85% width, no border, no shadow, no arrow. The text is the short place name ("Paris" for "Paris, France"), or "You".
- **Cluster bullet:** an ink circle with a 3px white ring showing the number of games (not places) in condensed 750-weight tabular figures. It comes in three sizes: 38px under 10 games, 46px under 50, 54px for 50 or more, with text at 17px (15px from 100 games up), all inside a hit area of at least 44px. It turns magenta on hover. A cluster that holds only one game prints as a 20px magenta dot with a 2.5px white ring instead of a number. Clicking a bullet zooms in until its places separate; once they are too close to separate (zoom 10) it opens the spread listing them.
- **Reader's position:** an 18px cyan dot with a 3px white ring and a 2px ink outline, labelled "You". It is not interactive and sits above every other marker.
- **Route line:** a 4px magenta polyline at 95% opacity with round caps and joins. It draws itself in over 1100ms after a 150ms delay.
- **Attribution:** 12px on sheet white at 85%, bottom right.

### Brand Marks
- **Favicon** (`public/favicon.svg`, 64 by 64): an ink square carrying a magenta route of three straight legs (4px, round caps) with two magenta dots ringed in white at its stops and an ink dot ringed in yellow at its end, the active marker in miniature. Raster copies ship at 32, 180, 192 and 512px; the manifest and theme colour are ink.
- **Open Graph image** (`public/og.png`, 1200 by 630): an ink field with "GAME" in white and "TRAVELLER" in yellow condensed caps, the strap "Where video games take place" in white over a white rule, a soft-grey line of figures with the numbers picked out in yellow, and the same magenta route with white-ringed dots and a yellow-ringed terminal.

### Motion
Motion uses one easing curve (`cubic-bezier(0.16, 1, 0.3, 1)`, expo-out). Panels slide in over 420ms: 24px from the left on desktop, 40px from below on phone, fading in from zero opacity. The camera flies to a point in 0.8s (never below zoom 5), to a route's or search's bounds in 1s (never past zoom 6), and into a cluster in 0.8s. Under `prefers-reduced-motion`, all animations and transitions collapse to near zero.

## Do's and Don'ts

### Do:
- **Do** keep map tiles in one grey and overprint everything actionable in process ink.
- **Do** reserve magenta for actions, the route and focus.
- **Do** separate chrome from the map with 3px ink rules and dock overlays flush to an edge.
- **Do** set titles, game names and years in condensed weight-800 Archivo, and years and counts in tabular figures with "BC" for years before 0.
- **Do** keep interactive targets at least 44px tall on touch, including map markers and zoom buttons.
- **Do** keep every corner square except the dots and bullets printed on the map and the marks that echo them.
- **Do** pin route stops and the active place outside clusters and caption them with ink labels.
- **Do** frame notices as strips at the top centre of the map: ink for transient status, sheet for empty states.

### Don't:
- **Don't** use soft drop shadows, floating rounded cards or blurred panels for chrome. The only shadows are the marker halos.
- **Don't** use magenta for genre tags or decoration.
- **Don't** show tiles in full colour.
- **Don't** fabricate screenshots or artwork. The only imagery is IGDB cover art, 64 by 85px in a 2px ink frame, with its credit in the footer.
- **Don't** set controls or running text in the condensed width.
- **Don't** add type sizes outside the ramp.
