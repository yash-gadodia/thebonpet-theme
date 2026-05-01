import { test, expect, request } from '@playwright/test';

/**
 * Crawls every internal link on the homepage and asserts HTTP 200.
 * Catches broken links (like the 6 that 404'd on 2026-04-21 before we fixed them).
 */
test.describe('Homepage internal links are all 200 @smoke', () => {
  test('every internal anchor + CTA returns 200', async ({ page, baseURL }) => {
    await page.goto('/');
    const origin = new URL(baseURL!).origin;

    const hrefs: string[] = await page.$$eval('a[href]', (anchors: Element[]) =>
      Array.from(
        new Set(
          (anchors as HTMLAnchorElement[])
            .map((a) => a.href)
            .filter((href) => href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')),
        ),
      ),
    );

    const internal = hrefs.filter((h) => h.startsWith(origin));
    expect(internal.length, 'homepage has internal links').toBeGreaterThan(5);

    const ctx = await request.newContext();
    const broken: { url: string; status: number }[] = [];

    // Shopify-internal endpoints that 406/403 for non-browser Accept headers but work fine in real browsers.
    // /pages/volume-discounts is the v3.11.0 volume-tiers page - template ships with the theme push but the
    // Shopify page itself is created in admin after push. Remove this skip once the admin page is live.
    const SKIP_PATTERNS = [/\/discount\//, /\/customer_authentication\//, /\/account\/login/, /\/challenge/, /\/pages\/volume-discounts/];

    for (const url of internal) {
      if (SKIP_PATTERNS.some((re) => re.test(url))) continue;

      try {
        const res = await ctx.get(url, {
          maxRedirects: 5,
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        if (res.status() >= 400) broken.push({ url, status: res.status() });
      } catch (e: any) {
        broken.push({ url, status: 0 });
      }
    }

    await ctx.dispose();

    expect(
      broken,
      `Broken links:\n${broken.map((b) => `  ${b.status}  ${b.url}`).join('\n')}`,
    ).toEqual([]);
  });

  test('discount redirect URLs return a reachable product page', async ({ page }) => {
    // Verify the FREETRIAL discount URLs actually land on a working product page
    const urls = [
      '/discount/FREETRIAL%253C3THEBONPET?redirect=%2Fproducts%2Ffree-dog-trial-pack',
      '/discount/FREETRIAL%253C3THEBONPET?redirect=%2Fproducts%2Ffree-cat-trial-pack',
    ];
    for (const url of urls) {
      const res = await page.goto(url);
      expect(res?.status(), `${url} should resolve`).toBeLessThan(400);
      expect(page.url(), 'should land on product page').toMatch(/\/products\/free-(dog|cat)-trial-pack/);
    }
  });
});
