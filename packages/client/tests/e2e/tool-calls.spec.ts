import { test, expect } from '@playwright/test';

test.describe('Tool Calls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('hotkeys dialog shows tool-related shortcuts', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should mention tools or collapse
    const content = await page.textContent('body');
    expect(content).toMatch(/tool|collapse|expand/i);
  });

  test('hotkeys dialog shows Ctrl+[ for collapse tools', async ({ page }) => {
    await page.keyboard.press('?');
    const content = await page.textContent('body');
    // Should show tool collapse shortcut
    expect(content).toMatch(/Ctrl\+\[|⌘\[|collapse.*tool/i);
  });
});
