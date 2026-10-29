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
   Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` separately in every Vercel
   project that deploys this app; environment variables are not shared between
   the public frontend and the admin project. Set `NEXT_PUBLIC_SITE_URL` to
   `https://accurate-writers-ndxu.vercel.app` in the frontend Production
   environment, and to that same public frontend URL in the admin project's
   Production environment. Redeploy after changing them.
5. Apply `supabase/migrations/20261029000000_create_profiles.sql` in the
   Supabase SQL Editor. It creates account profiles, a role enum, a profile
   trigger, and row-level security policies.
6. Apply `supabase/migrations/20261029000001_admin_console.sql` in the SQL
   Editor after the profiles migration. It adds protected job and application
   records and the private administrator access list.
7. In **Authentication → URL Configuration**, set the production Site URL to
   the public website origin and allow the full public URL ending in
   `/auth/callback` as a redirect URL. Keep email confirmation enabled for
   production. After confirming an email, writers and employers are returned to
   the public login form to sign in.
8. Restart the development server after changing `.env.local`.

### Email confirmation rate limits

Supabase's built-in email service has a low project-wide sending limit. If
signup reports that the email rate limit was exceeded, wait for the hourly
limit to reset before retrying. For production delivery, configure and verify a
custom SMTP sender in **Authentication → SMTP Settings**; this allows the
project's email limit to be raised in **Authentication → Rate Limits**. Do not
raise the limit until the SMTP provider is configured and verified.

## Admin access

The admin console is served by this app at `/admin`; it is not a separate
deployment. To open it on `admin.accuratewriters.com`, configure the subdomain
on the existing Vercel project:

1. In Vercel, open the project's **Settings → Domains** and add
   `admin.accuratewriters.com`.
2. Follow Vercel's domain verification and DNS instructions. Add the exact DNS
   record Vercel shows at the domain's DNS provider.
3. In the Vercel project's **Settings → Environment Variables**, set
   `ADMIN_HOSTNAME` to `admin.accuratewriters.com` for Production and redeploy.
   Keep `NEXT_PUBLIC_SITE_URL` set to the main website origin, such as
   `https://accuratewriters.com`, not the admin hostname.

The admin hostname routes directly to the administrator-only login page at
`/login`, then to the protected console after sign-in. Public writer/employer
registration remains on the main website. Authentication cookies remain scoped
to the admin hostname, so the main website and admin portal have separate
sign-in sessions.

To grant the first administrator:

1. In the Supabase SQL Editor, run the migrations in order:
   `supabase/migrations/20261029000000_create_profiles.sql`, then
   `supabase/migrations/20261029000001_admin_console.sql`. The admin login
   checks the `public.is_admin()` function created by the second migration.
2. In Supabase, open **Authentication → Users** and create the manager account
   directly. Set the email and choose a new password privately; do not use
   public writer/employer signup to create an administrator.
3. In the Supabase SQL Editor, run the statement below after replacing the
   example address with the exact email used for that account:

   ```sql
   insert into private.admin_users (user_id)
   select id
   from auth.users
   where lower(email) = lower('you@example.com')
   on conflict (user_id) do nothing;
   ```

4. Sign in at the admin project URL. The admin portal provides sign-in only;
   public signup links and signup actions are disabled on that hostname.

To revoke access, remove that account from the private admin table:

```sql
delete from private.admin_users
where user_id = (
  select id from auth.users where lower(email) = lower('you@example.com')
);
```

Never expose or grant administrator access from the public signup form.
Payments are not connected, so the console intentionally does not display
payment or revenue data.

Signup and login use Supabase Auth. Email confirmations exchange their
one-time code through the server-side callback, clear the temporary session,
and return users to the public login form. Authenticated sessions are refreshed
using the Next.js 16 `proxy.ts` convention. User profile roles are stored in
Postgres and cannot be changed through the profile update policy.
Each email address belongs to one Auth account and one selected profile role.
The signup selection is saved as `writer` or `employer` by the database's
`handle_new_user` trigger. To register separate writer and employer accounts,
use a different email address for each; signing up again with the same address
shows an existing-account error.

The public job listings are still sample content; job posting, applications,
messaging, payments, and social sign-in are not connected yet. The admin
console's job and application queues will populate when those records are
created. Do not put database passwords, connection strings, service-role keys,
or other secrets in the browser or commit them to Git. The database password
previously shared during setup must be rotated before it is used.
