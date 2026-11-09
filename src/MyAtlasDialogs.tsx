// Dialogene for «My atlas»: importere CSV, åpne i Table Editor, tømme og gjenopprette, og angre-meldingen.
import { AlertTriangle, ArrowUpRight, FileText, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type AtlasCatalog, type AtlasImport, TABLE_EDITOR_MAX_CELLS, atlasTable, markedRows, tableEditorUrl } from './atlasFiles';
import { count, shortDate } from './format';
import { addToAtlas, clearAtlas, mergeAtlas, replaceAtlas, restoreCleared, useClearedAtlas, useMyAtlas } from './myAtlas';
import { atlasTotal } from './atlasStats';

export type AtlasDialog =
  | { kind: 'import'; fileName: string; result: AtlasImport | { error: string } }
  | { kind: 'table' }
  | { kind: 'clear' }
  | { kind: 'restore' };

export type AtlasToast = { message: string; undo?: boolean; seq: number };

const SAVE_FAILED = 'Your browser would not save the change, so nothing was changed. Storage may be full or blocked in this window.';

const buttonClass = 'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 font-bold';
const secondaryClass = `${buttonClass} border border-ink/25 bg-card font-semibold text-ink hover:border-ink`;
const primaryClass = `${buttonClass} bg-magenta text-on-accent hover:bg-magenta-deep disabled:cursor-not-allowed disabled:opacity-45`;
const linkClass = 'min-h-11 cursor-pointer font-semibold underline underline-offset-4 hover:text-magenta';

function Modal({ title, alert = false, onClose, children, footer }: {
  title: string;
  alert?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Fokus på det trygge valget: «Keep my atlas», «Cancel» eller det første feltet
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby="atlas-dialog-title"
      className="atlas-modal"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <header className="flex items-center justify-between gap-4 border-b border-ink/15 py-4 pr-4 pl-6">
        <h2 id="atlas-dialog-title" className="text-[1.25rem] font-bold leading-tight">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] hover:bg-ink/7">
          <X size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[0.95rem] leading-relaxed">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/15 px-6 py-3.5">{footer}</footer>
    </dialog>
  );
}

const Note = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <p className="mt-4 flex gap-2 rounded-[10px] bg-ink/6 px-3 py-2.5 text-sm leading-snug">{icon}<span>{children}</span></p>
);

const quoteList = (names: string[]) => {
  const shown = names.slice(0, 3).map(name => `“${name}”`).join(', ');
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
};

function ImportDialog({ fileName, result, onClose, onChooseFile, onToast }: {
  fileName: string;
  result: AtlasImport | { error: string };
  onClose: () => void;
  onChooseFile: () => void;
  onToast: (toast: Omit<AtlasToast, 'seq'>) => void;
}) {
  const atlas = useMyAtlas();
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [error, setError] = useState<string>();
  const current = atlasTotal(atlas);
  const found = 'error' in result ? 0 : result.places + result.games;
  const added = 'error' in result ? 0 : atlasTotal(mergeAtlas(atlas, result.atlas)) - current;

  const run = () => {
    if ('error' in result) return;
    try {
      if (mode === 'replace' && current > 0) {
        replaceAtlas(result.atlas);
        onToast({ message: `My atlas replaced. ${count(current, 'earlier mark')} moved aside.`, undo: true });
      } else {
        addToAtlas(result.atlas);
        onToast({ message: added > 0 ? `Added ${count(added, 'new mark')} to My atlas.` : 'Imported. Everything in the file was already in My atlas.' });
      }
      onClose();
    } catch {
      setError(SAVE_FAILED);
    }
  };

  return (
    <Modal
      title="Import CSV"
      onClose={onClose}
      footer={<>
        <button type="button" data-autofocus onClick={onClose} className={secondaryClass}>Cancel</button>
        {found > 0 && <button type="button" onClick={run} className={primaryClass}>Import {count(found, 'mark')}</button>}
      </>}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex min-w-0 items-center gap-2 rounded-[8px] bg-ink/6 px-2.5 py-1 text-sm font-semibold"><FileText size={16} aria-hidden="true" className="shrink-0" /><span className="truncate">{fileName}</span></span>
        <button type="button" onClick={onChooseFile} className={`${linkClass} text-sm`}>Choose another</button>
      </p>
      {'error' in result ? (
        <Note icon={<AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-magenta" />}>{result.error}</Note>
      ) : (
        <>
          <h3 className="mt-4 font-bold">Found in the file</h3>
          {found === 0 && <p className="mt-1 text-ink-soft">No rows are marked “yes”, so there is nothing to import.</p>}
          <ul className="mt-1">
            {result.places > 0 && <li><b>{count(result.places, 'place')}</b> <span className="text-ink-soft">· {result.been} been here, {result.wantGo} want to go</span></li>}
            {result.games > 0 && <li><b>{count(result.games, 'game')}</b> <span className="text-ink-soft">· {result.played} played, {result.wantPlay} want to play</span></li>}
            {result.skipped.length > 0 && <li className="text-ink-soft"><b className="text-ink">{count(result.skipped.length, 'row')} skipped</b> · not in the atlas: {quoteList(result.skipped)}</li>}
          </ul>
          {found > 0 && current > 0 && (
            <fieldset className="mt-4">
              <legend className="font-bold">How to bring it in</legend>
              {([
                ['add', 'Add to My atlas', `Keeps everything you've marked here and adds the marks from the file. ${added > 0 ? `${count(added, 'new mark')}.` : 'Nothing new.'}`],
                ['replace', 'Replace My atlas', `Clears the ${count(current, 'mark')} in this browser first. You can undo it.`],
              ] as const).map(([value, label, hint]) => (
                <label key={value} className="mt-2 flex cursor-pointer gap-3 rounded-[10px] border border-ink/20 p-3 has-[:checked]:border-ink">
                  <input type="radio" name="atlas-import-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-4 shrink-0 accent-ink" />
                  <span><b>{label}</b><span className="block text-sm text-ink-soft">{hint}</span></span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
      {error && <Note icon={<AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-magenta" />}>{error}</Note>}
    </Modal>
  );
}

function TableDialog({ catalog, siteUrl, onClose }: { catalog: AtlasCatalog; siteUrl: string; onClose: () => void }) {
  const atlas = useMyAtlas();
  const rows = markedRows(atlas, catalog);
  const [include, setInclude] = useState({ places: rows.places.length > 0, games: rows.games.length > 0, links: false });
  const caption = `My atlas · Game Traveler · ${shortDate(new Date().toISOString())}`;
  const table = atlasTable(atlas, catalog, { ...include, siteUrl, caption });
  const cells = table.length * (table[0]?.length ?? 0);
  const tooBig = cells > TABLE_EDITOR_MAX_CELLS;
  const empty = table.length < 2;
  const options = [
    ['places', 'Places', 'been here and want to go', rows.places.length],
    ['games', 'Games', 'played and want to play', rows.games.length],
    ['links', 'Links', 'a Game Traveler link per row', undefined],
  ] as const;

  return (
    <Modal
      title="Open in Table Editor"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={`${linkClass} mr-auto`}>Cancel</button>
        {empty || tooBig
          ? <button type="button" disabled className={primaryClass}>Open Table Editor<ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" /></button>
          : <a href={tableEditorUrl(table, caption)} target="_blank" rel="noopener" onClick={onClose} className={primaryClass}>Open Table Editor<ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
      </>}
    >
      <p className="text-ink-soft">Opens your list as a table at truben.no/table, where you can sort it, style it and copy it in another format.</p>
      <fieldset className="mt-4">
        <legend className="mb-1 font-bold">Include</legend>
        {options.map(([key, label, hint, total], index) => (
          <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              data-autofocus={index === 0 ? true : undefined}
              checked={include[key]}
              disabled={total === 0}
              onChange={event => setInclude(current => ({ ...current, [key]: event.target.checked }))}
              className="size-5 shrink-0 accent-ink"
            />
            <span className="flex-1"><b>{label}</b> <span className="text-ink-soft">· {hint}</span></span>
            {total !== undefined && <span className="numerals text-ink-soft">{count(total, 'row')}</span>}
          </label>
        ))}
      </fieldset>
      {tooBig && <Note icon={<AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-magenta" />}>That is {cells.toLocaleString('en-GB')} cells, more than Table Editor opens from a link ({TABLE_EDITOR_MAX_CELLS.toLocaleString('en-GB')}). Leave out links or a part, or export as CSV instead.</Note>}
      <Note icon={<ShieldCheck size={18} aria-hidden="true" className="mt-0.5 shrink-0" />}>The list travels inside the link to a new tab. Nothing is uploaded; the part after # never reaches a server.</Note>
    </Modal>
  );
}

function ClearDialog({ catalog, onClose, onExport, onToast }: {
  catalog: AtlasCatalog;
  onClose: () => void;
  onExport: () => void;
  onToast: (toast: Omit<AtlasToast, 'seq'>) => void;
}) {
  const atlas = useMyAtlas();
  const [error, setError] = useState<string>();
  const { places, games } = markedRows(atlas, catalog);
  const total = atlasTotal(atlas);
  const n = (rows: { been?: boolean; want?: boolean; played?: boolean }[], key: 'been' | 'want' | 'played') => rows.filter(row => row[key]).length;
  const clear = () => {
    try {
      clearAtlas();
      onToast({ message: `My atlas cleared. ${count(total, 'mark')} moved aside.`, undo: true });
      onClose();
    } catch {
      setError(SAVE_FAILED);
    }
  };
  return (
    <Modal
      title="Clear My atlas?"
      alert
      onClose={onClose}
      footer={<>
        <button type="button" data-autofocus onClick={onClose} className={secondaryClass}>Keep my atlas</button>
        <button type="button" onClick={clear} className={`${buttonClass} bg-magenta-deep text-on-accent hover:brightness-90`}>Clear {count(total, 'mark')}</button>
      </>}
    >
      <p>This removes every mark in this browser:</p>
      <ul className="mt-2 leading-loose">
        <li><b>{n(places, 'been')}</b> places you've been · <b>{n(places, 'want')}</b> you want to go</li>
        <li><b>{n(games, 'played')}</b> games played · <b>{n(games, 'want')}</b> you want to play</li>
      </ul>
      <Note>You can undo this afterwards. To keep a copy outside this browser, <button type="button" onClick={onExport} className="cursor-pointer font-semibold underline underline-offset-4 hover:text-magenta">export as CSV</button> first.</Note>
      {error && <Note icon={<AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-magenta" />}>{error}</Note>}
    </Modal>
  );
}

function RestoreDialog({ onClose, onToast }: { onClose: () => void; onToast: (toast: Omit<AtlasToast, 'seq'>) => void }) {
  const atlas = useMyAtlas();
  const cleared = useClearedAtlas();
  const [error, setError] = useState<string>();
  if (!cleared) return null;
  const saved = atlasTotal(cleared.atlas);
  const now = atlasTotal(atlas);
  const restore = (mode: 'merge' | 'replace') => {
    try {
      restoreCleared(mode);
      onToast(mode === 'merge'
        ? { message: `Restored ${count(saved, 'mark')} and kept what you marked since.` }
        : { message: `Restored ${count(saved, 'mark')}. The ${count(now, 'mark')} you had were moved aside.`, undo: true });
      onClose();
    } catch {
      setError(SAVE_FAILED);
    }
  };
  return (
    <Modal
      title="Restore cleared atlas?"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={`${linkClass} mr-auto`}>Cancel</button>
        <button type="button" onClick={() => restore('replace')} className={secondaryClass}>Replace</button>
        <button type="button" data-autofocus onClick={() => restore('merge')} className={primaryClass}>Merge</button>
      </>}
    >
      <p>The cleared atlas has <b>{count(saved, 'mark')}</b> from {shortDate(cleared.clearedAt)}. Since then you've marked <b>{count(now, 'thing')}</b>.</p>
      <ul className="mt-3 list-disc pl-5">
        <li><b>Merge</b> keeps both.</li>
        <li><b>Replace</b> brings back the cleared atlas and moves what you have now aside.</li>
      </ul>
      {error && <Note icon={<AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-magenta" />}>{error}</Note>}
    </Modal>
  );
}

export function AtlasDialogs({ dialog, catalog, siteUrl, onClose, onChooseFile, onExport, onToast }: {
  dialog: AtlasDialog | null;
  catalog: AtlasCatalog;
  siteUrl: string;
  onClose: () => void;
  onChooseFile: () => void;
  onExport: () => void;
  onToast: (toast: Omit<AtlasToast, 'seq'>) => void;
}) {
  if (!dialog) return null;
  if (dialog.kind === 'import') return <ImportDialog key={dialog.fileName} fileName={dialog.fileName} result={dialog.result} onClose={onClose} onChooseFile={onChooseFile} onToast={onToast} />;
  if (dialog.kind === 'table') return <TableDialog catalog={catalog} siteUrl={siteUrl} onClose={onClose} />;
  if (dialog.kind === 'clear') return <ClearDialog catalog={catalog} onClose={onClose} onExport={onExport} onToast={onToast} />;
  return <RestoreDialog onClose={onClose} onToast={onToast} />;
}

// Meldingen nederst på kartet; «Undo» legger den tømte kopien tilbake. Forsvinner etter 10 sekunder.
export function AtlasToastMessage({ toast, onDone, onToast }: { toast: AtlasToast | null; onDone: () => void; onToast: (toast: Omit<AtlasToast, 'seq'>) => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDone, 10_000);
    return () => window.clearTimeout(timer);
  }, [toast, onDone]);
  if (!toast) return null;
  const undo = () => {
    try {
      restoreCleared('replace');
      onToast({ message: 'Undone. My atlas is back.' });
    } catch {
      window.alert(SAVE_FAILED);
    }
  };
  return (
    <div role="status" className="atlas-toast">
      <span className="flex-1">{toast.message}</span>
      {toast.undo && <button type="button" onClick={undo} className="atlas-toast-undo">Undo</button>}
    </div>
  );
}
