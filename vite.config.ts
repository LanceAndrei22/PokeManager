import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite 8 + Vitest configuration for PokéMart: Low Cortisol Shift.
 * Uses relative `./` base paths so bundled `./assets/...` sprites and chunks
 * resolve identically on local dev/preview servers and nested GitHub Pages URLs.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: false,
  },
});
