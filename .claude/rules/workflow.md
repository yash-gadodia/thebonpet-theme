---
name: workflow
description: Automatic development workflow — clarify, plan, implement, test, self-review. Scale rigor to task size.
---

Follow this workflow automatically. The user does not need to type `/plan` or `/test`.

## Scale to task size

### Trivial (copy tweak, single-line CSS fix, typo)
- Just do it. Edit + push via `./deploy.sh --only <path>`. Smoke suite gates the push.

### Small (single file, single concern, known pattern)
1. Clarify if anything is ambiguous (but one round max — don't interrogate).
2. Edit the file.
3. Bump version marker in `layout/theme.liquid` line 2 and `README-V3.md`.
4. `./deploy.sh --only <path>` (smoke runs first).
5. Curl the live site with cache-bust until the new marker appears.

### Medium (multi-file, new snippet/section, theme-setting addition)
1. Clarify intent → desired behaviour on mobile + desktop → success criteria.
2. Delegate to `architect` agent for a plan if the change touches ≥3 files or introduces new abstractions.
3. Implement per plan. TDD-style: write the Playwright spec first if the change is testable end-to-end.
4. Run `cd tests && npm run test:smoke` locally to confirm green before `./deploy.sh`.
5. Bump version + update README-V3 changelog.
6. Delegate to `reviewer` agent for spec-compliance + code-quality pass.
7. Deploy + cache-flip verification.

### Large (new page, architectural change, rip-and-replace)
1. Require a brief approved by the user before writing code.
2. Architect plan with explicit files, schema additions, mobile breakpoints, test plan, rollback.
3. Devil's advocate pass: what could go wrong? What's the rollback? What's the detection signal if this breaks live?
4. Subagent-dev style: one fresh subagent per independent task; two-stage review (spec compliance → quality).
5. Stage via a single deploy; don't break the change across days without a feature flag.

## Auto-invoked skills
- **clarify** — when intent is ambiguous; before planning.
- **plan** — medium/large tasks; outputs bite-sized (2–5 min) sub-tasks.
- **tdd** — during implementation when a Playwright spec can cover the change.
- **review** — after implementation and before deploy.
- **verify** — before claiming done. No success claims without fresh evidence (curl, Playwright output).
- **finish** — after review pass. Version bump + deploy + cache-flip confirm.

## Red flags that should pause the workflow
- Second attempt at the same approach failed → **stop coding, stop pushing, start researching** the underlying component/API. Read Shopify devdocs, context7, or the app's source. Don't "try one more thing".
- You're about to push a fix for a user-reported bug but you haven't reproduced it with a failing Playwright test → **stop and write the test first**. Speculative fixes are where multi-hour loops begin.
- You used `--skip-tests` once this session → fine. Using it twice → investigate the test failures before touching code again.
- Shopify page_cache still stale after 5 min of polling → don't keep polling. Switch to Playwright real-browser or `/pages/about` (flips faster). Curl has false-negative rate due to CDN shards.
- A fix works in `page.evaluate` but fails on real `.click()` → the fix doesn't address the user's bug. Different code path. Keep digging.
- A fix works on desktop-chrome but not mobile-safari → not done.
- Version marker didn't bump → not done.
- A `<form>` element was added outside the Shopify Forms embed → rip it out before deploy. HubSpot will auto-capture and send spurious emails.
