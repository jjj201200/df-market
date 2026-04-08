import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const hmrPort = parseInt(process.env.VITE_HMR_PORT || '13737');
const apiPort = parseInt(process.env.VITE_API_PORT || String(hmrPort + 1));
const apiTarget = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  root: '.',
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
