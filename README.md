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
5. Run `pnpm test`, then deploy the `lifescale-overseas` Vercel project.

## Commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
