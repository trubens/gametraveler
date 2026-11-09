import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionBuild, emptiedDirectories, planStaleFiles } from './lib/deploy-plan.mjs';
import { urlsForHtmlFiles } from './indexnow.mjs';

const meta = { sha256: 'a'.repeat(64), size: 1 };

test('hashed assets outlive one deployment; pages and older assets are deleted', () => {
  const previousFiles = {
    'assets/index-AAAAAAAA.js': meta,
    'assets/index-BBBBBBBB.js': meta,
    'place/prussia/index.html': meta,
    'app.js': meta,
  };
  const previousRetired = { 'assets/old-CCCCCCCC.js': meta, 'assets/back-DDDDDDDD.js': meta };
  const currentFiles = { 'assets/index-BBBBBBBB.js': meta, 'assets/back-DDDDDDDD.js': meta, 'app.js': meta };
  const { deletePaths, retired } = planStaleFiles({ previousFiles, previousRetired, currentFiles });
  // index-AAAA was live last time: kept for open tabs. old-CCCC was already kept once: deleted now.
  // back-DDDD is in the build again, so it is neither deleted nor retired.
  assert.deepEqual(retired, { 'assets/index-AAAAAAAA.js': meta });
  assert.deepEqual(deletePaths, ['assets/old-CCCCCCCC.js', 'place/prussia/index.html']);
});

test('a first deployment with a version 1 manifest has nothing retired yet', () => {
  const { deletePaths, retired } = planStaleFiles({ previousFiles: { 'assets/x-AAAAAAAA.css': meta }, currentFiles: {} });
  assert.deepEqual(deletePaths, []);
  assert.deepEqual(Object.keys(retired), ['assets/x-AAAAAAAA.css']);
});

test('folders emptied by deleted pages are removed deepest first, never ones still in the build', () => {
  const dirs = emptiedDirectories(
    ['place/prussia/index.html', 'series/old/deep/x.html', 'game/kept/old.html', 'index-old.html'],
    ['game/kept/index.html', 'place/paris/index.html'],
  );
  // series/ has nothing left in the build either; place/ and game/ do
  assert.deepEqual(dirs, ['series/old/deep', 'place/prussia', 'series/old', 'series']);
});

test('only a production build may be uploaded', () => {
  assert.doesNotThrow(() => assertProductionBuild('<link rel="canonical" href="https://truben.no/gametraveler/" />'));
  assert.throws(() => assertProductionBuild('<link rel="canonical" href="https://example.org/gameexplorer/" />'), /example\.org/);
  assert.throws(() => assertProductionBuild('<title>no canonical</title>'), /\(none\)/);
  // /gametraveller/ (two l) is the old address that redirects
  assert.throws(() => assertProductionBuild('<link rel="canonical" href="https://truben.no/gametravellerx/" />'));
});

test('IndexNow gets the trailing-slash URLs that are in the sitemap', () => {
  const sitemap = ['https://truben.no/gametraveler/game/a/', 'https://truben.no/gametraveler/', 'https://truben.no/gametraveler/places/'];
  assert.deepEqual(
    urlsForHtmlFiles(['index.html', 'game/a/index.html', 'places/index.html', 'my-atlas/index.html', '404.html', 'assets/x.js'], sitemap),
    ['https://truben.no/gametraveler/', 'https://truben.no/gametraveler/game/a/', 'https://truben.no/gametraveler/places/'],
  );
});
