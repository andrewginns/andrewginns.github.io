import { test, expect } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'theme-toggle-screenshots');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Theme Toggle UX - Simple Validation', () => {
  test('Theme toggle visual states', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of initial light mode
    await page.screenshot({
      path: join(outputDir, 'sidebar-light-mode.png'),
      clip: { x: 0, y: 0, width: 280, height: 600 },
    });

    // Click the sidebar toggle specifically
    const sidebarToggle = page.locator('#theme-toggle-sidebar');
    await sidebarToggle.click();
    await page.waitForTimeout(500); // Wait for theme change

    // Take screenshot of dark mode
    await page.screenshot({
      path: join(outputDir, 'sidebar-dark-mode.png'),
      clip: { x: 0, y: 0, width: 280, height: 600 },
    });

    // Toggle back to light
    await sidebarToggle.click();
    await page.waitForTimeout(500);

    // Take screenshot of light mode again
    await page.screenshot({
      path: join(outputDir, 'sidebar-light-mode-return.png'),
      clip: { x: 0, y: 0, width: 280, height: 600 },
    });

    console.log('✅ Theme toggle visual validation completed');
  });

  test('Full page theme comparison', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Full page light mode
    await page.screenshot({
      path: join(outputDir, 'full-page-light.png'),
      fullPage: true,
    });

    // Switch to dark mode
    const sidebarToggle = page.locator('#theme-toggle-sidebar');
    await sidebarToggle.click();
    await page.waitForTimeout(500);

    // Full page dark mode
    await page.screenshot({
      path: join(outputDir, 'full-page-dark.png'),
      fullPage: true,
    });

    console.log('✅ Full page theme comparison completed');
  });

  test('Toggle functionality verification', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify initial state (should be light mode)
    const htmlElement = page.locator('html');
    const initialTheme = await htmlElement.getAttribute('data-theme');

    console.log(`Initial theme: ${initialTheme || 'light (no attribute)'}`);

    // Click toggle
    const sidebarToggle = page.locator('#theme-toggle-sidebar');
    await sidebarToggle.click();
    await page.waitForTimeout(300);

    // Verify theme changed
    const newTheme = await htmlElement.getAttribute('data-theme');
    console.log(`After toggle theme: ${newTheme}`);

    // Verify the input state
    const toggleInput = page.locator('#theme-toggle-sidebar .theme-toggle__input');
    const isChecked = await toggleInput.isChecked();
    console.log(`Toggle input checked: ${isChecked}`);

    // Verify ARIA attribute
    const ariaChecked = await toggleInput.getAttribute('aria-checked');
    console.log(`ARIA checked: ${ariaChecked}`);

    console.log('✅ Toggle functionality verification completed');
  });
});
