import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the API is proxied, so the browser only ever talks to one origin.
// `--mode pages` builds the browser-only demo served from https://<user>.github.io/haven-realty/
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/haven-realty/' : '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
}));
