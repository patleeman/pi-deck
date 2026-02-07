import { test, expect } from '@playwright/test';

test.describe('Questionnaire', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without questionnaire initially', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    const questionnaireDialog = page.locator('[role="dialog"]').filter({ hasText: 'option' });
    await expect(questionnaireDialog).not.toBeVisible();
  });
});
