import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:5174', changeOrigin: true },
      '/__dayframe__': { target: 'http://127.0.0.1:5174', changeOrigin: true },
    },
  },
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', setupFiles: ['./src/test/setup.ts'], fileParallelism: false },
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'], database: ['dexie'] } },
    },
  },
});
