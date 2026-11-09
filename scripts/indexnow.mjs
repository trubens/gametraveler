import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// IndexNow sier fra til Bing, Yandex, Seznam m.fl. at sider er nye eller endret.
// Nøkkelfilen ligger i public/ og publiseres sammen med resten av siden, så
// keyLocation i /gametraveler/ gir oss lov til å melde inn URL-er under den mappen.
// Ny nøkkel 30. oktober 2026: Bing hadde knyttet den gamle til /gametraveller/ og avviste alt under /gametraveler/
const key = 'e1985e26653672b1ea13c0f1f2e1c85e';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemapPath = path.join(projectRoot, 'dist', 'sitemap.xml');
const maxUrlsPerRequest = 10000;

export async function readSitemapUrls() {
  const text = await fs.readFile(sitemapPath, 'utf8').catch(() => null);
  if (text === null) throw new Error('dist/sitemap.xml is missing. Run npm run build with VITE_SITE_URL set.');
  return [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replaceAll('&amp;', '&'));
}

// dist/index.html -> https://truben.no/gametraveler/, dist/game/x/index.html -> .../game/x/ (med skråstrek, som
// sitemap.xml; uten den svarer Apache med en omdirigering). Sider som ikke står i sitemap (my-atlas/) meldes ikke inn.
export function urlsForHtmlFiles(relativePaths, sitemapUrls) {
  // Forsiden er den korteste adressen i sitemap; alle sidene ligger under den
  const siteRoot = sitemapUrls.filter(url => url.endsWith('/')).sort((a, b) => a.length - b.length)[0];
  if (!siteRoot) return [];
  const known = new Set(sitemapUrls);
  const urls = relativePaths
    .filter(relativePath => relativePath === 'index.html' || relativePath.endsWith('/index.html'))
    .map(relativePath => `${siteRoot}${relativePath.slice(0, -'index.html'.length)}`);
  return [...new Set(urls)].filter(url => known.has(url));
}

export async function submitUrls(urls) {
  if (!urls.length) {
    console.log('IndexNow: no pages to submit.');
    return;
  }
  const siteRoot = new URL(urls[0]);
  // Nøkkelen ligger på domenets rot (lagt opp for hånd 30. oktober 2026), så den dekker hele truben.no
  const keyLocation = `${siteRoot.origin}/${key}.txt`;
  for (let start = 0; start < urls.length; start += maxUrlsPerRequest) {
    const urlList = urls.slice(start, start + maxUrlsPerRequest);
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: siteRoot.host, key, keyLocation, urlList }),
    });
    // 200 og 202 betyr mottatt; 422 betyr som regel at URL-ene ikke hører til nøkkelen
    if (response.status !== 200 && response.status !== 202) {
      throw new Error(`IndexNow answered ${response.status}: ${(await response.text()).trim()}`);
    }
  }
  console.log(`IndexNow: submitted ${urls.length} pages.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  readSitemapUrls().then(submitUrls).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
