-- Perivelle Admin Dashboard additions
-- Run this once in Supabase SQL Editor after commission-tracking.sql.

alter table public.commission_requests
  add column if not exists brief jsonb not null default '{}'::jsonb,
  add column if not exists preview_url text not null default '',
  add column if not exists delivery_url text not null default '',
  add column if not exists quoted_price text not null default '',
  add column if not exists quotation_note text not null default '',
  add column if not exists admin_note text not null default '';

create table if not exists public.studio_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.studio_settings enable row level security;
-- No public policies: the website's server-side API is the only access path.
