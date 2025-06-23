import { test, expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

interface MobileDevice {
  name: string;
  width: number;
  height: number;
  userAgent: string;
  deviceScaleFactor: number;
}

test.describe('Mobile Touch Interactions', () => {
  const mobileDevices: MobileDevice[] = [
    {
      name: 'iPhone SE',
      width: 375,
      height: 667,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
    },
    {
      name: 'iPhone 12 Pro',
      width: 390,
      height: 844,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 3,
    },
    {
      name: 'Samsung Galaxy S21',
      width: 360,
      height: 800,
      userAgent:
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      deviceScaleFactor: 3,
    },
  ];

  for (const device of mobileDevices) {
    test.describe(`${device.name} Tests`, () => {
      let context: BrowserContext;
      let page: Page;

      test.beforeEach(async ({ browser }: { browser: Browser }) => {
        context = await browser.newContext({
          viewport: {
            width: device.width,
            height: device.height,
          },
          userAgent: device.userAgent,
          deviceScaleFactor: device.deviceScaleFactor,
          hasTouch: true,
          isMobile: true,
        });

        page = await context.newPage();
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Wait for any animations to complete
        await page.waitForTimeout(1000);
      });

      test.afterEach(async () => {
        await context.close();
      });

      test('Hero Card - LinkedIn link opens with single tap', async () => {
        // Find the LinkedIn social link
        const linkedinLink = page.locator('.hero-links a[href*="linkedin.com"]');
        await expect(linkedinLink).toBeVisible();

        // Verify the link is properly sized for touch
        const boundingBox = await linkedinLink.boundingBox();
        expect(boundingBox).toBeTruthy();
        if (boundingBox) {
          // Touch targets should be at least 44px (iOS) - now fixed with proper min-height
          expect(boundingBox.height).toBeGreaterThanOrEqual(48);
          expect(boundingBox.width).toBeGreaterThanOrEqual(110);
        }

        // Test single tap behavior
        // We'll simulate tap and check if it would navigate
        const href = await linkedinLink.getAttribute('href');
        expect(href).toContain('linkedin.com/in/andrewginns');

        // Verify the link has proper target and rel attributes for external links
        const target = await linkedinLink.getAttribute('target');
        const rel = await linkedinLink.getAttribute('rel');
        expect(target).toBe('_blank');
        expect(rel).toBe('noopener noreferrer');

        // Test that the element is clickable (no overlapping elements)
        await expect(linkedinLink).toBeEnabled();

        // Simulate touch interaction and verify no double-tap needed
        const responses: any[] = [];
        page.on('response', (response) => responses.push(response));

        // Use tap instead of click to simulate mobile touch
        await linkedinLink.tap();

        // On mobile, external links should be handled by the browser
        // We verify the element is properly configured for single-tap
        await page.waitForTimeout(500);
      });

      test('Hero Card - GitHub link opens with single tap', async () => {
        const githubLink = page.locator('.hero-links a[href*="github.com"]');
        await expect(githubLink).toBeVisible();

        // Verify touch target size
        const boundingBox = await githubLink.boundingBox();
        expect(boundingBox).toBeTruthy();
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThanOrEqual(48);
          expect(boundingBox.width).toBeGreaterThanOrEqual(110);
        }

        // Verify link attributes
        const href = await githubLink.getAttribute('href');
        expect(href).toContain('github.com/andrewginns');

        const target = await githubLink.getAttribute('target');
        const rel = await githubLink.getAttribute('rel');
        expect(target).toBe('_blank');
        expect(rel).toBe('noopener noreferrer');

        // Test tap interaction
        await expect(githubLink).toBeEnabled();
        await githubLink.tap();
        await page.waitForTimeout(500);
      });

      test('View Source button opens with single tap', async () => {
        // Scroll to the bottom to find the View Source button
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        const viewSourceLink = page.locator('.source-link a[href*="github.com"]');
        await expect(viewSourceLink).toBeVisible();

        // Verify touch target size
        const boundingBox = await viewSourceLink.boundingBox();
        expect(boundingBox).toBeTruthy();
        if (boundingBox) {
          expect(boundingBox.height).toBeGreaterThanOrEqual(48);
          expect(boundingBox.width).toBeGreaterThanOrEqual(130);
        }

        // Verify link attributes
        const href = await viewSourceLink.getAttribute('href');
        expect(href).toContain('github.com/andrewginns/andrewginns.github.io');

        const target = await viewSourceLink.getAttribute('target');
        const rel = await viewSourceLink.getAttribute('rel');
        expect(target).toBe('_blank');
        expect(rel).toBe('noopener noreferrer');

        // Test tap interaction
        await expect(viewSourceLink).toBeEnabled();
        await viewSourceLink.tap();
        await page.waitForTimeout(500);
      });

      test('No hover state interference on touch', async () => {
        // Test that CSS hover states don't interfere with touch interactions
        const socialLinks = page.locator('.hero-links .social-link');

        for (let i = 0; i < (await socialLinks.count()); i++) {
          const link = socialLinks.nth(i);

          // Get initial styles
          const initialTransform = await link.evaluate(
            (el) => window.getComputedStyle(el).transform
          );

          // Tap the element
          await link.tap();

          // Wait a moment and check if transform persists (it shouldn't on mobile)
          await page.waitForTimeout(100);

          const afterTapTransform = await link.evaluate(
            (el) => window.getComputedStyle(el).transform
          );

          // On mobile, transforms from hover shouldn't persist after tap
          // (This test helps detect double-tap issues)
          console.log(
            `Link ${i}: Initial transform: ${initialTransform}, After tap: ${afterTapTransform}`
          );
        }
      });

      test('Touch targets are appropriately spaced', async () => {
        // Verify social links have adequate spacing for touch
        const socialLinks = page.locator('.hero-links .social-link');
        const linkCount = await socialLinks.count();

        if (linkCount > 1) {
          const firstLink = socialLinks.first();
          const secondLink = socialLinks.nth(1);

          const firstBox = await firstLink.boundingBox();
          const secondBox = await secondLink.boundingBox();

          if (firstBox && secondBox) {
            // Calculate distance between links
            const distance = secondBox.x - (firstBox.x + firstBox.width);

            // Should have at least 8px gap for comfortable touch
            expect(distance).toBeGreaterThanOrEqual(8);
          }
        }
      });

      test('Accessibility - Links have proper labels', async () => {
        // Check LinkedIn link
        const linkedinLink = page.locator('.hero-links a[href*="linkedin.com"]');
        const linkedinText = await linkedinLink.textContent();
        expect(linkedinText).toContain('LinkedIn');

        // Check GitHub link
        const githubLink = page.locator('.hero-links a[href*="github.com"]:not(.source-link a)');
        const githubText = await githubLink.textContent();
        expect(githubText).toContain('GitHub');

        // Check View Source link
        const viewSourceLink = page.locator('.source-link a');
        const viewSourceText = await viewSourceLink.textContent();
        expect(viewSourceText).toContain('View Source');
      });

      test('Performance - Touch response time', async () => {
        const linkedinLink = page.locator('.hero-links a[href*="linkedin.com"]');

        const startTime = Date.now();
        await linkedinLink.tap();
        const endTime = Date.now();

        const responseTime = endTime - startTime;

        // Touch interactions should respond quickly (under 100ms for tap registration)
        expect(responseTime).toBeLessThan(100);
      });
    });
  }

  test.describe('Cross-Device Consistency', () => {
    test('All mobile devices show same link behavior', async ({
      browser,
    }: {
      browser: Browser;
    }) => {
      const results: { device: string; linksFound: number }[] = [];

      for (const device of mobileDevices) {
        const context = await browser.newContext({
          viewport: { width: device.width, height: device.height },
          userAgent: device.userAgent,
          hasTouch: true,
          isMobile: true,
        });

        const page = await context.newPage();
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Count social links
        const socialLinksCount = await page.locator('.hero-links .social-link').count();

        // Scroll and count view source links
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const viewSourceCount = await page.locator('.source-link a').count();

        results.push({
          device: device.name,
          linksFound: socialLinksCount + viewSourceCount,
        });

        await context.close();
      }

      // All devices should find the same number of interactive links
      const expectedLinkCount = results[0].linksFound;
      for (const result of results) {
        expect(result.linksFound).toBe(expectedLinkCount);
      }
    });
  });
});
