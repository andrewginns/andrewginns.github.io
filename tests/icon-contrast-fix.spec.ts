import { test } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'icon-contrast-screenshots');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Icon Contrast Fix', () => {
  test('Moon icon should be visible in dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const toggle = page.locator('#theme-toggle-sidebar');
    const moonIcon = page.locator('#theme-toggle-sidebar .theme-toggle__icon--moon');

    // Take detailed screenshot of light mode
    await page.screenshot({
      path: join(outputDir, 'light-mode-toggle-detailed.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Switch to dark mode
    await toggle.click();
    await page.waitForTimeout(500);

    // Get moon icon color in dark mode
    const moonColor = await moonIcon.evaluate((el) => window.getComputedStyle(el).color);
    console.log(`Moon icon color in dark mode: ${moonColor}`);

    // Take detailed screenshot of dark mode
    await page.screenshot({
      path: join(outputDir, 'dark-mode-toggle-detailed.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Take a very close-up screenshot of just the handle
    const handle = page.locator('#theme-toggle-sidebar .theme-toggle__handle');
    await page.screenshot({
      path: join(outputDir, 'dark-mode-handle-closeup.png'),
      clip: (await handle.boundingBox()) || { x: 0, y: 0, width: 25, height: 25 },
    });

    console.log('✅ Icon contrast screenshots captured');
  });

  test('Compare both modes side by side', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Full toggle in light mode
    await page.screenshot({
      path: join(outputDir, 'comparison-light-mode.png'),
      clip: { x: 0, y: 0, width: 300, height: 100 },
    });

    // Switch to dark mode
    const toggle = page.locator('#theme-toggle-sidebar');
    await toggle.click();
    await page.waitForTimeout(500);

    // Full toggle in dark mode
    await page.screenshot({
      path: join(outputDir, 'comparison-dark-mode.png'),
      clip: { x: 0, y: 0, width: 300, height: 100 },
    });

    console.log('✅ Side-by-side comparison screenshots captured');
  });
});
