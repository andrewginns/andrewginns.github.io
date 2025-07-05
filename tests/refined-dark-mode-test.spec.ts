import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'refined-dark-mode-screenshots');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((selectedTheme) => {
    document.documentElement.setAttribute('data-theme', selectedTheme);
    localStorage.setItem('theme', selectedTheme);
  }, theme);
  await page.waitForTimeout(300);
}

test.describe('Refined Dark Mode Validation', () => {
  const criticalPages = [
    {
      name: 'projects',
      url: '/projects_github',
      description: 'Projects page with refined color elements',
    },
    {
      name: 'merbench',
      url: '/merbench',
      waitFor: '.leaderboard-section',
      description: 'Merbench with enhanced chart colors',
    },
    { name: 'home', url: '/', description: 'Homepage with improved floating elements' },
  ];

  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `,
    });
  });

  for (const pageInfo of criticalPages) {
    test(`${pageInfo.name} - refined dark mode comparison`, async ({ page }) => {
      console.log(`📸 Testing refined colors for ${pageInfo.name}`);

      // Navigate to page
      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      // Wait for specific element if specified
      if (pageInfo.waitFor) {
        try {
          await page.waitForSelector(pageInfo.waitFor, { timeout: 5000 });
        } catch (e) {
          console.log(`   ⚠️  Selector ${pageInfo.waitFor} not found, continuing...`);
        }
      }

      // Additional wait
      await page.waitForTimeout(2000);

      // Capture light mode
      await setTheme(page, 'light');
      await page.screenshot({
        path: join(outputDir, `${pageInfo.name}-refined-light.png`),
        fullPage: true,
      });

      // Capture refined dark mode
      await setTheme(page, 'dark');
      await page.screenshot({
        path: join(outputDir, `${pageInfo.name}-refined-dark.png`),
        fullPage: true,
      });

      console.log(`   ✅ Captured refined theme comparison for ${pageInfo.name}`);
    });
  }

  test('Mobile comparison for critical pages', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `,
    });

    for (const pageInfo of criticalPages) {
      console.log(`📱 Testing mobile refined colors for ${pageInfo.name}`);

      await page.goto(pageInfo.url);
      await page.waitForLoadState('networkidle');

      if (pageInfo.waitFor) {
        try {
          await page.waitForSelector(pageInfo.waitFor, { timeout: 5000 });
        } catch (e) {
          console.log(`   ⚠️  Mobile selector ${pageInfo.waitFor} not found, continuing...`);
        }
      }

      await page.waitForTimeout(2000);

      // Light mode mobile
      await setTheme(page, 'light');
      await page.screenshot({
        path: join(outputDir, `${pageInfo.name}-mobile-refined-light.png`),
        fullPage: true,
      });

      // Dark mode mobile
      await setTheme(page, 'dark');
      await page.screenshot({
        path: join(outputDir, `${pageInfo.name}-mobile-refined-dark.png`),
        fullPage: true,
      });

      console.log(`   ✅ Mobile refined comparison for ${pageInfo.name}`);
    }

    await context.close();
  });
});
