import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startAnalytics } from './analytics'

// Forhåndsrendrede sider (scripts/prerender.mjs) har statisk innhold for søkemotorer og for den som venter på
// skriptene; App fjerner det når den selv er tegnet, så det ikke blir en tom ramme imellom

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startAnalytics()
