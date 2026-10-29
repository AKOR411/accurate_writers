# Accurate Writers

Accurate Writers is a writing-opportunity marketplace for writers and the
clients looking to hire them.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run lint` and
`npm run build` to check the application.

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Set `SUPABASE_URL` to the project URL shown in Supabase **Project
   Settings → API**. It must include your project reference, for example
   `https://your-project-ref.supabase.co`.
3. Set `SUPABASE_ANON_KEY` to that project's publishable key (or legacy anon
   key). These credentials are used by server-side Supabase clients; do not
   add a `NEXT_PUBLIC_` prefix.
4. Set `NEXT_PUBLIC_SITE_URL` to the local or deployed site origin.
5. Apply `supabase/migrations/20261029000000_create_profiles.sql` in the
   Supabase SQL Editor. It creates account profiles, a role enum, a profile
   trigger, and row-level security policies.
6. In **Authentication → URL Configuration**, set the Site URL to the site
   origin and allow `/auth/callback` as a redirect URL. Keep email confirmation
   enabled for production.
7. Restart the development server after changing `.env.local`.

Signup and login use Supabase Auth. Email confirmations exchange their
one-time code through the server-side callback, and authenticated sessions
are refreshed using the Next.js 16 `proxy.ts` convention. User profile roles
are stored in Postgres and cannot be changed through the profile update policy.

The public job listings are still sample content; job posting, applications,
messaging, payments, and social sign-in are not connected yet. Do not put
database passwords, connection strings, service-role keys, or other secrets in
the browser or commit them to Git. The database password previously shared
during setup must be rotated before it is used.
