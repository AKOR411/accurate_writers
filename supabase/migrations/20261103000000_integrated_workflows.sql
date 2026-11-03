alter table public.profiles
  add column bio text not null default '',
  add column skills text[] not null default '{}',
  add column portfolio_url text;

alter table public.jobs
  add column is_draft boolean not null default false,
  add column filled_at timestamptz;
alter table public.applications
  add column experience_summary text not null default '' check (char_length(experience_summary) <= 4000);

grant update (bio, skills, portfolio_url) on public.profiles to authenticated;

drop policy if exists "Anyone can read approved jobs" on public.jobs;
create policy "Anyone can read available approved jobs"
on public.jobs for select to anon, authenticated
using (status = 'approved' and not is_draft and filled_at is null);

drop policy if exists "Employers can create their own jobs" on public.jobs;
create policy "Employers can create their own jobs"
on public.jobs for insert to authenticated
with check (
  employer_id = (select auth.uid())
  and status = 'pending'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'employer')
);

create policy "Writers can read employers of available jobs"
on public.profiles for select to authenticated
using (
  role = 'employer'
  and exists (
    select 1 from public.jobs
    where jobs.employer_id = profiles.id
      and jobs.status = 'approved'
      and not jobs.is_draft
      and jobs.filled_at is null
  )
);

create policy "Writers can read employers of applied jobs"
on public.profiles for select to authenticated
using (
  role = 'employer'
  and exists (
    select 1 from public.jobs j
    join public.applications a on a.job_id = j.id
    where j.employer_id = profiles.id and a.writer_id = (select auth.uid())
  )
);

drop policy if exists "Writers can apply to approved jobs" on public.applications;
create policy "Writers can apply to available approved jobs"
on public.applications for insert to authenticated
with check (
  writer_id = (select auth.uid())
  and status = 'pending'
  and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'writer')
  and exists (
    select 1 from public.jobs
    where jobs.id = applications.job_id and jobs.status = 'approved'
      and not jobs.is_draft and jobs.filled_at is null
  )
);

create type public.offer_status as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
create type public.assignment_status as enum ('in_progress', 'submitted_for_review', 'revision_requested', 'completed', 'cancelled');
create type public.submission_status as enum ('submitted', 'revision_requested', 'approved');
create type public.payment_status as enum ('pending', 'processing', 'paid', 'failed', 'refunded', 'disputed');

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  application_id uuid not null unique references public.applications(id) on delete cascade,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  writer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  instructions text not null default '',
  status public.offer_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_pending_offer_per_job_idx
  on public.job_offers(job_id) where status = 'pending';
create index job_offers_writer_created_idx on public.job_offers(writer_id, created_at desc);
create index job_offers_employer_created_idx on public.job_offers(employer_id, created_at desc);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  offer_id uuid not null unique references public.job_offers(id) on delete restrict,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  writer_id uuid not null references public.profiles(id) on delete cascade,
  agreed_amount numeric(12,2) not null check (agreed_amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  instructions text not null default '',
  deadline date,
  status public.assignment_status not null default 'in_progress',
  accepted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assignments_writer_status_idx on public.assignments(writer_id, status, created_at desc);
create index assignments_employer_status_idx on public.assignments(employer_id, status, created_at desc);

create policy "Writers can read jobs assigned to them"
on public.jobs for select to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.job_id = jobs.id and a.writer_id = (select auth.uid())
  )
);

create policy "Participants can read each other's assignment profiles"
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.assignments a
    where (a.employer_id = profiles.id and a.writer_id = (select auth.uid()))
       or (a.writer_id = profiles.id and a.employer_id = (select auth.uid()))
  )
);

create table public.work_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  writer_id uuid not null references public.profiles(id) on delete cascade,
  version integer not null check (version > 0),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf')),
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  comments text not null default '',
  status public.submission_status not null default 'submitted',
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, version)
);

create index work_submissions_assignment_created_idx on public.work_submissions(assignment_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check ((job_id is not null) <> (assignment_id is not null)),
  check (sender_id <> recipient_id)
);

create index messages_recipient_created_idx on public.messages(recipient_id, created_at desc);
create index messages_assignment_created_idx on public.messages(assignment_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete restrict,
  employer_id uuid not null references public.profiles(id) on delete cascade,
  writer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  provider text,
  provider_reference text unique,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (assignment_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.is_assignment_participant(target_assignment uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignments
    where id = target_assignment and (employer_id = (select auth.uid()) or writer_id = (select auth.uid()))
  );
$$;
revoke all on function private.is_assignment_participant(uuid) from public, anon;
grant execute on function private.is_assignment_participant(uuid) to authenticated;

alter table public.job_offers enable row level security;
alter table public.assignments enable row level security;
alter table public.work_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.disputes enable row level security;

revoke all on public.job_offers, public.assignments, public.work_submissions,
  public.notifications, public.messages, public.payments, public.reviews, public.disputes
from anon, authenticated;
grant select on public.job_offers, public.assignments, public.work_submissions,
  public.notifications, public.messages, public.payments, public.reviews, public.disputes
to authenticated;
grant update (read_at) on public.notifications, public.messages to authenticated;
grant update (status, resolution, resolved_at, updated_at) on public.disputes to authenticated;
grant insert on public.messages to authenticated;
grant insert on public.reviews, public.disputes to authenticated;

create policy "Participants can read their offers" on public.job_offers
for select to authenticated using (employer_id = (select auth.uid()) or writer_id = (select auth.uid()));
create policy "Participants can read their assignments" on public.assignments
for select to authenticated using (employer_id = (select auth.uid()) or writer_id = (select auth.uid()));
create policy "Admins can read assignments related to disputes" on public.assignments
for select to authenticated using (private.is_admin());
create policy "Participants can read work submissions" on public.work_submissions
for select to authenticated using (private.is_assignment_participant(assignment_id));
create policy "Writers can add submissions to their active assignments" on public.work_submissions
for insert to authenticated with check (
  writer_id = (select auth.uid())
  and exists (
    select 1 from public.assignments
    where id = assignment_id and writer_id = (select auth.uid())
      and status in ('in_progress', 'revision_requested')
  )
);
create policy "Users can read their notifications" on public.notifications
for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Users can mark their notifications read" on public.notifications
for update to authenticated using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
create policy "Conversation participants can read messages" on public.messages
for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy "Conversation participants can send authorized messages" on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and (
    (assignment_id is not null and exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and ((a.employer_id = sender_id and a.writer_id = recipient_id)
          or (a.writer_id = sender_id and a.employer_id = recipient_id))
    ))
    or (job_id is not null and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.employer_id = sender_id and exists (
        select 1 from public.applications ap where ap.job_id = j.id and ap.writer_id = recipient_id
      )
    ))
    or (job_id is not null and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.employer_id = recipient_id and exists (
        select 1 from public.applications ap where ap.job_id = j.id and ap.writer_id = sender_id
      )
    ))
  )
);
create policy "Users can mark received messages read" on public.messages
for update to authenticated using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));
create policy "Participants can read assignment payments" on public.payments
for select to authenticated using (employer_id = (select auth.uid()) or writer_id = (select auth.uid()));
create policy "Participants can read assignment reviews" on public.reviews
for select to authenticated using (reviewer_id = (select auth.uid()) or reviewee_id = (select auth.uid()));
create policy "Participants can review completed assignments" on public.reviews
for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_id and a.status = 'completed'
      and ((a.employer_id = reviewer_id and a.writer_id = reviewee_id)
        or (a.writer_id = reviewer_id and a.employer_id = reviewee_id))
  )
);
create policy "Participants can read assignment disputes" on public.disputes
for select to authenticated using (opened_by = (select auth.uid()) or private.is_assignment_participant(assignment_id));
create policy "Participants can open assignment disputes" on public.disputes
for insert to authenticated with check (
  opened_by = (select auth.uid()) and private.is_assignment_participant(assignment_id)
);
create policy "Admins can manage assignment disputes" on public.disputes
for all to authenticated using (private.is_admin()) with check (private.is_admin());

create function private.create_notification(
  recipient uuid, actor uuid, event text, heading text, detail text, destination text
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications(recipient_id, actor_id, event_type, title, body, href)
  values (recipient, actor, event, heading, detail, destination);
$$;
revoke all on function private.create_notification(uuid, uuid, text, text, text, text) from public, anon, authenticated;

create function private.notify_review_or_dispute()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare assignment_row public.assignments%rowtype;
begin
  select * into assignment_row from public.assignments where id = new.assignment_id;
  if tg_table_name = 'reviews' then
    perform private.create_notification(new.reviewee_id, new.reviewer_id, 'assignment_review', 'New assignment review', 'A participant left feedback on a completed assignment.',
      case when new.reviewee_id = assignment_row.employer_id then '/dashboard/employer/manage-reviews' else '/dashboard/rating' end);
  else
    perform private.create_notification(
      case when new.opened_by = assignment_row.employer_id then assignment_row.writer_id else assignment_row.employer_id end,
      new.opened_by, 'assignment_dispute', 'Assignment dispute opened', left(new.reason, 180),
      case when new.opened_by = assignment_row.employer_id then '/dashboard/disputed' else '/dashboard/employer/disputed' end
    );
  end if;
  return new;
end;
$$;
create trigger notify_assignment_review after insert on public.reviews
for each row execute function private.notify_review_or_dispute();
create trigger notify_assignment_dispute after insert on public.disputes
for each row execute function private.notify_review_or_dispute();

create function private.notify_dispute_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare assignment_row public.assignments%rowtype;
begin
  if new.status is distinct from old.status then
    select * into assignment_row from public.assignments where id = new.assignment_id;
    perform private.create_notification(new.opened_by, null, 'dispute_' || new.status, 'Dispute status updated',
      'Your assignment dispute is now ' || new.status || coalesce(': ' || nullif(new.resolution, ''), '.'),
      case when exists (select 1 from public.profiles where id = new.opened_by and role = 'employer') then '/dashboard/employer/disputed' else '/dashboard/disputed' end);
    perform private.create_notification(
      case when new.opened_by = assignment_row.employer_id then assignment_row.writer_id else assignment_row.employer_id end,
      null, 'dispute_' || new.status, 'Dispute status updated', 'An assignment dispute is now ' || new.status || '.',
      case when new.opened_by = assignment_row.employer_id then '/dashboard/disputed' else '/dashboard/employer/disputed' end);
  end if;
  return new;
end;
$$;
create trigger notify_dispute_status after update of status on public.disputes
for each row execute function private.notify_dispute_status();

create function private.notify_new_application()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare job public.jobs%rowtype;
begin
  select * into job from public.jobs where id = new.job_id;
  perform private.create_notification(job.employer_id, new.writer_id, 'application_received', 'New application received', 'A writer applied for ' || job.title, '/dashboard/employer/request-bid');
  return new;
end;
$$;
create trigger notify_new_application after insert on public.applications
for each row execute function private.notify_new_application();

create function private.notify_application_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare job_title text;
begin
  if new.status is distinct from old.status and new.status in ('shortlisted', 'rejected') then
    select title into job_title from public.jobs where id = new.job_id;
    perform private.create_notification(new.writer_id, auth.uid(), 'application_' || new.status::text,
      case when new.status = 'shortlisted' then 'You were shortlisted' else 'Application update' end,
      case when new.status = 'shortlisted' then 'Your application for ' || job_title || ' was shortlisted.' else 'Your application for ' || job_title || ' was declined.' end,
      '/dashboard/applications');
  end if;
  return new;
end;
$$;
create trigger notify_application_status after update of status on public.applications
for each row execute function private.notify_application_status();

create function private.notify_offer_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare job_title text;
begin
  select title into job_title from public.jobs where id = new.job_id;
  if tg_op = 'INSERT' then
    perform private.create_notification(new.writer_id, new.employer_id, 'job_offer', 'A job offer is waiting', 'You received an offer for ' || job_title, '/dashboard/offers');
  elsif new.status = 'accepted' then
    perform private.create_notification(new.employer_id, new.writer_id, 'offer_accepted', 'Offer accepted', 'The writer accepted your offer for ' || job_title, '/dashboard/employer/in-progress');
  elsif new.status = 'declined' then
    perform private.create_notification(new.employer_id, new.writer_id, 'offer_declined', 'Offer declined', 'The writer declined your offer for ' || job_title, '/dashboard/employer/request-bid');
  elsif new.status = 'expired' then
    perform private.create_notification(new.employer_id, new.writer_id, 'offer_expired', 'Offer expired', 'The offer for ' || job_title || ' expired before it was accepted.', '/dashboard/employer/request-bid');
    perform private.create_notification(new.writer_id, new.employer_id, 'offer_expired', 'Offer expired', 'The offer for ' || job_title || ' has expired.', '/dashboard/offers');
  end if;
  return new;
end;
$$;
create trigger notify_offer_change after insert or update of status on public.job_offers
for each row execute function private.notify_offer_change();

create function private.notify_new_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare job_title text;
begin
  select title into job_title from public.jobs where id = new.job_id;
  perform private.create_notification(new.writer_id, new.employer_id, 'assignment_accepted', 'Assignment started', 'Your offer for ' || job_title || ' was accepted. You can now begin work.', '/dashboard/assignments');
  return new;
end;
$$;
create trigger notify_new_assignment after insert on public.assignments
for each row execute function private.notify_new_assignment();

create function private.notify_assignment_cancellation()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    perform private.create_notification(new.writer_id, new.employer_id, 'assignment_cancelled', 'Assignment cancelled', 'The employer cancelled this assignment.', '/dashboard/canceled');
  end if;
  return new;
end;
$$;
create trigger notify_assignment_cancellation after update of status on public.assignments
for each row execute function private.notify_assignment_cancellation();

create function private.notify_submission()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare assignment public.assignments%rowtype;
begin
  select * into assignment from public.assignments where id = new.assignment_id;
  if tg_op = 'INSERT' then
    perform private.create_notification(assignment.employer_id, new.writer_id, 'work_submitted', 'Work submitted for review', new.file_name || ' was submitted.', '/dashboard/employer/in-progress');
  elsif new.status = 'revision_requested' then
    perform private.create_notification(new.writer_id, assignment.employer_id, 'revision_requested', 'Revision requested', coalesce(new.review_notes, 'The employer requested a revision.'), '/dashboard/in-progress');
  elsif new.status = 'approved' then
    perform private.create_notification(new.writer_id, assignment.employer_id, 'work_approved', 'Work approved', 'Your submitted work was approved.', '/dashboard/completed');
  end if;
  return new;
end;
$$;
create trigger notify_submission after insert or update of status on public.work_submissions
for each row execute function private.notify_submission();

create function private.notify_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.create_notification(new.recipient_id, new.sender_id, 'message_received', 'New message', left(new.body, 180),
    case when new.assignment_id is not null then '/dashboard/assignments' else '/dashboard/chat' end);
  return new;
end;
$$;
create trigger notify_message after insert on public.messages
for each row execute function private.notify_message();

create function private.notify_payment_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.create_notification(new.writer_id, new.employer_id, 'payment_pending', 'Payment pending', 'An approved assignment payment is awaiting processing.', '/dashboard/payments');
  elsif new.status is distinct from old.status then
    perform private.create_notification(new.writer_id, new.employer_id, 'payment_' || new.status::text, 'Payment update', 'Your assignment payment status is now ' || new.status::text || '.', '/dashboard/payments');
    perform private.create_notification(new.employer_id, new.writer_id, 'payment_' || new.status::text, 'Payment update', 'An assignment payment status is now ' || new.status::text || '.', '/dashboard/employer/transaction-history');
  end if;
  return new;
end;
$$;
create trigger notify_payment_change after insert or update of status on public.payments
for each row execute function private.notify_payment_change();

create function public.award_job_offer(target_application uuid, offer_amount numeric, offer_instructions text default '')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare application_row public.applications%rowtype; job_row public.jobs%rowtype; new_offer uuid;
begin
  select * into application_row from public.applications where id = target_application for update;
  if not found then raise exception 'Application not found.'; end if;
  select * into job_row from public.jobs where id = application_row.job_id for update;
  if job_row.employer_id <> auth.uid() then raise exception 'You cannot award this job.'; end if;
  if application_row.status <> 'shortlisted' then raise exception 'Shortlist the writer before making an offer.'; end if;
  if job_row.status <> 'approved' or job_row.filled_at is not null then raise exception 'This job is no longer available.'; end if;
  update public.job_offers set status = 'expired', responded_at = coalesce(responded_at, now()), updated_at = now()
  where job_id = job_row.id and status = 'pending' and expires_at <= now();
  if exists (select 1 from public.assignments where job_id = job_row.id)
    or exists (select 1 from public.job_offers where job_id = job_row.id and status = 'pending') then
    raise exception 'This job already has an active offer or assignment.';
  end if;
  if offer_amount is null or offer_amount <= 0 then raise exception 'Enter a valid offer amount.'; end if;
  insert into public.job_offers(job_id, application_id, employer_id, writer_id, amount, currency, instructions)
  values (job_row.id, application_row.id, job_row.employer_id, application_row.writer_id, offer_amount, job_row.currency, coalesce(offer_instructions, ''))
  returning id into new_offer;
  return new_offer;
end;
$$;
revoke all on function public.award_job_offer(uuid, numeric, text) from public, anon;
grant execute on function public.award_job_offer(uuid, numeric, text) to authenticated;

create function public.respond_to_job_offer(target_offer uuid, accept_offer boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare offer_row public.job_offers%rowtype; job_row public.jobs%rowtype; new_assignment uuid;
begin
  select * into offer_row from public.job_offers where id = target_offer for update;
  if not found or offer_row.writer_id <> auth.uid() then raise exception 'Offer not found.'; end if;
  if offer_row.status <> 'pending' then raise exception 'This offer has already been answered.'; end if;
  if offer_row.expires_at <= now() then
    update public.job_offers set status = 'expired', responded_at = now(), updated_at = now() where id = offer_row.id;
    return null;
  end if;
  if not accept_offer then
    update public.job_offers set status = 'declined', responded_at = now(), updated_at = now() where id = offer_row.id;
    return null;
  end if;
  select * into job_row from public.jobs where id = offer_row.job_id for update;
  if job_row.filled_at is not null or job_row.status <> 'approved' then raise exception 'This job is no longer available.'; end if;
  insert into public.assignments(job_id, offer_id, employer_id, writer_id, agreed_amount, currency, instructions, deadline)
  values (offer_row.job_id, offer_row.id, offer_row.employer_id, offer_row.writer_id, offer_row.amount, offer_row.currency, offer_row.instructions, job_row.deadline)
  returning id into new_assignment;
  update public.job_offers set status = 'accepted', responded_at = now(), updated_at = now() where id = offer_row.id;
  update public.jobs set filled_at = now() where id = offer_row.job_id;
  update public.applications set status = 'rejected'
  where job_id = offer_row.job_id and id <> offer_row.application_id and status in ('pending', 'shortlisted');
  return new_assignment;
end;
$$;
revoke all on function public.respond_to_job_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_job_offer(uuid, boolean) to authenticated;

create function public.submit_assignment_work(
  target_assignment uuid, file_path text, upload_name text, upload_mime text, upload_size bigint, writer_comments text default ''
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare assignment_row public.assignments%rowtype; next_version integer; submission_id uuid;
begin
  select * into assignment_row from public.assignments where id = target_assignment for update;
  if not found or assignment_row.writer_id <> auth.uid() then raise exception 'Assignment not found.'; end if;
  if assignment_row.status not in ('in_progress', 'revision_requested') then raise exception 'This assignment is not accepting submissions.'; end if;
  if upload_mime not in ('application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf') then raise exception 'Upload a DOC, DOCX, or PDF file.'; end if;
  if upload_size <= 0 or upload_size > 26214400 then raise exception 'Files must be no larger than 25 MB.'; end if;
  if file_path not like target_assignment::text || '/' || auth.uid()::text || '/%' then raise exception 'Invalid private file path.'; end if;
  select coalesce(max(version), 0) + 1 into next_version from public.work_submissions where assignment_id = target_assignment;
  insert into public.work_submissions(assignment_id, writer_id, version, storage_path, file_name, mime_type, file_size, comments)
  values (target_assignment, auth.uid(), next_version, file_path, upload_name, upload_mime, upload_size, left(coalesce(writer_comments, ''), 2000))
  returning id into submission_id;
  update public.assignments set status = 'submitted_for_review', updated_at = now() where id = target_assignment;
  return submission_id;
end;
$$;
revoke all on function public.submit_assignment_work(uuid, text, text, text, bigint, text) from public, anon;
grant execute on function public.submit_assignment_work(uuid, text, text, text, bigint, text) to authenticated;

create function public.review_assignment_submission(target_assignment uuid, decision text, notes text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare assignment_row public.assignments%rowtype; submission_row public.work_submissions%rowtype;
begin
  select * into assignment_row from public.assignments where id = target_assignment for update;
  if not found or assignment_row.employer_id <> auth.uid() then raise exception 'Assignment not found.'; end if;
  if assignment_row.status <> 'submitted_for_review' then raise exception 'There is no submission awaiting review.'; end if;
  select * into submission_row from public.work_submissions where assignment_id = target_assignment order by version desc limit 1 for update;
  if not found then raise exception 'No submission was found.'; end if;
  if decision = 'revision' then
    if char_length(btrim(coalesce(notes, ''))) < 5 then raise exception 'Enter clear revision instructions.'; end if;
    update public.work_submissions set status = 'revision_requested', review_notes = left(notes, 4000), reviewed_at = now() where id = submission_row.id;
    update public.assignments set status = 'revision_requested', updated_at = now() where id = target_assignment;
  elsif decision = 'approve' then
    update public.work_submissions set status = 'approved', review_notes = nullif(left(coalesce(notes, ''), 4000), ''), reviewed_at = now() where id = submission_row.id;
    update public.assignments set status = 'completed', completed_at = now(), updated_at = now() where id = target_assignment;
    insert into public.payments(assignment_id, employer_id, writer_id, amount, currency)
    values (assignment_row.id, assignment_row.employer_id, assignment_row.writer_id, assignment_row.agreed_amount, assignment_row.currency)
    on conflict (assignment_id) do nothing;
  else
    raise exception 'Choose approve or request revision.';
  end if;
end;
$$;
revoke all on function public.review_assignment_submission(uuid, text, text) from public, anon;
grant execute on function public.review_assignment_submission(uuid, text, text) to authenticated;

create function public.cancel_assignment(target_assignment uuid, cancellation_reason text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare assignment_row public.assignments%rowtype;
begin
  select * into assignment_row from public.assignments where id = target_assignment for update;
  if not found or assignment_row.employer_id <> auth.uid() then raise exception 'Assignment not found.'; end if;
  if assignment_row.status not in ('in_progress', 'revision_requested') then raise exception 'This assignment cannot be cancelled in its current state.'; end if;
  if exists (select 1 from public.work_submissions where assignment_id = target_assignment and status = 'submitted') then raise exception 'Review submitted work before cancelling this assignment.'; end if;
  update public.assignments set status = 'cancelled', instructions = case when btrim(coalesce(cancellation_reason, '')) = '' then instructions else instructions || E'\n\nCancellation note: ' || left(cancellation_reason, 1000) end, updated_at = now() where id = target_assignment;
end;
$$;
revoke all on function public.cancel_assignment(uuid, text) from public, anon;
grant execute on function public.cancel_assignment(uuid, text) to authenticated;

create function public.mark_notifications_read(notification_ids uuid[])
returns void language sql security invoker set search_path = ''
as $$
  update public.notifications set read_at = now()
  where id = any(notification_ids) and recipient_id = (select auth.uid()) and read_at is null;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('work-submissions', 'work-submissions', false, 26214400,
  array['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 26214400,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Writers upload to their eligible assignments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'work-submissions'
  and exists (
    select 1 from public.assignments a
    where a.id::text = (storage.foldername(name))[1]
      and a.writer_id = (select auth.uid())
      and a.status in ('in_progress', 'revision_requested')
      and (storage.foldername(name))[2] = (select auth.uid())::text
  )
);

create policy "Assignment participants download submissions"
on storage.objects for select to authenticated
using (
  bucket_id = 'work-submissions'
  and exists (
    select 1 from public.assignments a
    where a.id::text = (storage.foldername(name))[1]
      and (a.writer_id = (select auth.uid()) or a.employer_id = (select auth.uid()))
  )
);

create policy "Writers remove failed uploads from their assignments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'work-submissions'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
