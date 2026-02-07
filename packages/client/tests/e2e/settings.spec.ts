import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  const openSettings = async (page: import('@playwright/test').Page) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  };

  test('opens settings dialog', async ({ page }) => {
    await openSettings(page);
  });

  test('closes settings with Escape', async ({ page }) => {
    await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
  });

  test('closes settings by clicking backdrop', async ({ page }) => {
    await openSettings(page);
    await page.mouse.click(5, 5);
    await expect(page.getByRole('heading', { name: 'Settings' })).not.toBeVisible();
  });

  test('shows expected sections', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Developer' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Allowed Directories' })).toBeVisible();
  });

  test('shows rebuild button in Developer section', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole('button', { name: /Rebuild & Restart Server/i })).toBeVisible();
  });
});
