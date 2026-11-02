import { expect, test } from 'playwright/test';
import { HERO_TEXT, openApp, openStudio } from './helpers.ts';

test.describe('WebGL, UI and audio smoke', () => {
  test('boots the WebGL canvas, HUD and audio controls without page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await openApp(page);

    await expect(page.locator('[data-webgl-status]')).toHaveAttribute(
      'data-webgl-status',
      'available'
    );
    await expect(page.locator('canvas')).not.toHaveCount(0);
    await expect(page.locator('p', { hasText: HERO_TEXT })).toBeVisible();

    await openStudio(page);

    // HUD telemetry is on by default.
    await expect(page.getByText('settled on nodes')).toBeVisible();
    await expect(page.getByText('WebGL GPGPU')).toBeVisible();

    // Audio controls mount and toggle without throwing (headless may not
    // actually start playback, but the engine must stay alive).
    await page.getByRole('button', { name: 'Audio', exact: true }).click();
    const muteToggle = page.getByTestId('audio-toggle');
    await expect(muteToggle).toHaveText(/Muted/);
    await muteToggle.click();
    await expect(muteToggle).toHaveText(/On/);
    await expect(page.locator('div[data-audio-enabled]')).toHaveAttribute(
      'data-audio-enabled',
      'true'
    );

    await page.waitForTimeout(500);
    expect(pageErrors).toEqual([]);
  });
});
