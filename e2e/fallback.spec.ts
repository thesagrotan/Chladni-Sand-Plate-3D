import { chromium, expect, test } from 'playwright/test';
import { HERO_TEXT } from './helpers.ts';

test('keeps the DOM site usable when WebGL is unavailable', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Deterministically remove WebGL before any app script runs. Chromium's
  // --disable-webgl flag still leaves the SwiftShader fallback available.
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return null;
      }
      return (original as (...rest: unknown[]) => unknown).call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(`http://127.0.0.1:${process.env.E2E_PORT || 3002}/`);
  await expect(page.locator('[data-webgl-status]')).toHaveAttribute(
    'data-webgl-status',
    'unavailable'
  );
  await expect(page.locator('[data-webgl-fallback]')).toBeVisible();
  await expect(page.locator('p', { hasText: HERO_TEXT })).toBeVisible();

  // Controls must still open and work without the canvas.
  await page.keyboard.press('d');
  await expect(page.getByText('Chladni Grid Lab')).toBeVisible();

  expect(pageErrors).toEqual([]);
  await context.close();
  await browser.close();
});
