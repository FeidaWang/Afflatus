import { defineConfig } from 'vite';
import baseConfig from './vite.config.js';

// The Melbourne candidate is deliberately available only while Vite's DEV
// constant is true. Keep that production boundary intact while disabling the
// dev client's websocket reload path for long-running, page-lifetime soaks.
export default defineConfig({
  ...baseConfig,
  server: {
    ...baseConfig.server,
    hmr: false,
  },
});
