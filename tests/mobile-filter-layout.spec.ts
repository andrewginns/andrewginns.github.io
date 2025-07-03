import { test } from '@playwright/test';
import type { Browser } from '@playwright/test';

interface TestCase {
  name: string;
  width: number;
  height: number;
}

test.describe('Mobile Filter Layout', () => {
  const testCases: TestCase[] = [
    { name: 'Mobile-320', width: 320, height: 800 },
    { name: 'Mobile-375', width: 375, height: 800 },
    { name: 'Mobile-414', width: 414, height: 800 },
    { name: 'Mobile-768', width: 768, height: 800 },
    { name: 'Mobile-770', width: 770, height: 800 },
  ];

  for (const device of testCases) {
    test(`Merbench filters at ${device.width}px width`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
      });
      const pageInstance = await context.newPage();

      await pageInstance.goto('/merbench');
      await pageInstance.waitForLoadState('networkidle');
      await pageInstance.waitForTimeout(1000);

      // Screenshot just the filter area
      const filterElement = await pageInstance.locator('.filter-container');
      await filterElement.screenshot({
        path: `screenshots/filter-${device.name.toLowerCase()}.png`,
      });

      await context.close();
    });
  }
});
