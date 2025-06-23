import { test, expect } from '@playwright/test';

test.describe('Floating Tags Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('floating elements should be visible and clickable on desktop', async ({ page }) => {
    // Check viewport is desktop
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeGreaterThan(1024);

    // Wait for floating elements to be visible
    const floatingElements = page.locator('.floating-element');
    await expect(floatingElements.first()).toBeVisible();

    // Check that floating elements exist
    const count = await floatingElements.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} floating elements`);

    // Verify each floating element is an anchor tag
    for (let i = 0; i < count; i++) {
      const element = floatingElements.nth(i);
      const tagName = await element.evaluate((el) => el.tagName);
      expect(tagName).toBe('A');

      // Verify href attribute exists and points to GitHub search
      const href = await element.getAttribute('href');
      expect(href).toContain('https://github.com/search?q=owner%3Aandrewginns+topic%3A');
    }
  });

  test('floating elements should have hover effects', async ({ page }) => {
    const floatingElement = page.locator('.floating-element').first();

    // Get initial styles
    const initialOpacity = await floatingElement.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );

    // Hover over the element
    await floatingElement.hover();

    // Wait for transition
    await page.waitForTimeout(300);

    // Check hover styles
    const hoverOpacity = await floatingElement.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const transform = await floatingElement.evaluate((el) => window.getComputedStyle(el).transform);

    // Verify hover effects
    expect(parseFloat(hoverOpacity)).toBeGreaterThan(parseFloat(initialOpacity));
    expect(transform).toContain('matrix');
  });

  test('clicking floating tag should navigate to GitHub search', async ({ page }) => {
    // Get the first floating element
    const floatingElement = page.locator('.floating-element').first();
    const tagText = await floatingElement.textContent();

    // Get the href before clicking
    const href = await floatingElement.getAttribute('href');

    // Verify the href contains the expected GitHub search format
    expect(href).toContain('https://github.com/search?q=owner%3Aandrewginns+topic%3A');
    expect(href).toContain('&type=repositories');

    // Verify the tag is properly encoded in the URL
    const expectedTag = tagText?.toLowerCase().replace(/\s+/g, '-');
    expect(href).toContain(`topic%3A${expectedTag}`);
  });

  test('projects should be filtered based on selected tag', async ({ page }) => {
    // Navigate directly to a filtered view
    await page.goto('/projects_github?tag=python');

    // Wait for projects to load
    await page.waitForSelector('.portfolio-item');

    // Check that filter info is displayed
    const filterInfo = page.locator('.filter-info');
    await expect(filterInfo).toBeVisible();

    // Check that the filter tag shows "Python"
    const filterTag = page.locator('.filter-tag');
    await expect(filterTag).toHaveText('Python');

    // Get all project tags
    const projects = page.locator('.portfolio-item');
    const projectCount = await projects.count();

    // Verify at least one project has the filtered tag
    let foundTag = false;
    for (let i = 0; i < projectCount; i++) {
      const projectTags = await projects.nth(i).locator('.technologies span').allTextContents();
      if (projectTags.some((tag) => tag.toLowerCase() === 'python')) {
        foundTag = true;
        break;
      }
    }

    if (projectCount > 0) {
      expect(foundTag).toBe(true);
    }
  });

  test('clear filter button should remove tag filter', async ({ page }) => {
    // Navigate to a filtered view
    await page.goto('/projects_github?tag=python');

    // Verify filter is active
    const filterInfo = page.locator('.filter-info');
    await expect(filterInfo).toBeVisible();

    // Click the clear filter button
    const clearButton = page.locator('.clear-filter');
    await clearButton.click();

    // Wait for navigation
    await page.waitForURL('/projects_github');

    // Verify filter info is no longer visible
    await expect(filterInfo).not.toBeVisible();

    // Verify URL has no tag parameter
    const url = page.url();
    expect(url).not.toContain('?tag=');
  });

  test('floating elements should be hidden on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to home page
    await page.goto('/');

    // Check that floating elements are not visible
    const floatingElements = page.locator('.floating-element');
    const count = await floatingElements.count();

    if (count > 0) {
      // If elements exist in DOM, they should be hidden
      await expect(floatingElements.first()).not.toBeVisible();
    }
  });

  test('tag links should preserve proper casing in URL', async ({ page }) => {
    // Get a floating element with multi-word tag
    const floatingElements = page.locator('.floating-element');
    const count = await floatingElements.count();

    let multiWordElement = null;
    for (let i = 0; i < count; i++) {
      const text = await floatingElements.nth(i).textContent();
      if (text && text.includes(' ')) {
        multiWordElement = floatingElements.nth(i);
        break;
      }
    }

    if (multiWordElement) {
      const tagText = await multiWordElement.textContent();
      await multiWordElement.click();

      // Wait for navigation
      await page.waitForURL(/projects_github\?tag=/);

      // Verify URL has hyphenated lowercase version
      const url = page.url();
      const expectedTag = tagText?.toLowerCase().replace(/\s+/g, '-');
      expect(url).toContain(`tag=${expectedTag}`);
    }
  });

  test('all floating elements should have proper accessibility attributes', async ({ page }) => {
    const floatingElements = page.locator('.floating-element');
    const count = await floatingElements.count();

    for (let i = 0; i < count; i++) {
      const element = floatingElements.nth(i);

      // Check aria-label
      const ariaLabel = await element.getAttribute('aria-label');
      expect(ariaLabel).toContain('Filter projects by');

      // Check that it's focusable (has href)
      const href = await element.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });
});

test.describe('Floating Tags Visual Regression', () => {
  test('capture floating tags screenshot', async ({ page }) => {
    await page.goto('/');

    // Wait for animations to complete
    await page.waitForTimeout(1000);

    // Take screenshot of the floating elements area
    const floatingContainer = page.locator('.floating-elements');
    await expect(floatingContainer).toBeVisible();

    await expect(page).toHaveScreenshot('floating-tags.png', {
      clip: {
        x: 800,
        y: 0,
        width: 480,
        height: 800,
      },
      animations: 'disabled',
    });
  });
});
