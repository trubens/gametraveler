import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Forhåndsrendrede sider (scripts/prerender.mjs) har statisk innhold for søkemotorer; appen tar over
document.getElementById('static-content')?.remove()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
