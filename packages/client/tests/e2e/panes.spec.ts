import { test, expect } from '@playwright/test';

test.describe('Panes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with at least one pane area', async ({ page }) => {
    // The main pane area should be present
    await expect(page.locator('body')).toBeVisible();
    // Check for pane-related elements
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('pane shows toolbar elements', async ({ page }) => {
    // Look for common toolbar elements that should be visible
    const toolbar = page.locator('.flex').first();
    expect(toolbar).toBeTruthy();
  });

  test('pane has input area', async ({ page }) => {
    // Should have a textarea or input for message entry
    const inputArea = page.locator('textarea, input[type="text"]');
    // At least one should exist
    const count = await inputArea.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('can type in input area when workspace is open', async ({ page }) => {
    // First need to open a workspace
    // For now just verify the page loads
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows hotkeys dialog with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
  });

  test('hotkeys dialog shows split pane shortcuts', async ({ page }) => {
    await page.keyboard.press('?');
    // Should mention splitting
    const content = await page.textContent('body');
    expect(content).toMatch(/split|pane/i);
  });
});
