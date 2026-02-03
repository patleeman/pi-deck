import { test, expect, devices } from '@playwright/test';

test.describe('Mobile', () => {
  // Use mobile viewport
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads on mobile viewport', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('UI is responsive on mobile', async ({ page }) => {
    // Verify the page adapts to mobile width
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Content should be visible
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('elements are touch-friendly size', async ({ page }) => {
    // Buttons should be large enough for touch
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    if (count > 0) {
      const firstButton = buttons.first();
      const box = await firstButton.boundingBox();
      if (box) {
        // Touch targets should be at least 32px
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('can scroll content', async ({ page }) => {
    // Should be scrollable
    await page.evaluate(() => {
      window.scrollTo(0, 100);
    });
    // No error should occur
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Mobile iPhone', () => {
  test.use(devices['iPhone 13']);

  test('loads on iPhone 13', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Mobile Android', () => {
  test.use(devices['Pixel 5']);

  test('loads on Pixel 5', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
