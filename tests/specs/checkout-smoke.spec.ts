import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke: add a trial pack to cart → cart page loads with item.
 * Does NOT complete checkout (stops at /checkouts/... URL with item in cart).
 */
// Suppress the 8s auto-popup so it doesn't cover buttons during the test
async function suppressAutoPopup(page: any) {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
  });
}

async function findVariantId(page: any): Promise<string | null> {
  return await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/json"]')) as HTMLScriptElement[];
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent || '{}');
        if (d && Array.isArray(d.variants) && d.variants[0]?.id) return String(d.variants[0].id);
        if (d?.product?.variants?.[0]?.id) return String(d.product.variants[0].id);
      } catch {}
    }
    return null;
  });
}

test.describe('Cart + checkout smoke @smoke', () => {
  test('free dog trial: discount URL + product page + cart/add.js', async ({ page, request }) => {
    await suppressAutoPopup(page);

    // 1. Discount URL resolves to product page
    // Note: Shopify sometimes rate-limits the discount endpoint with "Too many attempts" errors.
    // Add a retry loop to handle transient 429/rate-limit responses.
    let retries = 3;
    let url = '';
    while (retries > 0) {
      try {
        await page.goto('/discount/FREETRIAL%253C3THEBONPET?redirect=%2Fproducts%2Ffree-dog-trial-pack', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        url = page.url();
        if (/products\/free-dog-trial-pack/.test(url)) {
          break;
        }
        // If we got the "Too many attempts" error page, wait and retry
        if (/too many attempts|rate limit/i.test(await page.content())) {
          retries--;
          if (retries > 0) {
            await page.waitForTimeout(2000);
            continue;
          }
        }
      } catch (e) {
        retries--;
        if (retries > 0) await page.waitForTimeout(2000);
      }
    }
    await expect(page).toHaveURL(/\/products\/free-dog-trial-pack/);

    // 2. Product page has a resolvable variant
    const variantId = await findVariantId(page);
    expect(variantId, 'variant id discoverable on product page').toBeTruthy();

    // 3. /cart/add.js succeeds (proves ATC API works end-to-end)
    const addRes = await request.post('/cart/add.js', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { id: variantId, quantity: 1 },
    });
    expect(addRes.status(), `add to cart should return 2xx; got ${addRes.status()}`).toBeLessThan(400);

    // 4. /cart.js reflects the addition
    const cartRes = await request.get('/cart.js', { headers: { Accept: 'application/json' } });
    const cart = await cartRes.json();
    expect(cart.item_count, 'cart has at least 1 item').toBeGreaterThan(0);
  });

  test('cart page loads and shows checkout button', async ({ page }) => {
    await suppressAutoPopup(page);
    await page.goto('/products/free-dog-trial-pack');
    const variantId = await findVariantId(page);
    test.skip(!variantId, 'no variant id discoverable');

    await page.request.post('/cart/add.js', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { id: variantId, quantity: 1 },
    });

    await page.goto('/cart');
    const checkoutBtn = page.locator('button[name="checkout"], a[href*="/checkouts"], button:has-text("Checkout")').first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
  });
});
