---
name: review
description: Two-stage review for V3 theme changes. Spec compliance first, then code quality + project rules.
---

## Stage 1 — spec compliance
- Did the change match what was asked? Cross-reference the user's literal words.
- Was every entry point wired? (e.g. "hero + promo bar + sticky" = all three.)
- Is the smoke suite green? If not, stop — spec failure.

If stage 1 fails, report and stop. Don't proceed to stage 2.

## Stage 2 — project-rule grep pass
Run these and report any hits:

```bash
# em-dash ban
grep -RE "—|–" sections/ snippets/ layout/ templates/ config/

# form duplication (must only match shopify-forms-embed)
grep -Rn "<form" sections/ snippets/ layout/ | grep -v 'shopify-forms-embed'

# {% include %} in layout/head
grep -Rn "{% include " layout/

# hardcoded stats
grep -RE '"(4\.8|183\+|318\+|1,500\+)"' sections/ snippets/

# shopify push without --allow-live
grep -R "shopify theme push" . | grep -v 'allow-live' | grep -v '.git'

# new <script> without IIFE
# (eyeball: search recent diffs for <script> blocks; each should start with (function () {)
```

## Stage 3 — version + changelog
- `layout/theme.liquid` line 2 marker bumped?
- `README-V3.md` changelog entry added?
- If new section/snippet: wired into relevant `templates/*.json`?
- If new setting: in both `config/settings_schema.json` and `config/settings_data.json`?

## Stage 4 — runtime verification
- `cd tests && npm run test:smoke` on the change — both projects pass without retries.
- After deploy, curl `/pages/about` (cache flips first) and `/` for the new version marker.

## Output
```
Verdict: pass | blockers | notes-only
Stage 1: <compliant | gaps: ...>
Stage 2: <clean | hits: ...>
Stage 3: <complete | missing: ...>
Stage 4: <verified | pending: ...>

Blockers (fix before deploy):
- <file:line> — <issue> — fix: <one-liner>

Non-blocking:
- <observation>

Evidence:
- grep 1: <result>
- test run: <last lines>
```

Never approve without running the commands. "Looks fine" is not a review.
