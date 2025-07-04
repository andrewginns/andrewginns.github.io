import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';

interface TestCase {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
}

test.describe('Mobile Filter Layout', () => {
  const testCases: TestCase[] = [
    { name: 'Mobile-320', width: 320, height: 800, isMobile: true },
    { name: 'Mobile-375', width: 375, height: 800, isMobile: true },
    { name: 'Mobile-414', width: 414, height: 800, isMobile: true },
    { name: 'Mobile-768', width: 768, height: 800, isMobile: true },
    { name: 'Desktop-1024', width: 1024, height: 800, isMobile: false },
  ];

  for (const device of testCases) {
    test(`Filter behavior at ${device.width}px width (${device.isMobile ? 'Mobile FAB' : 'Desktop Sticky'})`, async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
      });
      const pageInstance = await context.newPage();

      await pageInstance.goto('/merbench');
      await pageInstance.waitForLoadState('networkidle');
      await pageInstance.waitForTimeout(1000);

      if (device.isMobile) {
        // Mobile: Test FAB visibility and functionality
        const fab = pageInstance.locator('#filter-fab');
        const panel = pageInstance.locator('#filter-panel');

        // FAB should be visible
        await expect(fab).toBeVisible();

        // Panel should be initially hidden
        await expect(panel).not.toHaveClass(/expanded/);

        // Click FAB to expand panel
        await fab.click();
        await pageInstance.waitForTimeout(300); // Wait for animation

        // Panel should now be expanded
        await expect(panel).toHaveClass(/expanded/);

        // Screenshot expanded state
        await pageInstance.screenshot({
          path: `screenshots/filter-fab-expanded-${device.name.toLowerCase()}.png`,
          fullPage: true,
        });

        // Test filter interaction - uncheck a filter
        const firstCheckbox = panel.locator('input[type="checkbox"]').first();
        await firstCheckbox.uncheck();

        // Filter count badge should appear
        const filterCount = pageInstance.locator('#filter-count');
        await expect(filterCount).toHaveClass(/visible/);

        // Screenshot with filter count
        await pageInstance.screenshot({
          path: `screenshots/filter-fab-with-count-${device.name.toLowerCase()}.png`,
          fullPage: true,
        });
      } else {
        // Desktop: Test sticky behavior
        const container = pageInstance.locator('.filter-container');
        const fab = pageInstance.locator('#filter-fab');

        // FAB should be hidden on desktop
        await expect(fab).not.toBeVisible();

        // Container should be visible as sticky top bar
        await expect(container).toBeVisible();

        // Screenshot desktop layout
        await pageInstance.screenshot({
          path: `screenshots/filter-desktop-${device.name.toLowerCase()}.png`,
          fullPage: true,
        });
      }

      await context.close();
    });
  }

  test('Mobile FAB accessibility and keyboard navigation', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 800 },
    });
    const pageInstance = await context.newPage();

    await pageInstance.goto('/merbench');
    await pageInstance.waitForLoadState('networkidle');
    await pageInstance.waitForTimeout(1000);

    const fab = pageInstance.locator('#filter-fab');
    const panel = pageInstance.locator('#filter-panel');

    // Test keyboard navigation
    await fab.focus();
    await pageInstance.keyboard.press('Enter');
    await pageInstance.waitForTimeout(300);

    // Panel should be expanded
    await expect(panel).toHaveClass(/expanded/);

    // Test escape key to close
    await pageInstance.keyboard.press('Escape');
    await pageInstance.waitForTimeout(300);

    // Panel should be closed
    await expect(panel).not.toHaveClass(/expanded/);

    // Focus should return to FAB
    await expect(fab).toBeFocused();

    await context.close();
  });

  test('Mobile filter panel touch interactions', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 800 },
    });
    const pageInstance = await context.newPage();

    await pageInstance.goto('/merbench');
    await pageInstance.waitForLoadState('networkidle');
    await pageInstance.waitForTimeout(1000);

    const fab = pageInstance.locator('#filter-fab');
    const panel = pageInstance.locator('#filter-panel');

    // Open panel
    await fab.click();
    await pageInstance.waitForTimeout(300);

    // Test touch targets - all checkboxes should be easily clickable
    const checkboxes = panel.locator('.filter-checkbox');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const boundingBox = await checkbox.boundingBox();

      // Touch targets should be at least 44px (accessibility standard)
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44);
    }

    // Test action buttons
    const allButton = panel.locator('#select-all');
    const noneButton = panel.locator('#clear-all');

    await expect(allButton).toBeVisible();
    await expect(noneButton).toBeVisible();

    // Test button functionality
    await noneButton.click();
    await pageInstance.waitForTimeout(100);

    // All checkboxes should be unchecked
    const checkedBoxes = panel.locator('input[type="checkbox"]:checked');
    await expect(checkedBoxes).toHaveCount(0);

    // Filter count should show total number of filters
    const filterCount = pageInstance.locator('#filter-count');
    await expect(filterCount).toHaveClass(/visible/);

    await context.close();
  });

  test('Mobile menu and filter coordination', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 800 },
    });
    const pageInstance = await context.newPage();

    await pageInstance.goto('/merbench');
    await pageInstance.waitForLoadState('networkidle');
    await pageInstance.waitForTimeout(1000);

    const hamburger = pageInstance.locator('#mobile-menu-toggle');
    const mobileNav = pageInstance.locator('#mobile-nav-pane');
    const fab = pageInstance.locator('#filter-fab');
    const panel = pageInstance.locator('#filter-panel');

    // Test 1: Open hamburger, then filter - hamburger should close
    await hamburger.click();
    await pageInstance.waitForTimeout(300);
    await expect(mobileNav).toHaveClass(/active/);

    await fab.click();
    await pageInstance.waitForTimeout(500); // Account for both close and open animations

    // Mobile nav should be closed, filter panel should be open
    await expect(mobileNav).not.toHaveClass(/active/);
    await expect(panel).toHaveClass(/expanded/);

    // Close filter panel
    await fab.click();
    await pageInstance.waitForTimeout(300);

    // Test 2: Open filter, then hamburger - filter should close
    await fab.click();
    await pageInstance.waitForTimeout(300);
    await expect(panel).toHaveClass(/expanded/);

    await hamburger.click();
    await pageInstance.waitForTimeout(300);

    // Filter panel should be closed, mobile nav should be open
    await expect(panel).not.toHaveClass(/expanded/);
    await expect(mobileNav).toHaveClass(/active/);

    await context.close();
  });
});
