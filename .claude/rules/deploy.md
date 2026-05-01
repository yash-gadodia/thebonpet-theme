---
name: deploy
description: Shopify theme deploy rules. This folder is NOT a git repo — deploy = shopify theme push. Default target is the live theme.
---

## The repo is not git-versioned
`/Users/yash/Documents/TheBonPet/shopify-theme-v3-remote/` has no `.git`. Version history is tracked via:
- `layout/theme.liquid` line 2 comment marker (`<!-- tbp-theme-version: X.Y.Z · YYYY-MM-DD -->`)
- `README-V3.md` changelog
- Shopify's theme version history (not programmatically accessible)

Never run `git commit`, `git add`, or `gh pr create` here. The deploy is the commit.

## The deploy command
Always use `./deploy.sh`. It:
1. Installs `tests/node_modules` on first run.
2. Runs `npm run test:smoke` from `tests/`.
3. On pass, executes `shopify theme push --theme 161078673465 --nodelete --allow-live <extra-args>`.
4. Exits non-zero on smoke failure.

Flags:
- `./deploy.sh` — full push of all changed files.
- `./deploy.sh --only <path>` — scoped push; tests still gate.
- `./deploy.sh --skip-tests` — emergency only. Log a line in the PR/chat explaining why.

## Required flags when bypassing the wrapper
If you must call `shopify theme push` directly:
```bash
shopify theme push --theme 161078673465 --allow-live --nodelete [--only <path>]
```
Without `--allow-live`, the CLI hits an interactive prompt and hangs in this agent environment.

## Version bump discipline
Every deploy must bump the version marker. Format:
```
<!-- tbp-theme-version: 3.1.0 · 2026-04-23 -->
```
- **Minor (3.1.0 → 3.2.0)** — fixes, improvements, copy changes.
- **Major (3.x → 4.0.0)** — new sections, restructured templates, renamed settings.

Add a changelog entry to `README-V3.md` with:
- Version number + date
- 1–3 sentence summary of what changed and why.

## Cache-flip verification
Shopify's `page_cache` lags after push, typically 30s–5min:
- `/pages/about` flips first (lighter template).
- `/` (homepage) flips last.
- `/products/<handle>` has its own cache window.

Verification pattern:
```bash
for i in 1 2 3 4 5; do
  sleep 30
  V=$(curl -sL "https://thebonpet.com/?b=$(date +%s)" | grep -o 'tbp-theme-version[^"]*' | head -1)
  echo "iter $i: $V"
  [[ "$V" == *"<expected-version>"* ]] && break
done
```

## Rollback
Shopify admin → Online Store → Themes → theme library → previous theme → "Publish". No CLI rollback.

## Files never pushed
`.shopifyignore` excludes:
- `tests/`
- `deploy.sh`
- `README-V3.md`
- `.claude/`
- `CLAUDE.md`, `ARCHITECTURE.md`

Keep the ignore list current when adding dev-only files.

## Forcing homepage cache to flip
The homepage (`/`) page_cache is extremely sticky - can stay stale for 10+ minutes after a theme push. `/pages/*` flips in ~30-90s. If `/` won't flip:

1. Edit `config/settings_data.json` - bump or add a throwaway field like `tbp_cache_flush` with a new timestamp. Push. This changes the rendered HTML's cache key.
2. Edit `templates/index.json` - even a single-whitespace change forces the index template cache to invalidate. Push.
3. Don't trust curl for cache verification. CDN shards can each have different cache states. Trust a real browser (open incognito) or Playwright over curl results.

## Theme rollback ladder (most recent first)
- `#161078673465` "Latest live version" - current live, Dawn 15.4.1.
- `#160959299641` "Version 3.0" - Dawn 15.4.0 pre-upgrade. V3 baseline before 2026-04-23.
- `#150151069753` "Version 2.2" - full V2 rollback (no `bonpet-*` custom code).
To roll back: Shopify admin > Themes > the target > Publish. Or `shopify theme publish --theme <id>`.
