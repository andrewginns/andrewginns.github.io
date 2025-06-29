import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function waitForChartsToLoad(page: Page): Promise<void> {
  // Wait for Plotly to be loaded
  await page.waitForFunction(() => typeof (window as any).Plotly !== 'undefined', {
    timeout: 30000,
  });

  // Wait for all three charts to be rendered
  await page.waitForFunction(
    () => {
      const charts = ['pareto-chart', 'test-group-chart', 'token-chart'];
      return charts.every((id) => {
        const element = document.getElementById(id);
        // Check if the chart container has been populated by Plotly
        return element && element.querySelector('.plot-container') !== null;
      });
    },
    { timeout: 30000 }
  );

  // Additional wait to ensure charts are fully rendered
  await page.waitForTimeout(500);
}

test.describe('Merbench Page Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/merbench', { waitUntil: 'networkidle' });
  });

  test('capture desktop screenshots at various widths', async ({ page }) => {
    const widths = [1018, 1025, 1440, 1477, 1920];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1080 });
      await waitForChartsToLoad(page);

      // Capture full page
      await page.screenshot({
        path: `./screenshots/merbench-desktop-${width}px-full.png`,
        fullPage: true,
      });

      // Capture just the leaderboard section
      const leaderboardSection = page.locator('section:has(h2:text("Leaderboard"))');
      await leaderboardSection.screenshot({
        path: `./screenshots/merbench-desktop-${width}px-leaderboard.png`,
      });

      // Capture the summary section
      const summarySection = page.locator('section:has(h2:text("Evaluation Summary"))');
      await summarySection.screenshot({
        path: `./screenshots/merbench-desktop-${width}px-summary.png`,
      });

      console.log(`Captured screenshots at ${width}px width`);
    }
  });

  test('capture mobile screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await waitForChartsToLoad(page);

    await page.screenshot({
      path: './screenshots/merbench-mobile-full.png',
      fullPage: true,
    });

    console.log('Captured mobile screenshots');
  });

  test('capture tablet screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await waitForChartsToLoad(page);

    await page.screenshot({
      path: './screenshots/merbench-tablet-full.png',
      fullPage: true,
    });

    console.log('Captured tablet screenshots');
  });

  test('verify leaderboard columns visibility', async ({ page }) => {
    const widths = [1018, 1477];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1080 });
      await waitForChartsToLoad(page);

      // Check if all columns are visible
      const tableHeaders = await page.locator('.leaderboard-table th').count();
      console.log(`At ${width}px width, found ${tableHeaders} table headers`);

      // Get detailed measurements
      const measurements = await page.evaluate(() => {
        const container = document.querySelector('.leaderboard-table') as HTMLElement;
        const table = container?.querySelector('table') as HTMLElement;
        const content = document.querySelector('.merbench-content') as HTMLElement;

        return {
          containerWidth: container?.clientWidth || 0,
          containerScrollWidth: container?.scrollWidth || 0,
          tableWidth: table?.offsetWidth || 0,
          contentWidth: content?.clientWidth || 0,
          hasScroll: container ? container.scrollWidth > container.clientWidth : false,
          columnWidths: Array.from(document.querySelectorAll('.leaderboard-table th')).map(
            (th: Element) => (th as HTMLElement).offsetWidth
          ),
        };
      });

      console.log(`At ${width}px width:`, measurements);
    }
  });
});
