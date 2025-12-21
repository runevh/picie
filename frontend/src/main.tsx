import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ColorSchemeScript } from '@mantine/core'
import './index.css'
import './styles/Navbar.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorSchemeScript defaultColorScheme="auto" />
    <App />
  </StrictMode>,
)
