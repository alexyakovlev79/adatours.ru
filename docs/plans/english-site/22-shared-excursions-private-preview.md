# Ada Tours EN: 11 translated canonical Excursions in the private HTML pilot

Date: 2026-10-30. Feature branch: `feat/english-site-foundation`.
Status: **technical private-preview verified; no public EN release**.

## Completed and preserved

- User explicitly authorized the assistant to translate and prepare the eleven independent Excursion pages. All 11 were translated directly from their current canonical Russian Excursion MD, not by assuming that a similar Tour Word passage is the exact stand-alone product.
- Translation overlay files: `data/i18n/pilot-excursions/v1/<stableId>.json`; single manifest: `data/i18n/pilot-excursions/v1/manifest.json`. Provenance `assistant_translation_from_canonical_ru`. Status: prepared for private preview, independent editorial review false, publicationAuthorized false. The overlays hold localized text, not duplicate commercial entities.
- The source manifest pins each canonical source filename **and Git blob SHA**. GitHub Actions validated every fingerprint against both the EN feature checkout and current `main`. An updated RU file invalidates the old translation until reconciled.
- Numeric prices, currency, stable entity ID, destination and country IDs, shared image paths, statuses and relationships remain from canonical source records. Language-specific titles, lead/body, prices *in prose*, itineraries, services, conditions and image ALT/hover are translated, with exact counts checked.
- The shared `Itinerary.astro` renders these 11 source-verified records at their original linked positions across three EN Tours, with no RU fallback. Tour-specific Word-approved descriptions in contentBlocks remain with the Tour rather than overwriting a shared Excursion.

## Eleven completed Excursion translations

| Tour | Stable ID | Canonical EN preview slug |
|---|---|---|
| Rio | `excursion_rio_night_show_churrascaria_dinner` | `rio-night-show-churrascaria-dinner` |
| Rio | `excursion_rio_sugarloaf_urca_four_hours` | `sugarloaf-urca-four-hours` |
| Rio | `excursion_rio_corcovado_tijuca_four_hours` | `corcovado-tijuca-four-hours` |
| Rio | `excursion_rio_rocinha_private_walk` | `rocinha-private-walk` |
| Easter Island | `excursion_easter_island_orongo_rano_kau` | `orongo-rano-kau-tour` |
| Easter Island | `excursion_chile_easter_island_south_coast_anakena_private` | `south-coast-moai-anakena-private` |
| Easter Island | `excursion_chile_easter_island_akivi_hanga_pukure_puna_pau_tahai_private` | `akivi-hanga-pukure-puna-pau-tahai-private` |
| Colombia | `excursion_source_siti_tur_v_bogote` | `bogota-city-tour` |
| Colombia | `excursion_source_colombia_bogota_zipaquira_con_guatavita` | `zipaquira-guatavita-tour-from-bogota` |
| Colombia | `excursion_source_siti_tur_po_kartakhene` | `cartagena-city-san-felipe-castle-tour` |
| Colombia | `excursion_colombia_san_pedro_majagua_day_trip` | `colombia-san-pedro-de-majagua-day-trip` |

The 11 preview URLs use `/en-pilot-private/excursion/<canonical-slug>/`. Their hostless paths are only present in the explicit private Astro build. The preview root `/en-pilot-private/tours/` links to all three Tours and 11 Excursions. Each translated Excursion links to a matching Tour; Tour itineraries link back to the corresponding private EN Excursion page.

## Verification and deliverables

- Overlay changes: [translation commit 51084855](https://github.com/alexyakovlev79/adatours.ru/commit/51084855165f4432cf48e49aaad741974b9eb89c).
- Latest tested implementation: `ac206c52a9fd7f4f894a197b942a2cd20bd0e92d`. [Foundation tests #41075627376](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41075627376) = success. [Private Astro HTML #41075627323](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41075627323) = success.
- Private Actions artifact: `ada-en-three-tour-eleven-excursions-private-html`, ID `12987936006`, retention 14 days, 15 HTML files. The supplied Windows ZIP was repacked into a standalone catalogue directory (index + tour/ + excursion/); 15 HTML / 24 files; all local links and ZIP CRC checked.
- HTML checks: English-only visible copy, correct Tour day counts 4/3/5 and 11 Excursion links, localized ALT, explicit noindex, no canonical/hreflang, no public JSON-LD, no working POST form/analytics, private links valid, no private routes in sitemap.

## Source-specific follow-up

- The **canonical Bogotá city-tour gallery** contains an item sourced from the Cartagena excursion, with an ALT naming Cartagena. This translation faithfully retained the canonical media record, and we did not change or regenerate the source asset during a text translation. Re-evaluate that single photo in a dedicated media QA pass before public EN publication.
- Separate editorial review is still outstanding for 142 generated fields in the existing three-Tour pilot. The 11 newly authored Excursion EN pages have passed technical QA, **not** a second independent human editorial review. The distinction does not block private preview.
- Complete shared RU/EN `TourLayout` integration still requires localized Country/Destination relations and the regular public route pipeline. Forms, Pagefind, production SEO/Schema/hreflang, shared 2027 tariff reconciliation, live dual-domain deployment and mass translation release remain separate gates.
- `main`, the public site and domains were not modified by this EN worker. Do not relaunch completed matching or the five finished translator pilot packets when resuming.
