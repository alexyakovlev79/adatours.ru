# Ada Tours EN: numbered full-text translation inventory

Source main SHA: 16dc9cdb6f029c0d16445966521338cacf353771. Queue branch: i18n/translation-mass-staging.

First, number each text in exact sorted repository-path order within its category. Then form packet N from texts 5N-4 through min(5N,7056).

| Category order | Kind | Text numbers | Count |
|---:|---|---|---:|
| 1 | excursion | 1–407 | 407 |
| 2 | destination | 408–1426 | 1019 |
| 3 | seo_geo_article | 1427–7016 | 5590 |
| 4 | country | 7017–7037 | 21 |
| 5 | theme | 7038–7052 | 15 |
| 6 | case | 7053–7055 | 3 |
| 7 | person | 7056–7056 | 1 |

Total: 7056 individual texts and 1412 five-text packets; final packet contains one text.
Machine-readable full listing: data/i18n/fulltext-swarm/v1/listings/0000.tsv ... listings/0007.tsv.
Immutable packet definitions: data/i18n/fulltext-swarm/v1/definitions/0000.json ... definitions/0070.json (20 packets per file).
Already translated and source-SHA-checked: 18 pilots (11 excursions, 4 destinations, 3 countries).
Archived exclusions: 1 excursion and 5 SEO/GEO articles. Existing tour v2 translation queue is not duplicated.
One CAS lease for one numbered packet for 90 minutes; only after reservation reveal five precise source paths.
One result commit for all five texts; at most ten consecutive packets per chat. No independent semantic QA.
No writes to main, RU, prices, media, published pages, or existing tour v2 queue.

Astro templates and hard-coded service-page UI texts require separate safe string extraction; executable source code must not be presented as translatable Markdown.
