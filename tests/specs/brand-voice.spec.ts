import { test, expect } from '@playwright/test';

/**
 * Brand voice guardrails. Per CLAUDE.md / feedback_writing_voice memory:
 *   - NEVER use em-dashes (—) or en-dashes (–) in user-facing copy.
 * Scans rendered text on homepage + key pages. Guards against copy drift.
 */

const FORBIDDEN_CHARS = ['—', '–']; // U+2014 em-dash, U+2013 en-dash

function extractVisibleText(body: string): string {
  return body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

// Pages where nearly all text is theme-controlled (safe to guard for em-dashes).
// Pages with heavy admin-entered content (/pages/faq) or user-generated reviews
// (/pages/the-bon-pet-reviews) are NOT scanned - those em-dashes are out-of-scope
// for the theme deploy gate and should be cleaned up in Shopify admin separately.
const PAGES_TO_SCAN = [
  '/',
  '/pages/feeding-guideline',
  '/collections/dogs',
  '/collections/cats',
];

// Third-party widgets that render customer-supplied text (reviews, social posts, support
// chat) - em-dashes in that content are out of our control. Strip before scanning.
const THIRD_PARTY_WIDGET_SELECTORS = [
  'script', 'style', 'noscript', 'shopify-forms-embed', 'iframe',
  '[id*="chatwoot"]', '[id*="judgeme"]', '[id*="judge-me"]', '[id*="instafeed"]',
  '[class*="app-embed"]', '[class*="judgeme"]', '[class*="judge-me"]',
  '[class*="rocket"]', '[class*="google-reviews"]', '[class*="gr-widget"]',
  '[class*="grp"]', '[id*="grp"]', '[class*="widget_list"]', '[class*="reviews-widget"]',
  '[class*="instafeed"]', '[class*="chatwoot"]',
  '[data-shopify-editor-section*="apps_"]',
];

test.describe('Brand voice: no em/en dashes in customer-facing copy @smoke', () => {
  for (const path of PAGES_TO_SCAN) {
    test(`${path} has no em-dashes or en-dashes in rendered body`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1200);
      const visible = await page.evaluate((selectors) => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(selectors.join(',')).forEach((el) => el.remove());
        return clone.textContent || '';
      }, THIRD_PARTY_WIDGET_SELECTORS);

      for (const ch of FORBIDDEN_CHARS) {
        const idx = visible.indexOf(ch);
        if (idx !== -1) {
          const ctx = visible.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, ' ');
          throw new Error(`Found forbidden "${ch}" in ${path}: "...${ctx}..."`);
        }
      }
    });
  }
});

test.describe('Number consistency — promo codes, phone, email rendered correctly @smoke', () => {
  test('promo codes visible + correctly formatted on homepage', async ({ page }) => {
    await page.goto('/');
    const body = (await page.textContent('body')) || '';
    // FREETRIAL<3THEBONPET is the free trial code. Check it's present verbatim in CTAs/copy.
    expect(body, 'FREETRIAL<3THEBONPET referenced in hero copy').toMatch(/FREETRIAL<3THEBONPET/);
  });

  test('contact phone + email present in footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer.tbp-footer');
    await expect(footer).toContainText(/hello@thebonpet\.com/);
    await expect(footer).toContainText(/9010.?8515/);
  });

  test('kitchen address visible in footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer.tbp-footer');
    await expect(footer).toContainText(/Pioneer Cres/i);
    await expect(footer).toContainText(/628558/);
  });
});
