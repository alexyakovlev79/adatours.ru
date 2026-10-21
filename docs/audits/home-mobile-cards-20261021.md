# P02: mobile covers for homepage cards, 21 October 2026

Explicit user request: connect the prepared mobile crop files to the live mobile site, with screenshots of homepage country and adventure cards. The earlier P01 enabled page-top heroes; it did not replace the homepage card/background uses of the same originals. This experiment explicitly opts those homepage uses in.

Scope: five homepage country backgrounds (Brazil, Argentina, Chile, Peru, Colombia) and two homepage interest covers (wildlife, adventure). Reuse the exact unchanged originals and the largest previously uploaded/verified pilot crops. CSS breakpoint: <=479px; wider viewports retain original files. All other card uses omit the new prop and retain their old behavior. Culture/history and beach photos have no prepared crop in this pilot and remain unchanged. The Brazil crop is usable in its homepage card even though its separate photo-lead page hero requires a different geometry profile.

The original homepage hero and video timing are unchanged. Both background URLs are held in CSS custom properties and passed through the existing server-side `deferImages` background transform. Only the active responsive background is selected after the card enters the existing image-loading window. The interest card's opt-in decorative cover uses the same deferred-background mechanism as the country bands; ordinary image-based cards keep their existing markup. The no-JavaScript CSS fallback is retained. No eager `<source>` is added below the fold. No change to global lazy-loading code.

The adventure reference outside the narrow crop remains the existing 92% right focus up to 759px. Its narrow prepared crop uses the already reviewed top-aligned pair. Countries reuse reviewed top/center positions; Peru's accepted shared partial crop is intentional.

Seven original files total 2,398,612 bytes; the selected mobile files total 540,154 bytes (-77.5%). This is transfer weight when those cards are loaded, not proof of a homepage LCP/score gain. All selected files already have matching SHA-256/size records in the production media ledger; no new upload or Git binary.

Validation: all three changed Astro files compile. Check the existing lazy-background transform with both responsive custom properties and a no-JavaScript fallback. The full production pipeline is the final build/deploy gate. Verify the seven markers in public HTML, active CSS source selection, unchanged original sources above the breakpoint, and retained deferral before considering this complete.

Three independent official PSI reports before and after, each Mobile and Desktop, with unique IDs and stable per-stage homepage hashes. Before series: Mobile 77/76/82, median 77; LCP median 5.566s; TBT 71ms; CLS 0. Desktop 96/92/92, median 92; LCP 1.427s; TBT 150ms; CLS 0. Store all measurements, including variance and regressions, in `data/performance/runs/P02-home-mobile-cards-20261021.json` and the existing Google Sheets journal.

Rollback: remove the three homepage `mobileCover` prop passes and helper/import, then remove the optional component support. Preserve original and crop assets. The previous P01 page-top hero behavior remains independent.

Status: prepared, not yet published. GitHub connector reported authenticated API quota exhaustion during preparation; publication must be confirmed by commit and successful Pages deployment before changing this status.
