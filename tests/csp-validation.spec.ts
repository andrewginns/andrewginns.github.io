import { test, expect } from '@playwright/test';
import { CSPTestServer } from '../scripts/csp-test-server.js';

let cspServer: CSPTestServer;

test.describe('CSP Validation Tests', () => {
  let cspViolations: any[] = [];
  let consoleErrors: string[] = [];

  test.beforeAll(async () => {
    // Start CSP test server with strict policies
    cspServer = new CSPTestServer();
    await cspServer.start();
  });

  test.afterAll(async () => {
    // Stop CSP test server
    if (cspServer) {
      await cspServer.stop();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Reset violation tracking
    cspViolations = [];
    consoleErrors = [];

    // Listen for CSP violations
    page.on('response', async (response) => {
      if (response.url().includes('/csp-violation-report')) {
        try {
          const body = await response.text();
          if (body) {
            cspViolations.push(JSON.parse(body));
          }
        } catch (e) {
          // Ignore JSON parse errors for empty bodies
        }
      }
    });

    // Listen for console errors that might indicate CSP issues
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);

        // Log CSP-related errors immediately
        if (text.includes('Content Security Policy') || text.includes('CSP')) {
          console.log('🚨 CSP Console Error:', text);
        }
      }
    });
  });

  test('homepage should load without CSP violations', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();

    await page.goto(baseUrl);
    await expect(page).toHaveTitle(/Andrew Ginns/);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check for CSP violations
    expect(cspViolations).toHaveLength(0);

    // Check for CSP-related console errors
    const cspErrors = consoleErrors.filter(
      (error) =>
        error.includes('Content Security Policy') ||
        error.includes('CSP') ||
        error.includes('unsafe-inline') ||
        error.includes('unsafe-eval')
    );

    if (cspErrors.length > 0) {
      console.log('CSP-related console errors:', cspErrors);
    }

    expect(cspErrors).toHaveLength(0);
  });

  test('mobile header functionality should work under strict CSP', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Test mobile header auto-hide functionality
    const header = page.locator('#mobile-header');
    await expect(header).toBeVisible();

    // Scroll down to trigger hide
    await page.evaluate(() => {
      window.scrollTo({ top: 250, behavior: 'instant' });
    });
    await page.waitForTimeout(300);

    // Check if header hiding works (our mobile header script should function)
    const isHidden = await header.evaluate((el) => el.classList.contains('header-hidden'));

    // If this passes, it means our external TypeScript script is working under strict CSP
    expect(isHidden).toBe(true);

    // Verify no CSP violations occurred during interaction
    expect(cspViolations).toHaveLength(0);
  });

  test('all main pages should load without CSP violations', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();
    const pages = ['/', '/about_me', '/experience', '/projects_github', '/writing'];

    for (const pagePath of pages) {
      // Reset violations for each page
      cspViolations = [];
      consoleErrors = [];

      await page.goto(`${baseUrl}${pagePath}`);
      await page.waitForLoadState('networkidle');

      // Wait a bit for any delayed scripts to execute
      await page.waitForTimeout(500);

      // Check for CSP violations on this page
      if (cspViolations.length > 0) {
        console.log(`CSP violations on ${pagePath}:`, cspViolations);
      }
      expect(cspViolations).toHaveLength(0);

      // Check for CSP-related console errors
      const cspErrors = consoleErrors.filter(
        (error) =>
          error.includes('Content Security Policy') ||
          error.includes('CSP') ||
          error.includes('unsafe-inline') ||
          error.includes('unsafe-eval')
      );

      if (cspErrors.length > 0) {
        console.log(`CSP errors on ${pagePath}:`, cspErrors);
      }
      expect(cspErrors).toHaveLength(0);
    }
  });

  test('merbench page should work under strict CSP', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();

    await page.goto(`${baseUrl}/merbench`);
    await page.waitForLoadState('networkidle');

    // Wait for charts to load (they use external Plotly.js)
    await page.waitForTimeout(2000);

    // Check that charts are rendered (this validates external script loading works)
    const charts = page.locator('.js-plotly-plot');
    await expect(charts.first()).toBeVisible({ timeout: 10000 });

    // Verify no CSP violations from chart rendering
    expect(cspViolations).toHaveLength(0);

    // Check for CSP-related errors in console
    const cspErrors = consoleErrors.filter(
      (error) =>
        error.includes('Content Security Policy') ||
        error.includes('CSP') ||
        error.includes('unsafe-inline') ||
        error.includes('unsafe-eval')
    );

    expect(cspErrors).toHaveLength(0);
  });

  test('theme toggle should work under strict CSP', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Test theme toggle functionality
    const themeToggle = page.locator('#theme-toggle-sidebar');
    await expect(themeToggle).toBeVisible();

    // Click theme toggle
    await themeToggle.click();
    await page.waitForTimeout(300);

    // Check if dark theme was applied (validates theme toggle script works)
    const isDarkMode = await page.evaluate(
      () => document.documentElement.getAttribute('data-theme') === 'dark'
    );

    expect(isDarkMode).toBe(true);

    // Verify no CSP violations from theme toggle
    expect(cspViolations).toHaveLength(0);
  });

  test('should report CSP policy details', async ({ page }) => {
    const baseUrl = cspServer.getBaseUrl();

    await page.goto(baseUrl);

    // Get CSP header value to verify strict policy is applied
    const response = await page.goto(baseUrl);
    const cspHeader = response?.headers()['content-security-policy'];

    expect(cspHeader).toBeDefined();
    expect(cspHeader).not.toContain('unsafe-inline');
    expect(cspHeader).toContain('sha256-');

    console.log('✅ Strict CSP Policy Applied:', cspHeader?.substring(0, 100) + '...');
  });
});
