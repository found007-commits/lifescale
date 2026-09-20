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
#   scripts/release-web.sh --verify-only   # re-run the live checks, deploy nothing
#
# The Vercel login lives at "~/Library/Application Support/com.vercel.cli/auth.json" on
# macOS (not ~/.vercel). `npx vercel whoami` has to print an account name before this runs.

set -euo pipefail
cd "$(dirname "$0")/.."

VERCEL_VERSION=59.1.4
ROUTES=(/ /chapters /sanctuary /privacy /terms)

ALLOW_DIRTY=0
VERIFY_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

# Everything up to the verification is the gate that stands in front of a deployment. With
# --verify-only the gate is skipped and only the live checks run, which is how the checks can
# be re-run later against a site nobody in this session deployed.
if [ "$VERIFY_ONLY" -eq 0 ]; then

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

else
step "verify the live site (--verify-only: nothing was deployed)"
fi

failed=0
for route in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://app.lifescale.space$route" || echo 000)
  printf '  %-12s %s\n' "$route" "$code"
  [ "$code" = "200" ] || failed=1
done
# The landing page is client rendered, so its content cannot be read out of the HTML. Its
# stylesheet can, and that is enough to prove the build shipped. One selector per release is
# listed here, appended to rather than replaced: checking only the newest one would let a
# later release pass while an earlier release's rules quietly disappeared from the bundle.
#   .chapter-section   2.0.9
#   .guide-header      2.0.10
#   a:not(.brand)      2.0.11 - the minified form of ".legal-header > a:not(.brand)",
#                      which is the one rule this release adds and no earlier one has.
MARKERS=(.chapter-section .guide-header 'a:not(.brand)')
css=$(curl -s --max-time 20 https://app.lifescale.space/ | grep -o '/_next/static/chunks/[^"]*\.css' | head -1)
if [ -z "$css" ]; then
  echo "  could not locate a stylesheet to inspect" >&2
  failed=1
else
  body=$(curl -s --max-time 20 "https://app.lifescale.space$css")
  for marker in "${MARKERS[@]}"; do
    hits=$(printf '%s' "$body" | grep -c -- "$marker" || true)
    printf '  %-12s %-16s in %s: %s\n' "/ (css)" "$marker" "$css" "$hits"
    [ "$hits" -gt 0 ] || failed=1
  done
fi
# The guide pages are server rendered, so unlike the landing page their markup can be read
# straight out of the response. A release that changes what these pages contain has to be
# checked here, or a 200 on the route would be mistaken for the change having shipped.
# Two releases have put a control in this header, so both are named: 2.0.10 added the
# language control, 2.0.11 the theme control beside it.
for route in /chapters /sanctuary; do
  body=$(curl -s --max-time 20 "https://app.lifescale.space$route")
  for marker in 'class="language-select"' 'class="theme-button"'; do
    hits=$(printf '%s' "$body" | grep -c -- "$marker" || true)
    printf '  %-12s %-24s %s\n' "$route" "$marker" "$hits"
    [ "$hits" -gt 0 ] || failed=1
  done
done

if [ "$failed" -ne 0 ]; then
  echo
  echo "one or more checks failed - the deployment is live but looks wrong." >&2
  echo "roll back from the Vercel dashboard (Deployments -> promote the previous one)." >&2
  exit 1
fi

printf '\n✓ %s\n' "$([ "$VERIFY_ONLY" -eq 1 ] && echo 'live site matches the release' || echo 'deployed and verified')"
