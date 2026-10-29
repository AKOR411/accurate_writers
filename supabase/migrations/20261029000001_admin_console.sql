alter table public.profiles
  add column email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where users.id = profiles.id;

alter table public.profiles
  alter column email set not null;

create unique index profiles_email_lower_key
  on public.profiles (lower(email));

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.admin_users enable row level security;
revoke all on table private.admin_users from public, anon, authenticated;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using ((select private.is_admin()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(requested_name, ''), 'New writer'),
    case
      when requested_role = 'employer' then 'employer'::public.account_role
      else 'writer'::public.account_role
    end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create function public.handle_auth_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = lower(new.email)
  where id = new.id;
  return new;
end;
$$;

revoke all on function public.handle_auth_email_updated() from public, anon, authenticated;

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure public.handle_auth_email_updated();

create type public.job_status as enum ('pending', 'approved', 'rejected', 'closed');
create type public.application_status as enum (
  'pending',
  'shortlisted',
  'accepted',
  'rejected',
  'withdrawn'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 140),
  description text not null check (char_length(btrim(description)) between 30 and 10000),
  category text not null check (char_length(btrim(category)) between 2 and 60),
  budget_min numeric(12, 2) not null check (budget_min > 0),
  budget_max numeric(12, 2) not null check (budget_max >= budget_min),
  currency text not null default 'KES' check (currency ~ '^[A-Z]{3}$'),
  word_count integer check (word_count is null or word_count > 0),
  deadline date,
  status public.job_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  writer_id uuid not null references public.profiles (id) on delete cascade,
  cover_letter text not null check (char_length(btrim(cover_letter)) between 30 and 5000),
  proposed_budget numeric(12, 2) check (proposed_budget is null or proposed_budget > 0),
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, writer_id)
);

create index jobs_status_created_at_idx
  on public.jobs (status, created_at desc);
create index jobs_employer_created_at_idx
  on public.jobs (employer_id, created_at desc);
create index applications_status_created_at_idx
  on public.applications (status, created_at desc);
create index applications_writer_created_at_idx
  on public.applications (writer_id, created_at desc);

alter table public.jobs enable row level security;
alter table public.applications enable row level security;

revoke all on table public.jobs, public.applications from anon, authenticated;
grant select on table public.jobs to anon, authenticated;
grant insert, update, delete on table public.jobs to authenticated;
grant select, insert on table public.applications to authenticated;
grant update (status) on table public.applications to authenticated;

create policy "Anyone can read approved jobs"
on public.jobs
for select
to anon, authenticated
using (status = 'approved');

create policy "Employers can read their own jobs"
on public.jobs
for select
to authenticated
using (employer_id = (select auth.uid()));

create policy "Employers can create their own jobs"
on public.jobs
for insert
to authenticated
with check (
  employer_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'employer'
  )
);

create policy "Employers can update their own jobs"
on public.jobs
for update
to authenticated
using (
  employer_id = (select auth.uid())
  and (select role from public.profiles where id = (select auth.uid())) = 'employer'
)
with check (
  employer_id = (select auth.uid())
  and (select role from public.profiles where id = (select auth.uid())) = 'employer'
);

create policy "Admins can manage all jobs"
on public.jobs
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Writers and relevant employers can read applications"
on public.applications
for select
to authenticated
using (
  writer_id = (select auth.uid())
  or exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.employer_id = (select auth.uid())
  )
  or (select private.is_admin())
);

create policy "Writers can apply to approved jobs"
on public.applications
for insert
to authenticated
with check (
  writer_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'writer'
  )
  and exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id and jobs.status = 'approved'
  )
);

create policy "Writers can withdraw pending applications"
on public.applications
for update
to authenticated
using (writer_id = (select auth.uid()) and status = 'pending')
with check (writer_id = (select auth.uid()) and status = 'withdrawn');

create policy "Employers can review applications to their jobs"
on public.applications
for update
to authenticated
using (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.employer_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id
      and jobs.employer_id = (select auth.uid())
  )
);

create policy "Admins can manage all applications"
on public.applications
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create function private.guard_job_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not private.is_admin() then
    if old.employer_id = (select auth.uid())
      and old.status in ('pending', 'approved')
      and new.status = 'closed' then
      return new;
    end if;

    raise exception 'Only an administrator can moderate job listings.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_job_moderation() from public, anon, authenticated;

create trigger on_job_moderation_guard
  before update on public.jobs
  for each row execute procedure private.guard_job_moderation();

create trigger on_job_updated
  before update on public.jobs
  for each row execute procedure public.handle_profile_updated_at();

create trigger on_application_updated
  before update on public.applications
  for each row execute procedure public.handle_profile_updated_at();
