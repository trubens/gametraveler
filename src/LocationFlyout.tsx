import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { WITH_ARTICLE } from './placeArticle';
import { Drawer } from "@base-ui/react/drawer";
import { ArrowLeft, ChevronRight, ExternalLink, MapPin, Route, Share2, X } from "lucide-react";
import { Game, hasOrderedRoute, Location, PlaceType, spotParentOf, topLevelPlaceCount, seriesGames, isVisitableLocation } from "./gameData";
import { getGameRoutes, routeStyle } from "./routes";
import { count, eraSpan, formatDistance, formatYear, listName, shortName } from "./format";
import { AdSenseUnit } from "./AdSenseUnit";
import { rememberPanelScroll } from "./url";
import { GameAtlasLine, GameMarkButtons, GameMarkPill, PlaceAtlasLine, PlaceMarkButtons, PlaceMarkPill } from "./MyAtlasControls";

type Position = [number, number];
export const SHEET_PEEK_HEIGHT = 104;
const SHEET_PEEK_POINT = `${SHEET_PEEK_HEIGHT}px`;
// Øverste stopp er hele skjermen, over toppfeltet, slik Google Maps gjør det: spillene er innholdet,
// og toppfeltet kom tilbake med et drag ned. Før stoppet arket under søkefeltet og ga ett spill plass.
const SHEET_SNAP_POINTS = [SHEET_PEEK_POINT, 0.62, 1] as const;

export type PanelSection = {
  // Stedsnavn vises som mellomtittel når panelet samler flere steder
  title?: string;
  // Tekst til høyre for mellomtittelen, f.eks. avstand
  meta?: string;
  position?: Position;
  games: Game[];
  // Steder på nivå to inne i dette stedet, per spill (parken i Lisboa under A Date in the Park)
  spots?: Map<number, Location[]>;
};

export type NearbyPlace = { name: string; position: Position; games: number; km: number; from?: string };
export type IndexPlace = { name: string; position: Position; games: number; placeType: PlaceType; label?: string };

// Annonsen skal ikke dele lista før brukeren har sett noen spill: etter det fjerde i lange lister, ellers nederst
const AD_AFTER_GAMES = 4;
const AD_INLINE_MIN_GAMES = 6;
// «Nathan Drake, Chloe Frazer and Elena Fisher», ikke «Nathan Drake & Chloe Frazer & Elena Fisher»
const listFormat = { format: (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` };

const SERIES_MIN_GAMES = 3;
type Row =
  | { kind: 'game'; key: string; game: Game }
  | { kind: 'series'; key: string; label: string; games: Game[]; open: boolean };

// «F1 2014», «F1 22» → «F1»; «Formula 1 97» → «Formula 1»; «Sherlock Holmes: The Awakened» → «Sherlock Holmes»
const seriesLabel = (name: string) => name
  .split(/[:–—]| - /)[0]
  .replace(/\s+(\d+|[IVX]+)$/u, '')
  .trim();
const seriesKey = (name: string) => seriesLabel(name).toLowerCase();

const samePosition = (a: Position, b?: Position) => !!b && a[0] === b[0] && a[1] === b[1];

const chipClass =
  "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[10px] border border-transparent bg-paper px-3 text-[0.95rem] font-medium text-ink transition-colors hover:border-magenta hover:text-magenta md:min-h-9";

export function LocationFlyout({
  title,
  placeType,
  placeTypeVaries = false,
  variant,
  onOpenSeries,
  sections,
  placeIndex,
  placeIds = [],
  wikipediaUrl,
  mapsUrl,
  description,
  atlasContent,
  autoFocus,
  focusRequest,
  restoreScrollTop,
  backLabel,
  selectedGameId,
  selectedRouteId,
  onSelectRoute,
  hiddenByFilters = false,
  onShowHidden,
  minimizeRequest,
  peekFor,
  nearby,
  activeStopKey,
  sameEra,
  contributeUrl,
  onBack,
  onOpenGame,
  onToggleRoute,
  onClose,
  onLocationClick,
  onExpandFromPeek,
  onShare,
}: {
  title: string;
  placeType?: PlaceType;
  placeTypeVaries?: boolean;
  // 'game' viser ett spill med alle stedene og notatene; 'list' viser en liste over spill;
  // 'index' viser alle steder etter land, som et alternativ til kartet
  variant: 'list' | 'game' | 'index' | 'atlas' | 'series';
  // Åpner seriens samleside (fra spillets header og fra serieraden i en stedsliste)
  onOpenSeries: (name: string) => void;
  // Innholdet i «My atlas»-panelet (variant 'atlas')
  atlasContent?: React.ReactNode;
  sections: PanelSection[];
  placeIndex?: IndexPlace[];
  // Sted-id-ene bak stedet panelet viser; «Been here» og «Want to go» markerer dem
  placeIds?: string[];
  // Stedspostens Wikipedia-artikkel for stedet eller landet panelet viser
  wikipediaUrl?: string;
  // Stedet i Google Maps (gameData.googleMapsUrl); ingen for oppdiktede steder
  mapsUrl?: string;
  // Hva stedet er, en setning eller to; fra Wikipedia-sammendraget når posten ikke har egen tekst
  description?: string;
  autoFocus: boolean;
  focusRequest: number;
  // Rulleposisjonen tilbake-knappen gjenoppretter for dette panelet
  restoreScrollTop?: number;
  backLabel?: string;
  selectedGameId?: number;
  selectedRouteId?: string;
  onSelectRoute: (routeId: string | undefined) => void;
  // Det åpne spillet er ikke med i søket eller filteret som kartet viser
  hiddenByFilters?: boolean;
  onShowHidden?: () => void;
  minimizeRequest: number;
  // Økes når et land åpnes: arket legger seg nederst, så landet får hele kartet over seg
  peekFor?: number;
  nearby?: NearbyPlace[];
  // Stoppet på spillsiden som kartet sist ble flyttet til (posKey); ett trykk til på det åpner stedet
  activeStopKey?: string;
  sameEra?: Game[];
  contributeUrl?: string;
  onBack: () => void;
  onOpenGame: (game: Game) => void;
  onToggleRoute: (game: Game) => void;
  onClose: () => void;
  onLocationClick: (position: Position) => void;
  onExpandFromPeek: () => void;
  onShare: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [snapPoint, setSnapPoint] = useState<Drawer.Root.SnapPoint | null>(0.62);
  const snapPointRef = useRef<Drawer.Root.SnapPoint | null>(snapPoint);
  const lastExpandedSnapPoint = useRef<Drawer.Root.SnapPoint>(0.62);
  const previousMinimizeRequest = useRef(minimizeRequest);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  );
  const [desktopTop, setDesktopTop] = useState(0);
  const isPeek = isMobile && snapPoint === SHEET_PEEK_POINT;

  // A new place or panel gets a fresh reading position before the updated sheet paints; one reopened by
  // the back button goes back to where the reader left it (restoreScrollTop, from the history entry).
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = restoreScrollTop ?? 0;
    if (!restoreScrollTop) return;
    // Panelet som kommer tilbake er ofte ikke i DOM-en ennå (arket monteres i en portal), eller lista er ikke
    // ferdig tegnet. Posisjonen settes derfor i hvert bilde til den holder, i høyst halvannet sekund, og ikke
    // etter at leseren selv har begynt å rulle.
    const target = restoreScrollTop;
    let frame = 0;
    let stopped = false;
    const started = performance.now();
    const stop = () => { stopped = true; cancelAnimationFrame(frame); };
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    const settle = () => {
      if (stopped || performance.now() - started > 1500) return;
      const el = contentRef.current;
      if (el && el.scrollHeight - el.clientHeight >= target && Math.abs(el.scrollTop - target) < 2) return;
      if (el) el.scrollTop = target;
      frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(settle);
    return () => {
      stop();
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [focusRequest, restoreScrollTop]);
  // The position is written to the history entry while reading, a moment after scrolling stops
  const scrollSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scrollSave.current), []);
  // Bare tittelraden (tilbake, tittel, del, lukk) står fast. Stedsinfoen ligger øverst i lista og scroller bort med
  // den, én til én med fingeren. Før krympet en fast topp i ett hopp på over 100 px når man scrollet; på korte
  // lister (Belém, ett spill) var hoppet større enn det som fantes å scrolle, og det rykket uansett terskel.
  // Streken under tittelraden kommer først når noe ligger under den.
  const [barScrolledFor, setBarScrolledFor] = useState<number | undefined>(undefined);
  const scrolled = barScrolledFor === focusRequest;
  const onContentScroll = () => {
    const content = contentRef.current;
    if (content) {
      const now = content.scrollTop > 0;
      if (now !== scrolled) setBarScrolledFor(now ? focusRequest : undefined);
    }
    clearTimeout(scrollSave.current);
    scrollSave.current = setTimeout(() => { if (contentRef.current) rememberPanelScroll(contentRef.current.scrollTop); }, 150);
  };

  // When following a game's journey to another place, keep that game's entry in view in the new place's
  // list. A new panel scrolls to the selected game even without a chosen route («Show the journey» in a
  // place list chooses none, so Antarctica opened at the top with another game in view); within the same
  // panel it only follows a chosen route, so tapping a row does not make the list jump.
  const scrolledFor = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const newPanel = scrolledFor.current !== focusRequest;
    scrolledFor.current = focusRequest;
    if (variant !== 'list' || selectedGameId === undefined) return;
    // The back button restores the reader's own position instead
    if (newPanel && restoreScrollTop !== undefined) return;
    if (!newPanel && !selectedRouteId) return;
    const gameRow = contentRef.current?.querySelector<HTMLElement>(`[data-game-id="${selectedGameId}"]`);
    gameRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusRequest, selectedGameId, selectedRouteId, variant, restoreScrollTop]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // The desktop drawer is portalled to <body>, so it cannot inherit the
  // masthead's layout position. Keep it aligned with the map below the header.
  useLayoutEffect(() => {
    const masthead = document.querySelector<HTMLElement>(".atlas-masthead");
    if (!masthead) return;
    const update = () => {
      // Bare på desktop: på mobil er arket like høyt som vinduet (atlas.css), så det øverste stoppet
      // dekker toppfeltet og gir spillene plassen
      setDesktopTop(Math.max(0, masthead.getBoundingClientRect().bottom));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(masthead);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (minimizeRequest === previousMinimizeRequest.current) return;
    previousMinimizeRequest.current = minimizeRequest;
    if (!isMobile) return;
    const frame = window.requestAnimationFrame(() => {
      const current = snapPointRef.current;
      const next = current === SHEET_PEEK_POINT
        ? lastExpandedSnapPoint.current
        : current !== null ? SHEET_PEEK_POINT : null;
      if (current !== SHEET_PEEK_POINT && current !== null) lastExpandedSnapPoint.current = current;
      snapPointRef.current = next;
      setSnapPoint(next);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [minimizeRequest, isMobile]);

  // Fokus flyttes inn i panelet når brukeren åpnet det, men ikke mens man skriver i søket
  useEffect(() => {
    if (autoFocus) {
      if (isMobile && snapPointRef.current === SHEET_PEEK_POINT) {
        const expandedPoint = lastExpandedSnapPoint.current;
        snapPointRef.current = expandedPoint;
        setSnapPoint(expandedPoint);
        onExpandFromPeek();
      }
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [autoFocus, focusRequest, isMobile, onExpandFromPeek]);

  // Et land åpnes med arket nede: feltet over et 62 %-ark er rundt 180 px på en telefon, og der ble
  // Norge en flekk på zoom 3 og Storbritannia en strek under to klynger. Alt annet nytt innhold løfter arket
  // igjen hvis det står nede (leseren dro det ned, eller forrige panel var et land). Gjelder også når panelet
  // bygges på nytt etter å ha vært lukket. Ligger etter fokus-effekten, så det er denne som gjelder.
  const handledPanel = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (handledPanel.current === focusRequest) return;
    handledPanel.current = focusRequest;
    if (!isMobile) return;
    if (peekFor === focusRequest) {
      // Neste bilde, etter fokus-effekten (som løfter arket); avbrytes ikke, for effekten kjører bare én gang per panel
      window.requestAnimationFrame(() => {
        snapPointRef.current = SHEET_PEEK_POINT;
        setSnapPoint(SHEET_PEEK_POINT);
      });
      return;
    }
    if (snapPointRef.current === SHEET_PEEK_POINT) {
      const expandedPoint = lastExpandedSnapPoint.current;
      snapPointRef.current = expandedPoint;
      setSnapPoint(expandedPoint);
    }
  }, [focusRequest, peekFor, isMobile]);

  // Hvert spill én gang: i ei klynge med bare ett spill står det under hvert sted
  const allGames = [...new Map(sections.flatMap(s => s.games).map(g => [g.id, g])).values()];
  const placeSection = variant === 'list' && sections.length === 1 && sections[0].position ? sections[0] : undefined;
  const placeSettingTypes = new Set(
    placeSection?.games.flatMap(game => game.locations
      .filter(location => samePosition(location.position, placeSection.position))
      .map(location => location.settingType ?? 'real')) ?? [],
  );
  const sharedPlaceSetting = placeSettingTypes.size === 1 ? [...placeSettingTypes][0] : undefined;
  // Stedets Wikipedia-artikkel: fra stedsposten, ellers fra et av spillenes stoppdata; aldri et søk
  const placeWikipedia = wikipediaUrl ?? placeSection?.games.flatMap(game => game.locations.filter(l => samePosition(l.position, placeSection.position))).find(l => l.wikipediaUrl)?.wikipediaUrl;
  const placeSettingVaries = placeSettingTypes.size > 1;
  const era = eraSpan(allGames.flatMap(g => g.storyYears));
  const placeCount = sections.filter(s => s.title).length;
  const hasCovers = allGames.some(g => g.coverUrl);
  const GameHeading = placeCount > 0 ? "h4" : "h3";
  const countries = placeIndex ? groupByCountry(placeIndex) : [];
  // Lange spilltitler får mindre størrelse, så de ikke skyver alt innhold ut av syne
  // Oppdiktede steder: «(fictional)» flyttes fra tittelen til metalinja («Invented venue»). Med parentesen
  // brøt «Big Shell, New York (fictional)» over to linjer ved siden av del- og lukkeknappene på telefon.
  const inventedTag = variant === 'list' ? title.match(INVENTED_SUFFIX)?.[1].toLowerCase() : undefined;
  const fullTitle = inventedTag ? title.replace(INVENTED_SUFFIX, '').trim() : title;
  // Et sted får bare sitt eget navn som tittel; resten av navnet («Sweden» i «Gotland, Sweden») står i
  // metalinja som «Island in Sweden». To tunge linjer med tittel tok en fjerdedel av panelet.
  const titleParts = variant === 'list' && placeType && !placeTypeVaries ? splitPlaceName(fullTitle) : undefined;
  const shownTitle = titleParts?.name ?? fullTitle;
  const titleSize = shownTitle.length > 36 ? "md:text-[1.9rem]" : "md:text-[2.5rem]";
  // Arket nede (104 px) viste bare tittelen; én linje under sier hva som ligger der før man drar det opp
  const peekLine = variant === 'list'
    ? [placeType && !placeTypeVaries ? (titleParts ? `${placeTypeNoun(placeType)} in ${titleParts.within}` : placeTypeLabel(placeType)) : undefined, count(allGames.length, 'game'), era ? `set in ${era}` : undefined]
    : variant === 'game' && allGames[0]
      ? [String(allGames[0].year), count(new Set(allGames[0].locations.map(l => l.placeId)).size, 'place')]
      : variant === 'series' ? [count(allGames.length, 'game')] : [];

  const [openSeries, setOpenSeries] = useState<Map<string, boolean>>(() => new Map());
  const toggleSeries = (key: string, open: boolean) => setOpenSeries(current => {
    const next = new Map(current);
    next.set(key, !open);
    return next;
  });
  // Serier med tre eller flere spill på samme sted vises som én rad som kan åpnes,
  // så 24 F1-årganger ikke drukner resten av lista
  const rowsFor = (list: Game[]): Row[] => {
    if (variant !== 'list') return list.map(game => ({ kind: 'game', key: `g${game.id}`, game }));
    const bySeries = new Map<string, Game[]>();
    const keyOf = (game: Game) => game.series ?? seriesKey(game.name);
    for (const game of list) bySeries.set(keyOf(game), [...(bySeries.get(keyOf(game)) ?? []), game]);
    const rows: Row[] = [];
    const done = new Set<string>();
    for (const game of list) {
      const key = keyOf(game);
      const members = bySeries.get(key)!;
      if (members.length < SERIES_MIN_GAMES) {
        rows.push({ kind: 'game', key: `g${game.id}`, game });
      } else if (!done.has(key)) {
        done.add(key);
        const rowKey = `s${key}`;
        const open = openSeries.get(rowKey) ?? members.some(member => member.id === selectedGameId);
        rows.push({ kind: 'series', key: rowKey, label: `${members[0].series ?? seriesLabel(members[0].name)} series`, games: members, open });
      }
    }
    return rows;
  };
  // Samme spill kan stå i flere seksjoner («Near me»: Paris og Versailles), så annonsen festes til én bestemt
  // seksjon og rad, ikke til radnøkkelen alene; ellers kom den én gang per forekomst
  const allRows = sections.flatMap((section, sectionIndex) => rowsFor(section.games).map(row => ({ sectionIndex, key: row.key })));
  const adAfter = variant === 'list' && allRows.length >= AD_INLINE_MIN_GAMES ? allRows[AD_AFTER_GAMES - 1] : undefined;
  const showStoryLine = allGames.length > 1;

  // Stedsknappene til et spill eller en rute; stedet panelet viser er markert, gjentatte besøk vises én gang
  // Stoppene i en rute står i rekkefølge med nummer, også når ruten vender tilbake til et sted: George i
  // The Sleeping Dragon er i Paris tre ganger, og en liste med hvert sted én gang leste som feil rekkefølge
  // Stoppene står som én linje som brytes, med de samme nummerrundingene som på kartet. Som egne knapper
  // (44 px høye, ett stopp per linje på telefon) tok tre stopp en halv skjerm, og de lignet på ruteknappen.
  const placeChips = (locations: Location[], current?: Position, color = routeStyle(0).color) => (
    <ol className="mt-1.5 flex flex-wrap items-center gap-x-3.5 text-[0.95rem] leading-tight" aria-label="Stops in order">
      {locations.map((loc, index) => {
        const here = samePosition(loc.position, current);
        const number = (
          <span aria-hidden="true" className="gt-stop-number numerals" style={{ backgroundColor: color }}>{index + 1}</span>
        );
        return (
          <li key={`${index}-${loc.name}`} className="flex items-center">
            {here ? (
              <span className="flex min-h-8 items-center gap-1.5 font-bold text-ink" aria-current="location">
                {number}{shortName(loc.name)}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onLocationClick(loc.position)}
                aria-label={`${index + 1}. ${loc.name}`}
                className="flex min-h-8 cursor-pointer items-center gap-1.5 text-left font-medium text-ink underline decoration-ink/25 underline-offset-[3px] hover:text-magenta hover:decoration-magenta"
              >
                {number}{shortName(loc.name)}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );

  const renderGame = (game: Game, section: PanelSection) => {
      const selected = game.id === selectedGameId;
      // «Set in» er overflødig når det bare gjentar utgivelsesåret
      const showStory = game.storyYears.length > 0 && !(game.storyYears.length === 1 && game.storyYears[0] === game.year);
      const here = section.position ? game.locations.find(l => samePosition(l.position, section.position)) : undefined;
      const showGameSetting = here && !(placeSection === section && sharedPlaceSetting);
      const isList = variant === 'list' || variant === 'series';
      const spotsHere = section.spots?.get(game.id);
      // Et spill som bare har steder på nivå to i byen: byens rad låner det første stedets notat
      const description = here?.note ?? spotsHere?.[0]?.note ?? (section.position ? undefined : game.locations[0]?.note);
      const hasRoute = game.locations.length > 1 && hasOrderedRoute(game);
      const routeCount = getGameRoutes(game).length;
      const routeButton = hasRoute && (
        <button
          type="button"
          onClick={() => onToggleRoute(game)}
          aria-pressed={selected}
          className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[0.95rem] font-semibold whitespace-nowrap transition-colors ${
            selected
              ? "border-magenta/45 bg-magenta/10 text-magenta-deep hover:border-magenta"
              : "border-ink/30 bg-card text-ink hover:border-ink"
          }`}
        >
          <Route size={17} strokeWidth={1.75} />
          {selected ? (routeCount > 1 ? 'Journeys on the map' : 'Journey on the map') : routeCount > 1 ? `Show ${count(routeCount, 'journey')}` : 'Show the journey'}
        </button>
      );

      return (
        <li
          key={`game-${game.id}`}
          data-game-id={game.id}
          className={`grid ${isList && !isMobile ? 'grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4' : 'grid-cols-1'} border-b border-rule px-6 ${isList ? (isMobile ? 'py-3' : 'py-4') : 'pt-1 pb-5'} transition-colors ${selected && isList ? "bg-yellow/30" : ""}`}
        >
          {/* Årskolonnen tok en femdel av bredden på telefon; der står året i tittellinja i stedet */}
          {isList && !isMobile && <div className="headline numerals pt-0.5 text-[1.9rem] leading-none text-ink">{game.year}</div>}

          <article className="min-w-0">
            {isList && (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <GameHeading className="headline text-[1.375rem] leading-[1.05] md:text-[1.5rem]">
                    <button
                      type="button"
                      onClick={() => onOpenGame(game)}
                      className="cursor-pointer text-left hover:text-magenta hover:underline hover:decoration-2 hover:underline-offset-4"
                    >
                      {isMobile && <span className="numerals mr-2 text-base font-semibold text-ink-soft">{game.year}</span>}
                      {listName(game)}
                    </button>
                  </GameHeading>
                  {description && <p className="mt-2 text-[0.95rem] leading-snug text-ink">{description}</p>}
                  {spotsHere && spotsHere.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-soft">
                      <span>At</span>
                      {spotsHere.map(spot => (
                        <button key={spot.placeId} type="button" onClick={() => onLocationClick(spot.position)} className={`${chipClass} min-h-9 px-2.5 text-sm md:min-h-8`}>
                          <span aria-hidden="true" className="gt-spot-chip" />{shortName(spot.name)}
                        </button>
                      ))}
                    </p>
                  )}
                </div>
                {game.coverUrl && (
                  <img
                    src={game.coverUrl}
                    alt=""
                    width={48}
                    height={64}
                    loading="lazy"
                    className="h-16 w-12 shrink-0 border-2 border-ink object-cover"
                  />
                )}
              </div>
            )}
            {!isList && game.coverUrl && (
              <div className="flex justify-end">
                <img
                  src={game.coverUrl}
                  alt=""
                  width={64}
                  height={85}
                  loading="lazy"
                  className="h-[85px] w-16 shrink-0 border-2 border-ink object-cover"
                />
              </div>
            )}

            {isList ? (
              <>
                {/* Under notatet står bare det som hører til stedet: fremstillingen og årstallet. Sjanger,
                    antall steder og Wikipedia-lenken hører til spillsiden, ett trykk unna. Hake og flagg
                    står til høyre, i bunnen, så raden ikke trenger en egen linje for dem. På telefon
                    med ruteknapp får linja hele bredden, og knappen og merkene deler raden under. */}
                <div className={`mt-2 flex ${isMobile && hasRoute ? 'flex-col items-stretch gap-2' : 'items-end justify-between gap-3'}`}>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {showGameSetting && <SettingBadge settingType={here?.settingType} />}
                  {showStory && showStoryLine && <>{showGameSetting && <span aria-hidden="true"> · </span>}<span className="numerals">set in {game.storyYears.map(formatYear).join(", ")}</span></>}
                </p>
                {isMobile && hasRoute ? (
                  <div className="flex items-center justify-between gap-2">
                    {routeButton}
                    <GameMarkPill game={game} />
                  </div>
                ) : (
                  <span className="mb-0.5 shrink-0"><GameMarkPill game={game} /></span>
                )}
                </div>
                {hasRoute && !isMobile && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {routeButton}
                </div>
                )}
                {/* Stedene i ruten vises når ruten er på kartet. Har spillet flere ruter, får hver sin
                    fargestrek og navn, så linjene på kartet kan leses */}
                {hasRoute && selected && (routeCount > 1 ? (
                  <div className="mt-3 flex flex-col gap-3" role="group" aria-label="Journeys on the map">
                    {getGameRoutes(game).map((route, index) => (
                      <div key={route.id}>
                        <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
                          <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true" className="shrink-0">
                            <path d="M2 4H26" stroke={routeStyle(index).color} strokeWidth="4" strokeLinecap="round" />
                          </svg>
                          <span>
                            {route.name}
                            {route.characters?.length ? <span className="font-normal text-ink-soft"> · {listFormat.format(route.characters)}</span> : null}
                          </span>
                        </p>
                        {placeChips(route.locations, section.position, routeStyle(index).color)}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onOpenGame(game)}
                      className="self-start text-sm font-semibold text-ink underline underline-offset-4 hover:text-magenta"
                    >
                      Follow one route at a time
                    </button>
                  </div>
                ) : placeChips(game.locations, section.position))}
                {!hasRoute && !section.position && game.locations[0] && (
                  <button
                    type="button"
                    onClick={() => onLocationClick(game.locations[0].position)}
                    className={`mt-3 ${chipClass}`}
                  >
                    <MapPin size={14} strokeWidth={1.75} />
                    {game.locations[0].name}
                  </button>
                )}
              </>
            ) : (
              <>
                {game.routes && game.routes.length > 0 && (
                  <JourneyList game={game} selectedRouteId={selectedRouteId} onSelectRoute={onSelectRoute} onLocationClick={onLocationClick} activeStopKey={activeStopKey} />
                )}
                {/* Med ruter står stedene allerede på rutelinjene; her kommer bare de som ikke er på noen rute */}
                {game.routes && game.routes.length > 0 ? (() => {
                  const onRoute = new Set(getGameRoutes(game).flatMap(route => route.locations.map(l => l.placeId)));
                  // Et sted på nivå to i en by som er på ruten (Topkapı under Istanbul) hører til ruten, ikke til «also in the game»
                  const others = game.locations.filter(l => !onRoute.has(l.placeId) && !onRoute.has(spotParentOf(l)?.id ?? ''));
                  return others.length > 0 && <PlaceList locations={others} ordered={false} title="Also in the game" onLocationClick={onLocationClick} />;
                })() : (
                  <PlaceList locations={game.locations} ordered={hasOrderedRoute(game)} onLocationClick={onLocationClick} activeStopKey={activeStopKey} />
                )}
              </>
            )}
          </article>
        </li>
      );
  };

  return (
    <Drawer.Root
      key={isMobile ? 'mobile' : 'desktop'}
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      onOpenChangeComplete={open => { if (!open) onClose(); }}
      snapPoints={isMobile ? [...SHEET_SNAP_POINTS] : undefined}
      snapPoint={isMobile ? snapPoint : undefined}
      onSnapPointChange={isMobile ? point => {
        snapPointRef.current = point;
        setSnapPoint(point);
        if (point !== null && point !== SHEET_PEEK_POINT) lastExpandedSnapPoint.current = point;
      } : undefined}
      snapToSequentialPoints
      modal={false}
      disablePointerDismissal
      swipeDirection={isMobile ? "down" : "left"}
    >
      <Drawer.Portal>
        <Drawer.Viewport className="gt-sheet-viewport">
          <Drawer.Popup
            className="gt-sheet-popup outline-none focus-visible:outline-none"
            style={{ "--gt-sheet-top": `${desktopTop}px` } as React.CSSProperties}
            data-snap-point={isMobile && snapPoint !== null ? String(snapPoint) : undefined}
            aria-labelledby="panel-title"
          >
            {/* min-w-0: arket er et grid, og uten den ble panelet like bredt som den lengste ubrytelige teksten
                («Back to Broken Sword: The Shadow of the Templars»), så radene under ble kuttet på telefon */}
            <aside className="atlas-panel flex min-h-0 min-w-0 flex-col bg-sheet text-ink">
      <div className="gt-sheet-handle group grid h-7 w-full shrink-0 place-items-center md:hidden" aria-hidden="true">
        <span className="h-1 w-12 bg-ink-soft/50 transition-colors group-active:bg-magenta" />
      </div>

      {/* Tung linje over hårstrek, som under en artikkeltittel */}
      <header className={`gt-panel-bar relative px-6 md:pt-5 ${isPeek ? "gt-sheet-peek-header" : ""} ${scrolled && !isPeek ? "is-scrolled" : ""}`}>
        {/* Del og lukk ligger oppe til høyre, over tittelen; teksten under får hele bredden */}
        <div className="min-w-0">
          <div className="flex min-w-0 items-start">
            {backLabel && (
              <button
                type="button"
                onClick={onBack}
                aria-label={`Back to ${backLabel}`}
                title={`Back to ${backLabel}`}
                className="gt-inline-back grid shrink-0 cursor-pointer place-items-center text-ink-soft hover:text-magenta"
              >
                <ArrowLeft size={22} strokeWidth={1.75} />
              </button>
            )}
            <Drawer.Title
              id="panel-title"
              ref={headingRef}
              tabIndex={-1}
              className={`headline ${isPeek ? 'line-clamp-1' : 'line-clamp-2'} min-w-0 flex-1 text-[1.25rem] leading-[0.95] focus:outline-none md:line-clamp-none ${titleSize} ${isPeek || variant === 'index' || variant === 'atlas' ? 'pr-12' : 'pr-[6.25rem]'}`}
            >
              {shownTitle}
              {inventedTag && <span className="sr-only"> ({inventedTag})</span>}
            </Drawer.Title>
          </div>
          {isPeek && peekLine.length > 0 && <p className="numerals mt-1 truncate pr-12 text-sm text-ink-soft">{peekLine.filter(Boolean).join(' · ')}</p>}
        </div>
        <div className={`gt-panel-actions absolute right-4 flex gap-2 top-[calc(0.76rem-22px)] ${title.length > 36 ? 'md:top-4' : 'md:top-5'}`}>
          {!isPeek && variant !== 'index' && variant !== 'atlas' && <button
            type="button"
            onClick={onShare}
            aria-label="Share this page"
            title="Share"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] text-ink transition-colors hover:bg-ink/7"
          >
            <Share2 size={22} strokeWidth={1.75} />
          </button>}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close panel"
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] text-ink transition-colors hover:bg-ink/7"
          >
            <X size={26} strokeWidth={2} />
          </button>
        </div>
      </header>

      <Drawer.Content ref={contentRef} hidden={isPeek} onScroll={onContentScroll} data-panel-scroll className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {variant !== 'atlas' && (
          <div className="gt-panel-details px-6">
          {/* Stedstype, fremstilling og antall spill på én linje som brytes ved behov, ikke fire stablede linjer */}
          {!isPeek && variant === 'list' && (
            <p className="numerals mt-1.5 text-sm leading-snug text-ink-soft md:mt-2 md:text-base md:leading-relaxed">
              {placeType && <><span>{inventedTag ? `${inventedTag === 'legendary' ? 'Legendary' : 'Invented'} ${placeType === 'area' ? 'place' : (titleParts ? placeTypeNoun(placeType) : placeTypeLabel(placeType)).toLowerCase()}` : titleParts ? placeTypeNoun(placeType) : placeTypeLabel(placeType)}{titleParts && <> in {titleParts.within}</>}</span><span aria-hidden="true"> · </span></>}
              {!placeType && inventedTag && <><span>{inventedTag === 'legendary' ? 'Legendary' : 'Invented'}</span><span aria-hidden="true"> · </span></>}
              {placeTypeVaries && <><span>Several place types</span><span aria-hidden="true"> · </span></>}
              {sharedPlaceSetting && <><SettingBadge settingType={sharedPlaceSetting} /><span aria-hidden="true"> · </span></>}
              {placeSettingVaries && <><span>Setting varies by game</span><span aria-hidden="true"> · </span></>}
              <span>
                <span className="font-semibold text-ink">{count(allGames.length, 'game')}</span>
                {placeCount > 1 && <> · {count(placeCount, 'place')}</>}
              </span>
              {era && <><span aria-hidden="true"> · </span><span>{allGames.length === 1 || isMobile ? 'set in' : 'stories set in'} <span className="whitespace-nowrap">{era}</span></span></>}
              {/* Referansene står sist i metalinja: les om stedet, dra dit. Ikke i merkebryteren (den er leserens
                  eget atlas) og ikke som ikon i tittelraden (et tredje ikon tok en tredel av tittelbredden på telefon).
                  De to står på egen linje: inne i linja brøt de nesten alltid, og da hang en «·» igjen ytterst på linja over. */}
              {(placeWikipedia || mapsUrl) && <><span className="block whitespace-nowrap">
                {placeWikipedia && <a href={placeWikipedia} target="_blank" rel="noopener noreferrer" aria-label={`${shortName(title)} on Wikipedia (opens in a new tab)`} className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-ink-soft underline decoration-ink/35 underline-offset-4 hover:text-ink hover:decoration-current">Wikipedia <ExternalLink size={12} aria-hidden="true" /></a>}
                {placeWikipedia && mapsUrl && <span aria-hidden="true"> · </span>}
                {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`${shortName(title)} in Google Maps (opens in a new tab)`} className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-ink-soft underline decoration-ink/35 underline-offset-4 hover:text-ink hover:decoration-current">Google Maps <ExternalLink size={12} aria-hidden="true" /></a>}
              </span></>}
            </p>
          )}
          {/* My atlas har ingen metalinje: personvernsetningen står ved eksport/import, der den forklarer hvorfor man tar kopi */}
          {!isPeek && variant !== 'list' && <p className="numerals mt-2 text-base text-ink-soft">
            {variant === 'index' ? (
              <>
                <span className="font-semibold text-ink">{count(placeIndex?.length ?? 0, 'place')}</span>
                {' · '}{count(countries.length, 'country', 'countries')}
              </>
            ) : variant === 'series' ? (
              <>
                <span className="font-semibold text-ink">{count(allGames.length, 'game')}</span>
                {allGames.length > 1 && <> · {allGames[0].year}–{allGames[allGames.length - 1].year}</>}
                {' · '}{count(new Set(allGames.flatMap(game => game.locations.map(l => `${l.position[0]},${l.position[1]}`))).size, 'place')}
              </>
            ) : variant === 'game' && allGames[0] ? (
              <>
                <span className="font-semibold text-ink">{allGames[0].year}</span>
                {/* På mobil står sjangeren her, så toppen blir én linje kortere og ruten kommer høyere */}
                {isMobile && allGames[0].genres.length > 0 && <> · {allGames[0].genres.join(', ')}</>}
                {' · '}{count(topLevelPlaceCount(allGames[0]), 'place')}
                {era && <> · set in <span className="whitespace-nowrap">{era}</span></>}
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{count(allGames.length, 'game')}</span>
                {placeCount > 1 && <> · {count(placeCount, 'place')}</>}
                {era && <> · {allGames.length === 1 ? 'set in' : 'stories set in'} <span className="whitespace-nowrap">{era}</span></>}
              </>
            )}
          </p>}
          {!isPeek && !isMobile && variant === 'game' && allGames[0] && <GameCredits game={allGames[0]} />}
          {!isPeek && variant === 'game' && allGames[0] && <GameAliases game={allGames[0]} />}
          {!isPeek && variant === 'game' && allGames[0] && <GameSeriesLine game={allGames[0]} onOpenSeries={onOpenSeries} />}
          {/* Beskrivelsen står også når stedet ikke kan merkes (oppdiktede og imaginære steder) */}
          {!isPeek && variant === 'list' && description && (
            <p className="mt-1.5 text-sm leading-snug text-ink md:mt-2 md:text-[0.95rem]">
              {description}
            </p>
          )}
          {!isPeek && variant === 'list' && placeIds.length > 0 && (
            <>
              {/* Én delt bryter for «vært her / vil dit»: de utelukker hverandre, så de hører i samme kontroll.
                  Spilt-tellingen står ved siden av, ikke under: merkene er sekundære, spillene under skal opp */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:mt-3">
                <PlaceMarkButtons ids={placeIds} compact={isMobile} />
                <PlaceAtlasLine ids={placeIds} games={allGames} compact={isMobile} />
              </div>
            </>
          )}
          {!isPeek && variant === 'game' && allGames[0] && (
            <>
              {/* Knappene og lenken deler én rad, så ruten under kommer høyere på skjermen */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <GameMarkButtons game={allGames[0]} compact={isMobile} />
                <GameLink game={allGames[0]} />
              </div>
              <GameAtlasLine game={allGames[0]} />
            </>
          )}
          </div>
        )}
        {variant === 'atlas' && atlasContent}
        {hiddenByFilters && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-ink bg-yellow/30 px-6 py-3 text-[0.95rem]">
            <span>This game is hidden on the map by your search or filters.</span>
            <button type="button" onClick={onShowHidden} className="min-h-11 cursor-pointer font-bold text-magenta underline underline-offset-4">
              Clear search and filters
            </button>
          </div>
        )}
        {countries.map(([country, places]) => (
          <section key={country} aria-labelledby={`country-${slug(country)}`}>
            <h3 id={`country-${slug(country)}`} className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-ink bg-sheet px-6 pt-4 pb-2 text-base font-bold">
              {country}
              <span className="numerals shrink-0 text-sm font-semibold text-ink-soft">{count(places.length, 'place')}</span>
            </h3>
            <ul>
              {places.map(place => (
                <li key={place.position.join(',')} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onLocationClick(place.position)}
                    className="flex min-h-12 w-full cursor-pointer items-baseline justify-between gap-3 px-6 py-2 text-left hover:bg-paper hover:text-magenta"
                  >
                    <span className="min-w-0"><span className="block font-semibold">{place.label ?? place.name}</span><span className="block text-[0.8125rem] text-ink-soft">{placeTypeLabel(place.placeType)}</span></span>
                    <span className="numerals shrink-0 text-sm text-ink-soft">{count(place.games, 'game')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {sections.map((section, sectionIndex) => (
          // To seksjoner kan ha samme tittel (Athens har et eget punkt for rallyene)
          <section key={`${sectionIndex}-${section.title ?? 'all'}`} aria-label={section.title}>
            {section.title && section.position && (
              <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-ink bg-sheet px-6 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => onLocationClick(section.position!)}
                  className="min-h-9 cursor-pointer text-left text-base font-bold hover:text-magenta"
                >
                  {section.title}
                </button>
                <span className="numerals shrink-0 text-sm font-semibold text-ink-soft">
                  {section.meta ?? count(section.games.length, 'game')}
                </span>
              </h3>
            )}
            <ol>
              {rowsFor(section.games).map(row => (
                <Fragment key={row.key}>
                  {row.kind === 'series' ? (
                    // Seriens navn åpner seriesiden, som en spilltittel åpner spillet; en egen «Open the series»-knapp
                    // ved siden av «Show all» ble to like knapper under hverandre på telefon. Året står i tittellinja
                    // på telefon, som i spillradene.
                    // Åpen serie: overskriften og spillene står på en felles flate, og spillene henger på en strek
                    // fra overskriften, så det synes hvilke spill som hører til serien og hvor gruppen slutter
                    // (utfoldet så spillene ut som vanlige rader under en løsrevet overskrift)
                    <li className={`px-6 py-4 ${row.open ? 'bg-paper/60' : 'border-b border-rule'} ${isMobile ? '' : 'grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-4'}`}>
                      {!isMobile && <div className="headline numerals pt-0.5 text-[1.9rem] leading-none text-ink">{row.games[0].year}</div>}
                      <div className="min-w-0">
                        <h4 className="headline text-[1.375rem] leading-[1.05] md:text-[1.5rem]">
                          {row.games[0].series ? (
                            <button
                              type="button"
                              onClick={() => onOpenSeries(row.games[0].series!)}
                              className="cursor-pointer text-left hover:text-magenta hover:underline hover:decoration-2 hover:underline-offset-4"
                            >
                              {isMobile && <span className="numerals mr-2 text-base font-semibold text-ink-soft">{row.games[0].year}</span>}
                              {row.label}
                            </button>
                          ) : (
                            <>
                              {isMobile && <span className="numerals mr-2 text-base font-semibold text-ink-soft">{row.games[0].year}</span>}
                              {row.label}
                            </>
                          )}
                        </h4>
                        {/* Linja med antall spill er selve bryteren: en pil som snur seg foran «6 games · 1989–2014»,
                            slik lister og trekkspill gjør det, i stedet for en tung brikke under som konkurrerte med
                            tittelen. Trykkflaten er 44 px høy selv om den ser ut som en tekstlinje. */}
                        <button
                          type="button"
                          onClick={() => toggleSeries(row.key, row.open)}
                          aria-expanded={row.open}
                          aria-label={`${row.open ? 'Hide' : 'Show'} the ${count(row.games.length, 'game')} in the ${row.label}`}
                          className="group -ml-1.5 mt-0.5 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-1.5 text-[0.95rem] font-semibold text-ink hover:bg-ink/[0.06] focus-visible:outline-3 focus-visible:outline-magenta"
                        >
                          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className={`shrink-0 text-magenta transition-transform duration-200 ${row.open ? 'rotate-90' : ''}`} />
                          <span className="numerals">{count(row.games.length, 'game')}</span>
                          <span className="numerals font-normal text-ink-soft">· {row.games[0].year}–{row.games[row.games.length - 1].year}</span>
                        </button>
                      </div>
                    </li>
                  ) : renderGame(row.game, section)}
                  {row.kind === 'series' && row.open && (
                    <li className="list-none border-b border-rule bg-paper/60 pb-3">
                      <ol aria-label={`${row.label}: ${count(row.games.length, 'game')}`} className="ml-6 border-l-2 border-ink/25 bg-sheet">
                        {row.games.map(game => renderGame(game, section))}
                      </ol>
                    </li>
                  )}
                  {adAfter?.sectionIndex === sectionIndex && row.key === adAfter.key && <li className="list-none"><AdSenseUnit /></li>}
                </Fragment>
              ))}
            </ol>
          </section>
        ))}

        {nearby && nearby.length > 0 && (
          <section aria-labelledby="nearby-title" className="border-b border-rule px-6 py-5">
            <h3 id="nearby-title" className="text-base font-bold">Nearby</h3>
            {/* En liste som «Set in the same era», ikke store piller: seks steder tok en hel skjerm */}
            <ul className="mt-2">
              {nearby.map(place => (
                <li key={place.position.join(',')} className="border-b border-rule last:border-b-0">
                  <button type="button" onClick={() => onLocationClick(place.position)} className="group flex min-h-11 w-full cursor-pointer items-baseline gap-3 py-2 text-left">
                    <span className="min-w-0 flex-1 break-words text-base font-bold leading-tight group-hover:text-magenta">{shortName(place.name)}</span>
                    <span className="numerals shrink-0 text-[0.95rem] font-medium text-ink-soft">
                      {count(place.games, 'game')} · {formatDistance(place.km)}{place.from ? ` from ${place.from}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sameEra && sameEra.length > 0 && (
          <section aria-labelledby="era-title" className="border-b border-rule px-6 py-5">
            <h3 id="era-title" className="text-base font-bold">Set in the same era</h3>
            <ol className="mt-2">
              {sameEra.map(game => (
                <li key={game.id} className="grid grid-cols-[4.25rem_1fr] gap-x-4 border-b border-rule last:border-b-0">
                  <span className="numerals py-3 text-base font-semibold leading-none text-ink-soft">{game.year}</span>
                  <button
                    type="button"
                    onClick={() => onOpenGame(game)}
                    className="min-h-11 cursor-pointer py-2 text-left text-base font-bold leading-tight hover:text-magenta"
                  >
                    {listName(game)}
                    <span className="numerals ml-2 font-normal text-ink-soft">
                      {eraSpan(game.storyYears)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* På mobil står utvikler og utgiver nederst, ikke i toppen, så ruten får plassen */}
        {isMobile && variant === 'game' && allGames[0] && <div className="px-6 pt-4"><GameCredits game={allGames[0]} /></div>}
        {(variant === 'game' || (variant === 'list' && adAfter === undefined)) && <div className="mt-6"><AdSenseUnit /></div>}

        <footer className="px-6 py-5 text-sm text-ink-soft">
          {contributeUrl && (
            <p>
              Missing a game or a place?{' '}
              <a href={contributeUrl} target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-4 hover:text-magenta">
                Suggest it
              </a>
            </p>
          )}
          {hasCovers && <p className="mt-1">Cover art from <a href="https://www.igdb.com" target="_blank" rel="noopener" className="underline underline-offset-4">IGDB</a>.</p>}
        </footer>

      </Drawer.Content>
            </aside>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Sjanger og hvem som laget spillet, som en linje i panelhodet i stedet for en egen blokk
// Andre titler spillet er kjent under (Circle of Blood i USA for Broken Sword), så sida gjenkjennes og søket treffer
// «Part of the Broken Sword series · 5 games»: én stille linje under navnene, en vei videre fra spillet
function GameSeriesLine({ game, onOpenSeries }: { game: Game; onOpenSeries: (name: string) => void }) {
  const list = game.series ? seriesGames.get(game.series) : undefined;
  if (!game.series || !list) return null;
  return (
    <p className="mt-1 text-sm leading-snug text-ink-soft">
      Part of the <button type="button" onClick={() => onOpenSeries(game.series!)} className="cursor-pointer font-medium text-ink underline decoration-ink/35 underline-offset-4 hover:text-magenta hover:decoration-current">{game.series} series</button> · {count(list.length, 'game')}
    </p>
  );
}

function GameAliases({ game }: { game: Game }) {
  const names = (game.aliases ?? []).filter(alias => alias !== game.name);
  if (names.length === 0) return null;
  return (
    <p className="mt-1 text-sm leading-snug text-ink-soft">
      Also known as <span className="text-ink">{names.join(', ')}</span>
    </p>
  );
}

function GameCredits({ game }: { game: Game }) {
  const company = (name: string, url?: string) => url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-magenta">{name}</a>
    : name;
  return (
    <p className="mt-1 text-[0.95rem] leading-snug text-ink-soft">
      {game.genres.join(', ')}
      {game.developer && <> · by <span className="text-ink">{company(game.developer, game.developerUrl)}</span></>}
      {game.publisher && game.publisher !== game.developer && <>, published by <span className="text-ink">{company(game.publisher, game.publisherUrl)}</span></>}
    </p>
  );
}

function GameLink({ game }: { game: Game }) {
  if (!game.source) return null;
  const wikipedia = game.source.includes('wikipedia.org/wiki/');
  return (
    <a
      href={game.source}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Read about ${game.name}${wikipedia ? ' on Wikipedia' : ''} (opens in a new tab)`}
      className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-semibold text-ink underline underline-offset-4 hover:text-magenta"
    >
      {wikipedia ? 'Read on Wikipedia' : 'About this game'}
      <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}

// Rutene i et spill. Oversikten viser hver rute som et kort (farge, navn, hvem, første → siste stopp);
// en valgt rute vises som en linje i rutens farge med nummererte stopp, slik kartet nummererer dem.
const stopKey = (position: Position) => `${position[0]},${position[1]}`;
// Første trykk på et stopp flytter kartet dit og markerer stoppet; et nytt trykk åpner stedet
const stopButtonClass = (active: boolean) =>
  `min-h-11 cursor-pointer text-left font-bold hover:text-magenta md:min-h-9 ${active ? 'text-magenta underline decoration-2 underline-offset-4' : 'text-ink'}`;

function JourneyList({ game, selectedRouteId, onSelectRoute, onLocationClick, activeStopKey }: {
  game: Game;
  selectedRouteId?: string;
  onSelectRoute: (routeId: string | undefined) => void;
  onLocationClick: (position: Position) => void;
  activeStopKey?: string;
}) {
  const routes = getGameRoutes(game);
  const selectedIndex = routes.findIndex(route => route.id === selectedRouteId);
  const selected = selectedIndex >= 0 ? routes[selectedIndex] : undefined;
  const pillClass = (active: boolean) =>
    `flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold transition-colors md:min-h-9 ${active ? 'border-ink bg-ink text-on-ink' : 'border-ink/25 bg-card text-ink hover:border-ink'}`;
  const stroke = (index: number) => (
    <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true" className="shrink-0">
      <path d="M2 4H20" stroke={routeStyle(index).color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
  const who = (route: (typeof routes)[number]) =>
    [route.characters?.length ? listFormat.format(route.characters) : undefined, route.storyYears?.length ? `set in ${eraSpan(route.storyYears)}` : undefined].filter(Boolean).join(' · ');

  return (
    <section className="mt-5" aria-label="Journeys through the story">
      <h4 className="text-base font-bold">{routes.length > 1 ? `${routes.length} journeys through the story` : 'The journey'}</h4>
      <p className="mt-1 text-sm text-ink-soft">Lines on the map connect the stops, not the exact paths.</p>

      {/* Knappene bytter mellom rutene når én er valgt; i oversikten gjør kortene den jobben */}
      {routes.length > 1 && selected && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose a journey">
          <button type="button" aria-pressed={!selected} onClick={() => onSelectRoute(undefined)} className={pillClass(!selected)}>All journeys</button>
          {routes.map((route, index) => (
            <button key={route.id} type="button" aria-pressed={selectedRouteId === route.id} onClick={() => onSelectRoute(route.id)} className={pillClass(selectedRouteId === route.id)}>
              {stroke(index)}
              {route.name}
            </button>
          ))}
        </div>
      )}

      {routes.length > 1 && !selected ? (
        <ul className="mt-4 flex flex-col gap-2">
          {routes.map((route, index) => {
            const first = route.locations[0];
            const last = route.locations[route.locations.length - 1];
            return (
              <li key={route.id}>
                <button
                  type="button"
                  onClick={() => onSelectRoute(route.id)}
                  className="group flex w-full cursor-pointer items-start gap-3 rounded-[12px] border border-ink/15 bg-card px-4 py-3 text-left transition-colors hover:border-ink"
                >
                  <span className="mt-2">{stroke(index)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink group-hover:text-magenta">{route.name}</span>
                    {who(route) && <span className="block text-sm text-ink-soft">{who(route)}</span>}
                    <span className="mt-1 block text-sm text-ink">
                      {count(route.locations.length, 'stop')} · {shortName(first.name)} → {shortName(last.name)}
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} className="mt-1 shrink-0 text-ink-soft" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        (() => {
          const route = selected ?? routes[0];
          const index = selected ? selectedIndex : 0;
          const color = routeStyle(index).color;
          return (
            <div className="mt-4">
              {routes.length > 1 && <p className="font-bold">{route.name}</p>}
              {who(route) && <p className="text-sm text-ink-soft">{who(route)}</p>}
              {route.note && <p className="mt-1 text-[0.95rem] leading-snug">{route.note}</p>}
              <ol className="mt-3" aria-label={`${route.name} stops`}>
                {route.locations.map((location, stopIndex) => {
                  const also = routes.filter((other, otherIndex) => otherIndex !== index && other.locations.some(l => l.placeId === location.placeId));
                  const isLast = stopIndex === route.locations.length - 1;
                  return (
                    <li key={`${location.placeId}-${stopIndex}`} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
                      {/* Linjen mellom stoppene, i rutens farge */}
                      {!isLast && <span aria-hidden="true" className="absolute top-8 bottom-0 left-[15px] w-[3px]" style={{ backgroundColor: color }} />}
                      <span
                        className="numerals relative z-[1] mt-1.5 grid size-8 place-items-center rounded-full text-sm font-bold text-on-accent ring-2 ring-sheet"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      >
                        {stopIndex + 1}
                      </span>
                      <div className={isLast ? 'pb-1' : 'pb-4'}>
                        <button
                          type="button"
                          onClick={() => onLocationClick(location.position)}
                          aria-current={stopKey(location.position) === activeStopKey ? 'location' : undefined}
                          title={stopKey(location.position) === activeStopKey ? `Open ${location.name}` : `Show ${location.name} on the map`}
                          className={stopButtonClass(stopKey(location.position) === activeStopKey)}
                        >
                          <span className="sr-only">Stop {stopIndex + 1}: </span>{location.name}
                        </button>
                        {isVisitableLocation(location) && <PlaceMarkPill ids={[location.placeId]} />}
                        {location.note && <p className="-mt-1 text-[0.95rem] leading-snug text-ink-soft">{location.note}</p>}
                        {also.length > 0 && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                            Also on {also.map(other => (
                              <span key={other.id} className="inline-flex items-center gap-1.5 font-semibold text-ink">
                                {stroke(routes.indexOf(other))}{other.name}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {/* Rutens kilde står i dataene som dokumentasjon, ikke på siden (1. november 2026) */}
            </div>
          );
        })()
      )}
    </section>
  );
}

// Alle stedene i ett spill, med notatene, som en lesbar liste. Steder på nivå to (parken i Lisboa) står
// innrykket under byen sin, så lista sier «du er i Lisboa, og i Lisboa er du i parken». En journey (ordered)
// viser stoppene flatt, i rekkefølge. Mangler byen blant spillets steder, lages en rad for den uten notat.
function PlaceList({ locations, ordered, title, onLocationClick, activeStopKey }: { locations: Location[]; ordered: boolean; title?: string; onLocationClick: (position: Position) => void; activeStopKey?: string }) {
  const spotsOf = new Map<string, Location[]>();
  let rows = locations;
  if (!ordered) {
    const top: Location[] = [];
    for (const loc of locations) {
      const parent = spotParentOf(loc);
      if (!parent) { top.push(loc); continue; }
      if (!spotsOf.has(parent.id)) {
        spotsOf.set(parent.id, []);
        if (!locations.some(l => l.placeId === parent.id)) {
          top.push({ placeId: parent.id, name: parent.name, scale: parent.scale, placeType: parent.placeType, parentId: parent.parentId, position: [parent.position.lat, parent.position.lon], settingType: loc.settingType, wikipediaUrl: parent.wikipediaUrl });
        }
      }
      spotsOf.get(parent.id)!.push(loc);
    }
    rows = top;
  }
  return (
    <div className="mt-4">
      <h4 className="text-base font-bold">
        {title ? `${title} · ${rows.length}` : rows.length === 1 ? 'Where it takes place' : ordered ? `The journey · ${count(rows.length, 'place')}` : `Places in the game · ${rows.length}`}
      </h4>
      <ol className="mt-2 flex flex-col gap-1">
        {rows.map((loc, i) => (
          // En reise kan komme tilbake til samme sted, så navnet alene er ikke en unik nøkkel
          <li key={`${i}:${loc.placeId ?? loc.name}`} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span className="atlas-stop numerals text-sm font-bold text-magenta">{rows.length > 1 && ordered ? String(i + 1).padStart(2, '0') : <MapPin size={16} strokeWidth={2} />}</span>
            <div>
              <button
                type="button"
                onClick={() => onLocationClick(loc.position)}
                aria-current={stopKey(loc.position) === activeStopKey ? 'location' : undefined}
                title={stopKey(loc.position) === activeStopKey ? `Open ${loc.name}` : `Show ${loc.name} on the map`}
                className={`text-base ${stopButtonClass(stopKey(loc.position) === activeStopKey)}`}
              >
                {loc.name}
              </button>
              {isVisitableLocation(loc) && <PlaceMarkPill ids={[loc.placeId]} />}
              {/* Stedstype, hvordan spillet fremstiller stedet og om nålen bare markerer området, på én stille linje */}
              <p className="-mt-1 text-sm leading-relaxed text-ink-soft">
                <span>{placeTypeLabel(loc.placeType)}</span>
                <span aria-hidden="true"> · </span>
                <SettingBadge settingType={loc.settingType} />
                {loc.scale !== 'site' && <><span aria-hidden="true"> · </span><span>pin marks the area</span></>}
              </p>
              {/* Ingen Wikipedia-lenke her: den står på stedets egen side, ett trykk unna, så lista er bare steder og hva som skjer der */}
              {loc.note && <p className="mt-1.5 mb-3 text-[0.95rem] leading-snug text-ink">{loc.note}</p>}
              {spotsOf.get(loc.placeId)?.length ? (
                <ul className="mb-3 mt-1 flex flex-col gap-1 border-l-2 border-ink/15 pl-3">
                  {spotsOf.get(loc.placeId)!.map(spot => (
                    <li key={spot.placeId}>
                      <button type="button" onClick={() => onLocationClick(spot.position)} className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-left text-[0.95rem] font-bold text-ink hover:text-magenta">
                        <span aria-hidden="true" className="gt-spot-chip" />{shortName(spot.name)}
                      </button>
                      {spot.note && <p className="-mt-1 text-sm leading-snug text-ink">{spot.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SettingBadge({ settingType }: { settingType: Location['settingType'] }) {
  const type = settingType ?? 'real';
  const label = type === 'real' ? 'Real' : type === 'fictionalized' ? 'Fictionalized' : 'Imaginary';
  const color = type === 'real' ? 'var(--color-magenta)' : type === 'fictionalized' ? 'var(--color-fictional)' : 'var(--color-imaginary)';
  return (
    <span className="whitespace-nowrap font-semibold">
      <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-[-0.05em]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// Merkelappen placeLabel (gameData) setter på oppdiktede steder
const INVENTED_SUFFIX = /\s*\((fictional|legendary)\)$/;

// Kort substantiv for «Island in Sweden»; «City / town in Sweden» leste som et skjema
function placeTypeNoun(type: PlaceType) {
  return ({ country: 'Country', city: 'City', region: 'Region', neighborhood: 'District', island: 'Island', natural_feature: 'Natural feature', body_of_water: 'Water', landmark: 'Landmark', venue: 'Venue', area: 'Area' } as Record<PlaceType, string>)[type];
}

// «Gotland, Sweden» → Gotland i Sweden; «Washington, D.C., USA» er ett navn. Land som skrives med
// bestemt artikkel får den: «City in the UK», ikke «City in UK».
function splitPlaceName(name: string): { name: string; within: string } | undefined {
  const match = name.match(/^(.+?), (?!D\.C\.)(.+)$/);
  if (!match) return undefined;
  const within = match[2];
  return { name: match[1], within: WITH_ARTICLE.has(within) ? `the ${within}` : within };
}

// «Area», ikke «Other area»: på et steds egen side er det ikke noe «annet» å sammenligne med (Karibia,
// Mikronesia). I filteret står «Other area» fortsatt, ved siden av de andre typene.
function placeTypeLabel(type: PlaceType) {
  return ({ country: 'Country', city: 'City / town', region: 'Region', neighborhood: 'District / neighborhood', island: 'Island', natural_feature: 'Natural feature', body_of_water: 'Body of water', landmark: 'Landmark', venue: 'Venue', area: 'Area' } as Record<PlaceType, string>)[type];
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// "Paris, France" hører til France og vises som «Paris»; steder uten land samles under «Other places».
// Parenteser som «(fictional)» er ikke et land.
function groupByCountry(places: IndexPlace[]): [string, IndexPlace[]][] {
  const byCountry = new Map<string, IndexPlace[]>();
  for (const place of places) {
    const parts = place.name.replace(/\s*\([^)]*\)/g, '').split(',').map(part => part.trim());
    const country = parts.length > 1 ? parts[parts.length - 1] : 'Other places';
    const label = parts.length > 1 ? place.name.slice(0, place.name.lastIndexOf(`, ${country}`)) || place.name : place.name;
    byCountry.set(country, [...(byCountry.get(country) ?? []), { ...place, label }]);
  }
  return [...byCountry]
    .map(([country, list]) => [country, list.sort((a, b) => a.name.localeCompare(b.name))] as [string, IndexPlace[]])
    .sort(([a], [b]) => a === 'Other places' ? 1 : b === 'Other places' ? -1 : a.localeCompare(b));
}
