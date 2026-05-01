# Bon Pet site tests

Playwright smoke tests that guard against V3-launch-style regressions (trial-claim collapse, broken CTAs, inconsistent numbers). Runs against the live site by default.

## One-time setup

```bash
cd tests
npm install
npx playwright install chromium webkit
```

## Run

```bash
# All tests (desktop + mobile)
npm test

# Smoke subset only (@smoke tag) — fast, ~30s
npm run test:smoke

# Watch in browser
npm run test:headed

# Playwright UI (interactive, great for debugging)
npm run test:ui

# After a failure, open the HTML report
npm run report
```

## Target a staging theme

```bash
TBP_BASE_URL="https://d2ac44-d5.myshopify.com/?preview_theme_id=XXXX" npm test
```

## Before every theme push

Use `./deploy.sh` at repo root — it runs `npm run test:smoke` then `shopify theme push`. Fails the deploy if any smoke test breaks.

## Test files

| File | Guards against |
|---|---|
| `specs/hero-popup-infra.spec.ts` | The 2026-04-23 incident (trial claim collapse). Verifies claim-code button, Shopify Forms embed, hero CTAs, and no console errors. |
| `specs/cta-urls-200.spec.ts` | 404s on internal links. Crawls every homepage link, asserts 200. |
| `specs/checkout-smoke.spec.ts` | Broken add-to-cart or cart page. Walks through discount → product → add → cart. |
| `specs/review-count-consistency.spec.ts` | Rating / review count / pawrent count drifting across sections. |

## Adding a test

```ts
// specs/my-new.spec.ts
import { test, expect } from '@playwright/test';

test.describe('my feature @smoke', () => {  // @smoke = runs on every deploy
  test('behaves as expected', async ({ page }) => {
    await page.goto('/');
    // ...
  });
});
```

Tag with `@smoke` only if fast + critical-path. Expensive checks go untagged and run on nightly CI.

## Known gaps (add as you ship fixes)

- No visual-regression screenshots yet — add via `await expect(page).toHaveScreenshot()` once layout stabilises
- No Lighthouse perf budget — add `lighthouseci` later
- Cart-to-checkout E2E stops at cart page; Shopify checkout is hard to assert in CI without test orders
