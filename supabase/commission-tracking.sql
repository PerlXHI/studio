-- Perivelle commission tracking
-- Run this once in your Supabase project SQL Editor.

create table if not exists public.commission_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  status text not null default 'Awaiting Review'
    check (status in (
      'Awaiting Review', 'Quotation Sent', 'Awaiting Payment',
      'In Production', 'Revision', 'Completed', 'On Hold', 'Cancelled'
    )),
  status_note text not null default '',
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commission_requests enable row level security;
-- No public table policies: access is restricted to the server-side API.

create or replace function public.set_commission_request_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status is distinct from old.status or new.status_note is distinct from old.status_note then
    new.timeline = coalesce(old.timeline, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('status', new.status, 'at', now(), 'note', new.status_note)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists commission_request_update_trigger on public.commission_requests;
create trigger commission_request_update_trigger
before update on public.commission_requests
for each row execute function public.set_commission_request_updated_at();

create index if not exists commission_requests_request_id_idx
on public.commission_requests (request_id);