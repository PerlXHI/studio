# Phase 3 — Public CMS integration

## Goal

Connect the public Perivelle site to the normalized CMS introduced in Phase 1 and managed through the Admin CMS Studio in Phase 2. The public website reads only published and visible projections from \`GET /api/public-cms?resource=all\`; the legacy site-config route remains in use as a fallback and for settings that are not part of the normalized CMS yet.

## CMS-backed public content

- Producer cards and producer avatars use visible \`producer_profiles\` records.
- Portfolio category filters and category video galleries use visible \`portfolio_categories\` and published \`works\`.
- Featured Portfolio uses published Works with \`is_featured = true\`, excluding migrated portfolio-video markers that belong in the category video rail.
- Work credit assignments are used only when present in \`work_producers\`; no credits are inferred from names or legacy data.
- Audio-first / artwork-first Works without a video URL are rendered as playable asset cards inside their category.
- Service cards are ordered from published \`services\`; descriptions, thumbnails and price labels use CMS values. Active packages and add-ons appear below their parent service.

## Legacy content intentionally retained

The following still read from \`/api/site-config\`, because their normalized public workflows are not part of this phase: Freebies, the floating audio player, commission availability/status, studio contact links, and the existing commission request form. No Terms of Service or commission form is made public by this phase.

If the public CMS endpoint is unavailable or its response is incomplete, the website continues using the legacy \`site-config\` values. The public CMS endpoint and site-config request run in parallel so a failure in one does not block the other.

## Data safety

- No database schema changes, migrations, or content writes are required.
- No client-side Supabase key is introduced; the browser calls the existing Vercel public-CMS endpoint.
- The endpoint returns the existing allowlisted public projections only. Draft, archived, hidden producer/category records and unpublished services/Works remain excluded.
- CMS values are inserted into the DOM with text nodes / \`textContent\`; URLs used for images and audio must be HTTPS, and video URLs continue through the existing YouTube/Vimeo allowlist normalizer.
- Legacy settings remain unchanged and can serve as fallback during rollout.

## Validation performed

- Public CMS data projection maps categories, Works, work credits, producers, services, packages and add-ons into the public page contract.
- The current database snapshot contains 3 visible producers, 6 categories, 13 published Works, 5 published services, 0 work credits, 0 packages and 0 add-ons.
- Current service price labels are preserved verbatim from \`legacy_price_label\`; numeric price is not inferred.
- JavaScript syntax checks and mocked CMS projection checks passed.
- No live database writes or migrations were performed.

## Browser verification still required

- Open the Phase 3 Preview and confirm Home, Portfolio, Featured Portfolio, Services and Our Team render from the CMS.
- Confirm Freebies, audio player, commission status and contact links continue to load from site-config.
- Check that an invalid/unavailable public CMS response falls back to legacy site-config.
- Check desktop and mobile layouts, including categories with no Works, audio-only Works, and services with packages/add-ons.
