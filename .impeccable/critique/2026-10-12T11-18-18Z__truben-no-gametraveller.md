---
target: "https://truben.no/gametraveller"
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "url:https://truben.no/gametraveller"
timestamp: 2026-10-12T11-18-18Z
slug: truben-no-gametraveller
---
# Critique: truben.no/gametraveller (live)

## Heuristics (23/40, Acceptable)
1 Status 3 · 2 Real world 2 · 3 Control 3 · 4 Consistency 2 · 5 Error prevention 2 · 6 Recognition 2 · 7 Efficiency 3 · 8 Minimalism 2 · 9 Error recovery 2 · 10 Help 2

## Specificity
Partly authored: the time axis (era chips, year numerals) and "Places you've played before" belong to this product. The world view (~120 anonymous number circles, search pill, cookie bar) does not. Live site = cream atlas (teal/rust/Georgia); DESIGN.md = 90s magazine fold-out (magenta/cyan/yellow). Mix of two languages.

## Priority issues
- [P0] Mobile: Filter opens UNDER the place bottom sheet (z-index, atlas.css .gt-sheet-popup z 1000). Unusable.
- [P1] The world view and clusters hide games behind numbers; the cluster → zoom → cluster loop; the London spread opened without London in view.
- [P1] First run: the welcome card and the consent card overlap on desktop; the welcome cannot be found again except via More → Reset all.
- [P1] Keyboard/SR: ~115 marker tab stops in DOM order, no skip link, clusters named only by their count, no list alternative.
- [P2] Search: fuzzy false hits ("monkey" → Hitman: Blood Money), and misses dead-end without explanation (fictional worlds, Suggest).

## Minor
Off-ramp font sizes (App.tsx:821 0.7rem, App.css:22), Georgia outside the font system (atlas.css:27), flat h1/h2/h3 25.6px on mobile, ad in the game list, coordinates up front in the panel, overlapping genre categories (23 options in an inner scroll), clusters not dimmed in journey mode, map labels covered by markers.
