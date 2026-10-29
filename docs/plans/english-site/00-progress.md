# Ada Tours: English site — progress and resume point

Updated: 2026-10-29 (Europe/Moscow). Working branch: `feat/english-site-foundation`.
Baseline: `b1b14ed3a8abab9773053f836fed28c2ff77204f`.
Status: architecture/source preparation and isolated foundation verification
complete. English production and automatic translation workers are not enabled.

## Latest binding decision — 2026-10-29

Read `docs/workflows/english-site.md` v1.1 before the original plans and audits.
Alexey clarified the source authority:

1. Once the tour identity is confidently matched, use the selected English Word
   for EN content, including guide language, place names and programme details.
   Differences from the old RU text do not require manual review. Prefer a working
   first version over waiting for perfect block-by-block equivalence.
2. A different price found in the confidently matched 2027 Word replaces the
   old website price in BOTH RU and EN. Update the one shared tariff, retaining
   currency, occupancy and price basis. Do not create a separate offer/variant
   merely because the old site price differs, and do not request additional
   human approval for this authorized update.
3. Preserve the 2027 → 2026-for-remaining-tours → AI-for-gaps order. A 2026 text
   source must not roll back an already established newer 2027 shared tariff.
4. Historical audit evidence remains; prior review dispositions based solely on
   these Word/RU differences are superseded. Match uncertainty is not permission
   to attach an unrelated programme. CAS, provenance and deploy receipts remain.

This checkpoint changes the documented contract and resume instructions only.
No production price update, operational price synchronizer, mass translation or
EN deployment is claimed by this amendment.

## Commission

Build the English presentation of the existing Ada Tours site with one shared
implementation and shared commercial/entity/media data. Plan for `adatours.com`,
but make the English origin replaceable in configuration. Preserve current RU
public paths and technical identities. Use the existing English Word programmes
as approved copy: first the 2027 edition, then 2026 for tours not covered by 2027,
then faithful AI translation of unmatched blocks/tours. Resolve tour and block
matches before dispatch. Apply the source and price authority above rather than
preserving obsolete RU facts. Translate other visitor content in Ada Tours' own
voice, preserving structure, useful internal links and editorial rules.

The primary agent owns small interface copy, shared code and metadata templates.
Translation workers must not edit those shared files. New 2027 tariffs are
submitted as source-backed shared-fact changes; the master applies them to the
common record without another human approval gate. No public-domain migration,
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

Read the latest binding workflow first, then this directory's report and branch
head. Preserve saved inventory, matches, exact source revisions and approved text.
Never treat candidate matches, worker-ready, a commit or an unverified build as
a published English page. Continue from the most recent checkpoint; do not start
a translator swarm until its manifest, field/block mapping and operational pilot
gates are complete. Do not reinstate superseded manual review gates from the
historical audit or candidate records.

## Checkpoint 2: architecture and source preparation

- Full observed Drive metadata inventory: 1,112 files in 95 folders; 732
  candidate programme documents (344 in 2027, 388 in 2026), 380 excluded from
  automatic selection. Exclusion is not proof that an allowed alternative
  programme source cannot exist there.
- Current Tour roster: 392, including 358 active and 34 archived. Candidate
  matching remains incomplete; eight product identities checked against full
  DOCX, none approved for automatic publication or AI-only.
- Prepared architecture, editorial contract, swarm runbook, runtime SEO/schema
  audit and a step-by-step implementation plan.
- Prepared EN metadata specification with exact source hashes; source extractor
  and reproducible candidate builder, with integrity checks.

## Checkpoint 3: tested foundation and hand-off

- Implemented strict source/translation overlays, separate text/fact/media
  fingerprints, Word evidence validation, approval content hashes and CAS
  protection against overwriting an independent target edit. This is a library,
  not an operational content adapter or distributed queue.
- Added replaceable RU/EN site configuration, exact publication-aware language
  alternates, Organization identity helpers and strict UI-message utilities.
  EN remains `planned`; the helpers are not connected to production.
- The primary agent prepared 218 bilingual UI entries and 15 English interest
  copy sets. Prepared 89 metadata template/rule entries; runtime integration
  remains explicitly listed in the audit.
- Verification passed: 35 focused unit tests, 19 source-integrity checks,
  JSON parsing, JavaScript syntax checks and exact reproduction of all 392
  candidate rows from the saved manifests and baseline Git blobs. No complete
  Astro build, live queue test or EN deployment was performed.
- Added read-only `npm run i18n:status` and `npm run test:i18n`, canonical workflow
  guidance, an independent review, documentation index and final report.
- No Tour has yet completed block alignment/translation approval. All 392
  `aiOnlyEligible` decisions remain false; eight identity matches are evidence
  for the next mapping stage, not publication permission.

## GitHub checkpoints

1. `5eeb6bcbd139fb298e8ba63f5b2e38f1819889c1` — commission, actual baseline,
   write-access confirmation and resume point.
2. `7e3bf6009d712f7db1c895e0c3b97a100c8b88e8` — architecture, source audit,
   matching candidates, editorial contract, SEO audit and swarm runbook.
3. `da689b97500d3fca432c235db5d57becb4e9538e` — foundation code, UI copy, tests,
   schemas, reviewed hand-off and final report. The branch/PR is the review
   destination; `main` and public deployments are unchanged.
4. The commit adding the 2026-10-29 decision to this file — binding Word source
   authority, shared 2027 price-update policy, supersession of unnecessary manual
   reviews, and revised workflow/index/resume instructions. Documentation only;
   code, source evidence, production content and deployment settings unchanged.

## Next implementation session

1. Read `docs/workflows/english-site.md`, then `10-report.md`,
   `06-rollout-plan.md` and the latest branch head. Use `npm run i18n:status` as
   a static readiness snapshot, not a live queue query.
2. Complete semantic matching of remaining active Tour and stable block maps
   for the eight checked identities, including shared Excursion ownership.
   Apply Word content directly to EN and source-backed 2027 tariffs to the
   shared RU/EN record; no manual review for the superseded differences.
3. Connect the locale adapter and translated UI/metadata to Astro, preserving
   RU regression behavior. Build and test the real CAS dispatcher and recovery
   pilot before mass translation; the runbook defines the technical gates.
4. Proceed through 2027, then 2026, then proven AI gaps. Dual deployment and
   legacy-domain migration follow content and deployment receipts.

The final report and requested email are a hand-off of preparation, not a claim
that a new website or automatic synchronization has been launched.
