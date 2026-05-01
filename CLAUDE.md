# The Bon Pet — V3 Shopify Theme

Fork of Shopify Dawn 15.4.0 powering https://thebonpet.com (store `d2ac44-d5`, live theme #161078673465). V3 custom code is prefixed `bonpet-` (sections/snippets), `tbp-` (CSS classes), `--tbp-*` (CSS custom props). Current version marker at `layout/theme.liquid` line 2.

Read ARCHITECTURE.md for detailed architecture context before planning or making structural changes.

Brand, promo codes, customer voice, analytics, automation boundaries live in `../CLAUDE.md`. Read it before any customer-facing copy.

Claude automatically follows a development workflow (clarify → plan → implement → test → self-review) scaled to task size. You don't need to invoke /plan or /test manually.

## Deploy
- `./deploy.sh` — runs Playwright `@smoke` suite, then `shopify theme push --theme 161078673465 --allow-live --nodelete`.
- `./deploy.sh --only sections/bonpet-hero.liquid` — push single file (tests still run first).
- `./deploy.sh --skip-tests` — emergency only.
- **Default pushes go to LIVE theme** — there is no staging. Push directly unless user says otherwise.
- After push, Shopify page_cache can take 30s–5min to flip. Poll both `/` and `/pages/about` — `/pages/` flips first.

## Test
- `cd tests && npm run test:smoke` — fast `@smoke` subset (deploy gate).
- `cd tests && npm run test` — full suite.
- `cd tests && npm run test:ui` — Playwright inspector.
- Playwright 1.47+, projects `desktop-chrome` + `mobile-safari`, baseURL = `https://thebonpet.com`.
- Tag critical tests with `@smoke` in the `describe()` title so `./deploy.sh` picks them up.
- `tests/` is in `.shopifyignore` — never pushed to Shopify.

## Architecture
- **Dawn baseline**: `layout/theme.liquid`, `templates/*.json`, Shopify sections framework.
- **V3 custom layer**: `sections/bonpet-*.liquid` (~22 sections), `snippets/bonpet-*.liquid` (~9 snippets), `assets/bonpet-v3.css` (design tokens).
- **Design tokens**: `--tbp-primary`, `--tbp-cream`, `--tbp-space-N`, `--tbp-radius-*`, `--tbp-font-*`, `--tbp-text-*`.
- **Lead capture**: ONE Shopify Forms popup (`<shopify-forms-embed>`, closed shadow DOM). All entry points (hero, promo-bar, sticky CTA, 50% scroll) call `window.openBonPetForm()` — defined in `snippets/bonpet-forms-trigger.liquid`.
- **Trial reveal**: after the Shopify Forms popup submits, `bonpet-forms-trigger.liquid` detects success (fetch-intercept + shadow-DOM observer), closes Shopify's bare discount reveal, and shows our own overlay with Dog + Cat trial redirect buttons.
- **Public stats**: `settings.tbp_rating` / `settings.tbp_review_count` / `settings.tbp_pawrent_count` (in `config/settings_data.json`). Read inline via `{%- liquid assign ... -%}`. **Never `{% include 'bonpet-stats' %}` in a `<head>` context** — it crashes the page (see 2026-04-23 incident).

## Code style
- Emoji in UI copy (🐶 🐱 🎁 🐾 etc.). Singapore-casual voice ("pawrents", "furkids").
- **No em-dashes (—) or en-dashes (–)** anywhere — customer copy, comments, docs. Use hyphens, commas, parens.
- CSS: BEM-lite via `tbp-*` utility classes + design-token custom properties. No Tailwind.
- JS: vanilla only (no frameworks), IIFE-wrapped, `var` is fine (Dawn baseline).
- Liquid: prefer `{%- -%}` whitespace control. Guard optional settings with `if ... != blank`.
- Sections are page-level units with a `{% schema %}` block. Snippets are reusable components (no schema).

## Versioning (bump on every push)
- Update `layout/theme.liquid` line 2 comment `<!-- tbp-theme-version: X.Y.Z · YYYY-MM-DD -->`.
- Add entry to `README-V3.md` changelog.
- **Minor (X.Y+1.0)** for fixes or improvements. **Major (X+1.0.0)** for new features or structural changes.

## Workflow
- After 2 failed attempts at the same approach, stop and rethink — don't brute-force.
- Verify before claiming done: curl the live site for markers, run Playwright `@smoke`, show output.
- Delegate verbose operations (cache-flip polling, Playwright runs) to subagents to preserve context.
- Shopify Forms has a closed shadow DOM and unmounts the dialog on close — never assume `el.open()` alone works; always layer multiple strategies (in `bonpet-forms-trigger.liquid`).

## Do NOT
- Don't add a second `<form>` element to the site — HubSpot Collected Forms auto-captures it and fires duplicate welcome emails (2026-04-23 incident).
- Don't `{% include '<snippet>' %}` inside `<head>` or other restricted contexts. Use `{% render %}` or inline `{%- liquid -%}`.
- Don't push to live with `@smoke` failing unless the user explicitly authorises it.
- Don't `git commit` here — this folder is not a git repo. `shopify theme push` is the deploy mechanism.
- Don't drop `--allow-live` from push commands — there is only one theme and it is live.
