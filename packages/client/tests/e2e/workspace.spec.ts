import { test, expect } from '@playwright/test';

test.describe('Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows empty state when no workspace is open', async ({ page }) => {
    await expect(page.getByText('No workspace open')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open directory/i })).toBeVisible();
  });

  test('opens and closes directory browser', async ({ page }) => {
    await page.getByRole('button', { name: /Open directory/i }).click();
    await expect(page.getByRole('dialog', { name: 'Open Directory' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Open Directory' })).not.toBeVisible();
  });

  test('shows settings button and opens settings dialog', async ({ page }) => {
    const settingsButton = page.locator('[title*="Settings"]');
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
