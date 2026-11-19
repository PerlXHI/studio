-- Perivelle commission form rate limiting
-- Run this once in Supabase SQL Editor before deploying the API update.
-- Stores only a salted SHA-256 IP hash, never the raw IP address.

create table if not exists public.commission_submission_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.commission_submission_limits enable row level security;
revoke all on public.commission_submission_limits from anon, authenticated;
grant all on public.commission_submission_limits to service_role;

create or replace function public.consume_commission_rate_limit(
  p_ip_hash text,
  p_limit integer default 3,
  p_window_seconds integer default 900
)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_started_at timestamptz;
  v_request_count integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64
     or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  -- Serialize concurrent requests for the same hashed IP.
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  select window_started_at, request_count
    into v_window_started_at, v_request_count
    from public.commission_submission_limits
    where ip_hash = p_ip_hash
    for update;

  if not found or v_window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    insert into public.commission_submission_limits(ip_hash, window_started_at, request_count)
      values (p_ip_hash, v_now, 1)
      on conflict (ip_hash) do update
        set window_started_at = excluded.window_started_at,
            request_count = 1;
    return query select true, 0;
    return;
  end if;

  if v_request_count >= p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);
    return;
  end if;

  update public.commission_submission_limits
    set request_count = request_count + 1
    where ip_hash = p_ip_hash;

  return query select true, 0;
end;
$$;

revoke all on function public.consume_commission_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_commission_rate_limit(text, integer, integer) to service_role;

-- Optional cleanup: run periodically if desired to remove expired hashes.
-- delete from public.commission_submission_limits
-- where window_started_at < now() - interval '2 days';
