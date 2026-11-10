import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://andrew.ginns.uk',
  output: 'static',
  integrations: [sitemap()],
});
