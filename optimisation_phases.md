# Detailed Phased Implementation Plan for andrew.ginns.uk Astro Website

## Project Overview

This implementation plan transforms the andrew.ginns.uk website with modern Astro best practices, targeting **95+ Lighthouse scores**, **70% bundle size reduction**, and **60% faster build times**. The plan accounts for GitHub API public rate limits and uses Cloudflare Pages for production deployment.

## Phase 1: Critical Fixes (Week 1-2)

_Immediate improvements for SEO, Security, Images, and API handling_

### 1.1 SEO Implementation

#### Package Installation

```bash
npm install astro-seo@^1.3.0 astro-seo-schema@^5.0.0 @astrojs/sitemap@^3.0.0 astro-robots-txt@^1.0.0
```

#### File Structure

```
src/
├── components/
│   ├── SEO.astro
│   └── StructuredData.astro
└── layouts/
    └── BaseLayout.astro
```

#### SEO Component Implementation

**File: `src/components/SEO.astro`**

```astro
---
import { SEO } from 'astro-seo';
import { Schema } from 'astro-seo-schema';

export interface Props {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article';
  publishDate?: Date;
  author?: string;
}

const {
  title,
  description,
  image = '/og-default.jpg',
  type = 'website',
  publishDate,
  author = 'Andrew Ginns',
} = Astro.props;

const canonicalURL = new URL(Astro.url.pathname, Astro.site);
const imageURL = new URL(image, Astro.site);
---

<SEO
  title={title}
  description={description}
  canonical={canonicalURL.href}
  openGraph={{
    basic: {
      title: title,
      type: type,
      image: imageURL.href,
      url: canonicalURL.href,
    },
    optional: {
      description: description,
      siteName: 'Andrew Ginns',
    },
    article:
      type === 'article'
        ? {
            publishedTime: publishDate?.toISOString(),
            author: [author],
          }
        : undefined,
  }}
  twitter={{
    creator: '@andrewginns',
    card: 'summary_large_image',
  }}
/>

<Schema
  item={{
    '@context': 'https://schema.org',
    '@type': type === 'article' ? 'BlogPosting' : 'WebSite',
    name: title,
    headline: title,
    description: description,
    url: canonicalURL.href,
    image: imageURL.href,
    author: {
      '@type': 'Person',
      name: author,
      url: 'https://andrew.ginns.uk',
    },
  }}
/>
```

#### Astro Config Update

**File: `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import robotsTxt from 'astro-robots-txt';

export default defineConfig({
  site: 'https://andrew.ginns.uk',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      filter: (page) => !page.includes('/admin/'),
      serialize(item) {
        if (item.url.includes('/blog/')) {
          item.changefreq = 'monthly';
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
  ],
});
```

### 1.2 Security Headers Implementation

#### Create Headers File

**File: `public/_headers`**

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.github.com;

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  X-Robots-Tag: noindex
```

#### CSP Generation with Astro Shield

```bash
npm install @kindspells/astro-shield@^1.3.0
```

**Update `astro.config.mjs`:**

```javascript
import { shield } from '@kindspells/astro-shield';
import { resolve } from 'node:path';

const rootDir = new URL('.', import.meta.url).pathname;
const modulePath = resolve(rootDir, 'src', 'generated', 'sriHashes.mjs');

export default defineConfig({
  integrations: [
    shield({
      sri: {
        hashesModule: modulePath,
      },
    }),
    // ... other integrations
  ],
});
```

### 1.3 Image Optimization

#### Optimized Image Component

**File: `src/components/OptimizedImage.astro`**

```astro
---
import { Image, Picture } from 'astro:assets';

export interface Props {
  src: string | ImageMetadata;
  alt: string;
  sizes?: string;
  loading?: 'eager' | 'lazy';
  class?: string;
  formats?: ('webp' | 'avif' | 'png' | 'jpg')[];
}

const {
  src,
  alt,
  sizes = '(max-width: 768px) 100vw, 50vw',
  loading = 'lazy',
  class: className,
  formats = ['avif', 'webp'],
} = Astro.props;

const widths = [400, 800, 1200];
---

<Picture
  src={src}
  alt={alt}
  widths={widths}
  sizes={sizes}
  formats={formats}
  loading={loading}
  class={className}
/>
```

### 1.4 GitHub API Rate Limiting

#### Cache-First API Handler

**File: `src/utils/github-cache.ts`**

```typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

let lastRequestTime = 0;

async function fetchWithRateLimit(url: string, options: RequestInit = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

export async function getCachedGitHubData(endpoint: string) {
  const cacheKey = `github-${endpoint}`;
  const cached = cache.get(cacheKey);

  // Check cache first
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const headers: HeadersInit = {
      'User-Agent': 'andrew.ginns.uk',
      Accept: 'application/vnd.github.v3+json',
    };

    // Use ETag for conditional requests
    if (cached?.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await fetchWithRateLimit(`https://api.github.com${endpoint}`, { headers });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    // Handle not modified
    if (response.status === 304 && cached) {
      cached.timestamp = Date.now();
      return cached.data;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const etag = response.headers.get('ETag');

    // Update cache
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      etag: etag || undefined,
    });

    return data;
  } catch (error) {
    // Return cached data if available during errors
    if (cached) {
      return cached.data;
    }
    throw error;
  }
}
```

### Phase 1 Git Commit Structure

```bash
git commit -m "feat(seo): implement comprehensive SEO components and sitemap

- Add SEO.astro component with OpenGraph and Twitter cards
- Configure automatic sitemap generation
- Add robots.txt with proper crawl directives
- Implement structured data with Schema.org markup"

git commit -m "feat(security): add security headers and CSP configuration

- Configure security headers in _headers file
- Implement Content Security Policy with SRI hashes
- Add HSTS and other security headers for A+ rating
- Set up proper cache headers for static assets"

git commit -m "feat(images): implement optimized image component

- Add Picture component with AVIF/WebP support
- Configure responsive image widths
- Implement lazy loading by default
- Add proper sizes attribute for performance"

git commit -m "feat(api): implement GitHub API caching and rate limiting

- Add cache-first strategy with 5-minute TTL
- Implement rate limiting with 1-second delays
- Add ETag support for conditional requests
- Handle errors gracefully with stale cache fallback"
```

### Phase 1 Validation Steps

1. **SEO Testing**: Run Lighthouse SEO audit, verify score > 95
2. **Security Headers**: Test at securityheaders.com, verify A+ rating
3. **Image Performance**: Check Core Web Vitals, verify CLS < 0.1
4. **API Rate Limiting**: Monitor X-RateLimit headers, verify no 429 errors

## Phase 2: Performance Wins (Week 3-4)

_Code splitting, build optimization, mobile improvements, TypeScript integration_

### 2.1 Advanced Code Splitting

#### Vite Configuration for Manual Chunks

**File: `astro.config.mjs`**

```javascript
export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-components': ['./src/components/ui/index.ts'],
            utils: ['./src/utils/index.ts'],
          },
        },
      },
    },
  },
});
```

#### Islands Architecture Implementation

**File: `src/pages/index.astro`**

```astro
---
import Layout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import ProjectList from '../components/ProjectList.tsx';
import ContactForm from '../components/ContactForm.tsx';
---

<Layout title="Andrew Ginns">
  <!-- Static hero section -->
  <Hero />

  <!-- Interactive project list, loads when visible -->
  <ProjectList client:visible />

  <!-- Contact form, loads on idle -->
  <ContactForm client:idle />
</Layout>
```

### 2.2 Build Optimization

#### Performance-Focused Build Config

**File: `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    inlineStylesheets: 'auto',
    assets: '_astro',
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    build: {
      cssCodeSplit: true,
      minify: 'esbuild',
      target: 'es2020',
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
  },
});
```

### 2.3 Mobile Optimization

#### Responsive Component System

**File: `src/styles/global.css`**

```css
/* Mobile-first approach with fluid typography */
:root {
  --font-size-base: clamp(1rem, 2vw, 1.125rem);
  --font-size-lg: clamp(1.25rem, 3vw, 1.5rem);
  --font-size-xl: clamp(1.875rem, 4vw, 2.5rem);

  --spacing-base: clamp(1rem, 3vw, 1.5rem);
  --spacing-lg: clamp(2rem, 5vw, 3rem);

  --container-width: min(90vw, 1200px);
}

/* Touch-friendly interactive elements */
button,
a,
input,
textarea {
  min-height: 44px;
  min-width: 44px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2.4 TypeScript Integration

#### TypeScript Configuration

**File: `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

#### Type-Safe Content Collections

**File: `src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    publishDate: z.date(),
    author: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

const projectCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
    technologies: z.array(z.string()),
    featured: z.boolean().default(false),
  }),
});

export const collections = {
  blog: blogCollection,
  projects: projectCollection,
};
```

### Phase 2 Git Commits

```bash
git commit -m "perf(build): implement advanced code splitting and optimization

- Configure manual chunks for vendor libraries
- Enable CSS code splitting and minification
- Set up Islands architecture for interactive components
- Optimize build output with esbuild target es2020"

git commit -m "feat(mobile): implement mobile-first responsive design

- Add fluid typography with clamp() values
- Ensure 44px minimum touch targets
- Implement reduced motion preferences
- Add viewport optimization for notched devices"

git commit -m "feat(typescript): add strict TypeScript configuration

- Configure strict mode with null checks
- Add path aliases for clean imports
- Implement type-safe content collections
- Add comprehensive type definitions"
```

### Phase 2 Validation

1. **Bundle Analysis**: Run `npm run build -- --verbose`, verify < 150KB total
2. **Mobile Testing**: Test with Lighthouse mobile preset, score > 95
3. **Type Safety**: Run `npm run check`, ensure zero errors
4. **Performance Metrics**: Measure TTI < 3s, FCP < 1.5s

## Phase 3: Enhanced Features (Week 5-6)

_Accessibility, architecture patterns, monitoring, content management_

### 3.1 Accessibility Implementation

#### WCAG 2.1 AA Compliant Components

**File: `src/components/ui/Button.astro`**

```astro
---
export interface Props {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  type?: 'button' | 'submit' | 'reset';
}

const {
  variant = 'primary',
  size = 'medium',
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  type = 'button',
  ...rest
} = Astro.props;

const classes = ['btn', `btn--${variant}`, `btn--${size}`, disabled && 'btn--disabled']
  .filter(Boolean)
  .join(' ');
---

<button
  type={type}
  class={classes}
  disabled={disabled}
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedBy}
  {...rest}
>
  <slot />
</button>

<style>
  .btn {
    /* WCAG 2.1 AA Requirements */
    min-height: 44px;
    min-width: 44px;
    padding: 0.75rem 1.5rem;
    border: 2px solid transparent;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    /* Focus indicator - WCAG 2.1 AA Focus Visible */
    &:focus-visible {
      outline: 3px solid var(--focus-color);
      outline-offset: 2px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .btn {
      border: 2px solid currentColor;
    }
  }
</style>
```

#### Accessibility Testing Setup

```bash
npm install --save-dev @axe-core/playwright
```

**File: `tests/accessibility.test.js`**

```javascript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('http://localhost:4321');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

### 3.2 Architecture Patterns

#### State Management with Nanostores

```bash
npm install nanostores @nanostores/persistent
```

**File: `src/stores/theme.ts`**

```typescript
import { persistentAtom } from '@nanostores/persistent';
import { onMount } from 'nanostores';

export const THEMES = {
  light: 'light',
  dark: 'dark',
  system: 'system',
} as const;

export type Theme = keyof typeof THEMES;

export const themeStore = persistentAtom<Theme>('theme', 'system');

// Theme initialization
function initTheme() {
  const theme = themeStore.get();
  const root = document.documentElement;

  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    root.dataset.theme = mediaQuery.matches ? 'dark' : 'light';

    mediaQuery.addEventListener('change', (e) => {
      if (themeStore.get() === 'system') {
        root.dataset.theme = e.matches ? 'dark' : 'light';
      }
    });
  } else {
    root.dataset.theme = theme;
  }
}

if (typeof window !== 'undefined') {
  onMount(themeStore, initTheme);
}
```

### 3.3 Monitoring Integration

#### Sentry Setup

```bash
npm install @sentry/astro
```

**File: `src/utils/sentry-client.ts`**

```typescript
import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

#### Core Web Vitals Monitoring

**File: `src/utils/web-vitals.ts`**

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

interface VitalsMetric {
  name: string;
  value: number;
  id: string;
  delta: number;
}

function sendToAnalytics(metric: VitalsMetric) {
  // Send to Cloudflare Analytics or custom endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      '/api/analytics',
      JSON.stringify({
        ...metric,
        url: window.location.href,
        timestamp: Date.now(),
      })
    );
  }
}

export function initWebVitals() {
  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);
}
```

### Phase 3 Git Commits

```bash
git commit -m "feat(a11y): implement WCAG 2.1 AA compliant components

- Add accessible button component with proper ARIA
- Ensure 44px minimum touch targets
- Implement focus indicators and high contrast support
- Add automated accessibility testing with Playwright"

git commit -m "feat(state): add Nanostores for state management

- Implement persistent theme store
- Add system preference detection
- Create reactive state management patterns
- Configure localStorage persistence"

git commit -m "feat(monitoring): integrate Sentry and Core Web Vitals

- Configure Sentry error tracking
- Add Core Web Vitals monitoring
- Implement custom analytics endpoint
- Set up performance budget tracking"
```

## Phase 4: Advanced Optimizations (Week 7-8)

_Migration strategies, Cloudflare Workers, advanced caching, testing_

### 4.1 Cloudflare Workers Integration

#### Worker Configuration

**File: `wrangler.toml`**

```toml
name = "andrew-ginns-edge"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "andrew-ginns-edge"
route = { pattern = "andrew.ginns.uk/*", zone_name = "andrew.ginns.uk" }

[[kv_namespaces]]
binding = "EDGE_CACHE"
id = "your-kv-namespace-id"

[vars]
ENVIRONMENT = "production"
```

#### Edge Function Implementation

**File: `functions/_middleware.ts`**

```typescript
export async function onRequest(context: any) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Geographic routing
  const country = request.cf?.country || 'US';

  // Edge caching with KV
  const cacheKey = `page:${url.pathname}:${country}`;
  const cached = await env.EDGE_CACHE.get(cacheKey);

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300',
        'X-Edge-Cache': 'HIT',
      },
    });
  }

  const response = await next();

  // Cache successful responses
  if (response.status === 200) {
    const content = await response.text();
    await env.EDGE_CACHE.put(cacheKey, content, { expirationTtl: 300 });

    return new Response(content, {
      ...response,
      headers: {
        ...Object.fromEntries(response.headers),
        'X-Edge-Cache': 'MISS',
      },
    });
  }

  return response;
}
```

### 4.2 Advanced Caching Strategy

#### Service Worker Implementation

**File: `src/sw.ts`**

```typescript
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache Astro-built assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache strategies
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          return response.status === 200 ? response : null;
        },
      },
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
  })
);
```

### 4.3 Testing Framework

#### Vitest Configuration

**File: `vitest.config.ts`**

```typescript
/// <reference types="vitest" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

#### E2E Testing with Playwright

**File: `playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.4 CI/CD Pipeline

#### GitHub Actions Workflow

**File: `.github/workflows/deploy.yml`**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: |
          npm run check
          npm run test
          npm run test:e2e

  lighthouse:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Build project
        run: npm run build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun

  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [test, lighthouse]
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Build project
        run: npm run build
        env:
          NODE_ENV: production

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=andrew-ginns-uk
```

### Phase 4 Git Commits

```bash
git commit -m "feat(edge): implement Cloudflare Workers for edge caching

- Add Wrangler configuration for edge deployment
- Implement KV-based edge caching
- Add geographic routing capabilities
- Configure edge function middleware"

git commit -m "feat(sw): add Service Worker with advanced caching

- Implement Workbox strategies for different content types
- Add offline support with cache-first images
- Configure network-first API caching
- Enable background sync for analytics"

git commit -m "test: add comprehensive testing framework

- Configure Vitest for unit testing
- Add Playwright for E2E testing
- Implement visual regression tests
- Add performance benchmarking"

git commit -m "ci: implement complete CI/CD pipeline

- Add GitHub Actions workflow
- Configure Lighthouse CI checks
- Implement staged deployments
- Add automated performance budgets"
```

## Final Validation Checklist

### Performance Metrics

- [ ] Lighthouse Performance Score: 95+
- [ ] Bundle Size: < 150KB gzipped
- [ ] Build Time: < 30 seconds
- [ ] Core Web Vitals: All "Good"
  - [ ] LCP < 2.5s
  - [ ] FID < 100ms
  - [ ] CLS < 0.1

### Security & SEO

- [ ] Security Headers: A+ rating
- [ ] SEO Score: 95+
- [ ] Structured Data: Valid
- [ ] Mobile-Friendly: Pass

### Development Experience

- [ ] TypeScript: 100% coverage
- [ ] Tests: All passing
- [ ] Accessibility: WCAG 2.1 AA
- [ ] Documentation: Complete

## Production Deployment Steps

1. **Final Build**

   ```bash
   npm run build
   npm run preview # Local verification
   ```

2. **Deploy to Cloudflare Pages**

   ```bash
   npm run deploy
   ```

3. **Verify Deployment**

   - Check all security headers
   - Run Lighthouse audit
   - Test critical user paths
   - Monitor error rates

4. **Post-Deployment**
   - Set up alerts for performance degradation
   - Monitor Core Web Vitals
   - Track API rate limits
   - Review error logs in Sentry

This implementation plan provides a complete transformation of the andrew.ginns.uk website with modern Astro best practices, optimized for performance, security, and user experience while maintaining excellent developer ergonomics.
