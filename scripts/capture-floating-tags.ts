import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

async function captureFloatingTags(): Promise<void> {
  const browser: Browser = await chromium.launch();

  // Desktop viewport for floating tags
  const desktopContext: BrowserContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const desktopPage: Page = await desktopContext.newPage();

  // Navigate to the site
  console.log('Navigating to site...');
  await desktopPage.goto('http://localhost:4321/', { waitUntil: 'networkidle' });

  // Wait for floating elements to be rendered
  await desktopPage.waitForSelector('.floating-element', { timeout: 5000 });

  // Get all floating elements
  const floatingElements = await desktopPage.$$('.floating-element');
  console.log(`Found ${floatingElements.length} floating elements`);

  // Verify we have 10 elements
  if (floatingElements.length !== 10) {
    console.warn(`⚠️ Expected 10 floating elements, but found ${floatingElements.length}`);
  } else {
    console.log('✅ Correctly displaying 10 floating elements');
  }

  // Capture full page screenshot
  console.log('Capturing full page screenshot...');
  await desktopPage.screenshot({
    path: './screenshots/floating-tags-full.png',
    fullPage: false,
  });

  // Capture individual floating elements
  console.log('Capturing individual floating elements...');
  for (let i = 0; i < floatingElements.length; i++) {
    const element = floatingElements[i];
    const boundingBox = await element.boundingBox();

    if (boundingBox) {
      // Get the text content
      const text = await element.textContent();
      console.log(`Element ${i + 1}: "${text}"`);

      // Check if text is wrapped
      const computedStyle = await element.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const htmlEl = el as HTMLElement;
        return {
          width: htmlEl.offsetWidth,
          height: htmlEl.offsetHeight,
          whiteSpace: style.whiteSpace,
          lineHeight: style.lineHeight,
          fontSize: style.fontSize,
        };
      });

      console.log(`  - Dimensions: ${computedStyle.width}x${computedStyle.height}`);
      console.log(`  - White-space: ${computedStyle.whiteSpace}`);
      console.log(`  - Font-size: ${computedStyle.fontSize}`);

      // Capture screenshot with padding around the element
      await desktopPage.screenshot({
        path: `./screenshots/floating-element-${i + 1}.png`,
        clip: {
          x: Math.max(0, boundingBox.x - 20),
          y: Math.max(0, boundingBox.y - 20),
          width: boundingBox.width + 40,
          height: boundingBox.height + 40,
        },
      });
    }
  }

  // Test with very long tags to ensure wrapping works
  console.log('\nTesting with long tags...');
  await desktopPage.evaluate(() => {
    const elements = document.querySelectorAll('.floating-element');
    if (elements.length > 0) {
      // Simulate a very long tag
      (elements[0] as HTMLElement).textContent = 'Very Long Machine Learning Tag Name';
    }
  });

  await desktopPage.waitForTimeout(1000); // Wait for any animations

  await desktopPage.screenshot({
    path: './screenshots/floating-tags-long-text.png',
    fullPage: false,
  });

  await browser.close();
  console.log('\nScreenshots captured successfully!');
  console.log('Check the screenshots folder to verify:');
  console.log('- No text is cut off');
  console.log('- Long tags wrap properly');
  console.log('- Elements maintain visual appeal');
}

captureFloatingTags().catch(console.error);
