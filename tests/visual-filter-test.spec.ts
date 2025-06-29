import { test } from '@playwright/test';

test('visual test of filter styling', async ({ page }) => {
  await page.goto('http://localhost:4321/merbench');
  await page.waitForLoadState('networkidle');

  // Wait for charts to load
  await page.waitForFunction(() => typeof (window as any).Plotly !== 'undefined', {
    timeout: 30000,
  });

  await page.waitForFunction(
    () => {
      const charts = ['pareto-chart', 'test-group-chart', 'token-chart'];
      return charts.every((id) => {
        const element = document.getElementById(id);
        return element && element.querySelector('.plot-container') !== null;
      });
    },
    { timeout: 30000 }
  );

  // Additional wait
  await page.waitForTimeout(1000);

  // Screenshot 1: All filters enabled
  const leaderboard = page.locator('.leaderboard-section');
  await leaderboard.screenshot({
    path: './screenshots/filter-test-all-enabled.png',
  });

  // Uncheck Easy
  await page.locator('input[data-difficulty="easy"]').uncheck();
  await page.waitForTimeout(500);

  // Screenshot 2: Easy unchecked
  await leaderboard.screenshot({
    path: './screenshots/filter-test-easy-unchecked.png',
  });

  // Uncheck Medium
  await page.locator('input[data-difficulty="medium"]').uncheck();
  await page.waitForTimeout(500);

  // Screenshot 3: Only Hard checked
  await leaderboard.screenshot({
    path: './screenshots/filter-test-only-hard.png',
  });

  // Re-check all
  await page.locator('input[data-difficulty="easy"]').check();
  await page.locator('input[data-difficulty="medium"]').check();
  await page.waitForTimeout(500);

  // Screenshot 4: All re-enabled
  await leaderboard.screenshot({
    path: './screenshots/filter-test-all-reenabled.png',
  });

  console.log('✓ Visual filter test completed - check screenshots directory');
});
