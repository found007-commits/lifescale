#!/usr/bin/env bash
#
# Publishes the website to app.lifescale.space from this machine.
#
# Why a local script instead of CI: the GitHub Actions workflow
# (.github/workflows/deploy-overseas.yml) has been disabled. Its VERCEL_TOKEN secret was
# revoked on 21 August 2026, and a long-lived replacement can only be minted by hand in the
# Vercel dashboard - the CLI's own session cannot create one (POST as that app returns 403
# "Cannot create tokens for this app"). Until someone does that, this is the supported
# channel, so the four checks that workflow used to run live here instead: releasing from
# this script is not a way around the gate, it is where the gate now lives.
#
# Usage:
#   scripts/release-web.sh                 # refuses to run on a dirty working tree
#   scripts/release-web.sh --allow-dirty   # for a deliberate hotfix
#
# The Vercel login lives at "~/Library/Application Support/com.vercel.cli/auth.json" on
# macOS (not ~/.vercel). `npx vercel whoami` has to print an account name before this runs.

set -euo pipefail
cd "$(dirname "$0")/.."

VERCEL_VERSION=59.1.4
ROUTES=(/ /chapters /sanctuary /privacy /terms)

ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "0/6  what is about to ship"
git --no-pager log --oneline -1
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  if [ "$ALLOW_DIRTY" -eq 1 ]; then
    echo "!! working tree is dirty and --allow-dirty was passed: the deployed output will not"
    echo "!! match any commit. Record the commit above anyway."
  else
    echo "refusing to deploy a dirty working tree; commit first, or pass --allow-dirty" >&2
    exit 1
  fi
else
  echo "working tree clean"
fi

command -v npx >/dev/null || { echo "npx not found" >&2; exit 1; }
for bin in eslint tsc tsx next; do
  [ -x "node_modules/.bin/$bin" ] || { echo "node_modules/.bin/$bin missing - install dependencies first" >&2; exit 1; }
done

step "1/6  vercel login, and which project it points at"
whoami_out=$(npx --yes "vercel@$VERCEL_VERSION" whoami 2>&1 | tail -1)
if [ -z "$whoami_out" ]; then
  echo "not logged in to Vercel on this machine; run: npx vercel@$VERCEL_VERSION login" >&2
  exit 1
fi
echo "logged in as: $whoami_out"
echo "linked project: $(cat .vercel/project.json)"

step "2/6  eslint (web + mini program)"
./node_modules/.bin/eslint . --ignore-pattern dist --ignore-pattern .next
./node_modules/.bin/eslint --config eslint.mini.config.mjs miniprogram

step "3/6  typecheck"
./node_modules/.bin/tsc --noEmit

step "4/6  tests"
./node_modules/.bin/tsx --test tests/*.test.ts tests/*.test.mjs

step "5/6  build"
./node_modules/.bin/next build

step "6/6  deploy to production"
# Deliberately no `vercel pull`: it writes the production environment, service-role key
# included, to .vercel/.env.production.local. The remote build reads the project's own
# environment, so the file is not needed for a plain `deploy`.
npx --yes "vercel@$VERCEL_VERSION" deploy --prod --yes

step "verify the live site"
sleep 3
failed=0
for route in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://app.lifescale.space$route" || echo 000)
  printf '  %-12s %s\n' "$route" "$code"
  [ "$code" = "200" ] || failed=1
done
# The landing page is client rendered, so its content cannot be read out of the HTML. Its
# stylesheet and its JavaScript both can, and that is enough to prove the build shipped.
css=$(curl -s --max-time 20 https://app.lifescale.space/ | grep -o '/_next/static/chunks/[^"]*\.css' | head -1)
if [ -n "$css" ]; then
  hits=$(curl -s --max-time 20 "https://app.lifescale.space$css" | grep -c -- '.chapter-section' || true)
  printf '  %-12s chapter styles in %s: %s\n' "/ (css)" "$css" "$hits"
  [ "$hits" -gt 0 ] || failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo
  echo "one or more checks failed - the deployment is live but looks wrong." >&2
  echo "roll back from the Vercel dashboard (Deployments -> promote the previous one)." >&2
  exit 1
fi

printf '\n✓ deployed and verified\n'
