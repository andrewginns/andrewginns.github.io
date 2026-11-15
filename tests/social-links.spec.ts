import { expect, test } from '@playwright/test';

test('X profile is linked from navigation, contact, and identity metadata', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.locator('.social-links a').filter({ hasText: 'X' }),
  ).toHaveAttribute('href', 'https://x.com/andrewginns');
  const identity = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(identity.sameAs).toContain('https://x.com/andrewginns');
  await page.goto('/contact_me/');
  await expect(
    page.locator('.contact-card[href="https://x.com/andrewginns"]'),
  ).toBeVisible();
  await expect(
    page.locator('.contact-card[href="https://x.com/andrewginns"]'),
  ).toContainText('@andrewginns');
});
