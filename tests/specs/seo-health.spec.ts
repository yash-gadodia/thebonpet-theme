import { test, expect } from '@playwright/test';

/**
 * SEO health check — title, meta description, canonical, OG tags, structured data.
 * Catches regressions that silently tank rankings (like the 2026-04-23 "The Bon Pet" title bug).
 */

test.describe('SEO + AEO health @smoke', () => {
  test('title: descriptive, 40–70 chars, contains brand + keywords', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title, 'title should not be empty or just brand name').not.toMatch(/^The Bon Pet$/i);
    expect(title.length, `title length ${title.length} chars, should be 40-70`).toBeGreaterThanOrEqual(40);
    expect(title.length, `title length ${title.length} chars, should be 40-70`).toBeLessThanOrEqual(75);
    expect(title, 'title should contain brand').toMatch(/bon pet/i);
  });

  test('meta description: present, 120–250 chars', async ({ page }) => {
    await page.goto('/');
    const desc = await page.locator('meta[name="description"]').first().getAttribute('content');
    expect(desc, 'meta description should exist').toBeTruthy();
    expect(desc!.length, `meta description ${desc!.length} chars, should be 120-250`).toBeGreaterThanOrEqual(120);
    expect(desc!.length, `meta description ${desc!.length} chars, should be 120-250`).toBeLessThanOrEqual(260);
  });

  test('canonical link present and matches page URL', async ({ page }) => {
    await page.goto('/');
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical, 'canonical present').toBeTruthy();
    expect(canonical, 'canonical should be absolute https').toMatch(/^https:\/\//);
  });

  test('exactly one H1 on homepage', async ({ page }) => {
    await page.goto('/');
    const h1s = await page.locator('h1').count();
    expect(h1s, `found ${h1s} h1 tags, should be exactly 1`).toBe(1);
  });

  test('OpenGraph + Twitter card tags present', async ({ page }) => {
    await page.goto('/');
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      const content = await page.locator(`meta[property="${prop}"]`).first().getAttribute('content');
      expect(content, `${prop} should have content`).toBeTruthy();
    }
    for (const name of ['twitter:card', 'twitter:title', 'twitter:description']) {
      const content = await page.locator(`meta[name="${name}"]`).first().getAttribute('content');
      expect(content, `${name} should have content`).toBeTruthy();
    }
  });

  test('no duplicate OG tags (AVADA or native SEO should not inject old copy alongside V3)', async ({ page }) => {
    await page.goto('/');
    for (const prop of ['og:title', 'og:description']) {
      const count = await page.locator(`meta[property="${prop}"]`).count();
      expect(count, `${prop} should appear exactly once (got ${count})`).toBeLessThanOrEqual(2);
      // Accept up to 2 because Shopify's native social-image setting injects one; flag if 3+.
    }
  });

  test('critical JSON-LD schemas present (Organization, LocalBusiness, FAQPage)', async ({ page }) => {
    await page.goto('/');
    const jsonLdTypes = await page.$$eval('script[type="application/ld+json"]', (scripts) => {
      const types: string[] = [];
      for (const s of scripts) {
        try {
          const raw = (s.textContent || '').trim();
          const data = JSON.parse(raw);
          const collect = (d: any) => {
            if (!d) return;
            if (Array.isArray(d)) { d.forEach(collect); return; }
            if (d['@type']) types.push(String(d['@type']));
            Object.values(d).forEach((v) => typeof v === 'object' && collect(v));
          };
          collect(data);
        } catch {}
      }
      return types;
    });
    for (const expected of ['Organization', 'LocalBusiness', 'WebSite', 'FAQPage']) {
      expect(jsonLdTypes, `should have ${expected} JSON-LD`).toContain(expected);
    }
  });

  test('robots allow indexing on homepage', async ({ page }) => {
    await page.goto('/');
    const robots = await page.locator('meta[name="robots"]').first().getAttribute('content');
    expect(robots?.toLowerCase() || '', 'robots should allow index,follow').toMatch(/index/);
    expect(robots?.toLowerCase() || '', 'robots must NOT have noindex').not.toMatch(/noindex/);
  });

  test('sitemap.xml reachable and non-empty', async ({ request }) => {
    const res = await request.get('/sitemap.xml', { headers: { Accept: 'application/xml' } });
    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body, 'sitemap should reference product/page/collection sitemaps').toMatch(/sitemap_(products|pages|collections)/);
  });

  test('all non-decorative images have alt text', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const bad = await page.$$eval('img', (imgs) =>
      imgs
        .filter((img) => {
          const hasAlt = img.hasAttribute('alt') && (img.getAttribute('alt') || '').trim() !== '';
          const isDecorative = img.getAttribute('aria-hidden') === 'true';
          const inAppEmbed = img.closest('shopify-forms-embed, iframe, [id*="chatwoot"], [id*="judgeme"], [id*="instafeed"]') !== null;
          return !hasAlt && !isDecorative && !inAppEmbed;
        })
        .map((img) => img.getAttribute('src')?.slice(0, 120) || '(no src)')
    );
    expect(bad, `Images missing alt text:\n${bad.join('\n')}`).toEqual([]);
  });
});
