-- Align commission status constraints with the statuses exposed in the admin dashboard.
-- Run this migration once in the Supabase SQL Editor.

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.commission_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format(
      'alter table public.commission_requests drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.commission_requests
  add constraint commission_requests_status_check
  check (status in (
    'Awaiting Review',
    'Quotation Sent',
    'Awaiting Payment',
    'In Production',
    'Revision',
    'Completed',
    'On Hold',
    'Cancelled',
    'Waiting for client response',
    'Demo ready — Awaiting feedback',
    'Preparing final delivery'
  ));
