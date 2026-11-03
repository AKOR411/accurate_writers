create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  employer_id uuid not null references public.profiles(id) on delete restrict,
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

alter table public.payments
  add column collection_status text not null default 'pending'
    check (collection_status in ('pending', 'processing', 'paid', 'failed')),
  add column collection_confirmed_at timestamptz;

create function private.notify_daraja_collection()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.collection_status is distinct from old.collection_status then
    if new.collection_status = 'paid' then
      perform private.create_notification(new.employer_id, null, 'mpesa_collection_paid', 'M-PESA collection confirmed',
        'The assignment invoice was received by Accurate Writers.', '/dashboard/employer/paid');
      perform private.create_notification(new.writer_id, null, 'employer_collection_paid', 'Employer payment received',
        'The employer funded this assignment. Your writer payout remains pending until a payout is processed.', '/dashboard/payments');
    elsif new.collection_status = 'failed' then
      perform private.create_notification(new.employer_id, null, 'mpesa_collection_failed', 'M-PESA payment was not completed',
        'The STK Push did not complete. You can try again from your payment history.', '/dashboard/employer/unpaid');
    end if;
  end if;
  return new;
end;
$$;
create trigger notify_daraja_collection after update of collection_status on public.payments
for each row execute function private.notify_daraja_collection();

create index payment_attempts_payment_created_idx on public.payment_attempts(payment_id, created_at desc);
create unique index payment_attempts_one_active_per_payment_idx
  on public.payment_attempts(payment_id) where status in ('initiating', 'pending');

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from public, anon, authenticated;
grant select on public.payment_attempts to authenticated;
grant select, insert, update on public.payment_attempts to service_role;
grant update (status, collection_status, collection_confirmed_at, provider, provider_reference, confirmed_at, updated_at) on public.payments to service_role;
create policy "Employers can view their Daraja payment attempts"
on public.payment_attempts for select to authenticated
using (employer_id = (select auth.uid()));
create policy "Admins can view Daraja payment attempts"
on public.payment_attempts for select to authenticated
using (private.is_admin());
create policy "Admins can view assignment payments"
on public.payments for select to authenticated
using (private.is_admin());

create function public.process_daraja_payment_callback(
  target_checkout_id text,
  target_merchant_id text,
  callback_result_code text,
  callback_result_description text,
  callback_amount numeric,
  callback_phone text,
  callback_receipt text
) returns text language plpgsql security definer set search_path = ''
as $$
declare attempt_row public.payment_attempts%rowtype; next_status text;
begin
  select * into attempt_row from public.payment_attempts
  where checkout_request_id = target_checkout_id for update;
  if not found then return 'not_found'; end if;
  if attempt_row.merchant_request_id is distinct from target_merchant_id then return 'merchant_mismatch'; end if;
  if attempt_row.status in ('paid', 'failed', 'verification_failed') then return attempt_row.status; end if;
  if callback_result_code = '0' then
    if callback_amount is null or callback_amount <> attempt_row.amount
      or callback_phone is distinct from attempt_row.phone_number
      or nullif(btrim(coalesce(callback_receipt, '')), '') is null then
      update public.payment_attempts set status = 'verification_failed', result_code = callback_result_code,
        result_description = 'Success callback did not match the amount, phone, or receipt expected for this request.',
        callback_received_at = now(), updated_at = now() where id = attempt_row.id;
      return 'verification_failed';
    end if;
    next_status := 'paid';
  else
    next_status := 'failed';
  end if;
  update public.payment_attempts set status = next_status, receipt_number = nullif(callback_receipt, ''),
    result_code = callback_result_code, result_description = left(coalesce(callback_result_description, ''), 500),
    callback_received_at = now(), updated_at = now() where id = attempt_row.id;
  update public.payments set collection_status = next_status,
    provider = 'daraja', provider_reference = nullif(callback_receipt, ''),
    collection_confirmed_at = case when next_status = 'paid' then now() else null end, updated_at = now()
  where id = attempt_row.payment_id and collection_status = 'processing';
  return next_status;
end;
$$;
revoke all on function public.process_daraja_payment_callback(text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.process_daraja_payment_callback(text, text, text, text, numeric, text, text) to service_role;

comment on table public.payment_attempts is
  'Daraja STK Push attempts. Only the trusted server callback may move a payment to paid.';
