import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/vokabel-app/").
// Locally the app runs at "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  build: {
    // React + supabase-js + Web Awesome are ~220 kB gzip together; no split needed yet.
    chunkSizeWarningLimit: 900,
  },
});
