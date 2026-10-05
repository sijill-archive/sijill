# Sijill

Arabic, right-to-left archive project built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

## Run locally

```bash
npm install
npm run dev
```

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` for account access. Never expose a Supabase secret key in browser code or a `NEXT_PUBLIC_*` variable.

## Backend setup

The separate administration route is `/admin`. Database tables and Row Level Security policies are in `supabase/migrations/20261005_000001_admin_backend.sql`. They are not applied to the live Supabase project automatically. Follow [supabase/README.md](supabase/README.md) to review and apply the migration and assign the first owner account.

The current case and person-file pages are previews and do not yet save data. The AI review service, subscriber email delivery, broadcast delivery, and article editor are future backend stages.
