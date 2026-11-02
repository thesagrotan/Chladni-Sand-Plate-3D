import { expect, test } from 'playwright/test';
import { openApp } from './helpers.ts';

const appRoot = (page: import('playwright/test').Page) => page.locator('div[data-paused]');

test.describe('keyboard shortcuts', () => {
  test('scatter, reset, pause, HUD and panel toggles', async ({ page }) => {
    await openApp(page);

    await page.keyboard.press('s');
    await expect(page.getByText('⚡ Sand scattered')).toBeVisible();

    await page.keyboard.press('r');
    await expect(page.getByText('↺ Settings reset to factory defaults')).toBeVisible();
    await expect(appRoot(page)).toHaveAttribute('data-paused', 'false');

    await page.keyboard.press(' ');
    await expect(appRoot(page)).toHaveAttribute('data-paused', 'true');
    await page.keyboard.press(' ');
    await expect(appRoot(page)).toHaveAttribute('data-paused', 'false');

    // Open the drawer so the HUD and panel are mounted.
    await page.keyboard.press('d');
    await expect(page.getByText('Chladni Grid Lab')).toBeVisible();
    await expect(page.getByText('settled on nodes')).toBeVisible();

    await page.keyboard.press('h');
    await expect(page.getByText('settled on nodes')).toHaveCount(0);
    await page.keyboard.press('h');
    await expect(page.getByText('settled on nodes')).toBeVisible();

    await page.keyboard.press('d');
    await expect(page.getByText('Chladni Grid Lab')).toHaveCount(0);
  });

  test('W opens the benchmark lab and M toggles audio', async ({ page }) => {
    await openApp(page);

    await page.keyboard.press('w');
    await expect(
      page.getByRole('heading', { name: /WebAssembly Performance Research/ })
    ).toBeVisible();

    await page.keyboard.press('w');
    await expect(
      page.getByRole('heading', { name: /WebAssembly Performance Research/ })
    ).toHaveCount(0);

    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'false'
    );
    await page.keyboard.press('m');
    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'true'
    );
  });

  test('G randomizes the grid', async ({ page }) => {
    await openApp(page);

    const initial = await appRoot(page).getAttribute('data-grid-type');
    let changed = false;

    // Randomization can pick the current grid; retry so the test only proves
    // that the shortcut is wired, not that Math.random cooperates.
    for (let attempt = 0; attempt < 4 && !changed; attempt++) {
      await page.keyboard.press('g');
      await page.waitForTimeout(100);
      changed = (await appRoot(page).getAttribute('data-grid-type')) !== initial;
    }

    expect(changed).toBe(true);
  });
});
