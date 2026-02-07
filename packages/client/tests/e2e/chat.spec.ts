import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows key chat shortcuts in hotkeys', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByText('Send message')).toBeVisible();
    await expect(page.getByText('Abort agent / clear input')).toBeVisible();
  });
});
