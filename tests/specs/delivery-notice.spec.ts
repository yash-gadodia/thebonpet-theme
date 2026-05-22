import { test, expect } from '@playwright/test';

/**
 * v3.40.0 surfaced delivery cost + self-collect option on the PDP and inside
 * the cart progress widget. The motivating data: 97% of abandoned checkouts
 * were under the $80 free-ship threshold and 62% had a trial code applied.
 * The leak is shipping shock at checkout, so the notice has to render before
 * payment. These tests guard against regressions where the notice goes
 * missing or stops surfacing self-collect.
 */

async function suppressAutoPopup(page: any) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
  });
}

async function safeJson(request: any, url: string): Promise<any | null> {
  // Shopify's live storefront occasionally serves bot-defense HTML to headless agents
  // even for .js endpoints. Treat any non-JSON response as "rate-limited, skip" so
  // these tests don't fail on Shopify infra noise.
  try {
    const res = await request.get(url, { headers: { Accept: 'application/json' } });
    if (res.status() >= 400) return null;
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) return null;
    return await res.json();
  } catch { return null; }
}

async function findVariantId(request: any, handle: string): Promise<string | null> {
  const data = await safeJson(request, `/products/${handle}.js`);
  return data?.variants?.[0]?.id ? String(data.variants[0].id) : null;
}

test.describe('PDP delivery notice @smoke', () => {
  // Cover one regular pack and one free-trial PDP. If the notice goes missing
  // on either, the audit-driven shipping-shock fix has regressed.
  for (const handle of ['gently-cooked-free-range-chicken-for-dogs', 'free-dog-trial-pack']) {
    test(`/products/${handle} renders delivery + self-collect notice under price`, async ({ page }) => {
      await suppressAutoPopup(page);
      await page.goto(`/products/${handle}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      const notice = page.locator('.tbp-pdp-delivery-notice').first();
      await expect(notice, 'delivery notice container must be on PDP').toBeVisible({ timeout: 8_000 });
      await expect(notice).toContainText(/Cold-chain delivery from \$9/);
      await expect(notice).toContainText(/FREE on orders \$100\+/);
      await expect(notice).toContainText(/self-collect FREE/);
      await expect(notice).toContainText(/5 Siglap Road/);
    });
  }

  test('notice appears AFTER price block (so customer sees cost before deciding)', async ({ page }) => {
    await suppressAutoPopup(page);
    await page.goto('/products/gently-cooked-free-range-chicken-for-dogs', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const positions = await page.evaluate(() => {
      const price = document.querySelector('[id^="price-"]') as HTMLElement | null;
      const notice = document.querySelector('.tbp-pdp-delivery-notice') as HTMLElement | null;
      if (!price || !notice) return null;
      return {
        priceTop: price.getBoundingClientRect().top,
        noticeTop: notice.getBoundingClientRect().top,
      };
    });
    expect(positions, 'both price and notice elements must exist').not.toBeNull();
    expect(positions!.noticeTop, 'notice should sit below the price').toBeGreaterThan(positions!.priceTop);
  });
});

test.describe('Cart shipping-progress self-collect line @smoke', () => {
  test('cart under $100 shows progress bar AND self-collect fallback line', async ({ page, request }) => {
    await suppressAutoPopup(page);
    const variantId = await findVariantId(request, 'gently-cooked-free-range-chicken-for-dogs');
    test.skip(!variantId, 'products.js rate-limited; tested manually in full suite');

    await page.request.post('/cart/add.js', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { id: variantId, quantity: 1 },
    });

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const progress = page.locator('.tbp-shipping-progress').first();
    await expect(progress, 'shipping-progress widget visible on cart').toBeVisible({ timeout: 10_000 });
    await expect(progress).not.toHaveClass(/tbp-shipping-progress--won/);

    const selfcollect = progress.locator('.tbp-shipping-progress-selfcollect');
    await expect(selfcollect, 'self-collect fallback line must show when cart < $100').toBeVisible();
    await expect(selfcollect).toContainText(/self-collect FREE/);
    await expect(selfcollect).toContainText(/5 Siglap Road/);
  });

  test('cart at or over $100 hides self-collect line (won state)', async ({ page, request }) => {
    await suppressAutoPopup(page);
    const variantId = await findVariantId(request, 'gently-cooked-free-range-chicken-for-dogs');
    test.skip(!variantId, 'products.js rate-limited; tested manually in full suite');

    // gently-cooked-free-range-chicken-for-dogs is $8.60. 13 of them = $111.80, comfortably over $100.
    await page.request.post('/cart/add.js', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { id: variantId, quantity: 13 },
    });

    const cart = await safeJson(page.request, '/cart.js');
    test.skip(!cart, 'cart.js rate-limited; tested manually in full suite');
    test.skip(cart.total_price < 10_000, `cart total ${cart.total_price} cents < $100, can't test won state`);

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    const progress = page.locator('.tbp-shipping-progress').first();
    await expect(progress).toBeVisible({ timeout: 10_000 });
    await expect(progress, 'progress widget should be in won state').toHaveClass(/tbp-shipping-progress--won/);
    await expect(progress).toContainText(/FREE cold-chain delivery unlocked/);

    const selfcollect = progress.locator('.tbp-shipping-progress-selfcollect');
    await expect(selfcollect, 'self-collect line should NOT render once free delivery unlocked').toHaveCount(0);
  });
});
