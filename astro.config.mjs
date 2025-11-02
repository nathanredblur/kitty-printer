// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  vite: {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          'react': 'preact/compat',
          'react-dom': 'preact/compat',
        },
      },
    },

  integrations: [preact()],
});