import "./fonts.css";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './lib/i18n.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { registerServiceWorker } from './lib/offline.ts'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <LangProvider>
          <App />
        </LangProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
)

registerServiceWorker()
