import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  redirects: { '/kalibracija': '/meritve' },

  // Dev toolbar would cover the bottom tab bar on phones.
  devToolbar: { enabled: false },

  // podatki.html, not podatki/index.html: Cloudflare serves it at /podatki, the address the nav links use.
  build: { format: 'file' },

  vite: {
    plugins: [tailwindcss()],
  },
});