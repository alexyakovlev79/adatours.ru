# ADA Tours EN: acceptance of the five matching pilot results

Date: 2026-10-29, Moscow date only. Feature branch:
\`feat/english-site-foundation\`. Live queue: \`i18n/matching-staging\`.
The master must use \`docs/workflows/english-site.md\` for the current
2027 source authority and common RU/EN prices.

## Pilot result

The live matching index had exactly five \`ready\`, zero \`queued\`,
zero \`leased\`, zero \`retryable\`, zero \`blocked_external\`,
and 353 \`held\`. All five results were written under immutable
\`data/i18n/matching/v1/results/\` paths and were not duplicated.
All five selected corresponding 2027 English Word programmes.

| Entity ID | Evidence | Days | Pricing change |
| --- | --- | ---: | --- |
| \`tour_brazil_best_rio_express_six_days\` | Word 2027 identity and full DOCX SHA match original pilot | 6 | None; nine quoted price rows agree |
| \`tour_mexico_lindo_eight_days\` | Word 2027 identity/SHA and 8-day route verified | 8 | Three source-backed changes to common RU/EN tariff |
| \`tour_chile_easter_island_3_days_2027\` | Word 2027 identity/SHA and 3-day itinerary verified | 3 | None; six-cell table agrees |
| \`tour_brazil_rio_four_days\` | Word 2027 identity/SHA and four-day itinerary verified | 4 | None; nine-cell table agrees |
| \`tour_brazil_foz_iguazu_three_days\` | Word 2027 identity/SHA and three-day itinerary verified | 3 | None; three quoted price rows agree |

For every result, checked \`entityId\`, \`sourceFingerprint\`,
\`selectedSource.driveFileId\`, \`sourceSha256\` and
\`modifiedTime\` against the earlier independently downloaded
\`data/i18n/word-pilot-review.json\` evidence. The latest matching
core's \`validateMatchResult\` returned true for all five. The exact
Git blob hashes of results agree with the state receipts.

This is a matching audit, **not a full new download of the five DOCX
files or a completed block-by-block translation**. The existing Word
documents were independently extracted during the original pilot.

## New source-backed price instruction

Mexico Lindo 2027: Word price per person, programme of 8 days/7 nights:
\`SGL USD 2372\`, \`DBL USD 1908\`, \`TPL USD 1855\`.
The previously published RU Tour shows \`5870/5336/5219\`.
The result includes exact Word table anchors and
\`priceAmendments\` with \`changeRequired=true\` for these three
tariffs. **They remain pending application by the common-price
master**. Do not claim that RU has already been corrected or that
the English website is published. The master must update \`priceFrom\`,
\`priceNote\`, the full price table, other static amount references,
the dependent indexes/SEO and JSON-LD in a single consistent change,
with the same prices in future EN.

## What went wrong in pilot dispatch

The published worker guidance said three Tours per chat but
\`runEnMatching\` had no per-owner cap. The first Work chat completed
all five jobs; the second had no work. This did not duplicate
results, but it failed to exercise two independent owners as intended.

Correction in the feature branch: the dispatcher now records
\`ownerAssignments\` in the CAS index and enforces **3 distinct
claims per Work chat when \`pilotOnly\`**, and **6 when bulk matching**.
The quota survives individual completed/released jobs and a caller
cannot reset it by changing its token or claiming through an expired
lease. Separate runner tests verify 3+2 independent pilot owners,
six bulk completions, concurrent claims and lost replies.

CI: https://github.com/alexyakovlev79/adatours.ru/actions/runs/40837594359
(succeeded for matching quota + recovery tests).
Pilot evidence plus the earlier true GitHub CAS smoke test are
sufficient to allow matching **bulk**, subject to read-back of the
specific staging activation commit.

## Scope of approval

- Open remaining **353 matching jobs**, but never requeue five \`ready\`.
- Each bulk Work chat owns at most 6 **distinct** matching jobs.
- No worker may write common facts, prices, source MD, media or \`main\`.
  Source-backed 2027 price amendments are staged for the master.
- Translation remains **closed**. EN locale rendering, complete
  block alignment and dual deployment remain future gates.
- Publication and Word prices are separate workstreams; matching
  result \`ready\` is not \`translation approved\` or \`published\`.
- During bulk, process evidence-based candidates in priority
  2027 -> 2026 -> no-match only after both years and permitted
  quarantined sources have been substantively checked.
