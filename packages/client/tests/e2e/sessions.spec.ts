import { test, expect } from '@playwright/test';

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with session management UI', async ({ page }) => {
    // Should show "No session" or a session selector
    const content = await page.textContent('body');
    expect(content).toMatch(/session/i);
  });

  test('shows hotkeys dialog with session shortcuts', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should have session-related shortcuts
    const content = await page.textContent('body');
    expect(content).toMatch(/session|new/i);
  });

  test('hotkeys dialog mentions Ctrl+N for new session', async ({ page }) => {
    await page.keyboard.press('?');
    // Should show Ctrl+N or Cmd+N
    const content = await page.textContent('body');
    expect(content).toMatch(/Ctrl\+N|⌘N|new session/i);
  });

  test('can close hotkeys dialog with Escape', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    await page.keyboard.press('Escape');
    // Dialog should be closed
    await expect(page.getByText('Keyboard Shortcuts').first()).not.toBeVisible();
  });
});
