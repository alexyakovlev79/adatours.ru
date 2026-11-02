# Full-site EN staging baseline — 2026-11-02

The English GitHub Pages staging site mirrors every active canonical Russian
Astro page at the same relative /en/ route. Unlike the old 22-page demonstration,
it uses the real full homepage, full tour listing, countries, destinations,
excursions, VIP, multi-country, MICE, DMC, team, press and all other sections.
The source repository, shared S3 photos, prices, routes and stable IDs remain singular.

Untranslated pages are ordinary Russian content, with html lang=ru and a
noindex meta tag. There is no visible translation notice, banner or warning.
The previous 22-page English pilot and its Word evidence remain preserved in
source for later approval/promotion. They do not displace full Russian layout
until a compatible production-style EN page is ready.

The staging HTML restoration keeps the original Hero, gallery, picture
srcset, CSS backgrounds, video component and first-party Astro JS, and
rebases internal navigation into the EN route tree. Pagefind and public
data/geo and phone-flag assets are staged with the site. Redirect aliases
are intentionally excluded. Search is rebased into /en/ and must pass
generated HTML checks before publication.

Lead form markup is visible but inert and cannot send a live Russian request.
Analytics, canonical, JSON-LD and OG signals are suppressed for the noindex stage.
No English DNS, domain, public indexing, tariff update or mass translation
is enabled by this visual-baseline deployment.

Acceptance: full route-count parity with canonical active RU pages, S3
image URLs, scripts and Pagefind files, exact Home and Tour catalogue,
safe form and full-section links. One successful EN Pages deploy is
required before calling this staging baseline deployed.

Then: connect approved text overlays to the same Astro layouts and route
generation using stable IDs (Word 2027, then 2026, then AI gaps);
validate the end-to-end translator dispatcher and launch its gated swarm.
Three-tour demonstration batches are not the production work unit.
