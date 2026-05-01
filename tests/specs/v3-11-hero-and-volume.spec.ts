import { test, expect, request as playwrightRequest } from '@playwright/test';

/**
 * v3.11.0 coverage: sensitivity-angle hero reframe + volume discount visibility.
 * Homepage checks are @smoke (deploy gate). The /pages/volume-discounts page
 * itself is admin-created post-push, so those tests skip if the page 404s.
 */

// NOTE: these tests assert post-v3.11.0 copy. Intentionally NOT @smoke-tagged so deploy.sh doesn't
// block on them pre-push (the live site still has the pre-push copy until the push lands + cache flips).
// Once v3.11.0 is live, add @smoke to lock this behavior going forward.
test.describe('v3.11.0 homepage reframe (post-push regression guard)', () => {
  test('hero renders the sensitivity angle copy', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const heroHeading = page.locator('.tbp-hero .tbp-hero-heading');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/Itchy Skin or Upset Tummy\? Find Their Protein\./);

    const heroEyebrow = page.locator('.tbp-hero .tbp-hero-eyebrow');
    await expect(heroEyebrow).toHaveText(/Sensitivity Trial/);

    const heroSub = page.locator('.tbp-hero .tbp-hero-sub');
    await expect(heroSub).toContainText('Food sensitivities');
    await expect(heroSub).toContainText('4 for cats, 5 for dogs');
  });

  test('suppawt-local strip renders directly below hero', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const strip = page.locator('.tbp-suppawt-strip').first();
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Suppawt local');
    await expect(strip).toContainText('Small SG team');
    await expect(strip).toContainText('PhD-formulated');
    await expect(strip).toContainText('Open-source recipes');
  });

  test('volume discount banner renders with correct CTA href', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const banner = page.locator('.tbp-vol-banner').first();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Save up to 40%');

    const cta = banner.locator('.tbp-vol-banner-btn');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href, 'volume discount banner links to /pages/volume-discounts').toBe('/pages/volume-discounts');
  });

  test('homepage add-to-cart path still works (no checkout regression)', async ({ page, request }) => {
    await page.goto('/products/free-dog-trial-pack', { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const variantId = await page.evaluate(() => {
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

    expect(variantId, 'PDP variant id still discoverable post-v3.11.0').toBeTruthy();

    const addRes = await request.post('/cart/add.js', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: { id: variantId, quantity: 1 },
    });
    expect(addRes.status(), 'cart/add.js returns 2xx after v3.11.0').toBeLessThan(400);
  });
});

test.describe('v3.11.0 volume-discounts page (runs once admin page is created)', () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.get('/pages/volume-discounts', { headers: { Accept: 'text/html' }, maxRedirects: 0 });
    test.skip(res.status() === 404, '/pages/volume-discounts not created in Shopify admin yet. Create the page with handle volume-discounts + template volume-discounts, then re-run.');
  });

  test('page renders the tier table, calculator widget, and CTA', async ({ page }) => {
    await page.goto('/pages/volume-discounts', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const title = page.locator('.tbp-vol-title');
    await expect(title).toBeVisible();

    const calc = page.locator('[data-tbp-vol-calc]');
    await expect(calc).toBeVisible();

    const input = page.locator('[data-tbp-vol-calc-input]');
    await expect(input).toBeVisible();

    const table = page.locator('.tbp-vol-table tbody tr');
    await expect(table).toHaveCount(5);
  });

  test('calculator updates tier + % savings on input change', async ({ page }) => {
    await page.goto('/pages/volume-discounts', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const input = page.locator('[data-tbp-vol-calc-input]');
    const subOut = page.locator('[data-tbp-vol-calc-sub]');
    const tierPill = page.locator('[data-tbp-vol-calc-tier-pill]');

    await input.fill('60');
    await input.dispatchEvent('input');
    await expect(subOut).toHaveText('30%');
    await expect(tierPill).toHaveText('Tier 3');

    await input.fill('200');
    await input.dispatchEvent('input');
    await expect(subOut).toHaveText('40%');
    await expect(tierPill).toHaveText('Tier 5');

    await input.fill('5');
    await input.dispatchEvent('input');
    await expect(subOut).toHaveText('10%');
    await expect(tierPill).toHaveText('Tier 1');
  });

  test('volume-discounts page has no em-dashes', async ({ page }) => {
    await page.goto('/pages/volume-discounts', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const visible = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, noscript, shopify-forms-embed, iframe').forEach((el) => el.remove());
      return clone.textContent || '';
    });
    expect(visible.indexOf('—'), 'no em-dash on /pages/volume-discounts').toBe(-1);
    expect(visible.indexOf('–'), 'no en-dash on /pages/volume-discounts').toBe(-1);
  });

  test('page has no rogue <form> element outside Shopify Forms embed', async ({ page }) => {
    await page.goto('/pages/volume-discounts', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1500);

    const rogueFormCount = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.filter((f) => !f.closest('shopify-forms-embed') && !f.matches('shopify-forms-embed form')).length;
    });
    // Shopify injects search + cart forms baseline; we just want to know our new sections did NOT add one.
    // Baseline forms on any storefront page: header search, cart. Our new page adds 0.
    expect(rogueFormCount, 'no unexpected forms from v3.11.0 sections').toBeLessThanOrEqual(3);
  });
});
