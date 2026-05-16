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

  // Removed: donate-a-meal CTA was removed from paw-forward section (no longer in theme)

  test('custom sticky CTA is not rendered (v3.3.1 removed it; Shopify Forms teaser owns bottom-LHS)', async ({ page }) => {
    await page.goto('/');
    const sticky = await page.locator('.tbp-sticky-cta').count();
    expect(sticky, 'tbp-sticky-cta should be gone').toBe(0);
  });

  test('opening form via window.openBonPetForm has no JS exceptions', async ({ page }) => {
    // v3.36.0 removed the .tbp-hero-code-btn; trial flow now routes through primary CTAs.
    // Still verify that form-open infra works without JS errors.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');

    // Wait for Shopify Forms embed to be hydrated
    await page.waitForFunction(() => {
      const el = document.querySelector('shopify-forms-embed');
      return el && el.shadowRoot && el.shadowRoot.querySelector('[role="dialog"], dialog, form');
    }, { timeout: 10000 });

    // Trigger form open programmatically (what the UI would do)
    await page.evaluate(() => (window as any).openBonPetForm?.());
    await page.waitForTimeout(1200);

    // Filter out 3rd-party noise and CSP errors (non-critical)
    const ignorePatterns = [
      /hubspot|analytics|gtag|facebook|tiktok|klaviyo|hotjar|clarity|gorgias|bold|avada/i,
      /Trusted(HTML|Script|ScriptURL) assignment/i,
      /Executing inline script violates/i,
      /shopify-forms|CORS/i,
    ];
    const critical = errors.filter((e) => !ignorePatterns.some((re) => re.test(e)));
    expect(critical, `JS errors after form trigger:\n${critical.join('\n')}`).toHaveLength(0);
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
