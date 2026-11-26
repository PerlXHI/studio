-- Perivelle Studio — Phase 1 verification
-- Read-only checks. Safe to run repeatedly after 202611250001_cms_foundation.

-- 1) Normalized CMS row counts.
select 'producer_profiles' as resource, count(*)::bigint as rows from public.producer_profiles
union all select 'portfolio_categories', count(*) from public.portfolio_categories
union all select 'works', count(*) from public.works
union all select 'work_producers', count(*) from public.work_producers
union all select 'services', count(*) from public.services
union all select 'service_packages', count(*) from public.service_packages
union all select 'service_addons', count(*) from public.service_addons
union all select 'tos_versions', count(*) from public.tos_versions
union all select 'tos_sections', count(*) from public.tos_sections
union all select 'commission_forms', count(*) from public.commission_forms
union all select 'commission_form_versions', count(*) from public.commission_form_versions
order by resource;

-- 2) RLS and effective table privileges for browser roles.
select
  c.relname as table_name,
  c.relrowsecurity as row_security,
  has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT') as anon_select,
  has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT') as authenticated_select,
  has_table_privilege('service_role', format('%I.%I', n.nspname, c.relname), 'SELECT') as service_role_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'producer_profiles','portfolio_categories','works','work_producers',
    'services','service_packages','service_addons','tos_versions','tos_sections',
    'commission_forms','commission_form_versions'
  )
  and c.relkind = 'r'
order by c.relname;

-- 3) Storage bucket visibility and upload limit.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('studio-assets','freebies','commission-references')
order by id;

-- 4) New nullable references and snapshot columns on historical commissions.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'commission_requests'
  and column_name in (
    'service_id','form_version_id','tos_version_id','tos_accepted_at',
    'answers','reference_files','submission_snapshot'
  )
order by column_name;

-- 5) Historical commission and legacy settings integrity.
select
  count(*) as commission_requests,
  count(*) filter (where answers = brief) as answers_match_legacy_briefs,
  count(*) filter (where submission_snapshot <> '{}'::jsonb) as snapshots_populated,
  count(*) filter (where nullif(request_id, '') is null) as missing_request_ids
from public.commission_requests;

select
  count(*) as studio_settings_rows,
  count(*) filter (where setting_key in (
    'audio_player','catalog_products','client_showcase','commission_status',
    'featured_portfolio','freebies','portfolio_categories','portfolio_videos',
    'service_prices','studio_links','studio_producers','testimonials'
  )) as expected_legacy_keys_present
from public.studio_settings;
