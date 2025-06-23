import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

async function captureProjectCards(): Promise<void> {
  const browser: Browser = await chromium.launch();

  // Desktop viewport
  const desktopContext: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const desktopPage: Page = await desktopContext.newPage();

  // Mobile viewport
  const mobileContext: BrowserContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage: Page = await mobileContext.newPage();

  // Navigate to projects page
  console.log('Navigating to projects page...');
  await desktopPage.goto('http://localhost:4321/projects_github', { waitUntil: 'networkidle' });
  await mobilePage.goto('http://localhost:4321/projects_github', { waitUntil: 'networkidle' });

  // Wait for portfolio items to be rendered
  await desktopPage.waitForSelector('.portfolio-item', { timeout: 5000 });
  await mobilePage.waitForSelector('.portfolio-item', { timeout: 5000 });

  // Capture full page screenshots
  console.log('Capturing full page screenshots...');
  await desktopPage.screenshot({
    path: './screenshots/projects-page-desktop.png',
    fullPage: true,
  });

  await mobilePage.screenshot({
    path: './screenshots/projects-page-mobile.png',
    fullPage: true,
  });

  // Get all portfolio items on desktop
  const desktopItems = await desktopPage.$$('.portfolio-item');
  console.log(`Found ${desktopItems.length} project cards on desktop`);

  // Capture the first few project cards individually
  console.log('Capturing individual project cards...');
  for (let i = 0; i < Math.min(3, desktopItems.length); i++) {
    const item = desktopItems[i];
    const boundingBox = await item.boundingBox();

    if (boundingBox) {
      // Get the title text
      const titleElement = await item.$('h2');
      const title = await titleElement?.textContent();
      console.log(`Card ${i + 1}: "${title}"`);

      // Capture desktop version
      await desktopPage.screenshot({
        path: `./screenshots/project-card-desktop-${i + 1}.png`,
        clip: boundingBox,
      });

      // Measure spacing
      const styles = await item.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const h2 = el.querySelector('h2');
        const h2Computed = h2 ? window.getComputedStyle(h2) : null;

        // Get first and last child elements
        const lastChild = el.lastElementChild;
        const lastChildComputed = lastChild ? window.getComputedStyle(lastChild) : null;

        // Calculate actual visual spacing
        const h2Rect = h2?.getBoundingClientRect();
        const cardRect = el.getBoundingClientRect();
        const lastChildRect = lastChild?.getBoundingClientRect();

        const topSpace = h2Rect ? h2Rect.top - cardRect.top : 0;
        const bottomSpace = lastChildRect ? cardRect.bottom - lastChildRect.bottom : 0;

        return {
          padding: computed.padding,
          paddingTop: computed.paddingTop,
          h2MarginTop: h2Computed?.marginTop || 'N/A',
          h2MarginBottom: h2Computed?.marginBottom || 'N/A',
          lastChildTag: lastChild?.tagName || 'N/A',
          lastChildMarginBottom: lastChildComputed?.marginBottom || 'N/A',
          visualTopSpace: Math.round(topSpace) + 'px',
          visualBottomSpace: Math.round(bottomSpace) + 'px',
        };
      });

      console.log(`  - Padding: ${styles.padding}`);
      console.log(`  - Padding top: ${styles.paddingTop}`);
      console.log(`  - H2 margin top: ${styles.h2MarginTop}`);
      console.log(`  - H2 margin bottom: ${styles.h2MarginBottom}`);
      console.log(
        `  - Last child: <${styles.lastChildTag}> with margin-bottom: ${styles.lastChildMarginBottom}`
      );
      console.log(`  - Visual top space: ${styles.visualTopSpace}`);
      console.log(`  - Visual bottom space: ${styles.visualBottomSpace}`);
    }
  }

  // Capture mobile cards
  const mobileItems = await mobilePage.$$('.portfolio-item');
  console.log(`\nFound ${mobileItems.length} project cards on mobile`);

  if (mobileItems.length > 0) {
    const firstMobileItem = mobileItems[0];
    const mobileBoundingBox = await firstMobileItem.boundingBox();

    if (mobileBoundingBox) {
      await mobilePage.screenshot({
        path: './screenshots/project-card-mobile-1.png',
        clip: mobileBoundingBox,
      });

      console.log('✅ Mobile project card screenshot captured');
    }
  }

  await browser.close();
  console.log('\nScreenshots captured successfully!');
  console.log('Check the screenshots folder to verify:');
  console.log('- Reduced spacing above repo names');
  console.log('- Better visual hierarchy');
  console.log('- Proper alignment on mobile');
}

captureProjectCards().catch(console.error);
