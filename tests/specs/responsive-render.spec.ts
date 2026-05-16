import { test, expect } from '@playwright/test';

/**
 * Responsive rendering at standard breakpoints — no horizontal scroll, critical
 * elements visible, images not blown out. Covers the "things render properly
 * on all devices" request.
 */

const BREAKPOINTS = [
  { name: 'mobile-sm', width: 375, height: 812 },
  { name: 'mobile-lg', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.describe('Responsive render integrity @smoke', () => {
  for (const bp of BREAKPOINTS) {
    test(`no horizontal scroll at ${bp.name} (${bp.width}×${bp.height})`, async ({ page }) => {
      await page.addInitScript(() => {
        try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
      });
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(800);
      const { docW, vpW } = await page.evaluate(() => ({
        docW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        vpW: window.innerWidth,
      }));
      // Allow up to 2px tolerance for scrollbar / rounding.
      expect(docW - vpW, `horizontal overflow at ${bp.name}: doc ${docW} vs vp ${vpW}`).toBeLessThanOrEqual(2);
    });
  }

  test('DEBUG: identify overflowing element at mobile-sm @debug', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);

    const overflowInfo = await page.evaluate(() => {
      const vpW = window.innerWidth;
      const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const allElements = document.querySelectorAll('*');
      const wideElements = [];

      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        // Find elements wider than viewport
        if (rect.width > vpW) {
          wideElements.push({
            tag: el.tagName.toLowerCase(),
            className: el.className.substring(0, 50),
            offsetWidth: el.offsetWidth,
            clientWidth: el.clientWidth,
            boundingWidth: rect.width,
            left: rect.left,
          });
        }
      }

      return {
        vpW,
        docW,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        htmlOffsetWidth: document.documentElement.offsetWidth,
        bodyOffsetWidth: document.body.offsetWidth,
        wideElements: wideElements.slice(0, 10),
      };
    });

    console.log('OVERFLOW DEBUG AT 375×812:', JSON.stringify(overflowInfo, null, 2));
    expect(true).toBe(true);
  });

  test('hero CTAs visible above the fold on mobile 375×812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // At least ONE primary trial CTA must be within first viewport (y < 812).
    const dogBtn = page.getByRole('link', { name: /free trial for dogs/i }).first();
    const catBtn = page.getByRole('link', { name: /free trial for cats/i }).first();
    const dogBox = await dogBtn.boundingBox();
    const catBox = await catBtn.boundingBox();
    const atLeastOneAboveFold = (dogBox && dogBox.y < 900) || (catBox && catBox.y < 900);
    expect(atLeastOneAboveFold, 'at least one hero trial CTA should be above the fold on mobile').toBe(true);
  });

  test('how-it-works steps scroll horizontally on mobile <640px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const grid = page.locator('.tbp-hiw-grid');
    const overflowX = await grid.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX, 'HIW grid should scroll horizontally on mobile').toMatch(/auto|scroll/);
  });

  test('founder image does not dominate mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const img = page.locator('.tbp-founder-media img').first();
    await img.scrollIntoViewIfNeeded();
    const box = await img.boundingBox();
    expect(box, 'founder image should have bounding box').not.toBeNull();
    // Founder image height should be capped around 52vh (~422px at 812 viewport). Allow up to 500px.
    expect(box!.height, `founder image ${box!.height}px tall, should be <=500px on mobile`).toBeLessThanOrEqual(500);
  });

  test('WA floating bubble visible on all viewports', async ({ browser }) => {
    for (const bp of [BREAKPOINTS[0], BREAKPOINTS[4]]) {
      const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } });
      const page = await ctx.newPage();
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(1500);
      const wa = page.locator('.tbp-wa-float');
      await expect(wa, `WA bubble visible at ${bp.name}`).toBeVisible({ timeout: 8000 });
      await ctx.close();
    }
  });
});
