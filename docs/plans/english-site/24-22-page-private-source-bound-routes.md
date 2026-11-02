# ADA TOURS EN — 22 verified private HTML pages and stable-ID locale routes

**Date:** 2026-11-02. **Branch:** `feat/english-site-foundation`.
**State:** technical private EN HTML pilot verified; public release remains disabled.

## Confirmed output

One catalogue + three translated Tours + eleven translated canonical Excursions
+ three countries + four destinations = **22 private HTML pages**.

The new, independently source-bound Destination overlays are:

| Stable ID | Private EN URL | Exact canonical RU file | Pinned Git blob |
| --- | --- | --- | --- |
| `destination_chile_ostrov_pashi` | `/en-pilot-private/place/easter-island/` | `src/content/destinations/ostrov-pashi.md` | `59757aa7901b378ac59ecb4c824ee357c671ebfa` |
| `destination_colombia_bogota` | `/en-pilot-private/place/bogota/` | `src/content/destinations/bogota.md` | `b324e8a593cb6d091db9a62837e526d843f4739e` |
| `destination_colombia_kartahena` | `/en-pilot-private/place/cartagena/` | `src/content/destinations/kartahena.md` | `eb2e16298ab847e4129342a6b7a5e7fa83dde050` |

These three EN text sidecars include summary, body and the exact number of
source gallery images (6 + 10 + 10), with translated ALT and hover captions;
no new image assets, IDs, RU Markdown, offers, prices or shared media were
created or altered. Independent external editorial review remains pending.
Rapa Nui hero is still marked as an illustration, not a documentary photograph.

## Identity routing and graph

`src/lib/i18n/locale-entity-routes.mjs` now implements a generic,
explicit stable-ID → localized path index. It rejects unknown or
untranslated IDs, malformed/mismatched types, duplicate IDs/paths and unsafe
paths. The private adapter derives **21 exact entity routes** from the
approved three-Tour pilot and existing Excursion/Geography manifests;
plus the English catalogue path gives 22 HTML pages. This is reusable
foundation code and **not** an authorized public EN route set.

The private Tour route/country link is selected from each Tour's
`routeCountries ?? countries`, not from its name; linked EN Destination
pages are selected by canonical `routeDestinations ?? destinations` IDs.
Every one of the three Tour pages links to its appropriate English country
and relevant available EN destinations, while absent translations are never
rendered as Russian. Geography pages link to their actual country,
other available destinations of that country, and their relevant pilot Tour.
The catalogue, SiteHeader and SiteFooter use stable-ID URLs for their
translated geography. The public Russian navigation/default layout is
unchanged by design.

## Receipts and gates

- Production branch containing changes:
  [code commit `67a99570`](https://github.com/alexyakovlev79/adatours.ru/commit/67a99570a81eecacaf3a7219d7d33dc1df862d81).
- [Foundation tests `41400199246`](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41400199246) —
  **success**, exact code SHA `67a99570a81eecacaf3a7219d7d33dc1df862d81`.
- [22-page private Astro build `41400199202`](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41400199202) —
  **success**, including all 22 generated HTML files, localized ALT,
  intra-pilot links, CSS and full noindex/private-gate checks.
- GitHub Actions artifact: `ada-en-private-visual-22-pages`, artifact ID
  `13121635189`, expiry **2026-11-16**. It is a private review package,
  not a deploy to `adatours.com`.

`SITE_LOCALE=en` continues to fail closed. Private pages require the
explicit preview flag and have `noindex,nofollow,noarchive,nosnippet`:
no public canonical, hreflang, Schema.org, Pagefind index or live lead
submission. The disabled EN form is a visual prototype only. Neither
`main`, RU content, DNS nor mass translation was changed in this step.

## Next technical gates, not yet complete

1. Build `getLocalizedCollection(type,locale)` over the existing strict
   Astro MD + locale overlay adapter and replace hard-coded RU selectors in
   shared Tour/Country/Destination/Excursion layouts and the route generator
   in a controlled nonpublic integration. The existing private layout
   does **not** yet establish production locale runtime readiness.
2. Independently review the 142 AI-assisted pilot Tour text fields and 11
   standalone Excursion translations; preserve the Word-first authoritativeness
   and exact source fingerprints.
3. Reconcile 2027 Word base price vs supplemental rates with units,
   occupancies, seasonality and source locators, then update only validated
   common RU/EN prices in the authorized canonical workflow.
4. Integrate EN form endpoint/legal text, search/Pagefind, metadata,
   single-source Schema.org, reciprocal canonical/hreflang and dual-build
   regression checks. Never enable a public EN origin just to test features.
5. Pilot safe translation dispatcher on the full content graph before
   releasing batches beyond the already completed 358 matching results.
   Preserve 348 shared Excursion translation owners and all immutable receipts.

**Publication definition of done remains separate**: completed content,
source and semantic QA, safe dual deployment, confirmed release receipt
and explicit domain decision. This checkpoint satisfies none of those public
release conditions by itself.
