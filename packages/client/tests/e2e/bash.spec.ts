import { test, expect } from '@playwright/test';

const openHotkeys = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
  });
};

test.describe('Bash', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows bash command hints in hotkeys', async ({ page }) => {
    await openHotkeys(page);
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
    await expect(page.getByText('Run bash & send to LLM')).toBeVisible();
    await expect(page.getByText('Run bash (no LLM)')).toBeVisible();
  });
});
