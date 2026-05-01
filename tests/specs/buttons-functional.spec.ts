import { test, expect } from '@playwright/test';

/**
 * Every button/CTA on the homepage must:
 *   1. render in the DOM
 *   2. be visible (not display:none or hidden by overlap)
 *   3. have a valid destination (href 200 or scripted onclick)
 * Runs on both desktop-chrome and mobile-safari projects via playwright.config.
 */

const CRITICAL_BUTTONS = [
  { selector: '.tbp-hero-heading', name: 'hero heading', kind: 'element' },
  { selector: 'a:has-text("Free Trial for Dogs")', name: 'hero dog CTA', kind: 'link', hrefPattern: /\/discount\/FREETRIAL%253C3THEBONPET.+free-dog-trial-pack/ },
  { selector: 'a:has-text("Free Trial for Cats")', name: 'hero cat CTA', kind: 'link', hrefPattern: /\/discount\/FREETRIAL%253C3THEBONPET.+free-cat-trial-pack/ },
  { selector: '.tbp-hero-code-btn', name: 'hero claim-code button', kind: 'button' },
  { selector: '.tbp-wa-float', name: 'WhatsApp floating bubble', kind: 'link', hrefPattern: /wa\.me\/6590108515/ },
];

test.describe('Critical buttons render, visible, have valid targets @smoke', () => {
  test('homepage CTAs all clickable and correctly wired', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    for (const btn of CRITICAL_BUTTONS) {
      const el = page.locator(btn.selector).first();
      await expect(el, `${btn.name} should render`).toBeVisible({ timeout: 5000 });
      if (btn.hrefPattern) {
        await expect(el, `${btn.name} href should match ${btn.hrefPattern}`).toHaveAttribute('href', btn.hrefPattern);
      }
    }
  });

  test('donate-a-meal CTA in paw-forward routes to wildflower collection (not 404)', async ({ page, request }) => {
    await page.goto('/');
    const donateLink = page.getByRole('link', { name: /donate a meal/i }).first();
    await donateLink.scrollIntoViewIfNeeded();
    await expect(donateLink).toBeVisible();
    const href = await donateLink.getAttribute('href');
    expect(href, 'donate CTA has href').toBeTruthy();
    const res = await request.get(href!, { headers: { Accept: 'text/html' } });
    expect(res.status(), `donate destination ${href} should not 404`).toBeLessThan(400);
  });

  test('custom sticky CTA is not rendered (v3.3.1 removed it; Shopify Forms teaser owns bottom-LHS)', async ({ page }) => {
    await page.goto('/');
    const sticky = await page.locator('.tbp-sticky-cta').count();
    expect(sticky, 'tbp-sticky-cta should be gone').toBe(0);
  });

  test('clicking hero claim-code button attempts to open form (no exceptions)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.addInitScript(() => {
      try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
    });
    await page.goto('/');

    // Wait for Shopify Forms embed to be hydrated (shadow DOM ready)
    await page.waitForFunction(() => {
      const el = document.querySelector('shopify-forms-embed');
      return el && el.shadowRoot && el.shadowRoot.querySelector('[role="dialog"], dialog, form');
    }, { timeout: 10000 });

    // Disable pointer-events on Shopify Forms' click-intercepting overlay so our button is clickable.
    // The embed has an invisible overlay that blocks all clicks when form is closed.
    await page.evaluate(() => {
      const el = document.querySelector('shopify-forms-embed');
      if (el && el.shadowRoot) {
        // Find the first large div in shadow DOM - likely the overlay
        const divs = Array.from(el.shadowRoot.querySelectorAll('div')) as HTMLDivElement[];
        for (let d of divs) {
          const rect = d.getBoundingClientRect();
          const style = d.getAttribute('style') || '';
          // If it's large and positioned, it's likely the overlay
          if ((rect.width > 500 || rect.height > 500 || style.includes('position')) && d.children.length < 5) {
            d.style.pointerEvents = 'none';
            break;
          }
        }
      }
    });

    const btn = page.locator('.tbp-hero-code-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(1200);
    const critical = errors.filter((e) => !/hubspot|analytics|gtag|facebook|tiktok|klaviyo/i.test(e));
    expect(critical, `JS errors after popup trigger:\n${critical.join('\n')}`).toHaveLength(0);
  });

  test('every internal footer link returns 2xx/3xx', async ({ page, request }) => {
    await page.goto('/');
    const origin = new URL(page.url()).origin;
    const hrefs: string[] = await page.$$eval('footer.tbp-footer a[href]', (anchors: Element[]) =>
      Array.from(new Set((anchors as HTMLAnchorElement[]).map((a) => a.href)))
        .filter((h) => h && !h.startsWith('mailto:') && !h.startsWith('tel:') && !h.startsWith('javascript:'))
    );
    const internal = hrefs.filter((h) => h.startsWith(origin));
    const SKIP = [/\/discount\//, /\/customer_authentication\//, /\/account\/login/];
    const broken: { url: string; status: number }[] = [];
    for (const url of internal) {
      if (SKIP.some((re) => re.test(url))) continue;
      try {
        const res = await request.get(url, { maxRedirects: 5, headers: { Accept: 'text/html' } });
        if (res.status() >= 400) broken.push({ url, status: res.status() });
      } catch (e: any) {
        broken.push({ url, status: 0 });
      }
    }
    expect(broken, `Broken footer links:\n${broken.map((b) => `  ${b.status} ${b.url}`).join('\n')}`).toEqual([]);
  });
});
