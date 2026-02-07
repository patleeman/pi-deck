import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows hotkeys dialog with ?', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
  });

  test('hotkeys dialog shows input shortcuts', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Input' })).toBeVisible();
    await expect(page.getByText('Send message')).toBeVisible();
  });

  test('closes hotkeys dialog with Escape', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeVisible();
  });

  test('opens settings with keyboard shortcut event', async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
    });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('opens directory browser from empty state action', async ({ page }) => {
    await page.getByRole('button', { name: /Open directory/i }).click();
    await expect(page.getByRole('dialog', { name: 'Open Directory' })).toBeVisible();
  });
});
