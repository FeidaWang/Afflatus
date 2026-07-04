import { defineConfig } from 'vite';
import { resolve } from 'path';

// MPA multi-entry: index.html (home Three.js app) + the five sub-pages,
// which used to live untouched in public/ (no bundling/hashing/minification).
// Moving their *.html files to project root turns them into real Vite entries;
// their co-located classic <script src="/x.js"> files stay in public/ as
// static passthrough (unbundled) for now — see ROADMAP §6 for the follow-up
// (converting those to ES modules for full bundling).
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        arena: resolve(__dirname, 'arena.html'),
        sectors: resolve(__dirname, 'sectors.html'),
        signal: resolve(__dirname, 'signal.html'),
        games: resolve(__dirname, 'games.html'),
        league: resolve(__dirname, 'league.html'),
        serial: resolve(__dirname, 'serial.html')
      }
    }
  }
});
