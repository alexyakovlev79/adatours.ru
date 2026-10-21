# Mobile hero pilot — 21 October 2026

Current revision 2: 20 prepared crops, 19 enabled hero pages, Brazil preview-only. All eight original REVIEW_NO_CROP decisions were superseded by the user-approved head/face-first rule. Historical revision 1 below retains its measurements. Only exact page path + unchanged hero source opt in. Gallery/card uses do not change. Portrait source applies at <=479 CSS px; wider viewports retain the original. photo-lead heroes are excluded from automatic application.

27 WebP derivatives, quality 78, no enlargement; original maximum available crop sizes are preserved. Sharp runtime 0.35.5. Encoding/crop preparation: 2.415 seconds (excludes visual review, network and upload). Original downloads: 48.662 seconds. Full-size accepted originals: 4,060,352 bytes; largest derivative per accepted photo: 982,614 bytes, reduction 75.8%. This is asset size, not LCP improvement.

Initial 599px boundary was reduced after simulated cover previews clipped mountain peaks/flamingos. Final 479px boundary plus top/bottom object positions addresses those observed cases. Visual simulations are not real-device screenshots. Native resolution limits remain, no artificial upscale.

HeroVideo on opted-in pages uses the existing static HTML picture as its placeholder, avoiding an extra desktop poster request on phones; video files/start timing are unchanged. Shared picture remains present with JS disabled and failed autoplay.

Source of decisions and assets: src/data/media/mobile-hero-pilot-20261021.json. All uploaded derivatives verified by GET/SHA-256 and included in direct-s3-uploads.json. No binary Git files.

Validation: both Astro components compile with @astrojs/compiler; bounds, maximum source dimensions, 20 decisions and 27 variant records checked. Production pipeline remains the final build/deploy gate. Before/after PSI runs: data/performance/runs/P01-hero-mobile-20261021.json. Before medians: Mobile 79, LCP 5.568s, TBT 18ms; Desktop 95, LCP 1.429s, TBT 75ms. After values recorded separately after successful deploy.

Rollback: remove pilot import/source selection in Hero.astro and restore HeroVideo poster behavior; keep originals and S3 assets.

| Page | Decision | Reason |
|---|---|---|
| / | READY | Сахарная голова и изгиб залива |
| /brazil/ | READY (preview only) | Статуя Христа и горные склоны |
| /argentina/ | READY | Главная вершина Фицрой и передний план |
| /peru/ | READY | Сохранён центральный совместный кадр: часть лица ребёнка и часть морды ламы; частичная обрезка допустима. |
| /belize/ | READY | Приоритет — голова ребёнка; руки и морская звезда могут быть частично обрезаны. |
| /bolivia/ | READY | Фламинго, лагуна и горы |
| /chile/ | READY | Горный массив и бирюзовое озеро |
| /colombia/ | READY | Разноцветные фасады улицы |
| /costa-rica/ | READY | Фокус вправо на голове ара; хвост и края крыльев можно обрезать. |
| /ecuador/ | READY | Фокус влево на голове игуаны; сохранение всего тела не требуется. |
| /mexico/ | READY | Центр розетки агавы |
| /panama/ | READY | Центральная часть острова: удалены боковые края, скрываемые мобильным hero. |
| /uruguay/ | READY | Центральная часть монумента: сохранение всех пальцев не требуется. |
| /antarctica/ | READY | Айсберг и отражение |
| /vip/ | READY | Вулкан, фламинго и отражения |
| /mice/ | READY | Сахарная голова и залив |
| /mice/business-delegations/ | READY | Город, берег и закат |
| /dmc/travel-agencies/ | READY | Изгибы лагун и дюны |
| /interests/adventure/ | READY | Перенесён удачный фокус 92% вправо из мобильной карточки; в hero сохранены оба лица. |
| /interests/wildlife/ | READY | Фокус влево на голове ягуара; часть тела может выходить за кадр. |

## Revision 1 — published and measured

Pages deployment 39581191127 succeeded for source commit 222317b852d443f37635404dde3157f6b632d715. Public HTML verification: 20/20 expected results; 11 pages opt in. Brazil's prepared crop is preview-only because its photo-lead hero has a shorter media region. Eight composition failures retain original assets. 12 prepared crops is not 12 enabled pages.

Enabled 11-photo subset: 3,817,134 -> 935,160 bytes (-75.5%). Across all 20 originals including unchanged cases: -45.7%. Crop/encode control for all 12 prepared photos: 4,060,352 original bytes -> 2,709,518 re-encode-only bytes at quality 78 -> 982,614 cropped bytes. Cropping saves an additional 63.7% vs equally encoded full originals.

Three independent official PSI reports per stage, each Mobile and Desktop. Mobile scores before 72/80/79, after 78/80/81. Medians: 79 -> 80; LCP 5.568s -> 5.033s (-9.6%); TBT 18ms -> 76ms; CLS 0 -> 0. Desktop medians: 95 -> 96; LCP 1.429s -> 1.382s; TBT 75ms -> 29ms; SI 0.698s -> 0.772s. Small score shift remains within run variability; no stable score gain established from this pilot alone. Optimizing video loading is a separate future experiment.

Official PSI LCP diagnostic confirms the new h01-portrait-705 image. No device-wide optimization applied to other slots. Main HTML SHA-256 before: 07b50b62ab009ef7e2243ecfb6c9300952bc60ad3cc4c36bde75f8ca8fa1c6e9; after: 0c27c66702a16a559f3ecda77357e972e97b3d4e3fc5553cd535fe40b292df22. Remote PSI CDN-copy SHA cannot be verified, but its diagnostic names the versioned new crop.

Measurements recorded in repository and existing Google Sheets journal; record-only commit skips CI, no duplicate deployment.


## Revision 2 — composition correction, 21 October 2026

User correction: prioritize heads/faces for all living creatures. Whole bodies, hands, tails and wings are not mandatory. Partial shared framing (Peru child + llama) is explicitly accepted. Read existing per-slot positions before deriving a crop; if a special subject cannot be confidently selected, crop the central edges already hidden by cover rather than rejecting the image.

Confirmed existing mobile adventure card rule: `InterestCard.astro`, max-width 759px, `theme_adventure`, `object-position:92% center`. This rule remains unchanged. Its successful right alignment is transferred to the separate adventure hero derivative. The original theme hero was centered; the prior report failed to distinguish this use from the card. The new report explicitly names the card as the reference.

Eight new revised crops, 16 immutable WebP assets (`20261021-v2`). Existing 27 v1 assets retained. Eight originals: 2,246,276 -> 568,126 bytes (-74.7%). Enabled 19-photo subset: 6,063,410 -> 1,503,286 bytes (-75.2%). All 20 including unchanged Brazil: 6,306,628 -> 1,746,504 bytes (-72.3%). These are file sizes, not measured speed gains. No homepage image/source, video timing, lazy loading or card CSS changes.

Mobile source boundary remains max-width 479 CSS px, independent of device labels. Wider/tablet/landscape widths keep the original; full originals remain intact. No upscaling. Simulated cover checks at 320x700, 412x556 and 479x400 confirmed bird/iguana/jaguar heads and both traveler faces; the partially cropped Peru pair is intentional. Top alignment protects heads on wider/shorter hero blocks. Text overlays vary per real page and are not included in the crop simulation.

Checks: all 20 source hashes unchanged, 43 derivative hashes and bounds valid, no enlargement. All 16 uploaded v2 assets have verified GET receipts; the production build gate and Pages deployment passed. Revision 1 PSI results above remain historical, not attributed to the additional eight crops.

Revision 2 published: source b347ba79d0dff6c3ca91ddc29d0068b6d91be1f9, successful full Pages run 39586375126. Public HTML verification 20/20, 19 enabled. Three independent before/after reports for /interests/adventure/, Mobile and Desktop, stored in data/performance/runs/P01-hero-mobile-revision2-20261021.json. Mobile scores 65/74/78 -> 66/79/79, median 74 -> 79; LCP 6.828 -> 5.520s (-19.2%); TBT 29 -> 45ms, CLS 0. Desktop scores 95/95/96 -> 95/95/99, median 95 -> 95; LCP 1.444 -> 1.364s; TBT 26 -> 27ms. Desktop original unchanged, so do not attribute desktop variation to crops. Score ranges overlap and these are lab results for one page, not an all-site guarantee. LCP diagnostic confirms h19-portrait-636. HTML stable throughout each measurement series.
