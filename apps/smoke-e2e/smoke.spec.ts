import { test, expect } from '@playwright/test';

// No app exists yet — this only proves the Playwright harness itself
// (browser launch, page rendering, assertions) is wired up correctly.
test('playwright harness renders and asserts', async ({ page }) => {
  await page.setContent('<h1>Penny smoke test</h1>');

  await expect(page.locator('h1')).toHaveText('Penny smoke test');
});
