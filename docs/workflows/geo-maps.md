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

## Popup cards, excursion placement and gated lazy loading — 19.10.2026

- Selecting a numbered marker opens its informational card near the **top** of
  the map, outside the bottom-left Yandex control and attribution region. The
  card is in a higher stacking context than map UI; a capped scrollable area
  preserves access on narrow viewports. Popup photos have **larger**, less
  panoramic crops (220px desktop, 200px mobile), never reduced to make room.
  On mobile summaries use two lines so the destination link stays above the
  map controls. Original assets and alt descriptions remain unchanged.
- Excursions use the legend “Все точки экскурсии”; tour legends remain “Все
  точки маршрута”. Their map follows the place banners and precedes photos.
- The provider API and tiles now require three independent conditions:
  `window.load` plus completion of above-fold images/fonts, actual downward
  scrolling, and proximity within 300px of the viewport. Initial render alone
  cannot trigger network loading, including when the map sits above the fold.
  Without IntersectionObserver, proximity is calculated on scroll/resize.


## Catalogue-wide GEO map activation — 19.10.2026

The three-page allowlist in the historic pilot is no longer a runtime gate.
One shared `GeoRouteMap.astro` is now invoked in each common Tour, Excursion,
and Destination layout. There are no per-product scripts, duplicated map
implementations or generated binary assets. Only active RU entities with at
least one verified published Destination GEO coordinate render the component.
The existing first-screen/load/scroll/proximity lazy-load gate still prevents
initial Google/Yandex API and tile requests.

Tour and excursion maps preserve their real ordered visits and schematic
arrows. A Destination map sits immediately before the existing "Куда поехать
дальше" section. It receives *exactly* the already calculated and capped
recommendation IDs, excludes neighbors without valid published coordinate
passports, and requires the current destination itself to have verified
coordinates. It shows no route lines, because recommendations are alternatives.
The main destination gets a gold, larger high-z-index marker drawn last in
both Yandex and Google Maps; neighbors have blue markers. At equal/nearby
locations the current place remains on top. All links/cards share the same
canonical Destination identity and text.

On both desktop and mobile, photo cards fill their map's available vertical
space almost to the provider attribution, with the photo flexing taller and
summaries allowing four/three lines respectively. The provider controls remain
uncovered. A photo-less card remains content-sized rather than a tall blank box.


## Closer initial camera — 19.10.2026

The owner compared screenshots before and after two physical mouse-wheel
zoom increments. The visible inter-marker distance increased about 1.5×;
two full Web Mercator zoom levels would instead produce 4× magnification.
The shared `fitGeoCamera()` therefore applies `DEFAULT_INITIAL_ZOOM_BOOST
= 0.6` (approximately 1.52×) **after** calculating the original geographic
center and initial overview. It applies to every map on Tour, Excursion and
Destination pages, on desktop and mobile, with Yandex and Google alike.
The upper zoom limit still applies to a single location. No route order,
coordinates, marker styling, overlay behavior or lazy-load gate changes.
The intentionally closer initial view can clip peripheral stops on long
routes; pan/zoom and the accessible full list of stops remain available.
Pass `zoomBoost: 0` to test the unmodified fit-to-all geometry separately.


## Marker-edge-based responsive auto-fit — 19.10.2026

Supersedes the temporary `DEFAULT_INITIAL_ZOOM_BOOST=0.6` shortcut. Do **not**
apply a fixed zoom increment or the former broad 64/90px horizontal and
82/94px vertical padding. The start camera now uses the real map canvas width
and height and the *outer edges of its markers* (38px normal, 44px featured).
It reserves the largest circle radius plus 0.9 of one normal marker diameter
at each edge. In the limiting dimension, both opposite marker-edge gaps stay
within a single marker diameter. The other dimension may have more empty
space when the geography's aspect ratio differs from the viewport: enlarging
further would clip points. The algorithm runs independently for desktop and
mobile at their actual responsive pixel dimensions, using the original WGS84
Mercator bounds and antimeridian handling.

Yandex Maps 3 uses `zoomRounding:'smooth'` and Google Maps explicitly enables
`isFractionalZoomEnabled:true` so raster defaults do not round the computed
fractional zoom and cut off border markers. The static source data, ordered
routes, directional arrows, highlighted destination colors, photo cards,
and deferred API loading are unchanged. A single location remains centered
at its type-specific `pointZoom` because it has no bounding extent.

Regression tests project real Brazil/Argentina/Peru itinerary points on
1030×480 desktop, 360×445/390×445/320×445 mobile and 1200×700 wide
canvases, checking all circles are visible and that the limiting side(s)
have no more than one diameter of clearance. Also test a featured 44px
destination circle and both provider fractional zoom settings.

## Small upward camera adjustment and current place text — 19.10.2026

Following the marker-edge fit, the initial camera shifts the projected
geography **up 19 px on desktop and up 38 px on mobile**. The 720px responsive
breakpoint is the same as the map component's mobile breakpoint. The shift is
implemented by moving the Mercator camera center southward at the computed
fractional zoom, without changing coordinates, zoom, ordered legs, or marker
geometry. A clamp preserves at least 3px of space above the topmost circle on
height-constrained maps, so these are maximum intended shifts when headroom
permits. Applies to both Google and Yandex via `fitGeoCamera()`, including
single-place maps.

In the Destination map's ordered legend, the featured/current destination
is rendered as a bold `<strong aria-current="page">` without an anchor; other
destinations retain canonical links. Tour and excursion legends are unchanged.


## Route marker stacking — 19.10.2026

Tours and Excursions now prioritize overlapping circles through the single
provider-neutral `src/lib/geo-map-marker-priority.mjs` helper. The starting
marker (position 1) has zIndex **1000** and is rendered last, ensuring it is
visible above every other route marker. The marker for the **actual final
visit** in the ordered `route[]` (not necessarily the highest unique marker
number when a route returns to an earlier place) has zIndex **900**, above
ordinary stops (100) but below departure. On routes returning directly to
departure the start remains at 1000 and wins; no second marker is created.
Both the Yandex YMapMarker and the Google advanced/legacy marker adapters
reuse the identical ordered list and zIndex values. Destination neighborhood
maps keep the featured current place highest at 1000. Recommendations
get strictly decreasing z-index by numbered relevance position, so №2 is 999,
№3 is 998, down to №11 at 990; lower numbers cover higher numbers.

The marker identity, visit order, GPS coordinates, route SVG geometry,
camera fit, lazy loading and circle colors remain unchanged. Tests include
normal 3-stop routes, arrival at an earlier visited stop, return to departure,
single-point trips and unchanged Destination prominence.


## Destination recommendation marker ranking — 19.10.2026

On a Destination page, the `Куда поехать дальше` section counts each
co-occurring destination once per active Tour whose full `destinations`
contains the current place (including optional stops); it sorts by descending
number of shared Tours and then Russian name, limiting the list to ten.
The map uses the same ordered IDs, omitting only those without published
verified GEO coordinates. Each visible point's position is assigned after
this GEO filter; №1 is always the current destination.

All Destination markers now have a *strict* priority order, not just the
featured marker: `zIndex = 1001 - position`. Thus №7 is 994 and №8 is 993,
so №8 cannot obscure №7, even at identical coordinates. The shared
`orderedGeoMapMarkers` helper also sorts actual insertion order ascending
by z-index, protecting both Yandex Maps 3 and Google Maps (legacy and advanced
marker variants). Tour and Excursion starting/final marker precedence is
unchanged. The ranking or contents of recommendations, GEO screening, marker
colors, route geometries and map lazy loading are not changed.


## Live search map in Places tab — 19.10.2026

The global search overlay shows a compact (150–185px desktop, 150–188px
mobile) map between the `Места` filter and the existing `Найдено` results.
It is absent on all other search tabs. A single static JSON endpoint
`/search-geo-places.json` holds minimal URL/coordinate pairs from the same
published, verified GEO index as the destination pages. Its bytes are
downloaded only after the Places tab is selected; no per-page GEO JSON is
embedded in HTML. Search text remains handled entirely by Pagefind.

After every change of at least one character (including deletions), existing
Pagefind debounce (120ms) returns the ranked filtered results. The very same
results determine the circles, in the same order, with only those lacking
published GEO coordinates omitted. The Yandex/Google map instance and JS API
are loaded only once and kept for later updates. The common provider adapters
update markers and camera on the existing instance using
`YMap.removeChild/addChild/setLocation` or Google Marker removal and
`Map.moveCamera`. No geocoding/routing API, per-letter network calls or map
reinitialization. Zero-result queries clear pins without affecting the text
search. Close or switch tabs to suspend updates; reopening reuses the same map.


Search-map cleanup: after erasing the query below 2 characters, switching
tabs, or closing the overlay, previously displayed markers are removed.
Provider setup that finishes after query deletion also clears stale pins.
When returning to Places, the same map and GEO index are reused.
Search matches have relevance-based z-indexes (№1 above №2, etc.).


## Search Places map: prewarmed side layout (19.10.2026)

An explicit click opening the global search dialog initializes one
map with an empty marker list at a real offscreen 4:3 canvas size;
the map provider script and tiles can start loading before the visitor
chooses the Places tab. Only the Places tab fetches the compact GEO index.
The map API and instance are reused when the text search changes.

On desktop, the results occupy the left half of the container and
the 4:3 map the right half, with the "Найдено" count and first results
visible immediately on the left. On mobile, the same 4:3 map sits above
full-width results. Other tabs retain full-width search listings.

Clicking a pin shows a map-contained card with a 4:3 photo, title,
short Pagefind summary and destination link. The image is lazily fetched
only when selected, and relative /media paths use the configured CDN.
Pagefind remains the source of matching results and metadata; GEO data
still supplies only verified coordinates and is not refetched on every
keystroke.

## Visible maps after refresh and tab restoration — 20.10.2026

A map with any positive pixel overlap with the actual viewport can mount after
first-screen assets are ready **without** a user scroll. The previous scroll
requirement remains only for offscreen maps, which also need to approach within
300px of the viewport. Check strict two-dimensional viewport visibility
separately from the expanded proximity zone. Recheck on first-screen readiness,
scroll, resize, `pageshow` (including BFCache), and when a previously hidden
tab becomes visible. Wait two animation frames on restoration so the browser's
restored scroll position is reflected in element geometry. This supersedes the
historical mandatory-scroll rule above. Photo lazy-loading and search-map
activation on opening the Places tab remain unchanged.
