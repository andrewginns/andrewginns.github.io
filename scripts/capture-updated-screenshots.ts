import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

async function captureUpdatedScreenshots(): Promise<void> {
  const browser: Browser = await chromium.launch();
  
  // Desktop viewport
  const desktopContext: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage: Page = await desktopContext.newPage();
  
  // Mobile viewport
  const mobileContext: BrowserContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  });
  const mobilePage: Page = await mobileContext.newPage();
  
  // Capture updated site
  console.log('Capturing updated site screenshots...');
  await desktopPage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: './screenshots/updated-desktop.png' });
  
  await mobilePage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: './screenshots/updated-mobile.png', fullPage: false });
  
  await browser.close();
  console.log('Updated screenshots captured successfully!');
}

captureUpdatedScreenshots().catch(console.error);
