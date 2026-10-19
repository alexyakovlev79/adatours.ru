# Ada Tours — interactive GEO maps: pilot 17.10.2026

## Architecture

The static Astro build combines active Destination content and the canonical
\`src/data/catalog/destinations.json\` with **published** READY GEO passports in
\`data/geo-knowledge/entities/*.json\`. Staging / claims are not map data.

\`src/lib/geo-route-data.mjs\` is the pure route generator, independently tested in
\`tests/geo-route-map.test.mjs\`. It matches explicit tour day \`places[]\`, then day
title, then tour \`route[]\`; excursion \`route[]\`, then mention order in title/lead,
then linked Destination order. Consecutive repeats are merged, return visits are
retained in the line, and the marker keeps all applicable day numbers. Both identity
and coordinate assessments require >=70% when \`probability-70-v1\` is present;
low-confidence and unpublished locations are omitted.

\`src/lib/geo-map-astro.ts\` resolves the currently active content during build.
\`GeoRouteMap.astro\` sends a compact payload to a single lazy client loader.
The Yandex 3.0 and Google Maps API adapters reuse the same sequence, marker
numbers, hero image, summary, canonical link and geographic bounds.

The customer may pan/zoom after automatic first fit. No roads or transport mode
are asserted; lines are illustrative connections of visit points.

## Pilot

\`src/lib/geo-map-pilots.mjs\` limits maps to three pages:
\`tour_brazil_argentina_peru_14d\`, \`destination_brazil_rio\`,
\`excursion_source_salento_i_dolina_kokora\`.

Until valid API keys are installed, the component does **not** render to visitors:
no broken map container and no requests to map servers. Keys are necessary for
both providers. Never put unrestricted service keys in Git.

GitHub Actions build accepts these repository secrets/vars:

- Secret \`YANDEX_MAPS_JS_API_KEY\` -> \`PUBLIC_YANDEX_MAPS_API_KEY\`
- Secret \`GOOGLE_MAPS_JS_API_KEY\` -> \`PUBLIC_GOOGLE_MAPS_API_KEY\`
- Variable \`GOOGLE_MAPS_MAP_ID\` -> \`PUBLIC_GOOGLE_MAP_ID\` (optional, for advanced markers)

Restrict browser keys by HTTP Referer to the real public domains (including
\`adatours.ru\` and \`www.adatours.ru\` as applicable). Yandex JS API 3.0 requires
the Referer restriction. Google Maps JS API requires a billing-enabled project.
Browser keys are visible in page source by design; domain restrictions and
usage limits are the security boundary, not hiding a key in an Astro variable.

Provider priority: RU Yandex then Google; other locales Google then Yandex.
Provider libraries and their tiles load only when a map approaches the viewport
(IntersectionObserver rootMargin 300px). A failure leaves the static list of
canonical Destination links; the other configured provider is tried.

All maps are after hero/first screen. API services are not called at build time
or used to geocode or calculate transportation routes. Map and markers use the
existing destination titles, hero and summary.

## Completion criteria

Pilot requires real keys, one successful deploy and manual verification from
Russia without VPN, then independently from an international network. Verify
the three maps' route order, cards, fit-to-bounds and mobile. After the pilot,
switch from the three-ID allowlist to all active Tour/Destination/Excursion pages
with resolved GEO points; no extra MD fields or photo copies are necessary.

## Activation record — 2026-10-19

The owner configured a Yandex Maps JavaScript API key for `adatours.ru`
and added the repository Actions secret `YANDEX_MAPS_JS_API_KEY`.
Deploying again is necessary because Astro embeds its public browser key
only during the build. The three-page allowlist remains in effect; full
catalogue activation requires the pilot test from Russia without VPN.
Never copy the secret value into Git, documentation or CI logs.
