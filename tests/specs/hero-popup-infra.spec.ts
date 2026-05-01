import { test, expect } from '@playwright/test';

/**
 * Guards against the 2026-04-23 V3 incident where trial claims collapsed because
 * `code_cta_label` was empty + `bonpet-forms-trigger.liquid` suppressed the auto-popup.
 *
 * If this test fails, trial acquisition is broken. Do NOT deploy.
 */
test.describe('Hero popup + trial acquisition infra @smoke', () => {
  test('claim-code button renders with correct label', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.tbp-hero-code-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText(/claim your trial code/i);
  });

  test('shopify-forms-embed exists in DOM', async ({ page }) => {
    await page.goto('/');
    const embed = page.locator('shopify-forms-embed');
    await expect(embed).toHaveCount(1, { timeout: 15_000 });
  });

  test('window.openBonPetForm is a callable function', async ({ page }) => {
    await page.goto('/');
    const isFunction = await page.evaluate(() => typeof window.openBonPetForm === 'function');
    expect(isFunction).toBe(true);
  });

  test('hero dog + cat CTAs point to FREETRIAL discount URLs', async ({ page }) => {
    await page.goto('/');
    const dogCta = page.getByRole('link', { name: /free trial for dogs/i });
    const catCta = page.getByRole('link', { name: /free trial for cats/i });
    await expect(dogCta).toHaveAttribute('href', /\/discount\/FREETRIAL%253C3THEBONPET.+free-dog-trial-pack/);
    await expect(catCta).toHaveAttribute('href', /\/discount\/FREETRIAL%253C3THEBONPET.+free-cat-trial-pack/);
  });

  test('no critical JS errors on homepage load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // let Shopify Forms + other embeds hydrate

    // Noisy but non-critical sources we ignore:
    // - 3rd-party analytics/ads/chat
    // - Shopify Forms web component hydration warnings (harmless)
    // - CORS warnings from social embeds
    // - Image loading errors (reported as failed network, not breaking)
    const ignorePatterns = [
      /hubspot|analytics|gtag|facebook|tiktok|pinterest|klaviyo|hotjar|clarity/i,
      /shopify-forms-embed|shopify_forms|shopify\.com\/.*\.js.*error/i,
      /cors|cross-origin|cross origin|third-party/i,
      /favicon|manifest|apple-touch/i,
      /net::ERR_|Failed to load resource|ERR_BLOCKED_BY/i,
      /Permissions policy|violate the following/i,
      /ResizeObserver loop/i,
      /web-pixels?.*(refused|MIME|text\/html)/i,
      /font-size:0;color:transparent/i,
      /Refused to execute script/i,
    ];
    const critical = errors.filter((e) => !ignorePatterns.some((re) => re.test(e)));
    expect(critical, `Critical JS errors:\n${critical.join('\n')}`).toHaveLength(0);
  });
});
