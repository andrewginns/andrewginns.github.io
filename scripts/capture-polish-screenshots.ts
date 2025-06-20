import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

async function capturePolishScreenshots(): Promise<void> {
  const browser: Browser = await chromium.launch();
  
  // Mobile viewport
  const mobileContext: BrowserContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  });
  const mobilePage: Page = await mobileContext.newPage();
  
  // Desktop viewport
  const desktopContext: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const desktopPage: Page = await desktopContext.newPage();
  
  // Ultra-wide viewport
  const ultrawideContext: BrowserContext = await browser.newContext({
    viewport: { width: 2560, height: 1440 }
  });
  const ultrawidePage: Page = await ultrawideContext.newPage();
  
  console.log('Capturing polished site screenshots...');
  
  // Mobile
  await mobilePage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: './screenshots/polished-mobile.png', fullPage: false });
  
  // Desktop
  await desktopPage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await desktopPage.screenshot({ path: './screenshots/polished-desktop.png' });
  
  // Ultra-wide
  await ultrawidePage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await ultrawidePage.screenshot({ path: './screenshots/polished-ultrawide.png' });
  
  await browser.close();
  console.log('Polished screenshots captured successfully!');
}

capturePolishScreenshots().catch(console.error);
