import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// public/ (including _headers) is copied into dist/ as is. Cloudflare Workers serves dist/ as static assets.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true
  }
});
