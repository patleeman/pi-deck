import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('session shortcuts are listed in hotkeys', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Session' })).toBeVisible();
    await expect(page.getByText('Session tree navigation')).toBeVisible();
  });
});
