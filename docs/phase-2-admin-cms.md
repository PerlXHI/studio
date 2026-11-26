# Phase 2 — Admin CMS Studio

## Goal

Introduce a protected Admin Dashboard workspace for managing the normalized CMS records created in Phase 1. This phase adds server-side create, update and archive operations plus a collection editor. It does not switch public site rendering to the normalized records; that remains Phase 3.

## Collections managed

| Admin collection | Database table | Main operations |
|---|---|---|
| Producers | `producer_profiles` | Create, edit, archive |
| Categories | `portfolio_categories` | Create, edit, archive |
| Works | `works` | Create, edit, archive |
| Services | `services` | Create, edit, archive |
| Packages | `service_packages` | Create, edit, archive |
| Add-ons | `service_addons` | Create, edit, archive |
| Work credits | `work_producers` | Link, edit role/order, remove link |

ToS and commission-form records remain readable through the Admin CMS API but do not have editors in this phase. Their versioning/publishing flows need the dedicated workflow planned for Phase 4.

## Admin UI

The Admin Dashboard adds a **CMS Studio** tab with:
- Collection navigation, record counts, search and refresh.
- Create/edit forms generated from collection-specific field definitions.
- Category, service, work and producer selectors for related records.
- JSON editors for flexible structured metadata and line-based editors for text arrays.
- Existing signed Admin image-upload flow for producer portraits/banners and Works/service images.
- Clear notices for saved records, invalid input and API errors.

The older settings-based Portfolio, Producers and Service Pricing editors are left in place and are not migrated or overwritten by this phase. The CMS Studio panel explains that changes in normalized tables will not appear on the public pages until Phase 3 switches the public rendering layer.

## API

`api/admin-cms.js` retains the authenticated GET interface and now supports:

- `GET /api/admin-cms?resource=all`
- `POST /api/admin-cms?resource=<collection>` — create
- `PATCH /api/admin-cms?resource=<collection>&<primary_key>=<id>` — update
- `DELETE /api/admin-cms?resource=<collection>&<primary_key>=<id>` — archive, or remove a work-credit link

Only the seven collections listed above accept mutations. ToS/form tables are read-only through this endpoint.

### Protection and validation

- Every request requires the existing HMAC Admin session.
- Every mutation additionally requires the request Origin to match the current deployment host.
- Table names and writable columns are explicit server-side allowlists; clients cannot pass raw table names or arbitrary column names.
- Text lengths, URL protocols, enum values, numeric types, JSON shapes and stable ID patterns are validated before PostgREST is called.
- Required fields are checked on create and cannot be blanked by a partial update sent directly to the API.
- The service-role key remains server-side and is never sent to the browser.
- Main records are archived through their visibility/status/active field instead of hard-deleted. Only the many-to-many work-credit link has a hard delete operation.
- PostgREST receives `Prefer: return=representation`; the API returns the updated record or a clear status/message.

## Storage

The editor reuses the existing `/api/admin-upload` signed upload flow for image assets. Allowed image formats and file-size checks remain enforced by that endpoint. The upload categories are the existing supported destinations (`producers` and `portfolio`); no new bucket or storage policy is introduced here.

## Schema and data safety

- No database migration is required for Phase 2.
- No live rows are rewritten as part of deployment.
- The API operates on the Phase 1 normalized tables and preserves the legacy `studio_settings` editors.
- Archive actions preserve the record and linked history; package/add-on foreign keys are not deleted.
- Avoid write smoke tests against the connected live database using dummy records. Test mutations in a dedicated staging Supabase project or with approved real content; Preview deployments may still point to the same Supabase project as production.

## Validation checklist

### Read / editor
- [ ] Sign in to the Preview Admin Dashboard and open CMS Studio.
- [ ] Confirm records and counts load for all seven collections.
- [ ] Confirm categories appear in Works selectors; services appear in Package/Add-on selectors; works and producers appear in Work Credits selectors.
- [ ] Search and refresh each collection.
- [ ] Upload a test image only in a staging project/storage bucket, or use approved real content.

### Write behavior (staging only)
- [ ] Create and edit one record in each writable collection.
- [ ] Confirm invalid JSON, invalid URLs, invalid enum values, duplicate IDs/slugs and missing foreign keys are rejected.
- [ ] Archive a producer/category/work/service/package/add-on and confirm the row is retained with its visibility/status/active flag changed.
- [ ] Remove a work-credit link and confirm only the association row is deleted.
- [ ] Confirm unauthenticated requests return 401, cross-origin mutations return 403, read-only resources reject mutations, and unsupported methods return 405.

### Not part of Phase 2
- Public page integration / migration from `studio_settings` to normalized tables (Phase 3).
- ToS editor, version publishing and client acceptance workflow (Phase 4).
- Dynamic commission form builder/versioning and submission binding (Phase 4).
- New bulk import, file cleanup or production data backfill.

## Validation performed — 26 November 2026

- JavaScript syntax checks passed for `assets/js/admin-cms.js`, `api/_cms-write.js`, `api/admin-cms.js` and the existing Admin Dashboard inline script.
- Simulated API-write tests passed for producer creation, category update, Works soft-archive and removal of a work-credit association.
- Validation tests confirmed that unsupported fields, unsafe URL protocols, invalid enum values and invalid producer/category/work/service IDs are rejected.
- Additional mock API tests confirm that direct updates cannot blank required producer names or work slugs, while valid partial updates and creates remain allowed.
- Admin UI selector audit found no missing static element IDs; searching the record list no longer closes an open editor or discards its draft values.
- Before this hardening patch, Vercel reported **success** for Phase 2 head `f24f7288be42e26ee143d4fa888b1dfec67712cf`; the new branch head requires its own deployment-status check.
- The test harness used a mocked PostgREST response; it did not write test records into the connected Supabase database.
- Live schema was checked against the CMS write allowlists. No Phase 2 database migration was required.

## Deployment status — 26 November 2026

The previous Phase 2 head, `f24f7288be42e26ee143d4fa888b1dfec67712cf`, had a successful Vercel status check and a Ready Preview deployment. The hardening patch creates a new head, so its deployment status must be verified separately:

- Preview: [Perivelle Phase 2 Admin CMS](https://perivelle-git-phase-2-admin-cms-studio-perlx.vercel.app)
- Previous Vercel deployment record: [Open deployment](https://vercel.com/perlx/perivelle/CVi1Wmd1aG9H4pKrrned2rq73Uin)

Deployment readiness is not the same as route-level or browser verification. The automated inspection client could not reach the Preview hostname in this session, so the actual HTTP response and browser UI smoke tests remain pending. Open the Preview, sign in, and select **CMS Studio** to check the Admin UI and read-only collection loading.

Do not test create/update/archive against Preview until you confirm that its `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` point to a dedicated staging Supabase project. The current connected Supabase project already contains live Perivelle data; avoid dummy mutations there.
