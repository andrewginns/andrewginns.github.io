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

for (const width of [320, 375, 1440]) {
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

test('mobile navigation works with the keyboard, sticky bar, active context, and Escape return', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const header = page.locator('header.sidebar');
  const brand = header.locator('.site-title');
  const menu = header.locator('summary').filter({ hasText: 'Menu' });
  const themeToggle = page.getByRole('switch', { name: 'Dark mode' });

  await expect(header).toHaveCSS('position', 'sticky');
  const [headerBox, brandBox, menuBox, themeBox] = await Promise.all([
    header.boundingBox(),
    brand.boundingBox(),
    menu.boundingBox(),
    themeToggle.boundingBox(),
  ]);
  expect(headerBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(themeBox).not.toBeNull();
  // Compact single row: header is concise and all three controls share one row.
  expect(headerBox!.height).toBeLessThanOrEqual(72);
  expect(
    Math.abs(
      brandBox!.y + brandBox!.height / 2 - (menuBox!.y + menuBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(8);
  expect(
    Math.abs(
      themeBox!.y + themeBox!.height / 2 - (menuBox!.y + menuBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(8);

  await expect(menu).toContainText('Home');
  await expect(page.locator('details.navigation')).not.toHaveAttribute(
    'open',
    '',
  );

  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details[open]')).toBeVisible();
  await expect(page.locator('details[open] a[aria-current="page"]')).toHaveText(
    'Home',
  );

  const about = page
    .locator('details[open]')
    .getByRole('link', { name: 'About', exact: true });
  await expect(about).toBeVisible();
  await about.focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('details.navigation')).not.toHaveAttribute(
    'open',
    '',
  );
  await expect(menu).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(about).toBeVisible();
  await about.click();
  await expect(page).toHaveURL(/\/about_me\/?$/);
  await expect(menu).toContainText('About');
});

test('navigation switches at the 1024px breakpoint and keeps tablet hero horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1023, height: 800 });
  await page.goto('/');

  const summary = page.locator('header.sidebar summary');
  const details = page.locator('details.navigation');
  await expect(summary).toBeVisible();
  await expect(details).not.toHaveAttribute('open', '');
  await expect(page.locator('header.sidebar')).toHaveCSS('position', 'sticky');

  // Tablet hero stays horizontal when there is room.
  const imageBox = await page.locator('.hero-image').boundingBox();
  const copyBox = await page.locator('.hero-copy').boundingBox();
  expect(imageBox).not.toBeNull();
  expect(copyBox).not.toBeNull();
  expect(copyBox!.x).toBeGreaterThan(imageBox!.x + imageBox!.width - 4);

  // Selected work sits immediately below the hero, before "What I do".
  const sectionIds = await page
    .locator('main > section')
    .evaluateAll((sections) =>
      sections.map((section) => section.getAttribute('aria-labelledby')),
    );
  expect(sectionIds.slice(0, 2)).toEqual(['selected-work', 'what-i-do']);

  // At 1024px desktop navigation takes over.
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(summary).toBeHidden();
  await expect(details).toHaveAttribute('open', '');
  await expect(page.locator('header.sidebar')).toHaveCSS('position', 'fixed');
});

test('short screens constrain open menu and phones keep hero compact with scroll offset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto('/');

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const menu = page.locator('summary').filter({ hasText: 'Menu' });
  await menu.click();
  const nav = page.locator('details[open] > nav');
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(421);
  await expect(nav).toHaveCSS('overflow-y', 'auto');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();

  // Compact phone portrait and CSS scroll offset for sticky navigation & anchors.
  const heroImageBox = await page.locator('.hero-image').boundingBox();
  expect(heroImageBox).not.toBeNull();
  expect(heroImageBox!.height).toBeLessThanOrEqual(120);

  const offsets = await page.evaluate(() => {
    const htmlStyle = getComputedStyle(document.documentElement);
    const headerHeight =
      document.querySelector('header.sidebar')?.getBoundingClientRect()
        .height ?? 0;
    return {
      scrollPaddingTop: parseFloat(htmlStyle.scrollPaddingTop),
      headerHeight,
    };
  });
  expect(offsets.scrollPaddingTop).toBeGreaterThanOrEqual(offsets.headerHeight);
  await page.evaluate(() => {
    location.hash = 'selected-work';
  });
  const selectedWorkTop = await page
    .locator('#selected-work')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(selectedWorkTop).toBeGreaterThanOrEqual(offsets.headerHeight);
  expect(selectedWorkTop).toBeLessThanOrEqual(offsets.scrollPaddingTop + 1);

  // Skip-link focus remains reachable and focuses main content.
  const skipLink = page.locator('.skip-link');
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('mobile theme button toggles the icon and shares its preference with desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  const select = page.getByRole('combobox', { name: 'Color theme' });
  const sun = toggle.locator('.theme-sun');
  const moon = toggle.locator('.theme-moon');
  await expect(select).toBeHidden();
  await expect(toggle).not.toBeChecked();
  await expect(sun).toBeVisible();
  await expect(moon).toBeHidden();

  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(moon).toBeVisible();
  await expect(sun).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/about_me/');
  await expect(toggle).toBeChecked();

  await toggle.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(sun).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(toggle).toBeHidden();
  await expect(select).toHaveValue('light');
});

test('theme preference persists across navigation and reload', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const select = page.getByRole('combobox', {
    name: 'Color theme',
    exact: true,
  });
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveText([
    'System',
    'Light',
    'Dark',
  ]);
  await expect(select).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await select.selectOption('dark');
  await expect(select).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    'content',
    'dark',
  );
  await page.goto('/about_me/');
  await expect(select).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(select).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await select.selectOption('light');
  await expect(select).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    'content',
    'light',
  );
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
    'light',
  );

  await select.selectOption('system');
  await expect(select).toHaveValue('system');
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
    'content',
    'light dark',
  );
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
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

test('theme returns to the system while explicit overrides survive OS changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const select = page.getByRole('combobox', {
    name: 'Color theme',
    exact: true,
  });

  await select.selectOption('dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('theme')))
    .toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(select).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await select.selectOption('system');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(select).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await select.selectOption('light');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('theme')))
    .toBe('light');
});

test('theme changes dispatch theme-changed and sync across tabs via storage events', async ({
  context,
}) => {
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  await pageA.emulateMedia({ colorScheme: 'light' });
  await pageB.emulateMedia({ colorScheme: 'light' });
  await pageA.goto('/');
  await pageB.goto('/about_me/');

  await pageB.evaluate(() => {
    const win = window as Window & { __themeEvents?: number };
    win.__themeEvents = 0;
    window.addEventListener('theme-changed', () => {
      win.__themeEvents = (win.__themeEvents ?? 0) + 1;
    });
  });

  const selectA = pageA.getByRole('combobox', {
    name: 'Color theme',
    exact: true,
  });
  const selectB = pageB.getByRole('combobox', {
    name: 'Color theme',
    exact: true,
  });

  await selectA.selectOption('dark');
  await expect(selectB).toHaveValue('dark');
  await expect(pageB.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await pageB.evaluate(
      () => (window as Window & { __themeEvents?: number }).__themeEvents,
    ),
  ).toBeGreaterThanOrEqual(1);

  await selectA.selectOption('system');
  await expect(selectB).toHaveValue('system');
  await expect(pageB.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await pageB.evaluate(
      () => (window as Window & { __themeEvents?: number }).__themeEvents,
    ),
  ).toBeGreaterThanOrEqual(2);

  await pageA.close();
  await pageB.close();
});

test('system dark theme works without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: 'dark',
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(13, 19, 28)',
  );
  await expect(
    page.getByRole('combobox', { name: 'Color theme' }),
  ).not.toBeVisible();
  await context.close();
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

test('floating interest links stay stationary on scroll while responding to hover', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const topic = page.locator('.floating-topic').first();
  await expect(topic).toBeVisible();
  await expect(topic).toHaveAttribute('href', /^https:\/\/github\.com\//);
  const initialTransform = await topic.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const initialBox = await topic.boundingBox();
  expect(initialBox).not.toBeNull();
  await page.evaluate(async () => {
    scrollTo(0, 400);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await expect(topic).toHaveCSS('transform', initialTransform);
  const scrolledBox = await topic.boundingBox();
  expect(scrolledBox).not.toBeNull();
  expect(Math.abs(scrolledBox!.y - initialBox!.y)).toBeLessThanOrEqual(1);

  await topic.hover();
  await expect(topic).not.toHaveCSS('transform', initialTransform);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(topic).toHaveCSS('transform', 'none');
  await expect(topic.locator('.topic-arrow')).toHaveCSS('transform', 'none');
});
