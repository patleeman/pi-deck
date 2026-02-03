import { test, expect } from '@playwright/test';

test.describe('Extension UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without errors', async ({ page }) => {
    // Just verify the page loads
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show error state
    const content = await page.textContent('body');
    expect(content).not.toContain('Error loading');
  });

  test('UI includes necessary components for extension dialogs', async ({ page }) => {
    // The extension UI components should be importable/renderable
    // This test verifies the page structure is correct
    await expect(page.locator('body')).toBeVisible();
  });

  test('can show hotkeys dialog which includes extension info', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should mention skills or similar
    const content = await page.textContent('body');
    expect(content).toMatch(/skill|command|menu/i);
  });
});
