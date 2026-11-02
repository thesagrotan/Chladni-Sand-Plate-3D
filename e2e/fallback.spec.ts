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

test('boots with the reduced-cost software renderer path', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Make the capability probe see a software GPU so the app takes the
  // reduced pixel-ratio / antialias path, without changing actual rendering.
  await context.addInitScript(() => {
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    const RENDERER = 0x1f01;
    const proto = WebGL2RenderingContext.prototype;
    const original = proto.getParameter;
    proto.getParameter = function patchedGetParameter(this: WebGL2RenderingContext, pname: number) {
      if (pname === UNMASKED_RENDERER_WEBGL || pname === RENDERER) return 'SwiftShader';
      return original.call(this, pname);
    } as typeof proto.getParameter;
  });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(`http://127.0.0.1:${process.env.E2E_PORT || 3002}/`);
  await expect(page.locator('[data-webgl-status]')).toHaveAttribute(
    'data-webgl-status',
    'available'
  );
  await expect(page.locator('canvas')).not.toHaveCount(0);
  await expect(page.locator('[data-webgl-fallback]')).toHaveCount(0);
  await expect(page.locator('p', { hasText: HERO_TEXT })).toBeVisible();

  expect(pageErrors).toEqual([]);
  await context.close();
  await browser.close();
});
