import { defineConfig } from 'astro/config';

export default defineConfig({
  // Dev toolbar would cover the bottom tab bar on phones.
  devToolbar: { enabled: false },
  // podatki.html, not podatki/index.html: Cloudflare serves it at /podatki, the address the nav links use.
  build: { format: 'file' },
});
