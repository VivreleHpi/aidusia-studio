import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Isolation cross-origin, identique a vercel.json : elle debloque
// SharedArrayBuffer, donc le calcul multi-thread de Luciole sur processeur
// (sans elle, wllama tourne sur un seul thread). Servie aussi en dev/preview
// pour que les tests E2E s'executent dans les memes conditions qu'en prod.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
