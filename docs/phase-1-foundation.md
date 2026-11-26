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
- `api/public-cms.js`: read-only endpoint exposing published/visible CMS data only (producers, categories, works, service catalogue, packages and add-ons). ToS and form schemas are intentionally admin-only until their public workflows are implemented in Phase 4.

These endpoints are a foundation. They do not yet replace the existing Admin Dashboard forms or public frontend rendering; that integration belongs to Phase 2 and Phase 3.

## Execution and verification status — 26 November 2026

### Supabase migration

`202611250001_cms_foundation` is present in the connected Supabase migration history. It was applied on 25 November 2026. The verification queries were run again on 26 November 2026; the migration itself was not replayed because it is already recorded and the checks are read-only.

| Check | Verified result |
|---|---:|
| Producer profiles | 3 |
| Portfolio categories | 6 |
| Works | 13 |
| Work/producer assignments | 0 |
| Services | 5 |
| Service packages / add-ons | 0 / 0 |
| ToS versions / sections | 0 / 0 |
| Commission forms / versions | 0 / 0 |
| Historical commission requests retained | 7 of 7 |
| Historical answers equal original briefs | 7 of 7 |
| Submission snapshots populated | 7 of 7 |
| Existing `studio_settings` rows / expected keys | 12 / 12 |
| New CMS tables with RLS enabled | 11 of 11 |
| Direct table privileges for `anon` / `authenticated` | 0 |

The zero work/producer assignments reflect the legacy source: it had no video assignments and the featured item had no creator ID. Empty packages, add-ons, ToS and form tables are intentional foundations awaiting Phase 2/4 content entry; they are not failed backfills.

Storage verification:
- `commission-references`: exists, private, 50 MB limit.
- `freebies`: remains public, 50 MB limit.

### Supabase advisors

- Health advisor: no findings.
- Security advisor: 15 informational `rls_enabled_no_policy` notices across new and existing server-only tables. This is intentional for the current architecture: browser roles have no table grants, and the APIs use the server-side service-role key. Do not add public policies simply to silence this notice.
- Performance advisor: 12 informational unused-index notices. These indexes support the new CMS query patterns but have not been used because the site/admin are not yet integrated with the normalized tables. Reassess after Phase 2/3 traffic; do not drop them during this foundation phase.

### Deployment and API smoke tests

The current Phase 1 branch head is `f27e57192efca3565af5cd55f1bd15ff3dd12bfe`. Its Vercel status check is failing with `api-deployments-free-per-day` / deployment rate limit. This is an external deployment quota restriction, not a Supabase migration error. Therefore the following tests remain pending against the current branch head:

- `GET /api/public-cms?resource=producers`
- `GET /api/public-cms?resource=categories`
- `GET /api/public-cms?resource=works`
- `GET /api/public-cms?resource=services`
- `GET /api/admin-cms?resource=all` while signed in as admin
- Negative checks: public access to ToS/forms returns 400, and unauthenticated admin access returns 401.

A previous Vercel preview event reported Ready on 25 November, but it is not proof that the current branch head deployed or that its API routes passed smoke tests.

When the deployment quota clears, redeploy the branch and run the endpoint checks above. For local full-stack verification, use the Vercel CLI in the repository directory:

```bash
npm install -g vercel
vercel login
vercel link
vercel pull --environment=preview
vercel dev
```

Then test the routes at `http://localhost:3000`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side; never paste it into the browser or commit it.

## Read-only verification

Run `supabase/verify-phase1.sql` after the migration or whenever you need to re-check the live state. It is read-only. Do not replay the migration just to verify the current database; the migration is already recorded.

## Environment

The API uses the existing server-side variables already used by the project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SESSION_SECRET` for the existing admin session

No new public environment variable is introduced.

## Safety and rollback notes

- The migration is transactional and additive.
- The legacy settings records are not deleted or modified by the backfill.
- Existing commission columns and rows are not dropped.
- Do not drop the new tables to roll back after content has been entered. First export any new data; a rollback should be a deliberate, reviewed migration.
- The new APIs can be rolled back independently because existing routes and frontend code do not call them yet.
- Keep CMS table access server-only until the public and admin application flows are deliberately integrated.

## Known Phase 1 boundaries

- No Admin CRUD UI for normalized resources yet.
- No public UI integration yet.
- Existing producer data lacks full social links, genres, equipment, and appearance settings; those fields are initialized empty and will be populated through the upcoming CMS.
- Legacy `portfolio_videos` records may only have a video URL and producer credit; the migration preserves source JSON so details can be enriched later.
- TOS and dynamic forms are schema foundations only; they remain unpublished until created and reviewed through the future admin tools.
- Public and admin endpoint smoke tests against the current branch head remain pending because Vercel rate-limited the latest deployment.
