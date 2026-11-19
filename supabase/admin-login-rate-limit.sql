-- Perivelle admin login rate limiting
-- Run once in Supabase SQL Editor before deploying the updated admin login.
create table if not exists public.admin_login_attempts (
  fingerprint text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz
);

alter table public.admin_login_attempts enable row level security;

create or replace function public.pv_admin_login_rate_limit(p_key text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.admin_login_attempts%rowtype;
  reset_window boolean;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$'
     or p_action not in ('check', 'fail', 'success') then
    raise exception 'Invalid rate limit request';
  end if;

  if p_action = 'success' then
    delete from public.admin_login_attempts where fingerprint = p_key;
    return jsonb_build_object('locked', false, 'remaining', 5);
  end if;

  if p_action = 'check' then
    select * into current_row
      from public.admin_login_attempts
      where fingerprint = p_key;

    if not found then
      return jsonb_build_object('locked', false, 'remaining', 5);
    end if;

    return jsonb_build_object(
      'locked', current_row.blocked_until is not null and current_row.blocked_until > now(),
      'remaining', greatest(0, 5 - current_row.attempts),
      'blocked_until', current_row.blocked_until
    );
  end if;

  insert into public.admin_login_attempts (fingerprint, attempts, window_started_at, blocked_until)
  values (p_key, 1, now(), null)
  on conflict (fingerprint) do update
  set
    attempts = case
      when public.admin_login_attempts.window_started_at <= now() - interval '15 minutes'
        or (public.admin_login_attempts.blocked_until is not null and public.admin_login_attempts.blocked_until <= now())
      then 1
      else public.admin_login_attempts.attempts + 1
    end,
    window_started_at = case
      when public.admin_login_attempts.window_started_at <= now() - interval '15 minutes'
        or (public.admin_login_attempts.blocked_until is not null and public.admin_login_attempts.blocked_until <= now())
      then now()
      else public.admin_login_attempts.window_started_at
    end,
    blocked_until = case
      when public.admin_login_attempts.window_started_at <= now() - interval '15 minutes'
        or (public.admin_login_attempts.blocked_until is not null and public.admin_login_attempts.blocked_until <= now())
      then null
      when public.admin_login_attempts.attempts + 1 >= 5
      then now() + interval '15 minutes'
      else public.admin_login_attempts.blocked_until
    end
  returning * into current_row;

  return jsonb_build_object(
    'locked', current_row.blocked_until is not null and current_row.blocked_until > now(),
    'remaining', greatest(0, 5 - current_row.attempts),
    'blocked_until', current_row.blocked_until
  );
end;
$$;

revoke all on function public.pv_admin_login_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.pv_admin_login_rate_limit(text, text) to service_role;
revoke all on table public.admin_login_attempts from anon, authenticated;
