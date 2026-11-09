/// <reference types="vite/client" />

// Katalogen i to deler, se scripts/catalog-plugin.mjs
declare module 'virtual:catalog-core' {
  const core: unknown;
  export default core;
}
declare module 'virtual:catalog-details' {
  const details: unknown;
  export default details;
}
