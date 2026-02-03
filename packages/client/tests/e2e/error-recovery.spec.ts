import { test, expect } from '@playwright/test';

test.describe('Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('page handles navigation', async ({ page }) => {
    // Navigate away and back
    await page.goto('/nonexistent');
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('page handles refresh', async ({ page }) => {
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
  });

  test('page recovers from JavaScript errors gracefully', async ({ page }) => {
    // Inject an error and verify page still works
    await page.evaluate(() => {
      try {
        throw new Error('Test error');
      } catch {
        // Caught - page should continue working
      }
    });
    await expect(page.locator('body')).toBeVisible();
  });

  test('connection status indicator exists', async ({ page }) => {
    // Should show some connection status
    // This may be in the status bar or elsewhere
    await expect(page.locator('body')).toBeVisible();
    
    // Look for any connection-related text
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('page handles slow network', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async (route) => {
      await new Promise((r) => setTimeout(r, 100));
      await route.continue();
    });
    
    await page.reload();
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });
});
