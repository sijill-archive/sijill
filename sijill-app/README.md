# Sijill frontend

Arabic, right-to-left Sijill homepage, built with Next.js App Router, TypeScript, and Tailwind CSS. It uses the system color preference for dark mode and has no external UI libraries.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set the Supabase project URL, publishable key, and a server-only secret key before using the submission form. Keep `SUPABASE_SECRET_KEY` out of all `NEXT_PUBLIC_*` variables and browser code.

Open http://localhost:3000. The submission API validates every field server-side and saves new records as `submitted`; they remain private until a reviewer publishes them. `/testimonies` reads only published, consented records and only its public-safe columns. The form deliberately collects no witness name.

The live Supabase project must have both migrations applied from the repository root. Published archive records require review; the first reviewer/admin role must be assigned through a trusted Supabase administrative session, never through the public client.
