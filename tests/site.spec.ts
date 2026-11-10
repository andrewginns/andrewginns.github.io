import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/about_me/',
  '/experience/',
  '/projects_github/',
  '/writing/',
  '/merbench/',
  '/contact_me/',
];

for (const width of [375, 1440]) {
  test(`pages render and fit the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /\S.{30,}/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://andrew.ginns.uk${route}`,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route,
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('mobile navigation works with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const menu = page.locator('summary').filter({ hasText: 'Menu' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details[open]')).toBeVisible();
  const about = page
    .locator('details[open]')
    .getByRole('link', { name: 'About', exact: true });
  await expect(about).toBeVisible();
  await about.click();
  await expect(page).toHaveURL(/\/about_me\/?$/);
});

test('theme preference persists across navigation and reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Dark mode', exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.goto('/about_me/');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('reduced motion does not run decorative animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const movingAnimations = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return (
          animation.playState === 'running' && Number(timing?.duration ?? 0) > 1
        );
      }).length,
  );
  expect(movingAnimations).toBe(0);
});

test('profile and navigation remain useful without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('details[open]')).toBeVisible();
  await page
    .locator('details[open]')
    .getByRole('link', { name: 'About', exact: true })
    .click();
  await expect(page).toHaveURL(/\/about_me\/?$/);
  await expect(page.locator('main h1')).toContainText(/About/i);
  await context.close();
});

test('floating interest links respond to hover and scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const topic = page.locator('.floating-topic').first();
  await expect(topic).toBeVisible();
  await expect(topic).toHaveAttribute('href', /^https:\/\/github\.com\//);
  const initialPosition = await topic.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.evaluate(() => scrollTo(0, 400));
  await expect
    .poll(() =>
      topic.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(initialPosition);
  const label = topic.locator('span');
  const initialLabel = await label.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await topic.hover();
  await expect
    .poll(() =>
      label.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(initialLabel);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(topic).toHaveCSS('transform', 'none');
  await expect(label).toHaveCSS('transform', 'none');
});
