import { test, expect } from '@playwright/test';

test.describe('Mobile Header Auto-Hide', () => {
  test('should auto-hide header when scrolling down and show when scrolling up', async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Get header element
    const header = page.locator('#mobile-header');

    // Initially header should be visible (not hidden)
    await expect(header).not.toHaveClass(/header-hidden/);

    // Scroll down significantly to trigger hide (using new 40px threshold)
    await page.evaluate(() => {
      window.scrollTo({ top: 250, behavior: 'instant' });
    });

    // Wait for scroll handling
    await page.waitForTimeout(200);

    // Header should now be hidden
    await expect(header).toHaveClass(/header-hidden/);

    // Scroll up by at least 20px to trigger show
    await page.evaluate(() => {
      window.scrollTo({ top: 220, behavior: 'instant' });
    });

    // Wait for scroll handling
    await page.waitForTimeout(200);

    // Header should now be visible again
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should always show header at top of page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#mobile-header');

    // Scroll down to hide header
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    await expect(header).toHaveClass(/header-hidden/);

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    // Header should be visible at top
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should not hide header when menu is open', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#mobile-header');
    const hamburger = page.locator('#mobile-hamburger');

    // Open menu
    await hamburger.click();
    await page.waitForTimeout(100);

    // Verify menu is open
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    // Scroll down while menu is open
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    // Header should still be visible (not hidden) because menu is open
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should show header with glass shadow effect when scrolled', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#mobile-header');

    // Initially no scrolled class
    await expect(header).not.toHaveClass(/scrolled/);

    // Scroll down a small amount (less than hide threshold but more than shadow threshold)
    await page.evaluate(() => {
      window.scrollTo({ top: 30, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    // Should have scrolled class but not be hidden
    await expect(header).toHaveClass(/scrolled/);
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should require 20px upward scroll to show header', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#mobile-header');

    // Scroll down to hide header
    await page.evaluate(() => {
      window.scrollTo({ top: 250, behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    await expect(header).toHaveClass(/header-hidden/);

    // Small upward scroll (less than 20px) should not show header
    await page.evaluate(() => {
      window.scrollTo({ top: 240, behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    await expect(header).toHaveClass(/header-hidden/);

    // Another small scroll (total 15px up) - still shouldn't show
    await page.evaluate(() => {
      window.scrollTo({ top: 235, behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    await expect(header).toHaveClass(/header-hidden/);

    // Final scroll to reach 20px threshold - should now show
    await page.evaluate(() => {
      window.scrollTo({ top: 230, behavior: 'instant' });
    });
    await page.waitForTimeout(200);
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should show header after timeout when stopped scrolling', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const header = page.locator('#mobile-header');

    // Scroll down to hide header
    await page.evaluate(() => {
      window.scrollTo({ top: 300, behavior: 'instant' });
    });
    await page.waitForTimeout(200);

    // Header should be hidden
    await expect(header).toHaveClass(/header-hidden/);

    // Wait for the timeout period (3+ seconds)
    await page.waitForTimeout(3200);

    // Header should now be visible again due to timeout
    await expect(header).not.toHaveClass(/header-hidden/);
  });

  test('should work correctly on different mobile pages', async ({ page }) => {
    // Test on different pages to ensure it works across the site
    const pages = ['/about_me', '/experience', '/projects_github'];

    for (const pagePath of pages) {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      const header = page.locator('#mobile-header');

      // Should be visible initially
      await expect(header).not.toHaveClass(/header-hidden/);

      // Scroll down to hide
      await page.evaluate(() => {
        window.scrollTo({ top: 300, behavior: 'instant' });
      });
      await page.waitForTimeout(200);

      // Should be hidden
      await expect(header).toHaveClass(/header-hidden/);

      // Scroll up to show
      await page.evaluate(() => {
        window.scrollTo({ top: 100, behavior: 'instant' });
      });
      await page.waitForTimeout(200);

      // Should be visible
      await expect(header).not.toHaveClass(/header-hidden/);
    }
  });
});
