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

## Map runtime diagnostics (2026-10-19)

When the static point list renders but the map says unavailable, it means Astro's
GEO data path has already succeeded and a browser-side provider step failed.
The map now shows an anonymized stage code:

- `YANDEX_SCRIPT`: JS API script could not be downloaded (network/blocker/timeout).
- `YANDEX_GLOBAL`: script loaded without creating `window.ymaps3`.
- `YANDEX_READY`: Yandex async initialization rejected or timed out.
- `YANDEX_EXPORTS`: expected Yandex constructors not present.
- `YANDEX_CREATE`: map container/layers could not be created.
- `YANDEX_ROUTE`: polyline creation failed.
- `YANDEX_MARKERS`: custom marker construction failed.

Add `?mapdebug=1` to an affected page for a short **sanitized** error detail.
Neither the error text nor console diagnostics include the API key or request URL.
The viewer can retry loading using the map's button, without reloading the page.
If the stage is `YANDEX_SCRIPT`, verify browser network access to
`api-maps.yandex.ru`; if `YANDEX_READY`, inspect the key status and HTTP
Referer restriction in the developer console. Do not silently switch to a
provider without its own correctly configured key. The production map must
not send client-side errors or keys to any server or analytics endpoint.

## Automatic initial map camera and route arrows — 19.10.2026

The pilot route reported correctly geocoded South American places, but passing
\`location.bounds\` to Yandex produced a viewport clipping northern and southern
destinations. Astro still supplies WGS84 \`[lng, lat]\` and the unchanged visit order.

\`geo-map-camera.mjs\` now computes Web Mercator center and zoom locally from
**all ordered visited coordinates** and the actual container size (responsive).
It leaves generous margin for numbered markers, supports the antimeridian and
does not call Google/Yandex \`fitBounds\`. Both adapters receive the same result.
Single-place pages retain their type-based initial zoom.

The route uses an explicit matching data-source/layer, independently rendered
two-point legs and one narrow gold stroke without a wide white outer halo.
\`geo-map-direction.mjs\` divides legs at the antimeridian when needed, so no
line crosses the unrelated hemisphere; the map camera continues to depend
only on actual visit coordinates. Compact filled arrowheads sit on long legs
at 58% of their projected length, with short local hops left unmarked.
Both providers use the same leg geometry and direction data.
No Directions API requests are made. On subsequent user pan/zoom, markers and
arrows remain geographically anchored; there is no automatic recentering.

Tests cover the actual Brazil/Argentina/Peru GEO coordinates at desktop/mobile
widths, direction bearings, no-op cases, and mocked Google/Yandex adapters.
Only the map UI/renderer is changed; no content MD, GEO passports or routes
are edited. Pilot allowlist remains unchanged.


## Route displacement root cause and renderer replacement — 19.10.2026

The pilot reproduced a Yandex-only discrepancy: numbered HTML YMapMarker
pins correctly appeared in South America, whereas the YMapFeature stroke
rendered in the Pacific. Both paths were fed the exact same verified WGS84
destination coordinates. Changing feature source IDs, splitting the geometry,
thinning strokes and adding arrows did not fix the mismatch, because all three
attempts retained a separately positioned YMapFeature rendering pipeline.

Yandex now renders the schematic route with an independent, pointer-transparent
SVG overlay. Each segment's screen endpoints are measured from the actual
rendered DOM rectangles of its numbered YMapMarker endpoints, with a short
inset for each pin; arrowheads sit directly on that segment. YMapListener
schedules redraw after pan/zoom; ResizeObserver covers viewport resize.
Bounded warmup handles asynchronous marker attachment. This removes the
separate route coordinate projection that caused the previous discrepancy.

Google Maps continues to use native geographic Polylines, unchanged.
The initial camera, GEO passports, ordered visits, point numbering, URLs,
and content remain unchanged. No external directions/geocoding calls added.
For repeated-world copies, long dateline strokes are suppressed.
New regression tests explicitly assert pixel alignment and redraw after
moving marker DOM, and ensure YMapFeature is not instantiated by Yandex.

The earlier descriptions of Yandex native vector strokes above are
historical and superseded by this section.
