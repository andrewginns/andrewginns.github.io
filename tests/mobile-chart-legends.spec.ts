import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';

interface MobileDevice {
  name: string;
  width: number;
  height: number;
}

test.describe('Mobile Chart Legends', () => {
  const mobileDevices: MobileDevice[] = [
    { name: 'iPhone-SE', width: 375, height: 667 },
    { name: 'iPhone-12', width: 390, height: 844 },
    { name: 'Pixel-5', width: 393, height: 851 },
  ];

  for (const device of mobileDevices) {
    test(`Capture chart legends on ${device.name}`, async ({ browser }: { browser: Browser }) => {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();

      // Navigate to merbench page
      await page.goto('/merbench');

      // Wait for charts to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000); // Extra time for Plotly to render

      // Scroll to each chart and capture screenshots
      const charts = [
        { id: 'pareto-chart', name: 'pareto' },
        { id: 'test-group-chart', name: 'test-group' },
        { id: 'token-chart', name: 'token' },
        { id: 'failure-analysis-chart', name: 'failure-analysis' },
      ];

      for (const chart of charts) {
        const chartElement = page.locator(`#${chart.id}`);
        await chartElement.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500); // Let chart settle after scroll

        // Capture screenshot of the chart
        await chartElement.screenshot({
          path: `screenshots/mobile-legends-after/${device.name}-${chart.name}.png`,
        });
      }

      // Also capture full page for context
      await page.screenshot({
        path: `screenshots/mobile-legends-after/${device.name}-full-page.png`,
        fullPage: true,
      });

      await context.close();
    });
  }
});
