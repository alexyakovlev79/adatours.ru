# ADA TOURS EN — strict Astro locale collection bridge

**Checkpoint:** 2026-11-02. **Branch:** `feat/english-site-foundation`.
**Status:** verified private Astro integration; public EN release disabled.

## What was implemented

The underlying strict approved-overlay `getLocalizedCollection()` was
already implemented in `src/lib/i18n/content-adapter.mjs`. This step
**reuses it** for canonical RU Content Collections, rather than creating
a second translation source. A new Astro-facing bridge lives in
`src/lib/i18n/astro-locale-collection.mjs`:

- `getAstroLocalizedCollection(collection, locale, getCollection, options)`
  supplies the existing canonical RU records unchanged for `locale='ru'`.
  For the private EN pilot it routes through a strict source-bound snapshot.
  A public EN request still goes through the global release gate; the
  planned EN host and an approved resolver cannot be bypassed by an env var.
- `readPrivatePilotCollections(getCollection,{root,env})` assembles exactly
  3 Tour, 11 Excursion, 3 Country and 4 Destination records. All are keyed
  by existing stable IDs, not translated slugs or duplicated commercial
  entities. The three Tour source MDs are checked against the pinned
  SHA-256 fingerprints in their existing block maps. The 11 Excursion and
  7 geography sources are validated against the pinned Git blob SHAs in
  their existing manifests. The Tour preview JSON remains pinned to the
  immutable three-tour source snapshot.
- Tour price, currency, length, status, hero asset path, primary topics and
  confirmed country/destination identities must match the canonical RU
  source. The full set of 11 Excursion refs must resolve. An unsupported
  locale, missing translation, duplicate ID, source drift, media mismatch
  or unapproved public release makes the build fail rather than silently
  falling back to Russian.
- A rejected source snapshot is never retained as a cache hit. Successful
  private snapshots can be reused within one immutable Astro build/reader.
  No translation is performed at render time and no network fetch is
  required for the content adapter.

The private Astro route generators
`src/pages/en-pilot-private/[...path].astro`,
`country/[slug].astro` and `place/[slug].astro` now consume this
shared adapter instead of independently loading Tour JSON, canonical
Excursion overlays and geography files in each route. Existing reusable
`BaseLayout`, `Hero`, `TripStats`, `Itinerary`,
`IncludedExcluded`, `MediaGallery` and `TourPricing` remain in use.
The rendered set remains **22 internal HTML pages**.

## Exact verification

- [Code `ef19e29c`](https://github.com/alexyakovlev79/adatours.ru/commit/ef19e29cfd23bca20f11516df8511e83192e5bcc)
- [Foundation tests #41402962535](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41402962535):
  **success** (includes the new Astro adapter tests and unchanged
  historical matching-core verification).
- [Private Astro build #41402962545](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41402962545):
  **success**; all 22 HTML pages generated and verified, including source
  fingerprints, English-only page content, stable-ID links, responsive
  stylesheet assets, private form behavior and exclusion from sitemap.
- Internal GitHub Actions artifact `ada-en-private-visual-22-pages`,
  ID **13121709827**, expiry **2026-11-16**.
- `main` and the Russian production website were not modified by this
  work. This is not a public EN deployment receipt.

## What remains gated

This is a proven **data-loading bridge for the closed pilot**, not yet
the complete locale-aware production `TourLayout`, `CountryLayout`,
`DestinationLayout`, `ExcursionLayout`, catalogues or Pagefind runtime.
Do not set `runtimeLocaleAdapterConnected`,
`localeContentAdapterConnectedToAstro`,
`operationalDispatcherReady`, `newEnglishSitePublished` or the
public release gates to true based on this checkpoint.

Next: migrate shared layout data dependencies and strings to the
locale-aware resolver, using a single source for facts/media and
separate approved EN text. Begin with the Tour/Excursion shared
layout pair and their country/destination references, then cover
catalogues, navigation, metadata/Schema.org/hreflang, search, real
EN forms and full RU regression. Independently review the 142
AI-assisted pilot Tour fields and 11 standalone Excursion translations
before publication; reconcile 2027 Word prices with their actual
price basis and extras. Only after the integrated end-to-end pilot
may the mass translator and public EN release gates be considered.

All historic 358 matching decisions, 348 canonical shared-Excursion
owners, source fingerprints and closed staging results remain intact.
