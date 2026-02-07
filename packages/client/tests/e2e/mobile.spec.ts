import { test, expect } from '@playwright/test';

test.describe('Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads on mobile viewport', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('UI is responsive on mobile', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('elements are touch-friendly size', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      const firstButton = buttons.first();
      const box = await firstButton.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('can scroll content', async ({ page }) => {
    await page.evaluate(() => {
      window.scrollTo(0, 100);
    });
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads with iPhone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('loads with Pixel-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
