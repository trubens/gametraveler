// Innholdet i «My atlas»-panelet: tall for steder og spill og filhandlingene. Listene per tall er fjernet
// (8. november 2026): kartfilteret på tallene viser det samme, og listene ble sjelden brukt.
import { Check, Flag } from 'lucide-react';
import { useMemo } from 'react';
import { Game } from './gameData';
import { count, shortDate } from './format';
import { useClearedAtlas, useMyAtlas } from './myAtlas';
import { type AtlasFilter, type GameFilter, type PlaceFilter, atlasPlaces, atlasTotal, beenCountries } from './atlasStats';

// Én knappestil for alle handlingene i panelet; den farlige er rød
const buttonBase = 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border bg-card px-3 text-[0.9rem] font-semibold md:min-h-9';
const actionClass = `${buttonBase} border-ink/25 text-ink hover:border-ink`;
const dangerClass = `${buttonBase} border-magenta-deep/40 text-magenta-deep hover:border-magenta-deep`;

export function MyAtlasPanel({ games, totals, filter, onFilter, onExport, onImport, onTable, onRestore, onClear }: {
  games: Game[];
  // Det andelene regnes mot: steder du kan reise til og historiespill, som i headeren
  totals: { places: number; games: number };
  filter: AtlasFilter;
  onFilter: (filter: AtlasFilter) => void;
  onExport: () => void;
  onImport: () => void;
  onTable: () => void;
  onRestore: () => void;
  onClear: () => void;
}) {
  const atlas = useMyAtlas();
  const cleared = useClearedAtlas();
  const been = useMemo(() => atlasPlaces(atlas, 'been'), [atlas]);
  const wantGo = useMemo(() => atlasPlaces(atlas, 'want'), [atlas]);
  const played = useMemo(() => games.filter(game => atlas.games[String(game.id)]?.played), [atlas, games]);
  const wantPlay = useMemo(() => games.filter(game => atlas.games[String(game.id)]?.want), [atlas, games]);

  type Tile = { id: string; on: boolean; toggle: () => AtlasFilter; value: number; of?: string; label: string; icon: React.ReactNode };
  const share = (value: number, total: number, noun: string) =>
    `of ${total} ${noun} · ${value === 0 ? '0' : value / total < 0.01 ? '<1' : Math.round((value / total) * 100)}%`;
  const countries = useMemo(() => beenCountries(atlas).size, [atlas]);
  const placeTile = (id: PlaceFilter) => ({ id, on: filter.place === id, toggle: () => ({ ...filter, place: filter.place === id ? null : id }) });
  const gameTile = (id: GameFilter) => ({ id: `game-${id}`, on: filter.game === id, toggle: () => ({ ...filter, game: filter.game === id ? null : id }) });
  const tiles: Tile[] = [
    { ...placeTile('been'), value: been.length, of: `${share(been.length, totals.places, 'real-world places')}${countries > 0 ? ` · ${count(countries, 'country', 'countries')}` : ''}`, label: 'Been here', icon: <Check size={15} strokeWidth={2.25} aria-hidden="true" /> },
    { ...placeTile('want'), value: wantGo.length, label: 'Want to go', icon: <Flag size={15} strokeWidth={1.75} aria-hidden="true" /> },
    { ...gameTile('played'), value: played.length, of: share(played.length, totals.games, 'story games'), label: 'Played', icon: <Check size={15} strokeWidth={2.25} aria-hidden="true" /> },
    { ...gameTile('want'), value: wantPlay.length, label: 'Want to play', icon: <Flag size={15} strokeWidth={1.75} aria-hidden="true" /> },
  ];
  // «Not been yet» og «Not played yet» er de to valgene som ikke har eget tall: det som mangler i atlaset
  const notBeen = placeTile('not-been');
  const notPlayed = gameTile('not-played');
  const empty = tiles.every(tile => tile.value === 0);
  const filtering = !!(filter.place || filter.game);

  const notClass = (on: boolean) => `col-span-2 -mt-0.5 min-h-9 cursor-pointer text-left text-sm font-semibold underline-offset-4 ${on ? 'text-ink underline' : 'text-ink-soft hover:text-ink hover:underline'}`;

  const tile = (t: (typeof tiles)[number]) => (
    <button
      key={t.id}
      type="button"
      aria-pressed={t.on}
      onClick={() => onFilter(t.toggle())}
      title={t.on ? 'Show everything on the map' : 'Show only these on the map'}
      className={`atlas-stat ${t.on ? 'is-on' : ''}`}
    >
      <span className="numerals block text-[1.75rem] leading-none font-extrabold [font-stretch:68%]">{t.value}</span>
      <span className="mt-1 flex items-center gap-1.5 text-sm">{t.icon}{t.label}</span>
      {t.of && <span className="atlas-stat-of numerals block text-[0.8125rem]">{t.of}</span>}
    </button>
  );

  return (
    <>
      <div className="border-b border-rule px-6 pt-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <h3 className="col-span-2 text-[0.8125rem] font-bold tracking-[0.04em] text-ink-soft uppercase">Places</h3>
          {tiles.slice(0, 2).map(tile)}
          {!empty && <button type="button" aria-pressed={notBeen.on} onClick={() => onFilter(notBeen.toggle())} className={notClass(notBeen.on)}>Not been yet</button>}
          <h3 className="col-span-2 mt-1.5 text-[0.8125rem] font-bold tracking-[0.04em] text-ink-soft uppercase">Games</h3>
          {tiles.slice(2).map(tile)}
          {!empty && <button type="button" aria-pressed={notPlayed.on} onClick={() => onFilter(notPlayed.toggle())} className={notClass(notPlayed.on)}>Not played yet</button>}
        </div>
        {filtering && <p className="mt-3 text-sm text-ink-soft">The map shows only what you chose.{filter.game && !filter.place ? ' A games choice shows the places of those games.' : ''} Select it again to show everything.</p>}
      </div>

      {/* Atlaset ut og inn av nettleseren: egen gruppe like under tallene, så den ikke ligger under alle listene.
          Table Editor er ukjent for de fleste, så den står som en forklart lenke under knappene, ikke som en tredje knapp */}
      <div className="border-b border-rule px-6 py-4">
        <p className="mb-3 text-sm text-ink-soft">Saved in this browser only, nothing is sent anywhere. Export a copy to keep it or move it.</p>
        <div className="flex flex-wrap gap-2 *:flex-1 *:basis-28">
          {!empty && <button type="button" onClick={onExport} className={actionClass}>Export CSV</button>}
          <button type="button" onClick={onImport} className={actionClass}>Import CSV…</button>
        </div>
        {!empty && (
          <p className="mt-3 text-sm text-ink-soft">
            <button type="button" onClick={onTable} className="min-h-11 cursor-pointer font-semibold text-ink underline underline-offset-4 hover:text-magenta md:min-h-0">Open as a table…</button>
            {' '}on truben.no/table, where you can sort it and copy it.
          </p>
        )}
      </div>

      {empty && (
        <p className="px-6 py-5 text-[0.95rem] leading-relaxed text-ink-soft">
          Nothing marked yet. Open a place and choose <b className="text-ink">Been here</b> or <b className="text-ink">Want to go</b>; open a game and choose <b className="text-ink">Played</b> or <b className="text-ink">Want to play</b>.
        </p>
      )}

      {(cleared || !empty) && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          {cleared && (
            <button type="button" onClick={onRestore} className={actionClass} title={`${count(atlasTotal(cleared.atlas), 'mark')}, cleared ${shortDate(cleared.clearedAt)}`}>
              Restore cleared atlas
            </button>
          )}
          {!empty && <button type="button" onClick={onClear} className={dangerClass}>Clear my atlas…</button>}
          {cleared && <span className="numerals basis-full text-[0.8125rem] text-ink-soft">The cleared atlas has {count(atlasTotal(cleared.atlas), 'mark')} from {shortDate(cleared.clearedAt)}.</span>}
        </div>
      )}
    </>
  );
}
