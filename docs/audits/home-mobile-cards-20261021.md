# P02: mobile covers for homepage cards, 21 October 2026

Explicit user request: connect the prepared mobile crop files to the live mobile site, with screenshots of homepage country and adventure cards. The earlier P01 enabled page-top heroes; it did not replace the homepage card/background uses of the same originals. This experiment explicitly opts those homepage uses in.

Scope: five homepage country backgrounds (Brazil, Argentina, Chile, Peru, Colombia) and two homepage interest covers (wildlife, adventure). Reuse the exact unchanged originals and the largest previously uploaded/verified pilot crops. CSS breakpoint: <=479px; wider viewports retain original files. All other card uses omit the new prop and retain their old behavior. Culture/history and beach photos have no prepared crop in this pilot and remain unchanged. The Brazil crop is usable in its homepage card even though its separate photo-lead page hero requires a different geometry profile.

The original homepage hero and video timing are unchanged. Both background URLs are held in CSS custom properties and passed through the existing server-side `deferImages` background transform. Only the active responsive background is selected after the card enters the existing image-loading window. The interest card's opt-in decorative cover uses the same deferred-background mechanism as the country bands; ordinary image-based cards keep their existing markup. The no-JavaScript CSS fallback is retained. No eager `<source>` is added below the fold. No change to global lazy-loading code.

The adventure reference outside the narrow crop remains the existing 92% right focus up to 759px. Its narrow prepared crop uses the already reviewed top-aligned pair. Countries reuse reviewed top/center positions; Peru's accepted shared partial crop is intentional.

Seven original files total 2,398,612 bytes; the selected mobile files total 540,154 bytes (-77.5%). This is transfer weight when those cards are loaded, not proof of a homepage LCP/score gain. All selected files already have matching SHA-256/size records in the production media ledger; no new upload or Git binary.

Validation: all three changed Astro files compile. Check the existing lazy-background transform with both responsive custom properties and a no-JavaScript fallback. The full production pipeline is the final build/deploy gate. Verify the seven markers in public HTML, active CSS source selection, unchanged original sources above the breakpoint, and retained deferral before considering this complete.

Three independent official PSI reports before and after, each Mobile and Desktop, with unique IDs and stable per-stage homepage hashes. Before series: Mobile 77/76/82, median 77; LCP median 5.566s; TBT 71ms; CLS 0. Desktop 96/92/92, median 92; LCP 1.427s; TBT 150ms; CLS 0. Store all measurements, including variance and regressions, in `data/performance/runs/P02-home-mobile-cards-20261021.json` and the existing Google Sheets journal.

Rollback: remove the three homepage `mobileCover` prop passes and helper/import, then remove the optional component support. Preserve original and crop assets. The previous P01 page-top hero behavior remains independent.

Status: published and verified. The quota issue was resolved using the ordinary PR merge route; production Pages deployment succeeded.

Implementation committed as 43587faa4156236afc2e52c23871189ffeded06f and merged through PR #41 as 15c4fcbed1f8a43046f01abf4bcf0bbd73c279cb after generic ref reads were blocked by authenticated GitHub API quota. The standard Pages run is 39590174691. The production build and deployment completed successfully.

PR CI run 39590083244 failed in the all-tests step: an existing syntax error in tests/schema-geo-github-json.test.mjs:37 (extra parenthesis) prevents that unrelated GEO test file from parsing. Reproduced from the unmodified base commit 217ce28cc86d1bd6a7484f80bda18bc4712fdf65 with Node 24.19.0; the current change does not touch that test or module. Record this as an existing all-tests failure, separate from the production build gate and the passing three-component/lazy-background checks.

Composition QA used actual homepage card height clamp(360px, 105vw, 460px) at widths 320, 412 and 479px, with the selected source positions. Visual simulations retained both traveler faces, jaguar head, the intended partial child/llama pair, mountain peaks and the statue. These are crop simulations without the page text overlay, not real-device screenshots.

## Published measurements

Public HTML: seven opted-in covers, all URLs deferred; correct mobile rules shipped. Browser DOM confirmed all seven were deferred before scrolling, loaded their URL properties on scroll, and retained original source selection on desktop. Live CSSOM mobile conditions `(width <= 479px)` match exactly five country bands and two interest cover spans, with all expected crop URLs. This is DOM/CSS verification plus composition simulation, not a real-phone screenshot. Homepage top hero and video unchanged.

Three independent reports per stage/device. Mobile 77/76/82 -> 78/77/82, median 77 -> 78; LCP 5.566 -> 5.451s (-2.1%); TBT 71 -> 30ms; CLS 0; SI 4.489 -> 4.062s. Desktop 96/92/92 -> 95/93/95, median 92 -> 95; LCP 1.427 -> 1.518s (+6.4%); TBT 150 -> 62ms; CLS 0; SI .818 -> .780s. Both score ranges overlap. A meaningful start-up score improvement is not established from this series. The measurable file-weight benefit is for seven cards when loaded. Desktop sources remain original, but opt-in markup/shared CSS changed; do not present desktop measurements as an isolated crop effect.

Source/deploy: 15c4fcbed1f8a43046f01abf4bcf0bbd73c279cb / 39590174691. Before HTML SHA-256: 0c27c66702a16a559f3ecda77357e972e97b3d4e3fc5553cd535fe40b292df22. After: 37c388a28ad6f3f6ab828bb7bcdd23ce9fedd0e06afce77cc4c1ddb09699cdea. Both series stable in public HTML; remote PSI CDN-copy hash cannot be proven. All 12 raw metric rows saved in the performance run JSON and the existing Google Sheets journal.
