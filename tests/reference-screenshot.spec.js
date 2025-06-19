import { test } from '@playwright/test';

test.describe('Reference Website Screenshots', () => {
  test('Screenshot: tomcritchlow.com homepage', async ({ page }) => {
    await page.goto('https://tomcritchlow.com/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for any content to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({
      path: 'screenshots/reference-tomcritchlow-home.png',
      fullPage: true
    });
  });

  test('Screenshot: tomcritchlow.com mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    
    await page.goto('https://tomcritchlow.com/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: 'screenshots/reference-tomcritchlow-mobile.png',
      fullPage: true
    });
    
    await context.close();
  });
});