import { test } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'icon-check-screenshots');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Icon Logic Check', () => {
  test('Verify which icons show in each mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const toggle = page.locator('#theme-toggle-sidebar');
    const sunIcon = page.locator('#theme-toggle-sidebar .theme-toggle__icon--sun');
    const moonIcon = page.locator('#theme-toggle-sidebar .theme-toggle__icon--moon');

    // Check light mode
    console.log('=== LIGHT MODE ===');
    const lightTheme = await page.locator('html').getAttribute('data-theme');
    console.log(`Theme attribute: ${lightTheme || 'none (light mode)'}`);

    const lightSunOpacity = await sunIcon.evaluate((el) => window.getComputedStyle(el).opacity);
    const lightMoonOpacity = await moonIcon.evaluate((el) => window.getComputedStyle(el).opacity);

    console.log(`Sun icon opacity: ${lightSunOpacity}`);
    console.log(`Moon icon opacity: ${lightMoonOpacity}`);
    console.log(`Visible icon: ${parseFloat(lightSunOpacity) > 0.5 ? 'SUN' : 'MOON'}`);

    // Take close-up screenshot of light mode toggle
    await page.screenshot({
      path: join(outputDir, 'light-mode-icons.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Switch to dark mode
    await toggle.click();
    await page.waitForTimeout(500);

    console.log('\n=== DARK MODE ===');
    const darkTheme = await page.locator('html').getAttribute('data-theme');
    console.log(`Theme attribute: ${darkTheme}`);

    const darkSunOpacity = await sunIcon.evaluate((el) => window.getComputedStyle(el).opacity);
    const darkMoonOpacity = await moonIcon.evaluate((el) => window.getComputedStyle(el).opacity);

    console.log(`Sun icon opacity: ${darkSunOpacity}`);
    console.log(`Moon icon opacity: ${darkMoonOpacity}`);
    console.log(`Visible icon: ${parseFloat(darkMoonOpacity) > 0.5 ? 'MOON' : 'SUN'}`);

    // Take close-up screenshot of dark mode toggle
    await page.screenshot({
      path: join(outputDir, 'dark-mode-icons.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    console.log('\n=== EXPECTED BEHAVIOR ===');
    console.log('Light mode should show: SUN icon (representing current light state)');
    console.log('Dark mode should show: MOON icon (representing current dark state)');
  });
});
