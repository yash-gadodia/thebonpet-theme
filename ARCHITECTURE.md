# The Bon Pet — V3 Theme Architecture

## Overview
Shopify Online Store 2.0 theme powering https://thebonpet.com — DTC storefront for a Singapore fresh pet food brand. Forked from Dawn 15.4.0, rebuilt above the baseline with the `bonpet-*` custom layer. Ships as a single "live" theme (#161078673465); no staging.

## System Map
```
Shopify Platform (store: d2ac44-d5)
  └── Theme #161078673465 (Version 3.0, live)
        ├── Dawn baseline (sections/header, footer, header-group, cart-drawer, etc.)
        │
        └── V3 custom layer (this repo)
              ├── layout/theme.liquid          — version marker + render pipeline
              ├── sections/bonpet-*.liquid     — 22 page-level sections
              ├── snippets/bonpet-*.liquid     — 9 reusable components
              ├── templates/*.json             — section composition per page
              ├── config/settings_schema.json  — theme editor fields
              ├── config/settings_data.json    — current setting values
              └── assets/bonpet-v3.css         — design-token layer
```

## Directory Structure
- `layout/` — root wrappers (`theme.liquid`, `password.liquid`). Version marker at line 2 of `theme.liquid`.
- `sections/` — every page-level block. `bonpet-*` = V3 custom, others = Dawn baseline.
- `snippets/` — reusable fragments rendered with `{% render %}`. `bonpet-*` = V3 custom.
- `templates/` — per-page JSON manifests (which sections in which order). `index.json` = home.
- `config/` — `settings_schema.json` (admin UI) + `settings_data.json` (values, including `tbp_theme_version`, `tbp_rating`, `tbp_review_count`, `tbp_pawrent_count`).
- `assets/` — CSS/JS/images. `bonpet-v3.css` is the design-token + primitives layer, loaded from `snippets/bonpet-v3-head.liquid`.
- `locales/` — i18n JSON (English primary). Rarely touched.
- `tests/` — Playwright suite (NOT pushed to Shopify, gated by `.shopifyignore`). Includes `specs/`, `package.json`, `playwright.config.ts`.
- `deploy.sh` — wrapper that runs `tests/npm run test:smoke` then `shopify theme push`.
- `README-V3.md` — running changelog.

## Data Flow — Typical Homepage Request
1. Shopify edge serves cached HTML if `page_cache` is warm. ETag keyed on theme + section/template contents.
2. On cache miss, Shopify renders: `layout/theme.liquid` → `content_for_header` (Shopify Forms, app embeds injected here) → `templates/index.json` → section tree.
3. Sections iterate in the order defined in `index.json`; each renders its Liquid and inlines a `<style>` block.
4. `snippets/bonpet-v3-head.liquid` emits design-token CSS custom properties at document level.
5. `snippets/bonpet-forms-trigger.liquid` hydrates popup triggers + post-submission overlay.
6. Third-party app blocks (Judge.me UGC, Google Reviews Rocket, Instagram Feed) render via the `"type": "apps"` section entries.

## Key Design Decisions
- **Dawn fork over custom theme** — keeps Shopify feature parity (cart, search, auth) without rewriting. Treat `bonpet-*` as a plugin layer above Dawn.
- **Single `<form>` rule** — HubSpot Collected Forms auto-captures every `<form>` on page, then sends "Contact reconversion" emails. Anything that needs email capture routes through the Shopify Forms popup; nothing else introduces a `<form>` element.
- **Design tokens over per-component styling** — `--tbp-*` custom properties give consistent spacing, colour, radius across 22 sections. One token change ripples everywhere.
- **Live-only deploy** — simpler than preview themes; smoke suite + cache-flip polling give the safety net. Rollback = re-publish the prior theme in Shopify admin.
- **Inline `{%- liquid assign -%}` over `{% include %}`** — 2026-04-23 incident: `{% include 'bonpet-stats' %}` inside `<head>` crashed the page because Shopify disallows `include` in restricted contexts. Inline assigns are always safe.
- **Vanilla JS, IIFE-wrapped** — matches Dawn's baseline. No bundler, no TypeScript. Every snippet is self-contained and cache-friendly.

## Module Boundaries
- **Dawn baseline** (`sections/header.liquid`, `sections/footer.liquid`, `snippets/cart-drawer.liquid`, etc.) — don't edit unless necessary. Patch via section groups or overrides.
- **V3 custom layer** (`bonpet-*`) — safe to edit freely, all owned by us.
- **Third-party app blocks** — referenced via `shopify://apps/<app>/blocks/<id>` in `templates/*.json`. We don't touch the block code, only toggle in Shopify admin or swap the block ID.
- **Shopify Forms embed** — closed shadow DOM; integrate via `shopify-forms-embed` element and window events. Never try to style/inject directly.

## External Dependencies
- **Shopify Forms app** — provides `<shopify-forms-embed>`. Controls popup display trigger in the app's admin, not theme code.
- **Judge.me Reviews** — UGC grid + star ratings via app block.
- **Google Reviews Rocket** — live Google review feed via app block.
- **Instafeed** — Instagram feed via app block (matches V2.2 integration).
- **HubSpot** — background Collected Forms script on the site (installed outside the theme). Watches for `<form>` elements; this is why the single-form rule exists.
- **Ninja Van / Lalamove** — fulfilment (NOT in theme, relevant only because checkout mentions cold-chain delivery).

## Entry Points
- **Homepage:** `templates/index.json` → sections order including `bonpet-hero`, `bonpet-guarantee`, `bonpet-how-it-works`, `bonpet-reviews`, `bonpet-founder`, `bonpet-footer`.
- **Product pages:** `templates/product.json` + species-specific overrides (`product.cat-gc-chicken.json`, etc.).
- **Collection pages:** `templates/collection.cat.json`, `collection.dog.json`, `collection.trials.json`.
- **Critical snippets:** `snippets/bonpet-forms-trigger.liquid` (popup + Dog/Cat overlay), `snippets/bonpet-sticky-mobile-cta.liquid`, `snippets/bonpet-seo-head.liquid`.
- **Changelog + version:** `README-V3.md` + `layout/theme.liquid` line 2.
- **Deploy surface:** `deploy.sh` is the single deploy command.
- **Test surface:** `tests/specs/*.spec.ts` — `hero-popup-infra`, `v3-1-triggers`, `buttons-functional`, `checkout-smoke`, `cta-urls-200`, `review-count-consistency`, `seo-health`, `responsive-render`, `brand-voice`.
