---
name: testing
description: Playwright test conventions for the V3 theme. Tests hit live thebonpet.com — use domcontentloaded, handle Shopify Forms shadow DOM, tag @smoke for deploy gate.
---

## Framework
- **Playwright `@playwright/test` ^1.47.0**, installed in `tests/`.
- Projects: `desktop-chrome` (1440×900), `mobile-safari` (iPhone 13).
- Base URL: `https://thebonpet.com` (live). There is no preview theme. Tests run against production, gated by the smoke suite.

## Commands (run from `tests/`)
- `npm run test:smoke` — `@smoke`-tagged only. This is the deploy gate.
- `npm run test` — full suite.
- `npm run test:ui` — inspector.
- `npm run report` — open last HTML report.

## Required patterns

### `page.goto` with `domcontentloaded`
The live site is heavy (app embeds, HubSpot, analytics). Default `load` wait times out.
```ts
await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
await page.waitForTimeout(2000); // let embeds hydrate
```

### `@smoke` tag for deploy gating
Put the tag in the `describe()` title (or the `test()` title). `./deploy.sh` runs `playwright test --grep @smoke`.
```ts
test.describe('Hero popup infra @smoke', () => { /* ... */ });
```

### Shopify Forms popup detection
Closed shadow DOM. Open signal:
```ts
const el = document.querySelector('shopify-forms-embed');
const dlg = el?.shadowRoot?.querySelector('section[role="dialog"], [role="dialog"]');
const isOpen = dlg?.hasAttribute('open');
```
**The dialog is unmounted on close** — one fresh page per trigger test. Don't close and reopen.

### Call `window.openBonPetForm()` rather than clicking
Clicks flake when the popup overlay intercepts pointer events:
```ts
await page.evaluate(() => (window as any).openBonPetForm());
```

### Ignore known-noisy console errors
HubSpot, analytics, Shopify Forms hydration warnings, CORS, ResizeObserver loops — filter them out of `pageerror` assertions.

## Writing new tests

## Click-behavior tests must use real clicks, not `page.evaluate`

**WRONG** - gives false greens:
```ts
await page.evaluate(() => (window as any).openBonPetForm());
```
This bypasses click-event dispatch entirely. It'll pass even when the real button is covered by an overlay and a user's click never fires `onclick`.

**RIGHT** - reproduces the real user path:
```ts
await page.locator('.tbp-hero-code-btn').click();
```
Must use `page.locator(...).click()`. If Playwright reports the button is "blocked by another element intercepting pointer events" - that's a REAL bug, not a test problem. Fix the stacking, don't force-click around it.

## Check `elementFromPoint` before asserting clickable
If you suspect an invisible overlay, add this probe at the start of the test:
```ts
const hit = await page.evaluate((sel) => {
  const el = document.querySelector(sel)!;
  const r = el.getBoundingClientRect();
  const topmost = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return { isSelf: topmost === el, topmostTag: topmost?.tagName };
}, '.tbp-hero-code-btn');
expect(hit.isSelf, `expected hero button on top, got ${hit.topmostTag}`).toBe(true);
```

## Writing new tests
1. One spec per feature area in `tests/specs/<area>.spec.ts`.
2. Top-level `describe()` with `@smoke` tag if deploy-critical.
3. Fresh page per test (Playwright default).
4. Assert exact values, not truthy ranges.
5. Before committing: both projects pass without retries.

## Existing specs as examples
- `hero-popup-infra.spec.ts` — baseline infra
- `v3-1-triggers.spec.ts` — popup trigger surface (hero, promo bar, sticky, scroll)
- `buttons-functional.spec.ts` — click-through
- `review-count-consistency.spec.ts` — stat consistency
- `seo-health.spec.ts` — SEO/AEO
- `brand-voice.spec.ts` — em-dash ban enforcement
