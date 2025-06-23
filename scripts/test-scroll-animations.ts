import { chromium, type Browser, type Page } from 'playwright';

async function testScrollAnimations() {
  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const pages = [
    { name: 'Home', url: 'http://localhost:4322/' },
    { name: 'About', url: 'http://localhost:4322/about_me' },
    { name: 'Experience', url: 'http://localhost:4322/experience' },
    { name: 'Projects', url: 'http://localhost:4322/projects_github' },
    { name: 'Writing', url: 'http://localhost:4322/writing' },
    { name: 'Contact', url: 'http://localhost:4322/contact_me' },
  ];

  for (const pageInfo of pages) {
    console.log(`\nTesting ${pageInfo.name} page...`);
    const page: Page = await browser.newPage();
    await page.goto(pageInfo.url, { waitUntil: 'networkidle' });

    // Wait for initial page load
    await page.waitForTimeout(500);

    // Check if elements have the scroll-animate class
    const elementsWithAnimation = await page.$$eval(
      '.scroll-animate',
      (elements) => elements.length
    );
    console.log(`  - Found ${elementsWithAnimation} elements with scroll-animate class`);

    // Check initial state (should be hidden)
    const hiddenElements = await page.$$eval(
      '.scroll-animate:not(.visible)',
      (elements) => elements.length
    );
    console.log(`  - ${hiddenElements} elements are in initial hidden state`);

    // Scroll down to trigger animations
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000); // Wait for animations to trigger

    // Check how many elements are now visible
    const visibleElements = await page.$$eval(
      '.scroll-animate.visible',
      (elements) => elements.length
    );
    console.log(`  - ${visibleElements} elements are now visible after scrolling`);

    // Verify the CSS properties
    const animationStyles = await page.$$eval('.scroll-animate', (elements) => {
      return elements.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          hasTransition: styles.transition.includes('all 0.6s'),
          opacity: styles.opacity,
          transform: styles.transform,
          hasVisibleClass: el.classList.contains('visible'),
        };
      });
    });

    const workingAnimations = animationStyles.filter((style) => style.hasVisibleClass).length;
    const brokenAnimations = animationStyles.filter((style) => !style.hasTransition).length;

    console.log(`  - ${workingAnimations} animations working correctly`);
    if (brokenAnimations > 0) {
      console.log(`  - WARNING: ${brokenAnimations} elements missing transition styles`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nScroll animation test complete!');
}

testScrollAnimations().catch(console.error);
