# EN staging: confirmed translation precedence on shared canonical routes

Decision: 03.11.2026. Source repository: `alexyakovlev79/adatours.ru/main`.
The English publishing caller remains in `alexyakovlev79/adatours-en`.
This documents the code contract, not an assertion of a successful deployment.

## Existing results to preserve

- The complete matching swarm finished **358** Tour decisions (221 Word 2027, 44 Word 2026, 93 AI-only). Do not restart matching.
- Stable block maps cover 31,330 visible Tour text blocks; the independent mass translator has separate queue and release gates.
- The first approved source-bound English HTML set contains 22 pages: one catalogue, 3 Tours, 11 Excursions, 3 Countries, 4 Destinations. Existing Word and translation provenance must be retained.

## Publishing correction

The previous `prepare-en-pages-site.mjs` staged **zero** of those 22 verified EN pages, even though the Astro build generated and validated them. It copied RU pages into `/en/`, including `/en/tours/`. This is why the site reverted to Russian.

The staging assembler now:

1. Uses each translated entity's stable ID to resolve its **existing canonical RU URL** from the same source-index catalogue and exact entry. The EN path is `/en` + that URL. There is no second content record or separate EN slug ownership.
2. Promotes exactly the 22 source-verified English HTML pages and rebases only their internal preview links to canonical EN paths.
3. Fills every other canonical RU route with a non-indexable, `lang=ru` fallback, without overwriting English. An English catalogue of the three prepared journeys links to `/en/tours-ru/` for the complete RU catalogue; later pagination and unapproved tour pages remain available via regular EN-prefixed fallback URLs.
4. Reuses the original Astro build, media URLs on `img.adatours.ru`, shared `_astro` assets, the same ID relationships and underlying prices. It does not duplicate binary photos or the source content database.
5. Reuses the single UI dictionary for shared navigation; unverified prose remains RU. The en-pages verifier checks translated precedence, exact stable-ID route destinations, internal links, noindex and inactive live forms.

## Boundaries

This is a **page-level** fallback with a selective common UI translation. A true block-level locale adapter for arbitrary partially translated content is still a separate implementation stage. No English SEO release, canonical/hreflang, live forms, pricing synchronization or mass translation is authorized by this fix. The feature-branch and CAS worker checkpoints are not reset or overwritten.
