import { test, expect } from '@playwright/test';

test.describe('Models', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with model indicator', async ({ page }) => {
    // Should show model info or "No model"
    const content = await page.textContent('body');
    expect(content).toMatch(/model/i);
  });

  test('shows hotkeys dialog with model shortcuts', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    
    // Should have model-related shortcuts
    const content = await page.textContent('body');
    expect(content).toMatch(/model|thinking/i);
  });

  test('hotkeys dialog mentions Ctrl+P for model cycling', async ({ page }) => {
    await page.keyboard.press('?');
    // Should show Ctrl+P or Cmd+P
    const content = await page.textContent('body');
    expect(content).toMatch(/Ctrl\+P|⌘P|cycle/i);
  });

  test('hotkeys dialog mentions Ctrl+T for thinking level', async ({ page }) => {
    await page.keyboard.press('?');
    // Should show Ctrl+T or Cmd+T
    const content = await page.textContent('body');
    expect(content).toMatch(/Ctrl\+T|⌘T|thinking/i);
  });
});
