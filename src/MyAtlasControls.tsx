// Knappene og merkelappene for «My atlas». Hake betyr gjort (Been here, Played), flagg betyr vil (Want to go, Want to play),
// som merkene på kartet. Sted og spill markeres hver for seg:
// «Been here» og «Want to go» hører til stedet, «Played» og «Want to play» til spillet.
import { Check, Flag } from 'lucide-react';
import { isVisitableLocation, type Game } from './gameData';
import { gameMark, toggleGame, togglePlace, useMyAtlas } from './myAtlas';
import { placeMarkFor } from './atlasStats';

// Lagring kan feile (fullt lager, privat modus); da endres ingenting og brukeren får vite det
const safely = (action: () => void) => {
  try {
    action();
  } catch {
    window.alert('Your browser would not save this. My atlas is stored in this browser, and storage may be full or blocked.');
  }
};

const toggleClass = (on: boolean) =>
  `atlas-mark-toggle ${on ? 'is-on' : ''}`;

// Én delt bryter («vært her» | «vil dit»): valgene utelukker hverandre, så de står i samme ramme
// compact (telefon): lavere og mindre skrift; merkene er sekundære, spillene under er innholdet
export function PlaceMarkButtons({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  const atlas = useMyAtlas();
  const mark = placeMarkFor(atlas, ids);
  const segment = `atlas-mark-segment${compact ? ' is-compact' : ''}`;
  if (ids.length === 0) return null;
  // Arvet fra et sted inni (Bangkok gir Thailand): vises som markert, men kan bare endres der det ble satt
  if (mark.been && !mark.explicit) {
    return (
      <div role="group" aria-label="This place in My atlas" className={segment}>
        <span className={`${toggleClass(true)} is-implied`} title={`Counted from ${mark.via.join(', ')}`}>
          <Check size={18} strokeWidth={2.25} aria-hidden="true" />Been here
        </span>
      </div>
    );
  }
  return (
    <div role="group" aria-label="This place in My atlas" className={segment}>
      <button type="button" aria-pressed={mark.been} onClick={() => safely(() => togglePlace(ids, 'been'))} className={toggleClass(mark.been)}>
        <Check size={18} strokeWidth={2.25} aria-hidden="true" />Been here
      </button>
      <button type="button" aria-pressed={mark.want} onClick={() => safely(() => togglePlace(ids, 'want'))} className={toggleClass(mark.want)}>
        <Flag size={18} strokeWidth={1.75} aria-hidden="true" />Want to go
      </button>
    </div>
  );
}

export function GameMarkButtons({ game, compact = false }: { game: Game; compact?: boolean }) {
  const atlas = useMyAtlas();
  const mark = gameMark(atlas, game.id);
  const played = !!mark.played;
  const want = !!mark.want;
  if (compact) {
    return (
      <span role="group" aria-label={`${game.name} in My atlas`} className="flex shrink-0 gap-1.5">
        <button type="button" aria-pressed={played} aria-label="Played" title="Played" onClick={() => safely(() => toggleGame(game.id, 'played'))} className={`${toggleClass(played)} is-icon`}>
          <Check size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <button type="button" aria-pressed={want} aria-label="Want to play" title="Want to play" onClick={() => safely(() => toggleGame(game.id, 'want'))} className={`${toggleClass(want)} is-icon`}>
          <Flag size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    );
  }
  return (
    <div role="group" aria-label="This game in My atlas" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={played} onClick={() => safely(() => toggleGame(game.id, 'played'))} className={toggleClass(played)}>
        <Check size={18} strokeWidth={2.25} aria-hidden="true" />Played
      </button>
      <button type="button" aria-pressed={want} onClick={() => safely(() => toggleGame(game.id, 'want'))} className={toggleClass(want)}>
        <Flag size={18} strokeWidth={1.75} aria-hidden="true" />Want to play
      </button>
    </div>
  );
}

// Liten merkelapp ved et spill i en stedsliste: viser hva du har markert, uten knapper. Selve markeringen
// gjøres på spillsiden, der knappene har tekst; to ikonknapper på hver rad var uforståelige for de fleste
export function GameMarkPill({ game }: { game: Game }) {
  const atlas = useMyAtlas();
  const mark = gameMark(atlas, game.id);
  if (!mark.played && !mark.want) return null;
  return mark.played
    ? <span className="atlas-mark-pill"><Check size={13} strokeWidth={2.5} aria-hidden="true" />Played</span>
    : <span className="atlas-mark-pill is-want"><Flag size={12} strokeWidth={2} aria-hidden="true" />Want to play</span>;
}

// Liten merkelapp ved et sted i en rute eller liste: viser hva du har markert på stedet
export function PlaceMarkPill({ ids }: { ids: string[] }) {
  const atlas = useMyAtlas();
  const mark = placeMarkFor(atlas, ids);
  if (!mark.been && !mark.want) return null;
  return mark.been
    ? <span className="atlas-mark-pill"><Check size={13} strokeWidth={2.5} aria-hidden="true" />Been here</span>
    : <span className="atlas-mark-pill is-want"><Flag size={12} strokeWidth={2} aria-hidden="true" />Want to go</span>;
}

// «You've been here and played 2 of the 37 games set here.»
// compact (telefon): «Played 1 of 4» ved siden av bryteren, så spillene under kommer én linje høyere
export function PlaceAtlasLine({ ids, games, compact = false }: { ids: string[]; games: Game[]; compact?: boolean }) {
  const atlas = useMyAtlas();
  const { been, explicit, via } = placeMarkFor(atlas, ids);
  const played = games.filter(game => gameMark(atlas, game.id).played).length;
  const inherited = been && !explicit;
  if (played === 0 && !inherited) return null;
  const of = games.length === 1 ? 'the game' : `${played} of the ${games.length} games`;
  const list = via.length > 3 ? `${via.slice(0, 3).join(', ')} and ${via.length - 3} more` : via.join(', ');
  if (compact && !inherited) {
    return (
      <p className="numerals text-[0.9rem] leading-snug text-ink-soft">
        Played <b className="text-ink">{games.length === 1 ? 'this one' : `${played} of ${games.length}`}</b>
      </p>
    );
  }
  return (
    <p className="basis-full text-[0.9rem] leading-snug text-ink">
      {inherited && <>Counts as visited: you've been to <b>{list}</b>.{played > 0 && ' '}</>}
      {played > 0 && <>{been && !inherited ? "You've been here and played " : "You've played "}<b>{of}</b> set here.</>}
    </p>
  );
}

// «You've been to 1 of its 6 places: Boston.»
export function GameAtlasLine({ game }: { game: Game }) {
  const atlas = useMyAtlas();
  const seen = new Map<string, string>();
  for (const loc of game.locations) if (isVisitableLocation(loc)) seen.set(loc.placeId, loc.name);
  const been = [...seen].filter(([id]) => placeMarkFor(atlas, [id]).been);
  if (been.length === 0) return null;
  const names = been.map(([, name]) => name.split(',')[0]);
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ');
  return (
    <p className="mt-2.5 text-[0.9rem] leading-snug text-ink">
      You've been to <b>{seen.size === 1 ? 'its place' : `${been.length} of its ${seen.size} places`}</b>: {list}.
    </p>
  );
}
