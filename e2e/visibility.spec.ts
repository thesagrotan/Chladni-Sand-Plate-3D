import { expect, test } from 'playwright/test';
import { openApp } from './helpers.ts';

test.describe('tab visibility', () => {
  test('scatters the sand when the tab becomes visible again', async ({ page }) => {
    await openApp(page);

    // Playwright keeps the page visible, so dispatch the same event the
    // browser fires when the user comes back to the tab.
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.getByText('⚡ Sand scattered')).toBeVisible();
  });
});
