import { test, expect } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'theme-toggle-fix-screenshots');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Theme Toggle Fix Validation', () => {
  test('Fixed toggle functionality and visual appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of initial state
    await page.screenshot({
      path: join(outputDir, 'fixed-toggle-initial.png'),
      clip: { x: 0, y: 0, width: 300, height: 600 },
    });

    // Check initial theme state
    const htmlElement = page.locator('html');
    let currentTheme = await htmlElement.getAttribute('data-theme');
    console.log(`Initial theme: ${currentTheme || 'light (no attribute)'}`);

    // Find the sidebar toggle
    const sidebarToggle = page.locator('#theme-toggle-sidebar');
    await expect(sidebarToggle).toBeVisible();

    // Check ARIA attributes
    let ariaChecked = await sidebarToggle.getAttribute('aria-checked');
    console.log(`Initial ARIA checked: ${ariaChecked}`);

    // Click the toggle
    console.log('Clicking toggle...');
    await sidebarToggle.click();
    await page.waitForTimeout(500);

    // Take screenshot after click
    await page.screenshot({
      path: join(outputDir, 'fixed-toggle-after-click.png'),
      clip: { x: 0, y: 0, width: 300, height: 600 },
    });

    // Check theme changed
    currentTheme = await htmlElement.getAttribute('data-theme');
    console.log(`After click theme: ${currentTheme}`);

    // Check ARIA updated
    ariaChecked = await sidebarToggle.getAttribute('aria-checked');
    console.log(`After click ARIA checked: ${ariaChecked}`);

    // Click again to toggle back
    console.log('Clicking toggle again...');
    await sidebarToggle.click();
    await page.waitForTimeout(500);

    // Take screenshot after second click
    await page.screenshot({
      path: join(outputDir, 'fixed-toggle-second-click.png'),
      clip: { x: 0, y: 0, width: 300, height: 600 },
    });

    // Check theme changed back
    currentTheme = await htmlElement.getAttribute('data-theme');
    console.log(`After second click theme: ${currentTheme || 'light (no attribute)'}`);

    // Check ARIA updated
    ariaChecked = await sidebarToggle.getAttribute('aria-checked');
    console.log(`After second click ARIA checked: ${ariaChecked}`);

    console.log('✅ Toggle functionality test completed');
  });

  test('Visual state text visibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take detailed screenshot of toggle area
    const sidebarToggle = page.locator('#theme-toggle-sidebar');

    // Light mode state
    await page.screenshot({
      path: join(outputDir, 'toggle-light-state-detailed.png'),
      clip: (await sidebarToggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 50 },
    });

    // Switch to dark mode
    await sidebarToggle.click();
    await page.waitForTimeout(300);

    // Dark mode state
    await page.screenshot({
      path: join(outputDir, 'toggle-dark-state-detailed.png'),
      clip: (await sidebarToggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 50 },
    });

    console.log('✅ Visual state validation completed');
  });

  test('Full page theme switching', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Light mode full page
    await page.screenshot({
      path: join(outputDir, 'full-page-light-fixed.png'),
      fullPage: true,
    });

    // Switch to dark mode
    const sidebarToggle = page.locator('#theme-toggle-sidebar');
    await sidebarToggle.click();
    await page.waitForTimeout(500);

    // Dark mode full page
    await page.screenshot({
      path: join(outputDir, 'full-page-dark-fixed.png'),
      fullPage: true,
    });

    console.log('✅ Full page theme switching validation completed');
  });
});
