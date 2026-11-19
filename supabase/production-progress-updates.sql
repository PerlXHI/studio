-- Perivelle production progress updates
-- Run once in Supabase SQL Editor.
alter table public.commission_requests
  add column if not exists production_updates jsonb not null default '[]'::jsonb;
