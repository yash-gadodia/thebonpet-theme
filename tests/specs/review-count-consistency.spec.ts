import { test, expect } from '@playwright/test';

/**
 * Enforces single-source-of-truth for the two numbers we show publicly:
 *   - rating (4.8)
 *   - review count (183)
 *   - pawrent / customer count (1,500)
 *
 * If these drift across the page, customers notice and it erodes trust.
 * Update the CANONICAL object below when the real numbers change — then every
 * mention of them across the homepage must match.
 */

// Sync with theme settings: Theme editor > Theme settings > Bon Pet · Public Stats
// Current figures from Google Business Profile place_id ChIJqWbpqTwX2jERSJWIxogqqsg.
const CANONICAL = {
  rating: '4.9',
  review_count: '318',
  pawrent_count: '1,500',
};

test.describe('Review + pawrent count consistency across homepage @smoke', () => {
  test('homepage shows consistent rating + counts everywhere they appear', async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('tbp_popup_shown_v1', '1'); } catch {}
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const bodyText = (await page.textContent('body')) || '';

    // 1. Rating: every "X.Y / 5" or "X.Y stars" phrase must use canonical rating.
    const ratingMatches = bodyText.match(/\b([1-5]\.\d)\s*(?:\/\s*5|\s*stars?|out of 5)/gi) || [];
    for (const m of ratingMatches) {
      expect(m, `rating should be ${CANONICAL.rating}, found "${m}"`).toContain(CANONICAL.rating);
    }
    expect(ratingMatches.length, 'rating appears on homepage').toBeGreaterThan(0);

    // 2. Review count (183+) present somewhere.
    expect(bodyText.match(new RegExp(`${CANONICAL.review_count}\\+?\\s*(?:verified )?(?:pawrent )?reviews?`, 'i')), 'review count present').not.toBeNull();

    // 3. Pawrent (customer) count (1,500+) present somewhere.
    expect(bodyText.match(new RegExp(`${CANONICAL.pawrent_count}\\+?\\s*(?:happy )?(?:singapore )?pawrents?\\b(?!\\s+reviews?)`, 'i')), 'pawrent count present').not.toBeNull();

    // 4. Drift guard: match "X+ pawrents" where pawrents is the NOUN (not followed by "reviews").
    //    Any such mention must use the canonical pawrent_count (1,500).
    //    "183+ pawrent reviews" is fine (pawrent is an adjective modifying reviews).
    const pawrentNounPattern = /(\d{1,3}(?:,\d{3})?)\+?\s*(?:happy )?(?:singapore )?pawrents\b(?!\s+reviews?)/gi;
    const drift = [...bodyText.matchAll(pawrentNounPattern)];
    for (const match of drift) {
      const captured = match[1];
      expect(
        captured,
        `all "X+ pawrents" mentions must be ${CANONICAL.pawrent_count} (review count ${CANONICAL.review_count} is separate). Found "${match[0]}"`,
      ).toBe(CANONICAL.pawrent_count);
    }
  });

  test('footer trust band shows both review count + pawrent count', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer.tbp-footer');
    await expect(footer).toContainText(CANONICAL.review_count);
    await expect(footer).toContainText(CANONICAL.pawrent_count);
    await expect(footer).toContainText(CANONICAL.rating);
  });
});
