import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Models', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows model shortcuts in hotkeys', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Models & Thinking' })).toBeVisible();
    await expect(page.getByText('Next model')).toBeVisible();
    await expect(page.getByText('Cycle thinking level')).toBeVisible();
  });
});
