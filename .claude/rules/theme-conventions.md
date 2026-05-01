---
name: theme-conventions
description: V3 theme naming, token, and Liquid conventions. Project-specific rules that a lint pass won't catch.
---

## Naming

### File prefixes
- `sections/bonpet-<name>.liquid` — V3 custom sections (page-level, have `{% schema %}`).
- `snippets/bonpet-<name>.liquid` — V3 custom snippets (reusable fragments, no schema).
- Dawn baseline files keep their original names. Don't rename them.

### CSS
- Utility + component classes: `.tbp-<block>-<element>-<modifier>` (BEM-ish).
- Design-token custom properties: `--tbp-<category>-<variant>` (e.g. `--tbp-primary`, `--tbp-space-4`, `--tbp-radius-pill`, `--tbp-font-display`).
- No Tailwind. No CSS-in-JS. Inline `<style>` per section is the norm.

### JavaScript
- Window functions: `window.openBonPetForm`, `window.closeBonPetForm`. Don't add more without a strong reason.
- Every `<script>` wraps its body in an IIFE: `(function () { ... })();`
- `var` is fine. Dawn is ES5-baseline compatible.

## Liquid

### Whitespace
Use `{%- -%}` and `{{- -}}` to strip whitespace in rendered markup. Default to trimming in `<head>`, schemas, and around blank-guard conditionals.

### Blank guards
```liquid
{%- if section.settings.heading != blank -%}
  <h2>{{ section.settings.heading }}</h2>
{%- endif -%}
```

### Stats — inline, never include
The single source of truth is `settings.tbp_rating` / `settings.tbp_review_count` / `settings.tbp_pawrent_count`. Consume with:
```liquid
{%- liquid
  assign tbp_rating = settings.tbp_rating | default: '4.9'
  assign tbp_review_count = settings.tbp_review_count | default: '318'
  assign tbp_pawrent_count = settings.tbp_pawrent_count | default: '1,500'
-%}
```
**Never** `{% include 'bonpet-stats' %}` in `<head>`, `<script>`, or schema-rendered contexts. Liquid forbids `include` there and crashes the page (2026-04-23 incident).

### Render, not include
Prefer `{% render 'bonpet-<snippet>' %}` over `{% include %}` everywhere. Scoping in `render` is saner and it's what Dawn uses.

## Single-form rule
HubSpot's Collected Forms script (installed outside the theme) captures **every** `<form>` element on the page, then fires "Contact reconversion" emails and contact records.

Therefore: only one `<form>` is allowed on the site — the one rendered inside `<shopify-forms-embed>` (which has a closed shadow DOM, so HubSpot can't see it). Anything else that needs email capture routes through `window.openBonPetForm()` to open that one form.

## Ban list — grep checks
```
grep -RE "—|–" sections/ snippets/ layout/ templates/ config/
```
Any hit = violation. Replace em/en-dash with hyphen, comma, or restructured sentence.

```
grep -R "<form" sections/ snippets/ layout/ | grep -v shopify-forms-embed
```
Any hit outside the Shopify Forms embed = blocker.

```
grep -Rn "{% include " layout/
```
Any hit inside `layout/` = inspect for restricted-context usage.

## Responsive breakpoints
- `<640px` — mobile portrait.
- `640–767px` — mobile landscape / small tablet.
- `768–1023px` — tablet.
- `≥1024px` — desktop.

Use `@media (max-width: 767px)` for mobile-only overrides; `@media (min-width: 1024px)` for desktop-only. Middle zone inherits defaults.

## Settings
- Add new theme-editor fields in `config/settings_schema.json` under a dedicated `"content": "Bon Pet · <section>"` header block.
- Default values live in `config/settings_data.json` `current` object.
- Never hardcode a value that should be a setting. If copy might change, promote to setting.

## Shopify Forms web component - known constraints
The `<shopify-forms-embed>` element is a closed-shadow-DOM web component from the Shopify Forms app. All constraints below were verified in production on 2026-04-23.

### What breaks naive approaches
- **Closed shadow DOM** - external CSS and JS cannot reach inside. `::part()` is not exposed on this version.
- **Full-viewport click interceptor** - an inner `_appEmbed_` div (~1490 x 950 px, positioned across the viewport) is rendered in the shadow tree. `document.elementFromPoint(anyX, anyY)` returns `SHOPIFY-FORMS-EMBED`, NOT the visible button underneath. Your `<button onclick="...">` handlers never fire because the click lands on the embed.
- **`el.open` is undefined** on this version. Don't rely on it.
- **Dialog unmounts on close** - if user dismisses the popup, the `section[role="dialog"]` element is removed from the shadow tree. Same-tab reopen via cached reference fails.
- **Teaser pill is conditional** - only shown after an open-then-close cycle. Not present on first page load.

### What actually works to open the popup
1. Find teaser button: `el.shadowRoot.querySelector('[class*="teaserContainer"]')` and call `.click()` - works when the teaser is rendered (i.e., after a prior open-close).
2. Find dialog: `el.shadowRoot.querySelector('section[role="dialog"]')` and set `open` attribute + remove `hidden` attribute - works when dialog is present (fresh page load or after re-mount).
3. Both strategies are in `snippets/bonpet-forms-trigger.liquid`'s `openShopifyForm()` - update there, not in per-section buttons.

### To let users click OUR buttons that are visually on top of the embed
The embed's invisible overlay blocks clicks on buttons rendered anywhere on the page. Fix patterns (in order of preference):
1. **Raise z-index + position on our buttons** (`position: relative; z-index: 100000;`). Simple, works if the embed's overlay z-index is finite.
2. **Set `shopify-forms-embed { pointer-events: none; }` on the host** - lets clicks pass through. Risk: internal teaser/dialog become unclickable unless Shopify Forms' internal CSS sets `pointer-events: auto` on interactive children. Test before shipping.
3. **Document-level event delegation** - addEventListener on `document` in capture phase, filter for our button selectors, call `openBonPetForm()`. Bypasses the click-interception issue because capture-phase fires before target.

### Display trigger + copy lives in Shopify admin
Configure at Apps > Shopify Forms > the popup > "Display trigger" and "Content". Theme code only triggers and overlays the reveal screen.
