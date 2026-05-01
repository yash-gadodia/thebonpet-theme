import { test, expect } from '@playwright/test';

/**
 * v3.3+ popup trigger smoke: the Shopify Forms popup ("Get your FREE Trial") must
 * open via two entry points (hero button, promo-bar button) with REAL clicks, plus
 * auto-open at 50% scroll. Each test uses a fresh page (Shopify Forms unmounts the
 * dialog on close so same-page reopen is not reliable).
 */

async function popupIsOpen(page) {
  return page.evaluate(() => {
    const el = document.querySelector('shopify-forms-embed') as HTMLElement | null;
    if (!el || !el.shadowRoot) return false;
    const dlg = el.shadowRoot.querySelector('section[role="dialog"], [role="dialog"], dialog');
    if (!dlg) return false;
    return dlg.hasAttribute('open');
  });
}

async function clickReachable(page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { err: 'no-button' };
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { isSelf: top === el, topmostTag: top?.tagName };
  }, selector);
}

test.describe('v3.3 popup triggers @smoke', () => {
  test('hero onclick wires to openBonPetForm + click reaches the button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);

    const heroBtn = page.locator('.tbp-hero-code-btn').first();
    await expect(heroBtn).toBeVisible();
    const onclick = await heroBtn.getAttribute('onclick');
    expect(onclick).toMatch(/openBonPetForm/);

    const hit = await clickReachable(page, '.tbp-hero-code-btn');
    expect(hit.isSelf, `expected hero button on top, got ${hit.topmostTag}`).toBe(true);
  });

  test('promo-bar onclick wires to openBonPetForm + click reaches the button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);

    const promoBtn = page.locator('.tbp-promo-cta').first();
    await expect(promoBtn).toBeVisible();
    const onclick = await promoBtn.getAttribute('onclick');
    expect(onclick).toMatch(/openBonPetForm/);

    const hit = await clickReachable(page, '.tbp-promo-cta');
    expect(hit.isSelf, `expected promo button on top, got ${hit.topmostTag}`).toBe(true);
  });

  test('custom sticky CTA is REMOVED (v3.3.1)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const count = await page.locator('.tbp-sticky-cta').count();
    expect(count, 'custom sticky should not be rendered').toBe(0);
  });

  test('REAL click on hero eventually opens popup (end-state assertion)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);
    await page.locator('.tbp-hero-code-btn').click();
    await expect.poll(async () => popupIsOpen(page), { timeout: 8000, intervals: [400] }).toBe(true);
  });

  test('REAL click on promo-bar eventually opens popup (end-state assertion)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);
    await page.locator('.tbp-promo-cta').click();
    await expect.poll(async () => popupIsOpen(page), { timeout: 8000, intervals: [400] }).toBe(true);
  });

  test('auto-opens popup after scrolling past 50% (end-state)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
      window.scrollTo(0, Math.floor(h * 0.6));
    });
    await expect.poll(async () => popupIsOpen(page), { timeout: 8000, intervals: [400] }).toBe(true);
  });

  test('Dog + Cat overlay markup is rendered on page (hidden until success)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const dogBtn = page.locator('#tbpTrialReveal a[href*="free-dog-trial-pack"]');
    const catBtn = page.locator('#tbpTrialReveal a[href*="free-cat-trial-pack"]');
    await expect(dogBtn).toHaveCount(1);
    await expect(catBtn).toHaveCount(1);
    await expect(dogBtn).toHaveAttribute('href', /FREETRIAL%253C3THEBONPET/);
    await expect(catBtn).toHaveAttribute('href', /FREETRIAL%253C3THEBONPET/);

    const isHidden = await page.evaluate(() => {
      const el = document.getElementById('tbpTrialReveal');
      return el?.getAttribute('aria-hidden') === 'true';
    });
    expect(isHidden, 'overlay must start hidden, never show on page load').toBe(true);
  });
});
