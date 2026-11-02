import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';
import { openApp, openStudio } from './helpers.ts';

const appRoot = (page: Page) => page.locator('div[data-paused]');
const versionHistory = (page: Page) => page.getByTestId('version-history');

test.describe('studio panels', () => {
  test('applies a curated preset', async ({ page }) => {
    await openApp(page);
    await openStudio(page);

    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    await page.getByRole('button', { name: /Curated Grid Presets/ }).click();
    await page.getByRole('button', { name: /Empty Core Annulus/ }).click();

    await expect(appRoot(page)).toHaveAttribute('data-grid-type', 'annular');

    // Auto-save persists the applied preset.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('chladni_plate_saved_settings');
          return raw ? (JSON.parse(raw) as { gridType?: string }).gridType : null;
        })
      )
      .toBe('annular');
  });

  test('uploads a local font and selects it', async ({ page }) => {
    await openApp(page);
    await openStudio(page);

    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles(path.join(process.cwd(), 'public/fonts/GT-Pressura-Standard-Regular.woff2'));

    await expect(appRoot(page)).toHaveAttribute(
      'data-font-family',
      'GT-Pressura-Standard-Regular'
    );
    await expect(page.locator('select')).toHaveValue('GT-Pressura-Standard-Regular');
    await expect(
      page.locator('select option[value="GT-Pressura-Standard-Regular"]')
    ).toContainText('Custom WOFF2');
  });

  test('saves, restores and deletes a named version', async ({ page }) => {
    await openApp(page);
    await openStudio(page);

    await page.getByTitle('Toggle version history').click();
    const history = versionHistory(page);
    await expect(history).toBeVisible();

    const label = 'E2E snapshot';
    await history.getByPlaceholder('Version name (optional)…').fill(label);
    await history.getByPlaceholder('Version name (optional)…').press('Enter');
    await expect(history.getByText(label, { exact: true })).toBeVisible();

    const savedGrid = await appRoot(page).getAttribute('data-grid-type');
    expect(savedGrid).toBeTruthy();

    // Change the grid, then restore the snapshot.
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.getByRole('button', { name: 'Diamond', exact: true }).click();
    await expect(appRoot(page)).toHaveAttribute('data-grid-type', 'diamond');

    await page.getByTitle(`Restore ${label}`).click();
    await expect(appRoot(page)).toHaveAttribute('data-grid-type', savedGrid!);

    await page.getByTitle(`Delete ${label}`).click();
    await expect(history.getByText(label, { exact: true })).toHaveCount(0);
  });
});
