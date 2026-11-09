// Vite-plugin: landgrensene i public/data/ (scripts/build-countries.mjs) bygges inn som
// assets/countries-<målestokk>-<hash>.json i kompakt form (src/countryShapeCodec.ts). Med hash i navnet caches de
// i et år (public/.htaccess); fra public/ ble de sjekket mot serveren ved hvert besøk. Appen får adressene fra
// `virtual:country-shapes` (src/CountryShapes.tsx). Ligger i en .mjs-fil fordi prosjektet ikke har Node-typene.
import fs from 'node:fs';
import path from 'node:path';
import { encodeCountries } from '../../src/countryShapeCodec.ts';

const SCALES = ['110m', '50m'];
const virtualId = 'virtual:country-shapes';
const resolvedId = `\0${virtualId}`;

export function countryShapes() {
  const sourceFile = scale => path.resolve('public/data', `countries-${scale}.json`);
  const encoded = scale => JSON.stringify(encodeCountries(JSON.parse(fs.readFileSync(sourceFile(scale), 'utf8'))));
  let command = 'serve';
  let base = '/';
  return {
    name: 'country-shapes',
    configResolved(config) {
      command = config.command;
      base = config.base;
    },
    resolveId: id => (id === virtualId ? resolvedId : undefined),
    load(id) {
      if (id !== resolvedId) return;
      const entries = SCALES.map(scale => {
        if (command === 'serve') {
          this.addWatchFile(sourceFile(scale));
          return `${JSON.stringify(scale)}: ${JSON.stringify(`${base}@country-shapes/${scale}.json`)}`;
        }
        const reference = this.emitFile({ type: 'asset', name: `countries-${scale}.json`, source: encoded(scale) });
        return `${JSON.stringify(scale)}: import.meta.ROLLUP_FILE_URL_${reference}`;
      });
      return `export default { ${entries.join(', ')} };`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const scale = req.url?.match(/\/@country-shapes\/(110m|50m)\.json$/)?.[1];
        if (!scale) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(encoded(scale));
      });
    },
    // public/ kopieres med i bygget; de ukodede grensene der brukes ikke av appen
    writeBundle(options) {
      const dataDir = path.join(options.dir ?? 'dist', 'data');
      for (const scale of SCALES) fs.rmSync(path.join(dataDir, `countries-${scale}.json`), { force: true });
      // Mappen fjernes bare når den er tom
      if (fs.existsSync(dataDir) && fs.readdirSync(dataDir).length === 0) fs.rmdirSync(dataDir);
    },
  };
}
