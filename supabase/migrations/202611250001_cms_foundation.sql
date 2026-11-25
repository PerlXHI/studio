-- Perivelle Studio — Phase 1 CMS foundation
-- Additive migration: preserves all existing studio_settings and commission data.
-- Apply after the existing commission-tracking.sql and admin-dashboard.sql migrations.
-- Safe to re-run: tables, columns, indexes, triggers and legacy backfills are idempotent.

begin;

-- The current application already relies on these base tables. Fail with a clear
-- prerequisite message rather than partially migrating an incomplete project.
do $$
begin
  if to_regclass('public.commission_requests') is null then
    raise exception 'Prerequisite missing: run supabase/commission-tracking.sql before this migration.';
  end if;
end;
$$;

create table if not exists public.studio_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.studio_settings enable row level security;

create or replace function public.perivelle_slug(input_text text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.perivelle_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Producer profiles: producer IDs remain text-based to preserve existing IDs
-- such as bybi, rei and yoz, and keep current portfolio assignments compatible.
create table if not exists public.producer_profiles (
  producer_id text primary key check (producer_id ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
  display_name text not null,
  alias text not null default '',
  role_title text not null default '',
  biography text not null default '',
  avatar_url text not null default '',
  banner_url text not null default '',
  social_links jsonb not null default '{}'::jsonb,
  specializations text[] not null default array[]::text[],
  genres text[] not null default array[]::text[],
  equipment jsonb not null default '{}'::jsonb,
  credits jsonb not null default '[]'::jsonb,
  commission_status text not null default 'not_listed'
    check (commission_status in ('open','limited_slots','waitlist','closed','not_listed')),
  appearance jsonb not null default '{}'::jsonb,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Portfolio categories are a first-class entity, rather than embedded labels.
create table if not exists public.portfolio_categories (
  category_id text primary key check (category_id ~ '^[a-z0-9][a-z0-9_-]{0,59}$'),
  name text not null,
  description text not null default '',
  is_visible boolean not null default true,
  display_order integer not null default 0,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Works are shared records used by the public gallery and producer profiles.
create table if not exists public.works (
  work_id text primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  category_id text references public.portfolio_categories(category_id) on delete set null,
  cover_image_url text not null default '',
  video_url text not null default '',
  audio_url text not null default '',
  visibility text not null default 'draft'
    check (visibility in ('draft','published','archived')),
  is_featured boolean not null default false,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_producers (
  work_id text not null references public.works(work_id) on delete cascade,
  producer_id text not null references public.producer_profiles(producer_id) on delete restrict,
  credit_role text not null default 'Producer',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (work_id, producer_id)
);

-- Services: descriptive content and pricing are separated from package/add-on rows.
create table if not exists public.services (
  service_id text primary key check (service_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  description text not null default '',
  thumbnail_url text not null default '',
  pricing_model text not null default 'quote'
    check (pricing_model in ('fixed','starting_at','packages','quote')),
  starting_price numeric(12,2),
  currency text not null default 'USD',
  legacy_price_label text not null default '',
  estimated_delivery_days integer,
  included_revisions integer,
  deliverables jsonb not null default '[]'::jsonb,
  client_requirements jsonb not null default '[]'::jsonb,
  terms_markdown text not null default '',
  faq jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  display_order integer not null default 0,
  legacy_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_packages (
  package_id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(service_id) on delete cascade,
  name text not null,
  description text not null default '',
  price_amount numeric(12,2),
  currency text not null default 'USD',
  estimated_delivery_days integer,
  included_revisions integer,
  deliverables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_addons (
  addon_id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(service_id) on delete cascade,
  name text not null,
  description text not null default '',
  price_amount numeric(12,2),
  currency text not null default 'USD',
  additional_delivery_days integer,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Versioned Terms of Service: one global policy and optional service-specific policies.
create table if not exists public.tos_versions (
  tos_version_id uuid primary key default gen_random_uuid(),
  service_id text references public.services(service_id) on delete restrict,
  version_number integer not null check (version_number > 0),
  title text not null default 'Terms of Service',
  agreement_text text not null default 'I have read and agree to the Terms of Service.',
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  effective_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, version_number)
);

create unique index if not exists tos_versions_global_version_idx
  on public.tos_versions (version_number)
  where service_id is null;

create unique index if not exists tos_versions_one_global_published_idx
  on public.tos_versions ((coalesce(service_id, '__global__')))
  where status = 'published';

create table if not exists public.tos_sections (
  tos_section_id uuid primary key default gen_random_uuid(),
  tos_version_id uuid not null references public.tos_versions(tos_version_id) on delete cascade,
  section_key text not null,
  heading text not null,
  content_markdown text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tos_version_id, section_key)
);

create or replace function public.perivelle_protect_published_tos_section()
returns trigger
language plpgsql
as $
declare
  version_status text;
  target_version_id uuid;
begin
  target_version_id = case when tg_op = 'DELETE' then old.tos_version_id else new.tos_version_id end;
  select status into version_status
  from public.tos_versions
  where tos_version_id = target_version_id;

  if version_status = 'published' then
    raise exception 'Published Terms of Service sections are immutable. Create a new version instead.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$;

drop trigger if exists tos_sections_immutable_after_publish on public.tos_sections;
create trigger tos_sections_immutable_after_publish
before update or delete on public.tos_sections
for each row execute function public.perivelle_protect_published_tos_section();

-- Commission form definitions and immutable published snapshots.
create table if not exists public.commission_forms (
  form_id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(service_id) on delete restrict,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists commission_forms_service_name_idx
  on public.commission_forms (service_id, lower(name));

create table if not exists public.commission_form_versions (
  form_version_id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.commission_forms(form_id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  schema jsonb not null default '{"fields":[]}'::jsonb
    check (jsonb_typeof(schema) = 'object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, version_number)
);

create or replace function public.perivelle_protect_published_form_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'Published commission form versions cannot be deleted. Archive the version instead.';
    end if;
    return old;
  end if;

  if old.status = 'published' and (
    new.form_id is distinct from old.form_id or
    new.version_number is distinct from old.version_number or
    new.schema is distinct from old.schema or
    new.published_at is distinct from old.published_at
  ) then
    raise exception 'Published commission form versions are immutable. Create a new version instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists commission_form_version_immutable_after_publish on public.commission_form_versions;
create trigger commission_form_version_immutable_after_publish
before update or delete on public.commission_form_versions
for each row execute function public.perivelle_protect_published_form_version();

create or replace function public.perivelle_protect_published_tos_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then
      raise exception 'Published Terms of Service versions cannot be deleted. Archive the version instead.';
    end if;
    return old;
  end if;

  if old.status = 'published' and (
    new.service_id is distinct from old.service_id or
    new.version_number is distinct from old.version_number or
    new.title is distinct from old.title or
    new.agreement_text is distinct from old.agreement_text or
    new.effective_at is distinct from old.effective_at
  ) then
    raise exception 'Published Terms of Service versions are immutable. Create a new version instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists tos_version_immutable_after_publish on public.tos_versions;
create trigger tos_version_immutable_after_publish
before update or delete on public.tos_versions
for each row execute function public.perivelle_protect_published_tos_version();

create unique index if not exists commission_form_versions_one_published_idx
  on public.commission_form_versions (form_id)
  where status = 'published';

-- Additive commission extensions: existing request IDs, statuses, briefs and
-- timeline records remain intact. Foreign keys are nullable for legacy requests.
alter table public.commission_requests
  add column if not exists service_id text,
  add column if not exists form_version_id uuid,
  add column if not exists tos_version_id uuid,
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists reference_files jsonb not null default '[]'::jsonb,
  add column if not exists submission_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'commission_requests_service_id_fkey') then
    alter table public.commission_requests
      add constraint commission_requests_service_id_fkey
      foreign key (service_id) references public.services(service_id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'commission_requests_form_version_id_fkey') then
    alter table public.commission_requests
      add constraint commission_requests_form_version_id_fkey
      foreign key (form_version_id) references public.commission_form_versions(form_version_id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'commission_requests_tos_version_id_fkey') then
    alter table public.commission_requests
      add constraint commission_requests_tos_version_id_fkey
      foreign key (tos_version_id) references public.tos_versions(tos_version_id) on delete set null;
  end if;
end;
$$;

create index if not exists works_visibility_order_idx
  on public.works (visibility, display_order);
create index if not exists works_category_visibility_idx
  on public.works (category_id, visibility);
create index if not exists work_producers_producer_idx
  on public.work_producers (producer_id, display_order);
create index if not exists services_status_order_idx
  on public.services (status, display_order);
create index if not exists service_packages_service_order_idx
  on public.service_packages (service_id, is_active, display_order);
create index if not exists service_addons_service_order_idx
  on public.service_addons (service_id, is_active, display_order);
create index if not exists tos_sections_version_order_idx
  on public.tos_sections (tos_version_id, display_order);
create index if not exists commission_forms_service_order_idx
  on public.commission_forms (service_id, is_active, display_order);
create index if not exists commission_form_versions_form_status_idx
  on public.commission_form_versions (form_id, status, version_number desc);
create index if not exists commission_requests_service_idx
  on public.commission_requests (service_id);
create index if not exists commission_requests_form_version_idx
  on public.commission_requests (form_version_id);
create index if not exists commission_requests_tos_version_idx
  on public.commission_requests (tos_version_id);

-- Consistent updated_at maintenance for editable CMS records.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'producer_profiles','portfolio_categories','works','services',
    'service_packages','service_addons','tos_versions','tos_sections',
    'commission_forms','commission_form_versions'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.perivelle_touch_updated_at()',
      table_name || '_touch_updated_at', table_name
    );
  end loop;
end;
$$;

-- Backfill existing producer profiles without removing or modifying the source JSON.
insert into public.producer_profiles (
  producer_id, display_name, alias, role_title, biography, avatar_url, banner_url,
  social_links, specializations, genres, equipment, credits, commission_status,
  appearance, is_visible, display_order, legacy_data
)
select
  coalesce(nullif(item->>'id',''), 'legacy-producer-' || substr(md5(item::text),1,10)),
  coalesce(nullif(item->>'name',''), 'Unnamed producer'),
  coalesce(item->>'alias',''),
  coalesce(item->>'role',''),
  coalesce(item->>'bio',''),
  coalesce(item->>'photo',''),
  coalesce(item->>'banner',''),
  case when jsonb_typeof(item->'social_links')='object' then item->'social_links' else '{}'::jsonb end,
  case when jsonb_typeof(item->'specializations')='array' then array(select jsonb_array_elements_text(item->'specializations')) else array[]::text[] end,
  case when jsonb_typeof(item->'genres')='array' then array(select jsonb_array_elements_text(item->'genres')) else array[]::text[] end,
  case when jsonb_typeof(item->'equipment')='object' then item->'equipment' else '{}'::jsonb end,
  case when jsonb_typeof(item->'credits')='array' then item->'credits' else '[]'::jsonb end,
  case when item->>'commission_status' in ('open','limited_slots','waitlist','closed','not_listed') then item->>'commission_status' else 'not_listed' end,
  case when jsonb_typeof(item->'appearance')='object' then item->'appearance' else '{}'::jsonb end,
  coalesce((item->>'active')::boolean, true),
  ordinality::integer - 1,
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as source(item, ordinality)
where s.setting_key='studio_producers'
on conflict (producer_id) do nothing;

insert into public.producer_profiles (
  producer_id, display_name, role_title, biography, specializations,
  genres, is_visible, display_order, legacy_data
)
select fallback.producer_id, fallback.display_name, 'MUSIC PRODUCER · PERIVELLE',
       fallback.biography, array['Music Production','Original Music','Creative Audio']::text[],
       array[]::text[], true, fallback.display_order, jsonb_build_object('source','site_defaults')
from (values
  ('bybi','bybi','Creating original sounds and musical atmospheres for virtual worlds, characters, and creators.',0),
  ('rei','rei','Shaping musical ideas into expressive soundscapes for characters, streams, and stories.',1),
  ('yoz','yoz','Bringing fresh musical ideas to life through original compositions and thoughtful production.',2)
) as fallback(producer_id,display_name,biography,display_order)
where not exists (select 1 from public.studio_settings where setting_key='studio_producers')
on conflict (producer_id) do nothing;

-- Backfill categories from the configured category list. If no category setting
-- exists, use the categories already present in portfolio_videos; if neither is
-- present, seed the site's original five categories.
insert into public.portfolio_categories (
  category_id, name, is_visible, display_order, legacy_data
)
select
  coalesce(nullif(item->>'id',''), 'legacy-category-' || substr(md5(item::text),1,10)),
  coalesce(nullif(item->>'name',''), 'Untitled category'),
  coalesce((item->>'active')::boolean, true),
  ordinality::integer - 1,
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as source(item, ordinality)
where s.setting_key='portfolio_categories'
on conflict (category_id) do nothing;

insert into public.portfolio_categories (category_id, name, is_visible, display_order, legacy_data)
select
  coalesce(nullif(item->>'id',''), 'legacy-category-' || substr(md5(item::text),1,10)),
  coalesce(nullif(item->>'name',''), 'Untitled category'),
  true,
  ordinality::integer - 1,
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as source(item, ordinality)
where s.setting_key='portfolio_videos'
  and not exists (select 1 from public.studio_settings x where x.setting_key='portfolio_categories')
on conflict (category_id) do nothing;

insert into public.portfolio_categories (category_id, name, is_visible, display_order, legacy_data)
select fallback.category_id, fallback.name, true, fallback.display_order, '{}'::jsonb
from (values
  ('bgm','BGM',0),
  ('sound-alerts','Sound Alerts',1),
  ('stinger','Stinger',2),
  ('og-song','OG Song',3),
  ('lore-music','Lore Music',4)
) as fallback(category_id,name,display_order)
where not exists (select 1 from public.studio_settings where setting_key in ('portfolio_categories','portfolio_videos'))
on conflict (category_id) do nothing;

-- Featured portfolio records become shared Works rows. Their original JSON is
-- retained in legacy_data for traceability and later field-by-field migration.
insert into public.works (
  work_id, slug, title, description, category_id, cover_image_url, video_url, audio_url,
  visibility, is_featured, display_order, metadata, legacy_data
)
select
  coalesce(nullif(item->>'id',''), 'legacy-featured-' || substr(md5(item::text),1,12)),
  coalesce(nullif(public.perivelle_slug(item->>'title'),''), 'featured-work') || '-' || substr(md5(item::text),1,6),
  coalesce(nullif(item->>'title',''), 'Untitled featured work'),
  coalesce(item->>'description',''),
  case when exists (select 1 from public.portfolio_categories c where c.category_id=item->>'category') then item->>'category' else null end,
  coalesce(item->>'image',''),
  coalesce(item->>'video_url',''),
  coalesce(item->>'audio_url',''),
  case when coalesce((item->>'active')::boolean,true) then 'published' else 'archived' end,
  true,
  ordinality::integer - 1,
  '{}'::jsonb,
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as source(item, ordinality)
where s.setting_key='featured_portfolio'
on conflict (work_id) do nothing;

-- The old Works setup also stored video previews grouped by category. Convert
-- those previews to Works rows, keyed deterministically so this backfill is safe
-- to re-run, while retaining the complete source category JSON.
insert into public.works (
  work_id, slug, title, description, category_id, video_url,
  visibility, is_featured, display_order, metadata, legacy_data
)
select
  'legacy-video-' || substr(md5(coalesce(item->>'id','') || '|' || url.value),1,24),
  'legacy-video-' || substr(md5(coalesce(item->>'id','') || '|' || url.value),1,16),
  coalesce(nullif(item->>'name',''), 'Legacy portfolio preview'),
  '',
  case when exists (select 1 from public.portfolio_categories c where c.category_id=item->>'id') then item->>'id' else null end,
  url.value,
  'published',
  coalesce(item->>'featured'=url.value,false),
  (category_order.ordinality::integer - 1) * 100 + (url_order.ordinality::integer - 1),
  jsonb_build_object('legacy_source','portfolio_videos'),
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as category_order(item, ordinality)
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(category_order.item->'videos')='array' then category_order.item->'videos'
    when nullif(category_order.item->>'url','') is not null then jsonb_build_array(category_order.item->>'url')
    else '[]'::jsonb
  end
) with ordinality as url_order(value, ordinality)
where s.setting_key='portfolio_videos'
  and not exists (
    select 1 from public.works existing
    where existing.category_id = category_order.item->>'id'
      and existing.video_url = url_order.value
  )
on conflict (work_id) do nothing;

-- Retain producer credits from the two legacy portfolio structures.
insert into public.work_producers (work_id, producer_id, credit_role, display_order)
select
  coalesce(nullif(item->>'id',''), 'legacy-featured-' || substr(md5(item::text),1,12)),
  item->>'creator',
  'Producer',
  0
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) as source(item)
where s.setting_key='featured_portfolio'
  and nullif(item->>'creator','') is not null
  and exists (select 1 from public.producer_profiles p where p.producer_id=item->>'creator')
on conflict (work_id, producer_id) do nothing;

insert into public.work_producers (work_id, producer_id, credit_role, display_order)
select
  coalesce(
    (
      select existing.work_id
      from public.works existing
      where existing.category_id = category.item->>'id'
        and existing.video_url = assignment.item->>'url'
      order by existing.is_featured desc, existing.display_order asc
      limit 1
    ),
    'legacy-video-' || substr(md5(coalesce(category.item->>'id','') || '|' || (assignment.item->>'url')),1,24)
  ),
  assignment.item->>'creator',
  'Producer',
  assignment.ordinality::integer - 1
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) as category(item)
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(category.item->'video_assignments')='array' then category.item->'video_assignments' else '[]'::jsonb end
) with ordinality as assignment(item, ordinality)
where s.setting_key='portfolio_videos'
  and nullif(assignment.item->>'url','') is not null
  and nullif(assignment.item->>'creator','') is not null
  and exists (select 1 from public.producer_profiles p where p.producer_id=assignment.item->>'creator')
  and exists (
    select 1 from public.works existing
    where existing.category_id = category.item->>'id'
      and existing.video_url = assignment.item->>'url'
  )
on conflict (work_id, producer_id) do nothing;

-- Legacy service settings only contained names and display-price strings. Keep
-- those labels verbatim; do not guess a numeric amount or currency.
insert into public.services (
  service_id, slug, name, short_description, pricing_model,
  legacy_price_label, status, display_order, legacy_data
)
select
  coalesce(nullif(public.perivelle_slug(item->>'name'),''), 'legacy-service-' || substr(md5(item::text),1,8)),
  coalesce(nullif(public.perivelle_slug(item->>'name'),''), 'legacy-service-' || substr(md5(item::text),1,8)),
  coalesce(nullif(item->>'name',''), 'Legacy service'),
  '',
  case when nullif(trim(item->>'price'),'') is null then 'quote' else 'starting_at' end,
  coalesce(item->>'price',''),
  'published',
  ordinality::integer - 1,
  item
from public.studio_settings s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.setting_value)='array' then s.setting_value else '[]'::jsonb end
) with ordinality as source(item, ordinality)
where s.setting_key='service_prices'
on conflict (service_id) do nothing;

insert into public.services (
  service_id, slug, name, pricing_model, legacy_price_label,
  status, display_order, legacy_data
)
select public.perivelle_slug(fallback.name), public.perivelle_slug(fallback.name),
       fallback.name, 'quote', '', 'published', fallback.display_order,
       jsonb_build_object('source','site_defaults')
from (values
  ('Custom BGM Loop',0),
  ('Sound Alerts & Stinger',1),
  ('Lore / Cinematic Music',2),
  ('OG Song / Instrumental Cover',3),
  ('VTuber Debut Bundle',4)
) as fallback(name,display_order)
where not exists (select 1 from public.studio_settings where setting_key='service_prices')
on conflict (service_id) do nothing;

-- Preserve a compact immutable snapshot of historical commission information.
-- New requests will populate the structured version IDs and answer fields later.
update public.commission_requests
set
  answers = case
    when answers = '{}'::jsonb and jsonb_typeof(brief)='object' then brief
    else answers
  end,
  submission_snapshot = case
    when submission_snapshot = '{}'::jsonb then jsonb_build_object(
      'legacy', true,
      'request_id', request_id,
      'brief', coalesce(brief,'{}'::jsonb),
      'status', status,
      'status_note', coalesce(status_note,''),
      'created_at', created_at
    )
    else submission_snapshot
  end
where submission_snapshot = '{}'::jsonb or answers = '{}'::jsonb;

-- Private storage for client references. Upload/download access will be mediated
-- by authenticated server endpoints that issue short-lived signed URLs.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'commission-references',
      'commission-references',
      false,
      52428800,
      array['image/jpeg','image/png','image/webp','image/avif','audio/mpeg','audio/wav','audio/ogg','audio/mp4','application/pdf']::text[]
    )
    on conflict (id) do update
      set public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end;
$$;

-- Server-only access. No anon/authenticated table policies are created.
alter table public.producer_profiles enable row level security;
alter table public.portfolio_categories enable row level security;
alter table public.works enable row level security;
alter table public.work_producers enable row level security;
alter table public.services enable row level security;
alter table public.service_packages enable row level security;
alter table public.service_addons enable row level security;
alter table public.tos_versions enable row level security;
alter table public.tos_sections enable row level security;
alter table public.commission_forms enable row level security;
alter table public.commission_form_versions enable row level security;

revoke all on table
  public.producer_profiles,
  public.portfolio_categories,
  public.works,
  public.work_producers,
  public.services,
  public.service_packages,
  public.service_addons,
  public.tos_versions,
  public.tos_sections,
  public.commission_forms,
  public.commission_form_versions
from anon, authenticated;

grant all on table
  public.producer_profiles,
  public.portfolio_categories,
  public.works,
  public.work_producers,
  public.services,
  public.service_packages,
  public.service_addons,
  public.tos_versions,
  public.tos_sections,
  public.commission_forms,
  public.commission_form_versions
to service_role;

commit;
