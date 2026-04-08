import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const hmrPort = parseInt(process.env.VITE_HMR_PORT || '13737');
const apiPort = parseInt(process.env.VITE_API_PORT || String(hmrPort + 1));
const apiTarget = `http://localhost:${apiPort}`;

// Read version from plugin.json
const pluginJsonPath = path.resolve(__dirname, '..', '.claude-plugin', 'plugin.json');
const pluginVersion = fs.existsSync(pluginJsonPath)
  ? JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8')).version
  : 'unknown';

export default defineConfig({
  plugins: [react()],
  root: '.',
  define: {
    __PLUGIN_VERSION__: JSON.stringify(pluginVersion),
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist'),
    emptyOutDir: true,
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly' as const,
    },
  },
  server: {
    host: '127.0.0.1',
    port: hmrPort,
    proxy: {
      '/api': apiTarget,
      '/events': {
        target: apiTarget,
      },
      '/notify': apiTarget,
    },
  },
});
