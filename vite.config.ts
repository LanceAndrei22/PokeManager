import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite 8 + Vitest configuration for PokéMart: Low Cortisol Shift.
 * - Uses relative `./` base paths so bundled `./assets/...` sprites and chunks
 *   resolve identically on local dev/preview servers and nested GitHub Pages URLs.
 * - Splits React runtime and the static 493-species JSON catalog into dedicated
 *   cacheable vendor/data chunks for fast production loads with zero chunk warnings.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'pokedex-data',
              test: /[\\/]src[\\/]data[\\/]species\.json$/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: false,
  },
});
