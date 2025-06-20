import { test } from '@playwright/test';
import type { Page, Browser } from '@playwright/test';

interface PageInfo {
  name: string;
  url: string;
}

test.describe('Website Screenshots', () => {
  const pages: PageInfo[] = [
    { name: 'home', url: '/' },
    { name: 'experience', url: '/experience' },
    { name: 'projects', url: '/projects_github' },
    { name: 'writing', url: '/writing' },
    { name: 'about', url: '/about_me' },
    { name: 'contact', url: '/contact_me' }
  ];

  for (const page of pages) {
    test(`Screenshot: ${page.name} page`, async ({ page: playwright }: { page: Page }) => {
      await playwright.goto(page.url);
      
      // Wait for the page to be fully loaded
      await playwright.waitForLoadState('networkidle');
      
      // Wait a bit more for any animations to complete
      await playwright.waitForTimeout(1000);
      
      // Take screenshot
      await playwright.screenshot({
        path: `screenshots/current-${page.name}-page.png`,
        fullPage: true
      });
    });
  }

  test('Screenshot: Mobile home page', async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'screenshots/current-mobile-home.png',
      fullPage: true
    });
    
    await context.close();
  });
});
