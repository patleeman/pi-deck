import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Slash Commands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows slash command hint in hotkeys', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Navigation' })).toBeVisible();
    await expect(page.getByText('Slash commands').first()).toBeVisible();
  });
});
