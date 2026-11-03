import path from 'node:path';
import { expect, test, type Page } from 'playwright/test';
import { openApp, openStudio } from './helpers.ts';

const appRoot = (page: Page) => page.locator('div[data-paused]');
const versionHistory = (page: Page) => page.getByTestId('version-history');
const savedSand = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('chladni_plate_saved_settings');
    return raw ? (JSON.parse(raw) as { sandColor?: string }).sandColor ?? null : null;
  });

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

  test('picks a center void shape from the dropdown', async ({ page }) => {
    await openApp(page);
    await openStudio(page);

    const trigger = page.getByTestId('void-shape-select');
    await expect(trigger).toContainText('Circle');

    await trigger.click();
    await expect(page.getByTestId('void-shape-select-listbox')).toBeVisible();
    // The popup's entrance animation settles at full opacity.
    await expect
      .poll(() =>
        page
          .getByTestId('void-shape-select-listbox')
          .evaluate((element) => getComputedStyle(element).opacity)
      )
      .toBe('1');
    await page.getByRole('option', { name: /Square/ }).click();

    await expect(trigger).toContainText('Square');
    await expect(page.getByTestId('void-shape-select-listbox')).toHaveCount(0);

    // The choice is committed to params, so auto-save persists it.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('chladni_plate_saved_settings');
          return raw ? (JSON.parse(raw) as { centerVoidShape?: string }).centerVoidShape : null;
        })
      )
      .toBe('square');

    // Reopening marks the current value as selected.
    await trigger.click();
    await expect(page.getByRole('option', { name: /Square/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByRole('option', { name: /Circle/ }).click();
    await expect(trigger).toContainText('Circle');
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
    await expect(page.getByTestId('font-family-select')).toHaveValue(
      'GT-Pressura-Standard-Regular'
    );
    await expect(
      page.locator('select option[value="GT-Pressura-Standard-Regular"]')
    ).toContainText('Custom WOFF2');
  });

  test('release themes are off by default', async ({ page }) => {
    await openApp(page);
    await openStudio(page);
    await page.getByRole('button', { name: 'Style', exact: true }).click();

    const toggle = page.getByTestId('release-themes-toggle');
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId('theme-release-select')).toBeDisabled();

    // Play a release; with the option off the palette must not change.
    await page.keyboard.press('d');
    await page.getByTestId('play-release-tz-01').click();
    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'true'
    );

    await expect.poll(() => savedSand(page)).toBe('#f7f5f0');
    await expect(page.getByTestId('release-theme-tz-01')).toHaveCount(0);
  });

  test('edits a color theme and applies it when its release plays', async ({ page }) => {
    await openApp(page);
    await openStudio(page);

    await page.getByRole('button', { name: 'Style', exact: true }).click();

    // Opt in to release themes.
    await page.getByTestId('release-themes-toggle').check();
    await expect(page.getByTestId('theme-release-select')).toBeEnabled();

    // Edit the theme that is bound to TZ-01.
    await page.getByTestId('theme-row-golden_sand').click();
    await page.getByTestId('theme-color-sandPrimary').evaluate((element) => {
      const input = element as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, '#ff0000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem('chladni_color_themes');
          const themes = raw ? (JSON.parse(raw) as { id: string; sandPrimary: string }[]) : [];
          return themes.find((theme) => theme.id === 'golden_sand')?.sandPrimary ?? null;
        })
      )
      .toBe('#ff0000');

    // Move to a different theme, then let the release re-apply its own theme.
    await page.getByTestId('theme-row-silica').click();
    await expect.poll(() => savedSand(page)).toBe('#f7f5f0');

    await page.keyboard.press('d');

    const paletteBeforePlay = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sand-color').trim()
    );

    // Sample the rendered palette each frame to prove the change is gradual.
    await page.evaluate(() => {
      const w = window as unknown as { __paletteSamples?: string[] };
      w.__paletteSamples = [];
      const read = () => {
        w.__paletteSamples!.push(
          getComputedStyle(document.documentElement)
            .getPropertyValue('--sand-color')
            .trim()
        );
        if (w.__paletteSamples!.length < 240) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });

    await page.getByTestId('play-release-tz-01').click();

    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'true'
    );
    await expect.poll(() => savedSand(page)).toBe('#ff0000');

    // The palette eased through colors that are neither the palette before
    // playback nor the theme it settles on (a snap would only ever show those).
    await expect
      .poll(
        async () => {
          const samples = await page.evaluate(
            () => (window as unknown as { __paletteSamples?: string[] }).__paletteSamples ?? []
          );
          const settled = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue('--sand-color')
              .trim()
          );
          return samples.filter(
            (value) => value && value !== paletteBeforePlay && value !== settled
          ).length;
        },
        { timeout: 5000 }
      )
      .toBeGreaterThan(0);

    // Stopping playback restores the palette that was active before it started.
    await page.getByTestId('play-release-tz-01').click();
    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'false'
    );
    await expect.poll(() => savedSand(page)).toBe('#f7f5f0');
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
