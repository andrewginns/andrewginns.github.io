import { test } from '@playwright/test';

test('capture merbench page without floating elements', async ({ page }) => {
  await page.goto('http://localhost:4321/merbench');
  await page.waitForLoadState('networkidle');

  // Wait a bit for any animations
  await page.waitForTimeout(1000);

  // Capture screenshot at desktop width
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({
    path: './screenshots/merbench-no-floating-elements.png',
    fullPage: false,
  });

  console.log('✓ Captured merbench page without floating elements');
});
