# LifeScale Overseas Web App

Production application for [app.lifescale.space](https://app.lifescale.space). The brand website at `lifescale.space` is a separate project and is not modified here.

## Product scope

- Email OTP sign-up and sign-in through Supabase Auth
- Cloud-synced profile, life target, check-ins, journal entries and images
- Server-enforced one-year lock for birth date and target date
- Gentle and clear life-scale modes, including the Bonus Chapter after the target date
- Private-by-default records with opt-in public visibility
- Seven-day statistical report and privacy-safe downloadable share card
- Data export and permanent account deletion
- Chinese and English foundations, responsive layout, light/dark theme and PWA install support

## Infrastructure

- Next.js App Router on Vercel
- Supabase Auth, PostgreSQL, Storage and Row Level Security
- Database migration: `supabase/migrations/20260821000000_lifescale_core.sql`

Required environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix.

## Setup

1. Create or select a Supabase project.
2. Link the CLI and run `supabase db push`.
3. Configure the Auth Site URL as `https://app.lifescale.space` and include the six-digit `{{ .Token }}` in the email OTP template.
4. Add the three environment variables to Vercel Production and Preview.
5. Release with `scripts/release-web.sh` (see below).

## Releasing the website

`scripts/release-web.sh` is the supported release channel. It runs eslint (web and mini
program), `tsc --noEmit`, the full test suite and `next build`, then deploys to production
and checks the live routes:

```bash
scripts/release-web.sh                 # refuses to run on a dirty working tree
scripts/release-web.sh --allow-dirty   # deliberate hotfix only
scripts/release-web.sh --verify-only   # re-run the live checks, deploy nothing
```

The live checks are more than a status code sweep, because a 200 only proves the route
answers — not that the change shipped. Each release adds one selector to `MARKERS` in the
script and, where a page is server rendered, a marker read straight out of its markup: those
are the strings that would still pass every route check while the release itself was missing.

It uses the Vercel CLI login already on the machine — on macOS that lives in
`~/Library/Application Support/com.vercel.cli/auth.json`, and `npx vercel whoami` must print
an account name. It deliberately does not run `vercel pull`, which would write the
production environment, service-role key included, to `.vercel/.env.production.local`.

`.github/workflows/deploy-overseas.yml` is **disabled**: its `VERCEL_TOKEN` secret was
revoked on 21 August 2026, and a replacement can only be created by hand in the Vercel
dashboard (the CLI's own session is refused with `Cannot create tokens for this app`). Pushes
therefore do not deploy. To restore push-to-deploy, either create a token and re-enable the
workflow, or connect the repository to the Vercel project and delete the workflow.

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
