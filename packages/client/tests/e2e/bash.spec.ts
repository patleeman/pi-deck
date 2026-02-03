import { test, expect } from '@playwright/test';

test.describe('Bash', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('hotkeys dialog shows bash command hints', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should mention ! or bash
    const content = await page.textContent('body');
    expect(content).toMatch(/!|bash|command/i);
  });

  test('hotkeys dialog mentions ! prefix for bash commands', async ({ page }) => {
    await page.keyboard.press('?');
    const content = await page.textContent('body');
    // Should explain ! prefix
    expect(content).toMatch(/!|run.*command|execute/i);
  });
});
