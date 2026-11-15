import { expect, test } from '@playwright/test';

test('current professional title is consistent across pages and metadata', async ({
  page,
}) => {
  for (const path of ['/', '/about_me/', '/contact_me/', '/experience/']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText('Applied AI Engineer');
    await expect(page.locator('body')).not.toContainText('Deployment Engineer');
  }
  await page.goto('/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Applied AI Engineer at OpenAI/,
  );

  await expect(page).toHaveTitle(/Applied AI Engineer at OpenAI/);
  await expect(page.locator('main')).toContainText(
    "I'm an Applied AI Engineer at OpenAI",
  );
  const metadata = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(metadata.join('')).toContain('Applied AI Engineer');
});
