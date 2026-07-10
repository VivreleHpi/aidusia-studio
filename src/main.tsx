import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { ThemeProvider } from './lib/theme.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <App />
      </LangProvider>
    </ThemeProvider>
  </StrictMode>,
)
