# Ada Tours EN — shared Tour/Excursion geography model

**Date:** 2026-11-02. **Branch:** `feat/english-site-foundation`.
**Scope:** incremental locale-aware refactor of the actual RU Tour/Excursion
layouts and the closed 22-page EN pilot. Public EN release remains blocked.

## What changed in the running components

The new pure model `src/lib/i18n/entity-geography-model.mjs` accepts
canonical stable IDs and preverified Country/Destination entries in the
requested locale. It exports two independent projections:

- `buildTourGeographyModel()` selects route countries, full route places,
  main and optional places. RU mode retains the currently planned but
  unpublished destination as **unlinked Russian text**, and preserves the
  original country-first URL helpers. EN mode requires translated Country
  identities; missing EN Destination pages are excluded rather than
  silently linked or filled with Russian names.
- `buildExcursionGeographyModel()` deduplicates a primary Destination and
  relatedDestinations, preserves canonical RU destinationName fallback,
  and in English uses only the confirmed localized Destination entry or
  an explicitly translated destinationName, never the RU catalogue.
  It refuses a Cyrillic EN fallback or wrong-locale linked record.

The actual `src/layouts/TourLayout.astro` now uses the shared model
in place of its local Country/Destination mapping. The actual
`src/layouts/ExcursionLayout.astro` uses the same shared layer
for the visible destination set and destinationName. Existing Russian
template HTML, cards, rankings, SEO, archive controls, price basis and
external endpoints have **not** been rewritten.

The private `src/pages/en-pilot-private/[...path].astro` uses these
same functions to project its verified 3 Tour / 11 Excursion graph
and now shows available EN Destination links from Excursion pages.
The HTML verifier checks five exact source-backed
Excursion→Destination examples (Rio, Rapa Nui, Bogotá twice, Cartagena)
as well as Tour→Country and Tour→Destination links. Missing EN pages
remain non-links rather than fabricated product pages.

## Verification, errors addressed

- [Shared-model implementation `c27e8820`](https://github.com/alexyakovlev79/adatours.ru/commit/c27e88209a300c10932784bfa457a672b88d5c94)
- [Unit test fixture correction `03beddb9`](https://github.com/alexyakovlev79/adatours.ru/commit/03beddb91a9dcbdaf883cd32dc19c8997ce470f0):
  the original negative test mixed Cyrillic rejection with wrong-locale
  rejection. The fixture now isolates the exact error it asserts.
- [Final verifier correction `94598f46`](https://github.com/alexyakovlev79/adatours.ru/commit/94598f461eb8bdec966af9ccc2f137149b43a608):
  removed a duplicate import in the HTML verifier and added
  `node --check` preflight ahead of the expensive Astro build.
  The preceding full Astro build rendered 6176 pages but its post-build
  verifier could not parse the duplicate import; this was an
  explicit CI failure, not a successful EN release.
- [Foundation unit run #41405918364](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41405918364)
  **success** at exact SHA `94598f461eb8bdec966af9ccc2f137149b43a608`.
- [Full nonpublic Astro build #41405918629](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41405918629)
  **success** at the same SHA: 22 private EN pages, all reference/link,
  English ALT and noindex checks, package and the original RU checkout
  write-protection step.
- Review artifact: `ada-en-private-visual-22-pages`, ID
  `13123776684`, expiry **2026-11-16**.
- The `main` branch advanced separately from
  `168a249db7ee94fe35eb8472a98f2bdcc372f9e1` to
  `c209045e5728ba3141bf9daa5ad4099e3bb944a4` with only
  `src/scripts/video-covers.mjs` modified by another task.
  These EN commits did not write to `main`.

## Limits and next technical gate

This is **not** complete production-style EN rendering by
`TourLayout` and `ExcursionLayout`: the public
`SITE_LOCALE=en` gate remains disabled and the private English
Tour/Excursion body stays in its dedicated noindex route while it shares
presentational components and the new geography projection.
The 142 AI-assisted pilot Tour fields have not received independent
editorial QA; common 2027 Word tariffs have not been fully reconciled;
public EN SEO/Schema/hreflang, Pagefind and real forms remain gated.

**Next:** extract and localize further common Tour/Excursion visitor-facing
sections and link models, then integrate the same pattern into
`CountryLayout` and `DestinationLayout`. Verify RU equivalence with
explicit representative HTML checks, keep accurate source fingerprints,
and only afterward proceed to EN commercial/static pages, SEO,
search, forms and mass translation dispatch.

Do not re-run the completed 358 historical matching jobs,
21-identity private pilot, or 348 shared Excursion ownership mapping.
Do not merge into `main`, change DNS, enable a live EN form or publish
`adatours.com` as a side effect of this checkpoint.
