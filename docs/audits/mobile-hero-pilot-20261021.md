# Mobile hero pilot — 21 October 2026

Authorized pilot: 20 distinct published hero photos, 12 approved crops, 8 REVIEW_NO_CROP. Only exact page path + unchanged hero source opt in. Gallery/card uses do not change. Portrait source applies at <=479 CSS px; wider viewports retain the original. photo-lead heroes are excluded from automatic application.

27 WebP derivatives, quality 78, no enlargement; original maximum available crop sizes are preserved. Sharp runtime 0.35.5. Encoding/crop preparation: 2.415 seconds (excludes visual review, network and upload). Original downloads: 48.662 seconds. Full-size accepted originals: 4,060,352 bytes; largest derivative per accepted photo: 982,614 bytes, reduction 75.8%. This is asset size, not LCP improvement.

Initial 599px boundary was reduced after simulated cover previews clipped mountain peaks/flamingos. Final 479px boundary plus top/bottom object positions addresses those observed cases. Visual simulations are not real-device screenshots. Native resolution limits remain, no artificial upscale.

HeroVideo on opted-in pages uses the existing static HTML picture as its placeholder, avoiding an extra desktop poster request on phones; video files/start timing are unchanged. Shared picture remains present with JS disabled and failed autoplay.

Source of decisions and assets: src/data/media/mobile-hero-pilot-20261021.json. All uploaded derivatives verified by GET/SHA-256 and included in direct-s3-uploads.json. No binary Git files.

Validation: both Astro components compile with @astrojs/compiler; bounds, maximum source dimensions, 20 decisions and 27 variant records checked. Production pipeline remains the final build/deploy gate. Before/after PSI runs: data/performance/runs/P01-hero-mobile-20261021.json. Before medians: Mobile 79, LCP 5.568s, TBT 18ms; Desktop 95, LCP 1.429s, TBT 75ms. After values recorded separately after successful deploy.

Rollback: remove pilot import/source selection in Hero.astro and restore HeroVideo poster behavior; keep originals and S3 assets.

| Page | Decision | Reason |
|---|---|---|
| / | READY | Сахарная голова и изгиб залива |
| /brazil/ | READY | Статуя Христа и горные склоны |
| /argentina/ | READY | Главная вершина Фицрой и передний план |
| /peru/ | REVIEW_NO_CROP | Лица ребёнка и ламы не помещаются вместе в безопасный вертикальный кадр |
| /belize/ | REVIEW_NO_CROP | Для сохранения ребёнка, рук и морской звезды нужен более широкий кадр |
| /bolivia/ | READY | Фламинго, лагуна и горы |
| /chile/ | READY | Горный массив и бирюзовое озеро |
| /colombia/ | READY | Разноцветные фасады улицы |
| /costa-rica/ | REVIEW_NO_CROP | Длинный хвост и раскрытые крылья ара не помещаются в вертикальный кадр |
| /ecuador/ | REVIEW_NO_CROP | В вертикальном кадре теряется значительная часть тела игуаны |
| /mexico/ | READY | Центр розетки агавы |
| /panama/ | REVIEW_NO_CROP | Вертикальная обрезка разрушает композицию вытянутого острова |
| /uruguay/ | REVIEW_NO_CROP | Нельзя сохранить целиком группу пальцев монумента |
| /antarctica/ | READY | Айсберг и отражение |
| /vip/ | READY | Вулкан, фламинго и отражения |
| /mice/ | READY | Сахарная голова и залив |
| /mice/business-delegations/ | READY | Город, берег и закат |
| /dmc/travel-agencies/ | READY | Изгибы лагун и дюны |
| /interests/adventure/ | REVIEW_NO_CROP | Оба лица и указывающая рука не помещаются в безопасный вертикальный кадр |
| /interests/wildlife/ | REVIEW_NO_CROP | В узком hero невозможно сохранить целиком ягуара без изменения композиции |

## Published and measured

Pages deployment 39581191127 succeeded for source commit 222317b852d443f37635404dde3157f6b632d715. Public HTML verification: 20/20 expected results; 11 pages opt in. Brazil's prepared crop is preview-only because its photo-lead hero has a shorter media region. Eight composition failures retain original assets. 12 prepared crops is not 12 enabled pages.

Enabled 11-photo subset: 3,817,134 -> 935,160 bytes (-75.5%). Across all 20 originals including unchanged cases: -45.7%. Crop/encode control for all 12 prepared photos: 4,060,352 original bytes -> 2,709,518 re-encode-only bytes at quality 78 -> 982,614 cropped bytes. Cropping saves an additional 63.7% vs equally encoded full originals.

Three independent official PSI reports per stage, each Mobile and Desktop. Mobile scores before 72/80/79, after 78/80/81. Medians: 79 -> 80; LCP 5.568s -> 5.033s (-9.6%); TBT 18ms -> 76ms; CLS 0 -> 0. Desktop medians: 95 -> 96; LCP 1.429s -> 1.382s; TBT 75ms -> 29ms; SI 0.698s -> 0.772s. Small score shift remains within run variability; no stable score gain established from this pilot alone. Optimizing video loading is a separate future experiment.

Official PSI LCP diagnostic confirms the new h01-portrait-705 image. No device-wide optimization applied to other slots. Main HTML SHA-256 before: 07b50b62ab009ef7e2243ecfb6c9300952bc60ad3cc4c36bde75f8ca8fa1c6e9; after: 0c27c66702a16a559f3ecda77357e972e97b3d4e3fc5553cd535fe40b292df22. Remote PSI CDN-copy SHA cannot be verified, but its diagnostic names the versioned new crop.

Measurements recorded in repository and existing Google Sheets journal; record-only commit skips CI, no duplicate deployment.
