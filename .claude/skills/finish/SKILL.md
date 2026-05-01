---
name: finish
description: Land completed work. Version bump, deploy, cache-flip verification, changelog update.
---

## Prereqs (don't finish without these)
- Implementation passes `review` skill (stage 1 + stage 2).
- `cd tests && npm run test:smoke` passes on both projects.
- No open questions or TODOs in the diff.

## The sequence

### 1. Bump version
Edit `layout/theme.liquid` line 2:
```
<!-- tbp-theme-version: <new-version> · <YYYY-MM-DD> -->
```
- Minor bump for fixes/improvements.
- Major bump for features/structural changes.

### 2. Update changelog
Add an entry to `README-V3.md` under `## Changelog`:
```
- **v<X.Y.Z>** (<YYYY-MM-DD>) — <one-sentence why + what changed>.
```

### 3. Deploy
```bash
./deploy.sh
# or for a scoped push:
./deploy.sh --only sections/bonpet-<name>.liquid
```
Smoke tests run first. If they fail, deploy aborts — fix before retrying.

### 4. Cache-flip verification
Poll the homepage until the new version marker appears:
```bash
for i in 1 2 3 4 5 6; do
  sleep 30
  V=$(curl -sL "https://thebonpet.com/?b=$(date +%s)" \
        -H 'User-Agent: Mozilla/5.0 BonPetVerify' \
        | grep -o 'tbp-theme-version[^"]*' | head -1)
  echo "iter $i: $V"
  [[ "$V" == *"<new-version>"* ]] && { echo "FLIPPED"; break; }
done
```
`/pages/about` flips first (~30–90s). `/` flips last (~60s–5min).

### 5. Report to user
Keep it tight. State:
- Version shipped (e.g. v3.1.0).
- One-line summary of change.
- Evidence line — curl showing new marker + test run result.
- Any known caveats (cache flip timing, known mobile difference).

## Rollback (if something goes wrong)
Shopify admin → Themes → previous theme → Publish. Log the incident in `README-V3.md` and update memory if it's a recurring pattern.
