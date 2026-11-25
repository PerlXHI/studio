-- Perivelle Studio — Phase 1 verification
-- Read-only checks. Run after 202611250001_cms_foundation.sql.

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

select
  table_name,
  c.relrowsecurity as row_security
from information_schema.tables t
join pg_class c on c.relname=t.table_name
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where t.table_schema='public'
  and t.table_name in (
    'producer_profiles','portfolio_categories','works','work_producers',
    'services','service_packages','service_addons','tos_versions','tos_sections',
    'commission_forms','commission_form_versions'
  )
order by table_name;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('studio-assets','freebies','commission-references')
order by id;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='commission_requests'
  and column_name in (
    'service_id','form_version_id','tos_version_id','tos_accepted_at',
    'answers','reference_files','submission_snapshot'
  )
order by column_name;
