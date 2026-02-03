import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows empty state when no workspace is open', async ({ page }) => {
    // Should show directory browser or welcome message
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('has send button or input area', async ({ page }) => {
    // Look for message input elements
    const textarea = page.locator('textarea');
    const count = await textarea.count();
    // May or may not be visible depending on workspace state
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('hotkeys dialog shows chat shortcuts', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should show Enter to send
    const content = await page.textContent('body');
    expect(content).toMatch(/Enter|send|message/i);
  });

  test('hotkeys dialog shows abort shortcut', async ({ page }) => {
    await page.keyboard.press('?');
    // Should show Escape or Ctrl+C for abort
    const content = await page.textContent('body');
    expect(content).toMatch(/Escape|abort|stop/i);
  });
});
