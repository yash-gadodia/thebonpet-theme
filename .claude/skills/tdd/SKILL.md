---
name: tdd
description: Test-first for V3 changes. Write Playwright spec covering the target behaviour, watch it fail, implement, watch it pass.
---

## When to apply
Any change with observable live-site behaviour. Skip only for: theme-editor-only setting additions with no render impact, or pure copy tweaks.

## Cycle

### 1. RED — write the failing spec first
- Drop a spec in `tests/specs/<feature>.spec.ts`.
- Top-level `describe()` includes `@smoke` if this is deploy-gating.
- Use `page.goto('/', { waitUntil: 'domcontentloaded', timeout: 45_000 })`.
- Assert the expected post-change behaviour, not the current state.
- Run: `cd tests && npx playwright test specs/<feature>.spec.ts --project=desktop-chrome --reporter=list`.
- **Confirm it fails**, not because of a typo or selector bug, but because the behaviour isn't implemented yet.

### 2. GREEN — minimal edit to pass
- Edit only the files the plan named.
- Run the spec again, see it pass on desktop-chrome.
- Run again with `--project=mobile-safari` — if it fails there, fix before moving on.

### 3. REFACTOR — consolidate without breaking green
- Only after green on both projects. Extract duplicated CSS into a `--tbp-*` token if you see it. Inline stats instead of hardcoded values.
- Re-run both projects. Still green? Move on.

## Rationalisation watch
If you find yourself thinking any of these, STOP:
- "I'll skip the spec, this one's too simple."
- "I'll write the spec after, just to match current behaviour."
- "The selector isn't cooperating, I'll just `waitForTimeout` more."

The first two skip the point (catching regression). The third hides real flakiness.

## Project-specific gotchas
- `<shopify-forms-embed>` is closed shadow DOM. Reach into `el.shadowRoot` but expect closed/null in some contexts.
- The popup unmounts on close. One test = one page load.
- `HubSpot` + embeds log noisy console errors — filter ignore patterns (see `hero-popup-infra.spec.ts` for the canonical ignore list).
- Tests hit LIVE thebonpet.com. A bad spec can spam your Shopify admin with fake submissions — don't actually submit the form in tests.
