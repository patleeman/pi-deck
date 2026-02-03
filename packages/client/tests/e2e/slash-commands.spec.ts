import { test, expect } from '@playwright/test';

test.describe('Slash Commands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Need to have a workspace open for slash commands to work
    // For now, test that the UI elements exist
  });

  test('shows hotkeys dialog with ? key', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
  });

  test('hotkeys dialog shows slash command hint', async ({ page }) => {
    await page.keyboard.press('?');
    // Should mention slash commands
    await expect(page.getByText(/slash command/i)).toBeVisible();
  });

  test('hotkeys dialog shows / command entry', async ({ page }) => {
    await page.keyboard.press('?');
    // Should show "/" in the shortcuts
    const content = await page.textContent('body');
    expect(content).toContain('/');
  });
});
