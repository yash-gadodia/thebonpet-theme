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
      // Wait for app blocks (Subscriptions, Instafeed, etc.) to finish rendering before
      // we sample the DOM. networkidle with a generous timeout catches lazy-loaded
      // app content that intermittently injected em-dashes and caused flake.
      try {
        await page.waitForLoadState('networkidle', { timeout: 8000 });
      } catch { /* some apps poll forever, fall through */ }
      await page.waitForTimeout(2000);

      // Locate em/en-dashes via TreeWalker so we can report the DOM ancestry of every
      // hit. Old impl returned 80 chars of stripped text - useless for tracing which
      // section/snippet/app rendered the offending character. Now we get the parent
      // chain so the fix is mechanical.
      const findings = await page.evaluate((args) => {
        const { selectors, chars } = args;
        const stripSet = new Set<Element>();
        document.querySelectorAll(selectors.join(',')).forEach((el) => stripSet.add(el));
        const isInsideStripped = (node: Node) => {
          let el: Element | null = node.parentElement;
          while (el) { if (stripSet.has(el)) return true; el = el.parentElement; }
          return false;
        };
        const out: { ch: string; ctx: string; path: string }[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = walker.nextNode())) {
          const t = n.textContent || '';
          if (!chars.some((c) => t.includes(c))) continue;
          if (isInsideStripped(n)) continue;
          for (const ch of chars) {
            const i = t.indexOf(ch);
            if (i < 0) continue;
            const ctx = t.slice(Math.max(0, i - 50), i + 50).replace(/\s+/g, ' ');
            const segs: string[] = [];
            let el: Element | null = n.parentElement;
            while (el && segs.length < 6) {
              let s = el.tagName.toLowerCase();
              if (el.id) s += `#${el.id}`;
              const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
              if (cls) s += `.${cls}`;
              segs.push(s);
              el = el.parentElement;
            }
            out.push({ ch, ctx, path: segs.join(' > ') });
          }
        }
        return out;
      }, { selectors: THIRD_PARTY_WIDGET_SELECTORS, chars: FORBIDDEN_CHARS });

      if (findings.length > 0) {
        const lines = findings.slice(0, 5).map((f) => `  [${f.ch}] "${f.ctx}"\n    at: ${f.path}`);
        throw new Error(
          `Found ${findings.length} forbidden em/en-dash(es) in ${path}:\n${lines.join('\n')}`
        );
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
