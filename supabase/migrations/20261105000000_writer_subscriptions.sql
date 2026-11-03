create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  writer_id uuid not null references public.profiles(id) on delete cascade,
  plan_key text not null check (plan_key in ('weekly', 'two_weeks', 'monthly')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  duration_days integer not null check (duration_days > 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'failed', 'payment_review', 'cancelled')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_one_current_per_writer_idx
  on public.subscriptions(writer_id)
  where status in ('pending_payment', 'active', 'payment_review');
create index subscriptions_writer_created_idx on public.subscriptions(writer_id, created_at desc);

create table public.subscription_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  writer_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'daraja' check (provider = 'daraja'),
  merchant_request_id text,
  checkout_request_id text unique,
  phone_number text not null check (phone_number ~ '^254[17][0-9]{8}$'),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'initiating'
    check (status in ('initiating', 'pending', 'paid', 'failed', 'verification_failed')),
  receipt_number text unique,
  result_code text,
  result_description text,
  callback_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscription_payment_attempts_one_active_idx
  on public.subscription_payment_attempts(subscription_id)
  where status in ('initiating', 'pending');
create index subscription_payment_attempts_writer_created_idx
  on public.subscription_payment_attempts(writer_id, created_at desc);

create trigger on_subscription_updated
  before update on public.subscriptions
  for each row execute function public.handle_profile_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscription_payment_attempts enable row level security;

revoke all on public.subscriptions, public.subscription_payment_attempts from public, anon, authenticated;
grant select on public.subscriptions, public.subscription_payment_attempts to authenticated;
grant select, insert, update on public.subscriptions, public.subscription_payment_attempts to service_role;

create policy "Writers can read their subscriptions"
on public.subscriptions for select to authenticated
using (writer_id = (select auth.uid()));

create policy "Writers can read their subscription payment attempts"
on public.subscription_payment_attempts for select to authenticated
using (writer_id = (select auth.uid()));

create function public.process_daraja_subscription_callback(
  target_checkout_id text,
  target_merchant_id text,
  callback_result_code text,
  callback_result_description text,
  callback_amount numeric,
  callback_phone text,
  callback_receipt text
) returns text language plpgsql security definer set search_path = ''
as $$
declare
  attempt_row public.subscription_payment_attempts%rowtype;
  subscription_row public.subscriptions%rowtype;
  next_status text;
begin
  select * into attempt_row
  from public.subscription_payment_attempts
  where checkout_request_id = target_checkout_id
  for update;

  if not found then return 'not_found'; end if;
  if attempt_row.merchant_request_id is distinct from target_merchant_id then return 'merchant_mismatch'; end if;
  if attempt_row.status in ('paid', 'failed', 'verification_failed') then return attempt_row.status; end if;

  select * into subscription_row
  from public.subscriptions
  where id = attempt_row.subscription_id
  for update;

  if not found then return 'subscription_not_found'; end if;

  if callback_result_code = '0' then
    if callback_amount is null
      or callback_amount <> attempt_row.amount
      or callback_phone is distinct from attempt_row.phone_number
      or nullif(btrim(coalesce(callback_receipt, '')), '') is null then
      update public.subscription_payment_attempts
      set status = 'verification_failed',
          result_code = callback_result_code,
          result_description = 'Success callback did not match the expected amount, phone, or receipt.',
          callback_received_at = now(),
          updated_at = now()
      where id = attempt_row.id;

      update public.subscriptions
      set status = 'payment_review', updated_at = now()
      where id = subscription_row.id and status = 'pending_payment';
      return 'verification_failed';
    end if;
    next_status := 'paid';
  else
    next_status := 'failed';
  end if;

  update public.subscription_payment_attempts
  set status = next_status,
      receipt_number = nullif(callback_receipt, ''),
      result_code = callback_result_code,
      result_description = left(coalesce(callback_result_description, ''), 500),
      callback_received_at = now(),
      updated_at = now()
  where id = attempt_row.id;

  if next_status = 'paid' then
    update public.subscriptions
    set status = 'active',
        starts_at = now(),
        expires_at = now() + make_interval(days => subscription_row.duration_days),
        updated_at = now()
    where id = subscription_row.id and status = 'pending_payment';
  else
    update public.subscriptions
    set status = 'failed', updated_at = now()
    where id = subscription_row.id and status = 'pending_payment';
  end if;

  return next_status;
end;
$$;

revoke all on function public.process_daraja_subscription_callback(text, text, text, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.process_daraja_subscription_callback(text, text, text, text, numeric, text, text)
  to service_role;

comment on table public.subscriptions is
  'Writer subscription periods. A plan becomes active only after a verified Daraja payment callback.';
