# EN source blockers — address-specific review, 10 November 2026

## UPDATE — owner-approved rematch against revised Maya Word (10 Nov 2026)

On owner's explicit instruction to treat a modified English Word as a **new matching version**, the current DOCX `13yI6PCQliXLOv6YvBPAoR-WER8TzFTsg` was read again and matched to the same `tour_source_mir_majya`: Guatemala and Honduras, 10 days/9 nights, same itinerary days and hotels, RU blob unchanged. New DOCX SHA-256: `feee4047b625c770dd098485cb76eacebe3fe5958c8355f97b7f3154d3d22a15`. Old source checksum/receipt preserved.

**Confirmed matching revision:** `i18n/matching-staging` commit `75181607a9881190520293e8201b08e89764f0a5`. The new edition contains no numeric tariff amounts; former USD 5390/6037 price amendments are historical and were not carried forward. RU price has not been touched.

**Translation rebaseline confirmed:** 11 Maya packets `b001–b011` changed from `blocked_external` to **`queued`**, with new per-job sourceFingerprint and `source.selectedWord.sha256`, in 3 commits: `ac60b529ee7aca3c52d060f0ff75000ad9f91f0e`, `43e826785bd809d76ee9bf7782a967111f1b854a`, `db9bbc085de616f2808f1ba03788767cbd4a7ce7`. Prior frozen manifest remains immutable; old/new fingerprints are tracked in `data/i18n/translation-mass/v2/revisions/maya-20261110-feee4047-part{1,2,3}.json`, and original Git history remains.

**Unresolved:** 6 blocked packets across the other five tours below; commercial contradictions still require exact decisions. 0 stale_source. These 11 Maya packets are **not yet translated**: current index.stage is `ai_only`; after its outstanding jobs finish, the dispatcher stage must be explicitly switched back to `word_2027` for the queued Maya packets (without rewriting other workers' active leases). Successful `review`/historical `ready` results continue to be eligible for technical noindex EN Pages.

---


**No publication, translation or price/RU/media edits.** Queue: `i18n/translation-mass-staging`. Initially 16 `blocked_external` and 1 `stale_source`. This audit reclassifies only the latter because its Russian Git blob is again identical to its frozen source. No `review` or `ready` status has been fabricated.

| Tour | Affected packets | Proven blocker | Required resolution |
| --- | --- | --- | --- |
| Мир майя | b001–b011 (11) | Pinned Word `13yI6PCQliXLOv6YvBPAoR-WER8TzFTsg` SHA `792b9b95f860084bfef2e378f880b65a776c40ba8bac054dd685e860aab8ca2b` was modified 30 Oct, after frozen 28 Oct version; Drive revision history exposes only current version. RU main blob `b2d16d5945384cb44c26d49ada360ccb92f91f69` equals the original for **all** 11 packets, including b005. | Restore exact original DOCX or verify revised edition and explicitly create versioned, traceable source amendment. Do not silently rewrite immutable job/receipt. |
| Венесуэла — Новые конкистадоры | b002, b003 (2) | RU `included` contradicts its own `notIncluded`: extra excursions, guide, transatlantic flight, Canaima $40, insurance, tips, alcohol, single accommodation. Word 2026 `1IgOoSRM9m4NSRbNEWVJq97Dku6-GhUKW` lists these as excluded. | Commercial decision on actual coverage; avoid disguising contradiction as a missing Word passage. |
| Эквадор, Галапагосы и киты | b003 (1) | RU Galápagos air tickets **$575** vs 2027 Word `1WCzcZYJuiRJW-VIOVzPV5bsM3UzzVq6h` **$515**; RU transit card included vs Word **$20 excluded**. | Confirm price and card inclusion. |
| Мексика Линдо | b008 (1) | RU 6 days / 5 nights with shared transfers and Mérida arrival before 13:00; Word 2027 `1r_kV3bsX5sSfHUwMz0xU-JEbsqip1rrP` 8 days / 7 nights and private transfers. b008 contains the conflicting RU body. | Confirm correct programme edition and transfer terms. |
| Бразилия, Перу и Аргентина — 15 дней | b009 (1) | Word `1IfK7Yqdp2NvQuUMhAml6qXMElJUT9stK` uses 2026/2024 headings and **six miles** on Yacaratiá; approved current Anna RU says **about 6 km**. 4 alt/hover blocks are preserved in its existing checkpoint. | Source-backed editorial correction with accurate provenance; no false word_exact or wordAbsenceReason. |
| Люксовый тур в Панаму — Бару | b002 (1) | Word `1p53SieUHoWHQc516BD37iA1sZiMMH_V8` text begins “Luxury Panama 2025” despite 2027 filename; both domestic flights are excluded in Word and included in RU. | Confirm actual source edition and flight coverage. |

All six targeted RU Git blobs match the respective frozen translation job sourceBlobSha at main `5d48bcc8ce288d3b3b48ca5cabae705cb7d0ab0b`. Remaining unblocked translation packets are owned by other workers. Existing `review`/`ready` results remain eligible for technical **noindex** English Pages builds; none of these blocked packets is falsely promoted.
