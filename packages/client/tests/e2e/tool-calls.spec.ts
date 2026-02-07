import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Tool Calls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hotkeys include tool and thinking collapse actions', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Display' })).toBeVisible();
    await expect(page.getByText('Collapse/expand all tools')).toBeVisible();
    await expect(page.getByText('Collapse/expand all thinking')).toBeVisible();
  });
});
