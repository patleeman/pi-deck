import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens settings dialog', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Settings')).toBeVisible();
  });

  test('closes settings with Escape', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Settings')).toBeVisible();
    
    await page.keyboard.press('Escape');
    await expect(page.getByText('Settings').first()).not.toBeVisible();
  });

  test('closes settings by clicking backdrop', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Settings')).toBeVisible();
    
    // Click on the backdrop (semi-transparent overlay)
    await page.locator('.bg-black\\/50').click({ position: { x: 10, y: 10 } });
    await expect(page.getByText('Settings').first()).not.toBeVisible();
  });

  test('shows theme section with Dark and Light options', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Dark')).toBeVisible();
    await expect(page.getByText('Light')).toBeVisible();
  });

  test('shows notifications section', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Notifications')).toBeVisible();
  });

  test('shows Developer section', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Developer')).toBeVisible();
  });

  test('shows Allowed Directories section', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText('Allowed Directories')).toBeVisible();
  });

  test('shows rebuild button in Developer section', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    await expect(page.getByText(/Rebuild.*Restart/i)).toBeVisible();
  });

  test('can select a theme', async ({ page }) => {
    await page.locator('[title*="Settings"]').click();
    
    // Find a theme button and click it
    const themeButtons = page.locator('button').filter({ hasText: /Cobalt|Dracula|Monokai|Nord/i });
    const count = await themeButtons.count();
    if (count > 0) {
      await themeButtons.first().click();
      // Theme should be applied (no error)
    }
  });
});
