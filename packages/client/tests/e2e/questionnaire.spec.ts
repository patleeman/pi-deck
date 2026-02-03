import { test, expect } from '@playwright/test';

test.describe('Questionnaire', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without questionnaire initially', async ({ page }) => {
    // Questionnaire dialogs only appear when the agent asks a question
    // Verify the page loads without one showing
    await expect(page.locator('body')).toBeVisible();
    
    // Should not show questionnaire dialog initially
    const questionnaireDialog = page.locator('[role="dialog"]').filter({ hasText: 'option' });
    await expect(questionnaireDialog).not.toBeVisible();
  });

  test('hotkeys dialog visible with ? key', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
  });
});
