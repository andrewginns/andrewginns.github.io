import { test } from '@playwright/test';
import type { Browser } from '@playwright/test';

interface TestCase {
  name: string;
  width: number;
  height: number;
}

interface Page {
  name: string;
  url: string;
}

test.describe('Mobile Layout Validation', () => {
  const testCases: TestCase[] = [
    { name: 'Mobile Small', width: 320, height: 568 },
    { name: 'Mobile Large', width: 414, height: 896 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
  ];

  const pages: Page[] = [
    { name: 'home', url: '/' },
    { name: 'experience', url: '/experience' },
    { name: 'projects', url: '/projects_github' },
  ];

  for (const device of testCases) {
    for (const page of pages) {
      test(`${device.name}: ${page.name} page`, async ({ browser }: { browser: Browser }) => {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height }
        });
        const pageInstance = await context.newPage();
        
        await pageInstance.goto(page.url);
        await pageInstance.waitForLoadState('networkidle');
        await pageInstance.waitForTimeout(1000);
        
        await pageInstance.screenshot({
          path: `screenshots/mobile-${device.name.toLowerCase().replace(' ', '-')}-${page.name}.png`,
          fullPage: true
        });
        
        await context.close();
      });
    }
  }
});
