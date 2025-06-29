import { test, expect } from '@playwright/test';

test.describe('Floating Elements Visibility', () => {
  test('floating elements should not appear on merbench page', async ({ page }) => {
    await page.goto('http://localhost:4321/merbench');
    await page.waitForLoadState('networkidle');

    // Check if floating elements container exists
    const floatingElements = page.locator('.floating-elements');
    const count = await floatingElements.count();

    expect(count).toBe(0);
    console.log('✓ Floating elements are hidden on /merbench page');
  });

  test('floating elements should appear on home page', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('networkidle');

    // Check if floating elements container exists
    const floatingElements = page.locator('.floating-elements');
    const count = await floatingElements.count();

    expect(count).toBe(1);

    // Check if individual floating elements exist
    const individualElements = await page.locator('.floating-element').count();
    expect(individualElements).toBeGreaterThan(0);

    console.log(`✓ Found ${individualElements} floating elements on home page`);
  });

  test('floating elements should appear on other pages', async ({ page }) => {
    const pages = ['/experience', '/projects_github', '/writing', '/about_me', '/contact_me'];

    for (const pagePath of pages) {
      await page.goto(`http://localhost:4321${pagePath}`);
      await page.waitForLoadState('networkidle');

      const floatingElements = page.locator('.floating-elements');
      const count = await floatingElements.count();

      expect(count).toBe(1);
      console.log(`✓ Floating elements are visible on ${pagePath}`);
    }
  });

  test('floating elements should be interactive on pages where they appear', async ({ page }) => {
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('networkidle');

    // Check if floating elements are clickable and have correct href
    const firstElement = page.locator('.floating-element').first();
    const href = await firstElement.getAttribute('href');

    expect(href).toContain('github.com/search');
    expect(href).toContain('owner%3Aandrewginns');
    expect(href).toContain('topic%3A');

    console.log('✓ Floating elements have correct GitHub search links');
  });
});
