import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'theme-toggle-screenshots');

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Theme Toggle UX Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `,
    });
  });

  test('Theme toggle shows current state correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test initial light mode state
    const toggle = page.locator('.theme-toggle--sidebar');
    const toggleInput = page.locator('.theme-toggle__input');
    const switchElement = page.locator('.theme-toggle__switch');

    // Verify light mode state
    await expect(toggleInput).not.toBeChecked();
    await expect(page.locator('[data-theme="light"]')).toHaveCount(0); // Root doesn't have light attribute

    // Verify toggle appearance in light mode
    const lightModeState = page.locator('.theme-toggle__state--light');
    await expect(lightModeState).toBeVisible();
    await expect(lightModeState).toHaveText('Off');

    // Take screenshot of light mode toggle
    await page.screenshot({
      path: join(outputDir, 'toggle-light-mode-state.png'),
      clip: { x: 0, y: 0, width: 280, height: 600 },
    });

    // Click to switch to dark mode
    await toggle.click();
    await page.waitForTimeout(300); // Wait for animation

    // Verify dark mode state
    await expect(page.locator('[data-theme="dark"]')).toHaveCount(1);
    await expect(toggleInput).toBeChecked();

    // Verify toggle appearance in dark mode
    const darkModeState = page.locator('.theme-toggle__state--dark');
    await expect(darkModeState).toBeVisible();
    await expect(darkModeState).toHaveText('On');

    // Take screenshot of dark mode toggle
    await page.screenshot({
      path: join(outputDir, 'toggle-dark-mode-state.png'),
      clip: { x: 0, y: 0, width: 280, height: 600 },
    });

    console.log('✅ Theme toggle state validation completed');
  });

  test('Theme toggle accessibility features', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.locator('.theme-toggle--sidebar');
    const toggleInput = page.locator('.theme-toggle__input');

    // Test ARIA attributes
    await expect(toggleInput).toHaveAttribute('role', 'switch');
    await expect(toggleInput).toHaveAttribute('aria-checked', 'false');

    // Test keyboard navigation
    await toggleInput.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);

    // Verify state changed via keyboard
    await expect(toggleInput).toBeChecked();
    await expect(toggleInput).toHaveAttribute('aria-checked', 'true');

    // Test Enter key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await expect(toggleInput).not.toBeChecked();
    await expect(toggleInput).toHaveAttribute('aria-checked', 'false');

    console.log('✅ Theme toggle accessibility validation completed');
  });

  test('Mobile theme toggle functionality', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();

    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `,
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open mobile menu
    const hamburger = page.locator('.hamburger');
    await hamburger.click();
    await page.waitForTimeout(300);

    // Test mobile toggle
    const mobileToggle = page.locator('.theme-toggle--mobile');
    const mobileInput = page.locator('.theme-toggle--mobile .theme-toggle__input');

    await expect(mobileToggle).toBeVisible();
    await expect(mobileInput).not.toBeChecked();

    // Take screenshot of mobile toggle in light mode
    await page.screenshot({
      path: join(outputDir, 'mobile-toggle-light.png'),
      fullPage: true,
    });

    // Switch to dark mode
    await mobileToggle.click();
    await page.waitForTimeout(300);

    await expect(mobileInput).toBeChecked();

    // Take screenshot of mobile toggle in dark mode
    await page.screenshot({
      path: join(outputDir, 'mobile-toggle-dark.png'),
      fullPage: true,
    });

    await context.close();
    console.log('✅ Mobile theme toggle validation completed');
  });

  test('Toggle visual feedback and animations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.locator('.theme-toggle--sidebar');
    const handle = page.locator('.theme-toggle__handle');
    const switchBg = page.locator('.theme-toggle__switch');

    // Test hover state
    await toggle.hover();
    await page.waitForTimeout(100);

    // Take screenshot of hover state
    await page.screenshot({
      path: join(outputDir, 'toggle-hover-state.png'),
      clip: { x: 0, y: 0, width: 280, height: 120 },
    });

    // Test focus state
    await toggle.focus();
    await page.waitForTimeout(100);

    // Take screenshot of focus state
    await page.screenshot({
      path: join(outputDir, 'toggle-focus-state.png'),
      clip: { x: 0, y: 0, width: 280, height: 120 },
    });

    console.log('✅ Theme toggle visual feedback validation completed');
  });

  test('Toggle label consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggleLabel = page.locator('.theme-toggle__label');

    // Verify label is consistent
    await expect(toggleLabel).toHaveText('Dark mode');

    // Switch themes multiple times and verify label stays the same
    const toggle = page.locator('.theme-toggle--sidebar');

    for (let i = 0; i < 3; i++) {
      await toggle.click();
      await page.waitForTimeout(200);
      await expect(toggleLabel).toHaveText('Dark mode');
    }

    console.log('✅ Theme toggle label consistency validated');
  });
});
