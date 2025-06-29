import { test, expect } from '@playwright/test';

test('test leaderboard styling when filters change', async ({ page }) => {
  await page.goto('http://localhost:4321/merbench');
  await page.waitForLoadState('networkidle');

  // Wait for initial load
  await page.waitForTimeout(1000);

  // Capture initial styles
  const initialStyles = await page.evaluate(() => {
    const table = document.querySelector('.leaderboard-table table');
    const firstRow = document.querySelector('.leaderboard-table tbody tr');
    const progressBar = document.querySelector('.progress-bar');

    return {
      tableDisplay: table ? getComputedStyle(table).display : null,
      tableBorderCollapse: table ? getComputedStyle(table).borderCollapse : null,
      rowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
      progressBarStyles: progressBar
        ? {
            position: getComputedStyle(progressBar).position,
            backgroundColor: getComputedStyle(progressBar).backgroundColor,
            height: getComputedStyle(progressBar).height,
          }
        : null,
    };
  });

  console.log('Initial styles:', initialStyles);

  // Uncheck "Easy" difficulty
  const easyCheckbox = page.locator('input[data-difficulty="easy"]');
  await easyCheckbox.uncheck();

  // Wait for update
  await page.waitForTimeout(500);

  // Capture styles after filter change
  const afterFilterStyles = await page.evaluate(() => {
    const table = document.querySelector('.leaderboard-table table');
    const firstRow = document.querySelector('.leaderboard-table tbody tr');
    const progressBar = document.querySelector('.progress-bar');

    return {
      tableDisplay: table ? getComputedStyle(table).display : null,
      tableBorderCollapse: table ? getComputedStyle(table).borderCollapse : null,
      rowDisplay: firstRow ? getComputedStyle(firstRow).display : null,
      progressBarStyles: progressBar
        ? {
            position: getComputedStyle(progressBar).position,
            backgroundColor: getComputedStyle(progressBar).backgroundColor,
            height: getComputedStyle(progressBar).height,
          }
        : null,
    };
  });

  console.log('Styles after filter change:', afterFilterStyles);

  // Check if table still exists and has correct styles
  const tableExists = await page.locator('.leaderboard-table table').isVisible();
  expect(tableExists).toBe(true);

  // Check specific CSS properties
  const tableHasBorderCollapse = await page.evaluate(() => {
    const table = document.querySelector('.leaderboard-table table');
    return table ? getComputedStyle(table).borderCollapse === 'collapse' : false;
  });
  expect(tableHasBorderCollapse).toBe(true);

  // Take screenshots
  await page.screenshot({ path: './screenshots/filter-before.png', fullPage: false });

  // Re-check the checkbox
  await easyCheckbox.check();
  await page.waitForTimeout(500);

  await page.screenshot({ path: './screenshots/filter-after.png', fullPage: false });
});
