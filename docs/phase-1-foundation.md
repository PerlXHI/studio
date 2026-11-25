# Phase 1 — CMS Foundation

## Scope

This change establishes a normalized CMS data model alongside the existing Perivelle data model. It is additive and deliberately does not remove or rewrite the existing `studio_settings` JSONB records.

### Existing architecture retained

- Public website: static HTML, CSS and vanilla JavaScript.
- Hosting and API: Vercel with serverless functions.
- Database and file storage: Supabase PostgreSQL and Supabase Storage.
- Existing admin session: `api/_admin.js` HMAC session cookie.
- Existing order and settings APIs remain unchanged in this phase.

## What this phase adds

### Normalized tables

| Table | Purpose |
|---|---|
| `producer_profiles` | Extended producer profile and appearance data |
| `portfolio_categories` | Managed Works categories |
| `works` | One shared record per portfolio work |
| `work_producers` | Many-to-many producer credits |
| `services` | Service catalogue and pricing model |
| `service_packages` | Packages per service |
| `service_addons` | Add-ons per service |
| `tos_versions` | Global and service-specific ToS versions |
| `tos_sections` | Ordered content sections per ToS version |
| `commission_forms` | Form definition per service |
| `commission_form_versions` | Versioned form schema snapshots |

The existing `commission_requests` table is extended with nullable references to service, form version and ToS version, plus answer, file-reference and submission-snapshot JSONB fields. Existing request IDs, briefs, statuses and timelines are retained.

### Legacy backfill

The migration copies existing settings into normalized tables using `ON CONFLICT DO NOTHING`:

- `studio_producers` → `producer_profiles`
- `portfolio_categories` → `portfolio_categories`
- `portfolio_videos` and `featured_portfolio` → `works` and `work_producers`
- `service_prices` → `services`

The original JSONB settings remain untouched. For legacy service prices, the original display label is retained verbatim; the migration does not guess a numeric price or currency. Legacy video entries without titles or descriptions are imported with generic titles and the original source JSON retained in `legacy_data`.

No legal Terms of Service is auto-published. The current page copy must be reviewed and approved before it becomes a versioned, enforceable TOS.

### Storage

The migration provisions a private `commission-references` bucket for future client-uploaded reference files. Public studio artwork and free audio continue using their existing public-storage workflows. Private references must be uploaded and retrieved through authenticated server endpoints and short-lived signed URLs; do not create public read policies for this bucket.

### API foundation

- `api/_cms.js`: shared allowlisted PostgREST reads and public/admin resource projections.
- `api/admin-cms.js`: authenticated, read-only CMS data endpoint for the admin.
- `api/public-cms.js`: read-only endpoint exposing published/visible CMS data only.

These endpoints are a foundation. They do not yet replace the existing Admin Dashboard forms or public frontend rendering; that integration belongs to Phase 2 and Phase 3.

## Apply the migration

1. Make sure the Supabase project has a current backup or export.
2. Confirm the existing base migrations have already been applied:
   - `supabase/commission-tracking.sql`
   - `supabase/admin-dashboard.sql`
3. Open the Supabase project → SQL Editor.
4. Run `supabase/migrations/202611250001_cms_foundation.sql`.
5. Run `supabase/verify-phase1.sql` and inspect the row counts, RLS status, bucket and new commission columns.
6. Deploy the branch to a Vercel Preview and check:
   - `/api/public-cms?resource=producers`
   - `/api/public-cms?resource=works`
   - `/api/public-cms?resource=services`
   - `/api/admin-cms?resource=all` while signed in to Admin.

The admin endpoint uses the existing HMAC admin session. The service-role key remains server-side and is never returned by these APIs.

## Environment

The API uses the existing server-side variables already used by the project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No new public environment variable is introduced.

## Safety and rollback notes

- The migration is transactional and additive.
- The legacy settings records are not deleted or modified by the backfill.
- Existing commission columns and rows are not dropped.
- Do not drop the new tables to roll back after content has been entered. First export any new data; a rollback should be a deliberate, reviewed migration.
- The new APIs can be rolled back independently because existing routes and frontend code do not call them yet.
- Apply to a Supabase backup/staging project first when one is available. The repository migration cannot be executed against the user's Supabase project from GitHub.

## Known Phase 1 boundaries

- No Admin CRUD UI for normalized resources yet.
- No public UI integration yet.
- Existing producer data lacks full social links, genres, equipment, and appearance settings; those fields are initialized empty and will be populated through the upcoming CMS.
- Legacy `portfolio_videos` records may only have a video URL and producer credit; the migration preserves source JSON so details can be enriched later.
- TOS and dynamic forms are schema foundations only; they remain unpublished until created and reviewed through the future admin tools.
