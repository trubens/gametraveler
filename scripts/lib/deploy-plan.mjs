// Rene hjelpere for scripts/deploy-ftp.mjs (testes i scripts/deploy-plan.test.mjs)
import path from 'node:path';

export const PRODUCTION_SITE_URL = 'https://truben.no/gametraveler/';

export function isContentHashedAsset(relativePath) {
  return relativePath.startsWith('assets/')
    && /-[A-Za-z0-9_-]{8,}\.[^./]+$/.test(path.posix.basename(relativePath));
}

// Et bygg med feil VITE_SITE_URL (CI bygger med example.org) skal aldri ut: canonical-lenkene og sitemap
// ville pekt et annet sted
export function assertProductionBuild(indexHtml) {
  const canonical = indexHtml.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (!canonical?.startsWith(PRODUCTION_SITE_URL)) {
    throw new Error(`dist/index.html has canonical ${canonical ? `"${canonical}"` : '(none)'}, not ${PRODUCTION_SITE_URL}. Build with VITE_SITE_URL=https://truben.no/gametraveler before deploying.`);
  }
}

// Hva som skal skje med filer som ikke lenger er i bygget. Filer med hash i assets/ blir stående én publisering
// til («retired»): faner som er åpne fra forrige versjon laster deler av appen (maplibre, kartgrensene) når de
// trengs, og fikk 404 om filene var borte. De som alt sto over én publisering, slettes nå, som alt annet.
export function planStaleFiles({ previousFiles = {}, previousRetired = {}, currentFiles }) {
  const retired = {};
  const deletePaths = [];
  for (const [relativePath, metadata] of Object.entries(previousFiles)) {
    if (relativePath in currentFiles) continue;
    if (isContentHashedAsset(relativePath)) retired[relativePath] = metadata;
    else deletePaths.push(relativePath);
  }
  for (const relativePath of Object.keys(previousRetired)) {
    if (!(relativePath in currentFiles) && !(relativePath in retired)) deletePaths.push(relativePath);
  }
  return { deletePaths: deletePaths.sort(), retired };
}

// Mapper som kan ha blitt tomme når filene er slettet (place/x/ etter place/x/index.html), dypeste først,
// uten rotmappen og uten mapper som fortsatt har filer i bygget
export function emptiedDirectories(deletedPaths, currentPaths) {
  const keep = new Set();
  for (const relativePath of currentPaths) {
    for (let dir = path.posix.dirname(relativePath); dir !== '.'; dir = path.posix.dirname(dir)) keep.add(dir);
  }
  const candidates = new Set();
  for (const relativePath of deletedPaths) {
    for (let dir = path.posix.dirname(relativePath); dir !== '.'; dir = path.posix.dirname(dir)) {
      if (!keep.has(dir)) candidates.add(dir);
    }
  }
  return [...candidates].sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b));
}
