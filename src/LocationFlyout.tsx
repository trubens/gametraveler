import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MapPin, Route, Share2, X } from "lucide-react";
import { Game, Location } from "./gameData";
import { count, eraSpan, formatDistance, formatYear, genreInk, shortName } from "./format";

type Position = [number, number];

export type PanelSection = {
  // Stedsnavn vises som mellomtittel når panelet samler flere steder
  title?: string;
  // Tekst til høyre for mellomtittelen, f.eks. avstand
  meta?: string;
  position?: Position;
  games: Game[];
};

export type NearbyPlace = { name: string; position: Position; games: number; km: number };

const samePosition = (a: Position, b?: Position) => !!b && a[0] === b[0] && a[1] === b[1];

const chipClass =
  "flex min-h-11 cursor-pointer items-center gap-1.5 border border-ink-soft/40 px-3 text-[0.95rem] font-medium text-ink transition-colors hover:border-magenta hover:text-magenta md:min-h-9";

export function LocationFlyout({
  title,
  variant,
  sections,
  autoFocus,
  backLabel,
  selectedGameId,
  nearby,
  sameEra,
  contributeUrl,
  onBack,
  onOpenGame,
  onToggleRoute,
  onClose,
  onLocationClick,
  onShare,
}: {
  title: string;
  // 'game' viser ett spill med alle stedene og notatene; 'list' viser en liste over spill
  variant: 'list' | 'game';
  sections: PanelSection[];
  autoFocus: boolean;
  backLabel?: string;
  selectedGameId?: number;
  nearby?: NearbyPlace[];
  sameEra?: Game[];
  contributeUrl?: string;
  onBack: () => void;
  onOpenGame: (game: Game) => void;
  onToggleRoute: (game: Game) => void;
  onClose: () => void;
  onLocationClick: (position: Position) => void;
  onShare: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Fokus flyttes inn i panelet når brukeren åpnet det, men ikke mens man skriver i søket
  useEffect(() => {
    if (autoFocus) headingRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const allGames = sections.flatMap(s => s.games);
  const era = eraSpan(allGames.flatMap(g => g.storyYears));
  const placeCount = sections.filter(s => s.title).length;
  const hasCovers = allGames.some(g => g.coverUrl);
  const GameHeading = placeCount > 0 ? "h4" : "h3";

  return (
    <aside
      aria-labelledby="panel-title"
      className={`gt-panel absolute z-[1000] flex flex-col bg-sheet
        max-md:inset-x-0 max-md:bottom-0 max-md:border-t-[3px] max-md:border-ink
        md:inset-y-0 md:left-0 md:w-[420px] md:border-r-[3px] md:border-ink
        ${expanded ? "max-md:h-[90%]" : "max-md:max-h-[62%]"}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse panel" : "Expand panel"}
        className="grid h-6 w-full shrink-0 cursor-pointer place-items-center md:hidden"
      >
        <span className="h-1 w-12 bg-ink-soft/50" />
      </button>

      {/* Tung linje over hårstrek, som under en artikkeltittel */}
      <header className="relative mb-2 flex items-start gap-2 border-b-[3px] border-ink px-6 pb-4 after:absolute after:inset-x-0 after:-bottom-[6px] after:h-px after:bg-ink md:pt-5">
        <div className="min-w-0 flex-1">
          {backLabel && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 mb-2 flex min-h-9 cursor-pointer items-center gap-1.5 px-1 text-[0.95rem] font-semibold text-ink-soft hover:text-magenta"
            >
              <ArrowLeft size={18} strokeWidth={2.25} />
              Back to {backLabel}
            </button>
          )}
          <h2
            id="panel-title"
            ref={headingRef}
            tabIndex={-1}
            className="headline line-clamp-2 text-[1.6rem] leading-[0.95] uppercase focus:outline-none md:line-clamp-none md:text-[2.5rem]"
          >
            {title}
          </h2>
          <p className="numerals mt-2 text-base text-ink-soft">
            {variant === 'game' && allGames[0] ? (
              <>
                <span className="font-semibold text-ink">{allGames[0].year}</span>
                {' · '}{count(allGames[0].locations.length, 'place')}
                {era && <> · set {era}</>}
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{count(allGames.length, 'game')}</span>
                {placeCount > 1 && <> · {count(placeCount, 'place')}</>}
                {era && <> · set {era}</>}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label="Share this page"
          title="Share"
          className="grid size-11 shrink-0 cursor-pointer place-items-center text-ink transition-colors hover:bg-yellow"
        >
          <Share2 size={22} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="-mr-2 grid size-11 shrink-0 cursor-pointer place-items-center text-ink transition-colors hover:bg-yellow"
        >
          <X size={26} strokeWidth={2.5} />
        </button>
      </header>

      <div className="thin-scroll flex-1 overflow-y-auto">
        {sections.map(section => (
          <section key={section.title ?? "all"} aria-label={section.title}>
            {section.title && section.position && (
              <h3 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-ink bg-sheet px-6 pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => onLocationClick(section.position!)}
                  className="min-h-9 cursor-pointer text-left text-[0.95rem] font-bold tracking-wide uppercase hover:text-magenta"
                >
                  {section.title}
                </button>
                <span className="numerals shrink-0 text-sm font-semibold text-ink-soft">
                  {section.meta ?? count(section.games.length, 'game')}
                </span>
              </h3>
            )}
            <ol>
              {section.games.map(game => {
                const selected = game.id === selectedGameId;
                // «Set in» er overflødig når det bare gjentar utgivelsesåret
                const showStory = game.storyYears.length > 0 && !(game.storyYears.length === 1 && game.storyYears[0] === game.year);
                const here = section.position ? game.locations.find(l => samePosition(l.position, section.position)) : undefined;
                return (
                  <li
                    key={game.id}
                    className={`grid grid-cols-[4.25rem_1fr] gap-x-4 border-b border-rule px-6 py-5 transition-colors ${selected ? "bg-yellow/30" : ""}`}
                  >
                    <div className="headline numerals pt-0.5 text-[1.9rem] leading-none text-ink">{game.year}</div>

                    <article className="min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        {variant === 'game' ? (
                          <GameHeading className="headline text-[1.6rem] leading-[1.05]">{game.name}</GameHeading>
                        ) : (
                          <GameHeading className="headline text-[1.6rem] leading-[1.05]">
                            <button
                              type="button"
                              onClick={() => onOpenGame(game)}
                              className="cursor-pointer text-left hover:text-magenta hover:underline hover:decoration-2 hover:underline-offset-4"
                            >
                              {game.name}
                            </button>
                          </GameHeading>
                        )}
                        {game.coverUrl && (
                          <img
                            src={game.coverUrl}
                            alt=""
                            width={64}
                            height={85}
                            loading="lazy"
                            className="h-[85px] w-16 shrink-0 border-2 border-ink object-cover"
                          />
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-[0.8125rem] font-bold tracking-wide uppercase ${genreInk(game.genre)}`}>
                          {game.genre}
                        </span>
                        {showStory && (
                          <span className="numerals text-sm text-ink-soft">
                            Set in {game.storyYears.map(formatYear).join(", ")}
                          </span>
                        )}
                      </div>

                      {here?.note && variant === 'list' && (
                        <p className="mt-3 text-[0.95rem] leading-snug text-ink">{here.note}</p>
                      )}

                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[0.95rem]">
                        <dt className="text-ink-soft">Developer</dt>
                        <dd className="font-medium">{game.developer}</dd>
                        <dt className="text-ink-soft">Publisher</dt>
                        <dd className="font-medium">{game.publisher}</dd>
                      </dl>

                      {variant === 'game' ? (
                        <PlaceList locations={game.locations} onLocationClick={onLocationClick} />
                      ) : game.locations.length > 1 ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => onToggleRoute(game)}
                            aria-pressed={selected}
                            className={`flex min-h-11 cursor-pointer items-center gap-2 border-2 px-3.5 text-[0.95rem] font-bold transition-colors md:min-h-9 ${
                              selected
                                ? "border-magenta bg-magenta text-white"
                                : "border-ink text-ink hover:bg-ink hover:text-white"
                            }`}
                          >
                            <Route size={18} strokeWidth={2.25} />
                            {selected ? "Journey shown on the map" : `Show the journey (${count(game.locations.length, 'place')})`}
                          </button>
                          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Places in this game">
                            {game.locations.map(loc => (
                              <li key={loc.name}>
                                {samePosition(loc.position, section.position) ? (
                                  <span className="flex min-h-11 items-center gap-1.5 bg-ink px-3 text-[0.95rem] font-semibold text-white md:min-h-9">
                                    <MapPin size={14} strokeWidth={2.5} />
                                    {loc.name}
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => onLocationClick(loc.position)} className={chipClass}>
                                    <MapPin size={14} strokeWidth={2.25} />
                                    {loc.name}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        !section.position && game.locations[0] && (
                          <button
                            type="button"
                            onClick={() => onLocationClick(game.locations[0].position)}
                            className={`mt-4 ${chipClass}`}
                          >
                            <MapPin size={14} strokeWidth={2.25} />
                            {game.locations[0].name}
                          </button>
                        )
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {nearby && nearby.length > 0 && (
          <section aria-labelledby="nearby-title" className="border-b border-rule px-6 py-5">
            <h3 id="nearby-title" className="text-[0.95rem] font-bold tracking-wide uppercase">Nearby</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {nearby.map(place => (
                <li key={place.name}>
                  <button type="button" onClick={() => onLocationClick(place.position)} className={chipClass}>
                    <MapPin size={14} strokeWidth={2.25} />
                    {shortName(place.name)}
                    <span className="numerals font-normal text-ink-soft">
                      · {count(place.games, 'game')} · {formatDistance(place.km)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sameEra && sameEra.length > 0 && (
          <section aria-labelledby="era-title" className="border-b border-rule px-6 py-5">
            <h3 id="era-title" className="text-[0.95rem] font-bold tracking-wide uppercase">Set in the same era</h3>
            <ol className="mt-2">
              {sameEra.map(game => (
                <li key={game.id} className="grid grid-cols-[4.25rem_1fr] gap-x-4 border-b border-rule last:border-b-0">
                  <span className="numerals py-3 text-base font-semibold leading-none text-ink-soft">{game.year}</span>
                  <button
                    type="button"
                    onClick={() => onOpenGame(game)}
                    className="min-h-11 cursor-pointer py-2 text-left text-base font-bold leading-tight hover:text-magenta"
                  >
                    {game.name}
                    <span className="numerals ml-2 font-normal text-ink-soft">
                      {eraSpan(game.storyYears)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

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
      </div>
    </aside>
  );
}

// Alle stedene i ett spill, med notatene, som en lesbar liste
function PlaceList({ locations, onLocationClick }: { locations: Location[]; onLocationClick: (position: Position) => void }) {
  return (
    <div className="mt-4">
      <h4 className="text-[0.95rem] font-bold tracking-wide uppercase">
        {locations.length > 1 ? `The journey · ${count(locations.length, 'place')}` : 'Where it takes place'}
      </h4>
      <ol className="mt-2 flex flex-col gap-1">
        {locations.map((loc, i) => (
          <li key={loc.name} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span className="numerals pt-2.5 text-sm font-bold text-magenta">{locations.length > 1 ? i + 1 : <MapPin size={16} strokeWidth={2.5} />}</span>
            <div>
              <button
                type="button"
                onClick={() => onLocationClick(loc.position)}
                className="min-h-11 cursor-pointer text-left text-base font-bold text-ink hover:text-magenta md:min-h-9"
              >
                {loc.name}
              </button>
              {loc.note && <p className="-mt-1 pb-2 text-[0.95rem] leading-snug text-ink-soft">{loc.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
