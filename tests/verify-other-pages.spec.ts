import { test, expect } from '@playwright/test';

test('verify other pages are not affected by merbench width changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  // Check the home page
  await page.goto('http://localhost:4321/');
  await page.waitForSelector('.content');

  // Get the content width
  const homeContentWidth = await page.evaluate(() => {
    const content = document.querySelector('.content');
    return content ? window.getComputedStyle(content).maxWidth : null;
  });

  // The home page should maintain its original max-width (800px)
  console.log('Home page content max-width:', homeContentWidth);

  // Check another page
  await page.goto('http://localhost:4321/projects_github');
  await page.waitForSelector('.portfolio-content');

  const projectsContentWidth = await page.evaluate(() => {
    const content = document.querySelector('.portfolio-content');
    return content ? window.getComputedStyle(content).maxWidth : null;
  });

  console.log('Projects page content max-width:', projectsContentWidth);

  // These should be 800px (the original width), not affected by merbench changes
  expect(homeContentWidth).toBe('800px');
  expect(projectsContentWidth).toBe('800px');
});
