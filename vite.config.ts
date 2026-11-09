import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { catalog } from './scripts/catalog-plugin.mjs'
import { countryShapes } from './scripts/lib/vite-country-shapes.mjs'

// https://vite.dev/config/
export default defineConfig({
  base: '/gametraveler/',
  // catalog: spill- og stedspostene som virtual:catalog-core og virtual:catalog-details (scripts/catalog-plugin.mjs);
  // countryShapes: landgrensene som assets med hash (scripts/lib/vite-country-shapes.mjs)
  plugins: [react(), tailwindcss(), catalog(), countryShapes()],
  // Katalogen (spill- og stedspostene) som JSON.parse av en streng, ikke objektlitteraler: V8 parser
  // det flere ganger raskere, og det er over en megabyte av den
  json: { stringify: true },
  build: {
    rollupOptions: {
      output: {
        // Kjernen av katalogen i sin egen fil, så den bare lastes på nytt når dataene endres, ikke ved hver
        // kodeendring; scripts/prerender.mjs peker på den fra app.js. Detaljene blir en egen fil som lastes ved behov.
        manualChunks: id => (id.includes('virtual:catalog-core') ? 'catalog' : undefined),
      },
    },
  },
})
