import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Panes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('hotkeys include pane shortcuts', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Panes' })).toBeVisible();
    await expect(page.getByText('Split vertical')).toBeVisible();
    await expect(page.getByText('Split horizontal')).toBeVisible();
  });
});
