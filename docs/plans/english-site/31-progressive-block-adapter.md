# Incremental EN overlay promotion: nonpublic staging checkpoint

Date: 2026-11-02. Canonical repository: `alexyakovlev79/adatours.ru`.

## Scope

The next translation phase can select approved English blocks without rebuilding
the tour catalogue or duplicating prices/media. The pure
`planProgressiveEnglishCollection()` helper reads current active RU Astro
entries, their exact stable-ID block maps and approved target overlays. It
assesses every mapped visible block, its revision and Word evidence through
the existing `assessOverlay()` contract. Only complete, fully approved,
source-current entities are promoted to English.

All other entries are retained unchanged in `russianFallback`, together with
machine-readable decisions (`missing`, `stale`, `review`,
`untranslated_dependency`, etc.). Dependency closure keeps a Tour on RU
fallback when an embedded canonical Excursion has no approved English text.
Shared commercial facts and media come from the *current* RU record. A price
change unrelated to a translated block does not erase completed text, while
source-text and dependent Word changes invalidate the affected overlay.

The Astro collection bridge exposes this only through
`progressivePreview: true` for the exact noindex
`adatours-en` staging build. Missing/unsafe content is never rendered as
English. Existing 22 strict EN pages and the public RU build remain unchanged.
The current HTML fallback script still handles the unpromoted routes.

## Still required before production use

- Feed real approved overlays and accurate embedded Excursion dependencies to
  the new resolver, with source hashes and document evidence.
- Connect the progressive collection path to shared Tour/Excursion and
  Country/Destination Astro layouts and new EN routes. It is not invoked by
  existing route generators yet.
- Verify page-level route precedence, translation of all visible shell copy,
  accessible navigation and the static nonindex Pages build.
- Independently review the pending 142 pilot editorial blocks and reconcile
  2027 Word tariffs into shared RU/EN data before extending the translated set.

This change does **not** start mass translation, change DNS, publish indexed
English content, activate forms, or claim additional translated pages.
