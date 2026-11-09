// Adressene til de kodede landgrensene, per målestokk (countryShapes i vite.config.ts)
declare module 'virtual:country-shapes' {
  const urls: Record<'110m' | '50m', string>
  export default urls
}
