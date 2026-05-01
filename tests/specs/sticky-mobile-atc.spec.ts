import { test, expect } from '@playwright/test';

/**
 * v3.6 sticky mobile Add-to-Cart. Mobile-only (<=767px) bar on /products/*.
 * Hidden on trial PDPs, cart, checkout. Clicks the existing product form submit
 * button (no new <form>, no HubSpot capture).
 */

const PROBE_PRODUCT = '/products/gently-cooked-chicken-dog';

async function popupDismiss(page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('tbp_popup_shown_v1', '1');
      sessionStorage.setItem('tbp_popup_shown_v3', '1');
    } catch {}
  });
}

test.describe('v3.6 sticky mobile ATC @smoke', () => {
  test('renders on mobile PDP, hit-testable', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await popupDismiss(page);
    await page.goto(PROBE_PRODUCT, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);

    const sticky = page.locator('.tbp-sticky-atc').first();
    await expect(sticky, 'sticky bar visible on mobile PDP').toBeVisible({ timeout: 8_000 });

    const hit = await page.evaluate(() => {
      const btn = document.querySelector('.tbp-sticky-atc-btn') as HTMLElement | null;
      if (!btn) return { err: 'no btn' };
      const r = btn.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { isBtn: top === btn || btn.contains(top), topmostTag: top?.tagName };
    });
    expect(hit.isBtn, `sticky ATC button reachable (got ${hit.topmostTag})`).toBe(true);
    await ctx.close();
  });

  test('does NOT render on desktop', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await popupDismiss(page);
    await page.goto(PROBE_PRODUCT, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2000);

    const sticky = page.locator('.tbp-sticky-atc').first();
    const count = await sticky.count();
    if (count === 0) {
      expect(count, 'sticky not rendered on desktop').toBe(0);
    } else {
      const display = await sticky.evaluate((el) => getComputedStyle(el).display);
      expect(display, 'sticky hidden on desktop').toBe('none');
    }
    await ctx.close();
  });

  test('does NOT render on trial PDPs', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await popupDismiss(page);
    await page.goto('/products/free-dog-trial-pack', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2000);

    const count = await page.locator('.tbp-sticky-atc').count();
    expect(count, 'sticky should be absent on trial PDP').toBe(0);
    await ctx.close();
  });

  test('does NOT render on /cart', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await popupDismiss(page);
    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2000);

    const count = await page.locator('.tbp-sticky-atc').count();
    expect(count, 'sticky should be absent on /cart').toBe(0);
    await ctx.close();
  });

  test('does NOT add to cart on page load (no side effects)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await popupDismiss(page);

    const preCart = await page.request.get('/cart.js', { headers: { Accept: 'application/json' } });
    const preCartJson = await preCart.json();
    const preCount = preCartJson.item_count;

    await page.goto(PROBE_PRODUCT, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);

    const postCart = await page.request.get('/cart.js', { headers: { Accept: 'application/json' } });
    const postCartJson = await postCart.json();
    expect(postCartJson.item_count, 'sticky mounting MUST NOT trigger a cart add').toBe(preCount);
    await ctx.close();
  });

  test('no Liquid errors on PDP after sticky added', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(PROBE_PRODUCT, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const html = await page.content();
    expect(html).not.toMatch(/Liquid error|Liquid syntax error/i);
    await ctx.close();
  });
});
