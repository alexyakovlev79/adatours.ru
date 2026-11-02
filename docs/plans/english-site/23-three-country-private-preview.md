# EN Ada Tours: three-country private geography and navigation

Date: 2026-11-02. Branch: `feat/english-site-foundation`.
Scope: closed EN preview only. Public RU, `main`, `adatours.ru`,
`adatours.com`, real lead submission and mass translation remain unchanged.

## Source-bound additions

- Added English country overlays for `country_chile` and
  `country_colombia`, alongside existing `country_brazil` and
  `destination_brazil_rio`.
- Each overlay retains the canonical stable ID, slug, source path and Git
  blob fingerprint; only editorial language fields, photo ALT/hover, regions,
  languages, seasonal text and feature-band text are localized. Existing
  `/media/` paths, prices, relations and RU content are untouched.
- Canonical source blob SHAs were equal in `main` and this feature branch
  before creating the new overlays:
  - Chile `7383936a41ce28d06ff2ab18df0fd0fa85b15760`
  - Colombia `eac7c29a80aa2cab9406eb0feec00f804ed98c37`
- `data/i18n/pilot-geography/v1/manifest.json` now names four exact records.
  The strict loader refuses missing records, changed RU MD, untranslated
  Cyrillic, unverified country ID, inconsistent image counts or unauthorized
  public release.
- Private Astro generates three country pages and the Rio destination page,
  in addition to three Tours, eleven Excursions and one catalogue:
  **19 HTML pages total**.
- Native EN header/footer and the private catalogue link to all three
  country pages. Each of the three Tour pages links to its own source-bound
  country, not a generic country inferred from text.

## Commits and verification

1. [`ef88e535`](https://github.com/alexyakovlev79/adatours.ru/commit/ef88e5357a729c96665f58ba08fd4602764d0f18):
   translated Chile and Colombia, strict manifest, common geography renderer,
   source verification, navigation, 19-page HTML verification and package.
2. [`8ac3df13`](https://github.com/alexyakovlev79/adatours.ru/commit/8ac3df138d513b9cb868488dcb6f9564cf9b53ad):
   source-driven geography cards in private catalogue and direct Tour →
   Country links, with stricter HTML link checks.

The first checkpoint has a successful
[foundation test](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41397537769)
and [19-page private Astro build](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41397537764),
which generated a nonpublic, expiring review artifact. The second checkpoint
has [foundation test](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41397950465)
success. Its final [private Astro build](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41397950430)
must be checked before calling the *latest* catalogue/navigation build verified.

## Release boundary and next work

This is still an **internal Astro preview**, not EN production.
`EN_PILOT_PREVIEW=1` is required, `PUBLIC_EN_RELEASE` is forbidden,
and `SITE_LOCALE=en` still fails closed. Every preview page must stay
`noindex,nofollow,noarchive,nosnippet` without canonical, hreflang or
public JSON-LD. EN forms are visible but disabled; do not claim live leads.
Full `TourLayout`/Country/Destination runtime integration is not complete.

The next implementation passes are:
1. Replace hardcoded private pilot route links with stable-ID-driven locale
   routing in the regular shared Astro layouts; add verified EN versions
   of referenced active destinations where content exists. No RU fallback.
2. Complete editorial QA of the 142 previously generated pilot Tour fields
   and independently evaluate the eleven excursion translations.
3. Reconcile Word 2027 base tariffs and supplements using price basis,
   occupancy, currency, season and XML source locators; update verified shared
   RU/EN prices only through the authorized canonical price workflow.
4. Test real EN-only navigation, EN contact form endpoint, Pagefind,
   SEO titles/descriptions, Schema.org and reciprocal hreflang. Keep the
   nonpublic release gate closed until an integrated dual-build pilot passes.
5. Open the separate translation dispatcher to the remaining active
   catalogue only after its pilot and safety gates pass. Preserve the
   already complete 358 historical matching receipts and 348 shared
   excursion ownership records; do not repeat those swarms.

Do not merge into `main`, activate mass translation, switch DNS or publish
`adatours.com` as a side effect of this private checkpoint.
