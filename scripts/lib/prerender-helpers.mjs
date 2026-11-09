// Rene hjelpere for scripts/prerender.mjs, så de kan testes uten å bygge (scripts/site-build.test.mjs)

// Siste «reviewed»-dato blant spillene (YYYY-MM-DD sorterer som tekst), eller undefined når ingen har en
export const latestReviewed = games => games
  .map(game => game.reviewed)
  .filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
  .sort()
  .at(-1);

// Gamle stedsadresser (src/data/redirects.json) blir én 301 rett til den nye siden, med skråstrek til slutt.
// RedirectMatch med ^…/?$ treffer både /place/gammel og /place/gammel/, og bare den; Redirect matcher prefikser
// og ga /place/ny// for adressen med skråstrek. Omdirigeringer som ville pekt på en side som ikke finnes, til
// seg selv, eller som ville skygget for en side som finnes, hoppes over og meldes som advarsler.
export function placeRedirects({ redirects, placeById, placeSlug, pageSlugs, basePath }) {
  const lines = [];
  const warnings = [];
  for (const [oldSlug, placeId] of Object.entries(redirects)) {
    const place = placeById.get(placeId);
    if (!place) throw new Error(`redirects.json: unknown place id ${placeId}`);
    const target = placeSlug(place);
    if (oldSlug === target || pageSlugs.has(oldSlug)) {
      if (oldSlug !== target) warnings.push(`redirects.json: ${oldSlug} is a live place page; redirect to ${target} skipped`);
      continue;
    }
    if (!pageSlugs.has(target)) {
      warnings.push(`redirects.json: ${oldSlug} -> ${target} skipped, no game is set in ${placeId} so it has no page`);
      continue;
    }
    lines.push(`RedirectMatch 301 ^${escapeRegex(`${basePath}/place/${oldSlug}`)}/?$ ${basePath}/place/${target}/`);
  }
  return { lines, warnings };
}

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
