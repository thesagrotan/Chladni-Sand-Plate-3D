import { expect, type Page } from 'playwright/test';

export const HERO_TEXT = 'TEZETT PLATTE is a Berlin label and recording studio';

/** Navigates to the app and waits for the WebGL renderer to mount. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('[data-webgl-status]')).toHaveAttribute(
    'data-webgl-status',
    'available'
  );
  await expect(page.locator('p', { hasText: HERO_TEXT })).toBeVisible();
}

/** Opens the Studio drawer with its keyboard shortcut. */
export async function openStudio(page: Page) {
  await page.keyboard.press('d');
  await expect(page.getByText('Chladni Grid Lab')).toBeVisible();
}
