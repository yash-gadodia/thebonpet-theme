---
name: verify
description: Before claiming done, produce fresh evidence — curl, Playwright output, version marker. No success claims from memory.
---

## The rule
You cannot say "done", "fixed", "passing", or "live" without a new command output proving it. Memory of what you wrote is not evidence.

## Evidence per claim

### "The change is live"
```bash
curl -sL "https://thebonpet.com/?b=$(date +%s)" \
  -H 'User-Agent: Mozilla/5.0 BonPetVerify' \
  | grep -o 'tbp-theme-version[^"]*' | head -1
```
Expected: the new version marker you bumped to. If it still shows the old marker, the cache hasn't flipped — wait, don't claim done.

### "The popup opens"
```bash
cd tests && npx playwright test specs/v3-1-triggers.spec.ts --project=desktop-chrome --reporter=list --workers=1
cd tests && npx playwright test specs/v3-1-triggers.spec.ts --project=mobile-safari --reporter=list --workers=1
```
Expected: all tests pass, no retries.

### "The form isn't duplicated"
```bash
curl -sL https://thebonpet.com/ \
  | grep -cE 'tbpTrialModal|tbpTrialForm|tbp-modal-form'
```
Expected: `0`.

### "Mobile works"
Playwright `mobile-safari` project must pass the same tests as desktop. Don't infer.

### "SEO didn't regress"
```bash
cd tests && npx playwright test specs/seo-health.spec.ts --reporter=list
```

## Patterns to avoid
- "Should be working now." Prove it.
- "The curl passed" without pasting the relevant line of output.
- Polling a cache-flip loop for >5 min without pausing to investigate.
- Claiming success because the architect or developer agent said so — re-verify in main context.

## When verification fails
Don't re-run in hope. Pause, read the failure, change approach. CLAUDE.md global rule: "After 2 failed attempts, stop and rethink."
