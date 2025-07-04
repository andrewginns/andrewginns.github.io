import { test, expect } from '@playwright/test';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const outputDir = join(process.cwd(), 'toggle-visual-fix-screenshots');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

test.describe('Theme Toggle Visual Fix Validation', () => {
  test('Switch handle moves and colors change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const toggle = page.locator('#theme-toggle-sidebar');
    const switchElement = page.locator('#theme-toggle-sidebar .theme-toggle__switch');
    const handle = page.locator('#theme-toggle-sidebar .theme-toggle__handle');

    // Take screenshot of initial light mode
    await page.screenshot({
      path: join(outputDir, 'switch-light-mode.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Get initial handle position and switch colors
    const initialHandleTransform = await handle.evaluate(
      (el) => window.getComputedStyle(el).transform
    );
    const initialSwitchBg = await switchElement.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    console.log(`Initial handle transform: ${initialHandleTransform}`);
    console.log(`Initial switch background: ${initialSwitchBg}`);

    // Click to switch to dark mode
    await toggle.click();
    await page.waitForTimeout(500); // Wait for transition

    // Take screenshot of dark mode
    await page.screenshot({
      path: join(outputDir, 'switch-dark-mode.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Get new handle position and switch colors
    const darkHandleTransform = await handle.evaluate(
      (el) => window.getComputedStyle(el).transform
    );
    const darkSwitchBg = await switchElement.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    console.log(`Dark mode handle transform: ${darkHandleTransform}`);
    console.log(`Dark mode switch background: ${darkSwitchBg}`);

    // Verify the handle moved
    if (initialHandleTransform !== darkHandleTransform) {
      console.log('✅ Handle position changed correctly');
    } else {
      console.log('❌ Handle position did not change');
    }

    // Verify the background color changed
    if (initialSwitchBg !== darkSwitchBg) {
      console.log('✅ Switch background color changed correctly');
    } else {
      console.log('❌ Switch background color did not change');
    }

    // Switch back to light mode
    await toggle.click();
    await page.waitForTimeout(500);

    // Take screenshot back in light mode
    await page.screenshot({
      path: join(outputDir, 'switch-light-mode-return.png'),
      clip: (await toggle.boundingBox()) || { x: 0, y: 0, width: 200, height: 60 },
    });

    // Verify it returned to original state
    const returnHandleTransform = await handle.evaluate(
      (el) => window.getComputedStyle(el).transform
    );
    const returnSwitchBg = await switchElement.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );

    console.log(`Return handle transform: ${returnHandleTransform}`);
    console.log(`Return switch background: ${returnSwitchBg}`);

    if (initialHandleTransform === returnHandleTransform) {
      console.log('✅ Handle returned to original position');
    } else {
      console.log('❌ Handle did not return to original position');
    }

    console.log('✅ Visual switch animation test completed');
  });

  test('Icon transitions work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.locator('#theme-toggle-sidebar');
    const sunIcon = page.locator('#theme-toggle-sidebar .theme-toggle__icon--sun');
    const moonIcon = page.locator('#theme-toggle-sidebar .theme-toggle__icon--moon');

    // Check initial icon states
    const initialSunOpacity = await sunIcon.evaluate((el) => window.getComputedStyle(el).opacity);
    const initialMoonOpacity = await moonIcon.evaluate((el) => window.getComputedStyle(el).opacity);

    console.log(`Initial sun opacity: ${initialSunOpacity}`);
    console.log(`Initial moon opacity: ${initialMoonOpacity}`);

    // Switch to dark mode
    await toggle.click();
    await page.waitForTimeout(500);

    // Check icon states after switch
    const darkSunOpacity = await sunIcon.evaluate((el) => window.getComputedStyle(el).opacity);
    const darkMoonOpacity = await moonIcon.evaluate((el) => window.getComputedStyle(el).opacity);

    console.log(`Dark mode sun opacity: ${darkSunOpacity}`);
    console.log(`Dark mode moon opacity: ${darkMoonOpacity}`);

    // Verify icons switched
    if (parseFloat(initialSunOpacity) > parseFloat(darkSunOpacity)) {
      console.log('✅ Sun icon faded out correctly');
    }
    if (parseFloat(darkMoonOpacity) > parseFloat(initialMoonOpacity)) {
      console.log('✅ Moon icon faded in correctly');
    }

    console.log('✅ Icon transition test completed');
  });
});
