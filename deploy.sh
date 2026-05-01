#!/usr/bin/env bash
#
# Bon Pet theme deploy wrapper.
# Runs smoke tests before pushing to the live theme.
# Any failure aborts the deploy.
#
# Usage:
#   ./deploy.sh                                  # run smoke tests + push all changed files
#   ./deploy.sh --only sections/bonpet-hero.liquid  # push single file after tests pass
#   ./deploy.sh --skip-tests                     # emergency bypass (don't)

set -euo pipefail

THEME_ID="161078673465"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SKIP_TESTS=0
PUSH_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--skip-tests" ]]; then
    SKIP_TESTS=1
  else
    PUSH_ARGS+=("$arg")
  fi
done

if [[ $SKIP_TESTS -eq 0 ]]; then
  echo "🧪 Running smoke tests..."
  if [[ ! -d tests/node_modules ]]; then
    echo "   Installing test dependencies (first run only)..."
    (cd tests && npm install --silent)
  fi
  # Capture output + exit code separately. Playwright 1.59+ exits non-zero when
  # any test was "flaky" (failed once, passed on retry) even though the suite is
  # technically green. We parse the output: if there are 0 "failed" tests, accept
  # the run regardless of flaky count. Live site has Cloudflare bot-detection +
  # 429 rate-limiting that causes ~5-9 env-flaky tests per run.
  smoke_log=$(mktemp -t tbp-smoke.XXXXXX.log)
  set +e
  (cd tests && npm run test:smoke --silent) 2>&1 | tee "$smoke_log"
  smoke_exit=${PIPESTATUS[0]}
  set -e
  failed_count=$(grep -cE "^\s+[0-9]+ failed\b" "$smoke_log" || true)
  flaky_count=$(grep -oE "^\s+([0-9]+) flaky" "$smoke_log" | awk '{print $1}' | head -1)
  flaky_count=${flaky_count:-0}
  if [[ "$failed_count" -gt 0 ]]; then
    echo ""
    echo "❌ Smoke tests FAILED ($failed_count tests). Deploy aborted."
    echo "   Run 'cd tests && npm run report' for details."
    echo "   To bypass (not recommended): ./deploy.sh --skip-tests"
    rm -f "$smoke_log"
    exit 1
  fi
  if [[ "$smoke_exit" -ne 0 && "$flaky_count" -gt 0 ]]; then
    echo "⚠️  Smoke had $flaky_count flaky test(s) (passed on retry). Treating as pass per env-flakiness baseline."
  fi
  rm -f "$smoke_log"
  echo "✅ Smoke tests passed."
else
  echo "⚠️  Skipping tests (--skip-tests)."
fi

echo ""
echo "🚀 Pushing to live theme #$THEME_ID..."
if [[ ${#PUSH_ARGS[@]} -gt 0 ]]; then
  shopify theme push --theme "$THEME_ID" --nodelete --allow-live "${PUSH_ARGS[@]}"
else
  shopify theme push --theme "$THEME_ID" --nodelete --allow-live
fi
echo ""

# Notify @weslee_bot in the team Telegram thread.
# Reads version from layout/theme.liquid line 2 + matching entry from README-V3.md.
# Never fails the deploy: any error here is logged + swallowed.
notify_weslee() {
  local token_file="$HOME/.telegram-weslee-bot-token"
  if [[ ! -f "$token_file" ]]; then
    echo "📨 (telegram notify skipped: no token at $token_file)"
    return 0
  fi

  local version
  version=$(sed -n '2p' layout/theme.liquid | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  if [[ -z "$version" ]]; then
    echo "📨 (telegram notify skipped: could not read version from theme.liquid line 2)"
    return 0
  fi

  local entry
  entry=$(awk -v v="$version" '
    BEGIN { found = 0 }
    {
      if (index($0, "- **v" v "**") == 1) { found = 1; print; next }
      if (found && /^- \*\*v[0-9]/) { exit }
      if (found) print
    }
  ' README-V3.md 2>/dev/null || true)

  if [[ -z "$entry" ]]; then
    entry="(no changelog entry found for v${version} in README-V3.md)"
  fi

  # Format the entry for Telegram readability:
  # 1. Strip the "- **vX.Y.Z** (date) - " prefix (we have the version in the header).
  # 2. Convert any sub-bullets ("  - " or "  * ") into emoji-prefixed lines (• ).
  # 3. Trim a "Touches X, Y, Z." or "**Files:** ..." engineering tail.
  # 4. Strip stray markdown bold (**X**) markers that telegram won't render in plain text.
  # 5. Collapse multiple blank lines.
  # 6. Cap at 1800 chars.
  local body
  body=$(printf '%s' "$entry" | sed -E '
    s/^- \*\*v[0-9.]+\*\* \([^)]*\) [-–—]?[[:space:]]*//
    s/^[[:space:]]+[-*][[:space:]]+/  • /
    s/\*\*([^*]+)\*\*/\1/g
    s/[[:space:]]+(Touches |\*\*Files:\*\* |Files: ).*$//
  ' | awk 'NF>0 || (NR>1 && prev>0) {print; prev=NF}' )
  if [[ ${#body} -gt 1800 ]]; then
    body="${body:0:1800}..."
  fi

  local token
  token=$(cat "$token_file")

  local msg
  msg=$(cat <<EOF
🚀 Theme deploy: v${version}
━━━━━━━━━━━━━━━━━━━━

${body}

━━━━━━━━━━━━━━━━━━━━

🔗 Live: https://thebonpet.com
📎 Admin: https://admin.shopify.com/store/d2ac44-d5/themes/${THEME_ID}
🐾
EOF
)

  if curl -sS -X POST "https://api.telegram.org/bot${token}/sendMessage" \
       -d "chat_id=-1002184573790" \
       -d "message_thread_id=34253" \
       --data-urlencode "text=${msg}" >/dev/null 2>&1; then
    echo "📨 Posted v${version} to weslee Telegram thread."
  else
    echo "📨 (telegram notify failed; deploy itself succeeded)"
  fi
}

notify_weslee || true

# Mirror the deploy to GitHub (private backup repo: yash-gadodia/thebonpet-theme).
# Never fails the deploy: any git error is logged + swallowed.
git_backup() {
  if [[ ! -d .git ]]; then
    echo "🐙 (git backup skipped: no .git here)"
    return 0
  fi

  local version
  version=$(sed -n '2p' layout/theme.liquid | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
  version="${version:-unknown}"

  if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
    echo "🐙 (git backup skipped: tree clean)"
    return 0
  fi

  git add -A 2>/dev/null || { echo "🐙 (git add failed; deploy itself succeeded)"; return 0; }
  if ! git -c commit.gpgsign=false commit -q -m "Deploy v${version}" 2>/dev/null; then
    echo "🐙 (git commit failed or nothing staged; deploy itself succeeded)"
    return 0
  fi
  if git push -q origin HEAD 2>/dev/null; then
    echo "🐙 Pushed v${version} to GitHub backup."
  else
    echo "🐙 (git push failed; commit kept locally — push manually with: git push origin HEAD)"
  fi
}

git_backup || true

echo "🎉 Deploy complete."
