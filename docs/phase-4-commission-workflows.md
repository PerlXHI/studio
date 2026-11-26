# Phase 4 — Versioned Terms and dynamic commission workflows

## Goal

Move Terms of Service and commission brief definitions into CMS-managed, versioned content. The admin team can prepare drafts, review them, publish immutable versions, and collect a client-specific submission snapshot without replacing the existing commission tracking workflow.

## Admin CMS Studio

New collections:
- tos_versions — global or service-specific Terms versions.
- tos_sections — ordered Terms content sections belonging to a version.
- commission_forms — active form definitions associated with a published service.
- commission_form_versions — immutable versioned field schemas.

Publishing workflow:
- New records begin as drafts.
- Terms versions can be duplicated into a new draft together with their sections.
- Commission form versions can be duplicated from the latest saved schema.
- The admin validates section completeness and form schema structure before publishing.
- The server repeats publication validation; client-side checks are not trusted as the only guard.
- Existing database triggers protect published Terms sections and published form/Terms content from edits. Changes require a new version.
- The existing unique indexes continue to prevent multiple published versions in the same supported scope.

## Public experience

- /api/public-cms?resource=all returns only published Terms, active forms and published form versions attached to published services.
- Drafts and archived records remain private to the Admin CMS API.
- The Commission page chooses a service-specific published form when one exists; otherwise it keeps the existing static brief form as a compatibility fallback.
- Supported dynamic field types: text, textarea, select, checkbox, email, URL, number and date.
- A published applicable Terms version appears in the commission form as a required acceptance step, with a readable dialog.
- If no Terms version is published, the existing commission request remains usable and no invented policy text is shown.

## Submission integrity and privacy

- The server validates the selected published service, form version, schema, field values and applicable current Terms version.
- Service-specific Terms take precedence over the global Terms version.
- A submission must accept the applicable Terms version shown by the public site.
- commission_requests stores service_id, form_version_id, tos_version_id, acceptance time, normalized answers and a submission_snapshot containing the exact form schema and Terms sections accepted.
- The existing brief, request ID, status, timeline, rate limit and Discord notification flow remain in place.
- Admin order details display additional dynamic answers and the accepted Terms version.
- No browser-side Supabase key or direct table access is introduced.

## Current data and publishing boundary

The connected Perivelle database was checked read-only on 26 November 2026:
- Published services: 5
- Terms versions / sections: 0 / 0
- Commission forms / versions: 0 / 0

No Terms or form content was seeded because legal wording and service-specific questions must be authored and approved by Perivelle. The admin editor is ready for that content; the public form uses its legacy fallback until a form version is published.

No schema migration, live data write or content publication was performed in this phase. The normalized tables and immutable-version triggers were created in Phase 1.

## Verification

- Automated tests cover valid published form submissions, service/form mismatch, Terms acceptance and invalid select answers.
- Phase 5 CI checks JavaScript syntax in API/public/admin scripts and inline page scripts.
- Preview deployment and browser behavior still require visual confirmation before production release.
