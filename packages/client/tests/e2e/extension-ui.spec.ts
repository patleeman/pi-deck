import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Extension UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without errors', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const content = (await page.textContent('body')) || '';
    expect(content).not.toContain('Error loading');
  });

  test('hotkeys dialog is available', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
  });
});
