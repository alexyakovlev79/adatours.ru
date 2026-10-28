# Ada Tours: English site — progress and resume point

Date: 2026-10-28 (Europe/Moscow). Working branch: `feat/english-site-foundation`.
Baseline: `b1b14ed3a8abab9773053f836fed28c2ff77204f`.
Status: architecture and foundation in progress; English production is not enabled.

## Commission

Build the English presentation of the existing Ada Tours site with one shared
implementation and shared commercial/entity/media data. Plan for `adatours.com`,
but make the English origin replaceable in configuration. Preserve current RU
content and public paths. Use the existing English Word programmes as approved
copy: first the 2027 edition, then 2026 for tours not covered by 2027, then faithful
AI translation of unmatched blocks/tours. Resolve tour and block matches before
dispatch. Translate all other visitor content in Ada Tours' own voice, preserving
facts, structure, useful internal links, and the existing editorial rules.

The primary agent owns small interface copy, shared code and metadata templates.
Translation workers must not edit those shared files. No public-domain migration,
replacement of the existing adatours.com site or bulk translation is performed
by this foundation checkpoint.

## Confirmed at checkpoint 1

- GitHub read/write access works; the feature branch exists.
- The actual repository uses Astro 7.3.4 and Node >=24; `main` is the production
  branch. The current deployment workflow uses `https://adatours.ru` at `/`.
- Public media are shared through `https://img.adatours.ru`; new image binaries
  are not to be committed to Git.
- Existing URLs already use English slugs and stable entity IDs. These must not
  change when a language is added.
- The universal swarm standard is `docs/workflows/agent-swarms.md`; existing
  SEO/GEO/photo swarms remain independent.
- The supplied English Drive roots are readable. Inventory and matching are in
  progress; listing a file is not evidence of a programme match.

## Deliverable ownership

| Workstream | Output | Owner |
| --- | --- | --- |
| Architecture, rollout, editable domain config | `docs/plans/english-site/`, `src/lib/i18n/` | primary agent |
| Word inventory and evidence-based matching | `data/i18n/` and source audit | source audit worker; primary integrates |
| SEO/template/schema and voice audit | source-specific audit and translation rules | SEO audit worker; primary integrates |
| Strict text overlay, provenance and invalidation | isolated `content-overlay.mjs`, schema, focused tests | core implementation worker |
| UI dictionary and integration plan | `src/data/i18n/` | primary agent |

## Resume protocol

Read this directory's latest report and the branch head. Preserve saved inventory,
matches, exact source revisions and approved text. Never treat candidate matches,
worker-ready, a commit, or an unverified build as a published English page.
Continue from the most recent checkpoint; do not start a translator swarm until
its manifest, field/block mapping and operational pilot gates are complete.

## Remaining at checkpoint 1

1. Complete the code, static/dynamic metadata and source inventory audit.
2. Save the target architecture and precise translation/swarm contracts.
3. Implement and test safe initial i18n modules and translate the small UI copy.
4. Save final deliverables and test results in this branch, open a reviewable PR,
   and send the final report to the requesting user.
