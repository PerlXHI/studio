# Phase 5 — Brand polish, quality gates and release readiness

## Goal

Bring the public and admin experiences into a consistent, responsive Perivelle system; add repeatable static QA; and prepare one final Preview for owner review before production deployment.

## Visual and responsive pass

- Keep the existing plum, lilac and rose palette, Sora/Inter typography and rounded component language.
- Standardize public spacing and component behavior through the existing design tokens.
- Keep the main navigation on one swipeable row on narrow screens rather than hiding key destinations.
- Refine home hero stacking, producer/service/work grids, portfolio rails, commission controls, dialogs and footer columns across tablet and phone widths.
- Respect reduced-motion preferences and keyboard focus styles.
- Keep dynamic CMS dialogs consistent with the existing public components and dark mode.

## Functional and security audit

- Phase 3 public CMS remains read-only and uses published projections with legacy fallback.
- Service detail dialogs show full description, packages, add-ons, deliverables, client requirements, service terms and FAQ when available.
- Phase 4 form and Terms publishing is checked server-side as well as in the admin interface.
- Commission submissions validate the current published service/form/Terms records before saving.
- Existing rate limiting runs before CMS validation reads.
- Submitted form and Terms versions are retained in immutable request snapshots for later audit.
- The service-role key remains server-side.
- No production CMS content or legal text is generated on behalf of the studio.

## Automated quality checks

The GitHub Actions workflow .github/workflows/phase5-qa.yml:
- checks syntax for JavaScript modules in api/ and assets/js/;
- extracts and syntax-checks inline scripts in the public and admin HTML pages;
- runs focused tests for dynamic commission submission validation.

## Release process

1. Keep the Phase 3–5 pull request in draft while code and Preview checks are in progress.
2. Resolve CI, Vercel build and static audit findings.
3. Verify the Preview pages and Admin CMS in a real browser at desktop, tablet and phone widths.
4. Owner performs the final visual/functional QC on the Preview.
5. Only after approval, merge the pull request and allow the production deployment.
6. Run production smoke checks for public CMS, Admin authentication, commission submission/tracking and existing Freebies/audio behavior.

Production deployment is intentionally not triggered by this implementation pass. The connected Supabase project contains live Perivelle data; no test writes or dummy content should be made against it.
