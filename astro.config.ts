import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';
import type { AstroIntegration } from 'astro';

// https://astro.build/config
export default defineConfig({
  site: 'https://andrew.ginns.uk',
  output: 'static',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      filter: (page: string) => !page.includes('/admin/'),
      serialize(item) {
        if (item.url.includes('/writing/')) {
          item.priority = 0.9;
        }
        return item;
      },
    }),
    robotsTxt({
      sitemap: true,
      policy: [
        {
          userAgent: '*',
          allow: ['/'],
          disallow: ['/admin/', '/api/'],
          crawlDelay: 1,
        },
      ],
    }),
  ] as AstroIntegration[],
  vite: {
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['astro'],
          },
        },
      },
    },
  },
});
