# Очередь улучшения встроенных фотографий Word/PDF

Сверка 11.10.2026. Машинный список: `data/audits/word-photo-enhancement-queue-20261011.json`. Рабочие статусы синхронизированы с листом «Фото» реестра Ada Tours. Это срез действующих ссылок, не полный список всех когда-либо загруженных медиа.

| Источник | Уникальных фото | Используемых слотов таблицы | Пакетов по 10 |
|---|---:|---:|---:|
| Word | 76 | 164 | 8 (последний — 6) |
| PDF P109 | 46 | 57 | 5 (последний — 6) |
| Всего документов | 122 | 221 | 13 (последний — 2, при общей очереди) |

У всех 122 текущих assets отсутствует точное подтверждение `method: gpt-image` в каноническом реестре. Им назначен `NEEDS_REPLACEMENT`. Это означает отсутствие подтвержденного улучшения, а не доказательство отсутствия любого исторического вызова инструмента. `REPLACED` в старой таблице означал подключение/загрузку и не гарантировал GPT Image.

Сценарий появления: встроенная картинка документа → извлечение → WebP → прямой S3 upload и receipt → Tour/Excursion/Destination. S3 проверяет доставку байтов; четкость этот процесс не повышает. У части PDF P109 в исходном media mapping ошибочно стоит `anna_word_embedded`; в данной описи фактический источник явно PDF, исходные данные не переименованы.

Подтвержденные примеры:

| Сцена | Источник | Размер текущего файла |
|---|---|---|
| Лунная долина, P108, word-03 | Word | 628×488 |
| Солончак Уюни, P108, word-05 | Word | 528×378 |
| Лагуна Верде, P108, word-06 | Word | 738×321 |
| Интерьер собора Лимы, P109, pdf-x120 | PDF, стр. 4 | 479×446 |
| Дом Каса-Алиага, P109, pdf-x115 | PDF, вертикальный кадр | 497×648 |

## Как продолжать

1. Для Word взять первые 10 не завершенных `origin: word_embedded` по `documentQueueOrder`; для всех документов — по `queueOrder`.
2. Сверить действующий asset, владельцев и архив в актуальной main и живой таблице. Датированная опись сама не отменяет последующие улучшения.
3. Один исходник улучшать один раз. Все его появления и связанные экскурсионные карточки получают тот же результат.
4. Точный файл → один вызов GPT Image, без коллажей → WebP → прямой S3 и подтвержденный receipt → текстовый commit и реестр GPT Image. Сюжет и framing сохранять.
5. После успешного подключения обновить все указанные строки таблицы и запись этой очереди. Готовый enhancement переиспользовать без повторной генерации.

## Уникальные фотографии

Очередь сортируется по исходному порядку строк листа «Фото». Столбец «№ группы» используется при отдельной обработке Word/PDF; «Пакет» — общая очередь документов.

| № | Источник | № группы | Пакет | Файл | Строки «Фото» |
|---:|---|---:|---:|---|---|
| 1 | Word | 1 | 1 | [tours/complete-ecuador-new-year/word-07-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-07-20261009-v1.webp) | 1079, 4039, 4072, 4086, 5498, 5522, 5696, 6335, 6339, 6348 |
| 2 | Word | 2 | 1 | [tours/complete-ecuador-new-year/word-13-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-13-20261009-v1.webp) | 4004, 5494, 5502, 5512, 5556, 5665, 5683, 5703, 5879 |
| 3 | Word | 3 | 1 | [tours/complete-ecuador-new-year/word-06-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-06-20261009-v1.webp) | 4060, 5523, 5687, 5697, 5699, 5706, 5722, 5726, 5891 |
| 4 | Word | 4 | 1 | [tours/complete-ecuador-new-year/word-14-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-14-20261009-v1.webp) | 5492 |
| 5 | Word | 5 | 1 | [tours/complete-ecuador-new-year/word-04-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-04-20261009-v1.webp) | 5493, 5528, 5555, 5875, 5912 |
| 6 | Word | 6 | 1 | [tours/complete-ecuador-new-year/word-16-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-16-20261009-v1.webp) | 5495, 5504, 5516 |
| 7 | Word | 7 | 1 | [tours/complete-ecuador-new-year/word-01-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-01-20261009-v1.webp) | 5496, 5517, 5532 |
| 8 | Word | 8 | 1 | [tours/complete-ecuador-new-year/word-08-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-08-20261009-v1.webp) | 5497, 5507, 5520, 5883, 5885, 6336, 6344 |
| 9 | Word | 9 | 1 | [tours/complete-ecuador-new-year/word-09-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-09-20261009-v1.webp) | 5499, 5524 |
| 10 | Word | 10 | 1 | [tours/complete-ecuador-new-year/word-10-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-10-20261009-v1.webp) | 5500 |
| 11 | Word | 11 | 2 | [tours/complete-ecuador-new-year/word-03-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-03-20261009-v1.webp) | 5501 |
| 12 | Word | 12 | 2 | [tours/complete-ecuador-new-year/word-02-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-02-20261009-v1.webp) | 5503 |
| 13 | Word | 13 | 2 | [tours/complete-ecuador-new-year/word-15-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-15-20261009-v1.webp) | 5505 |
| 14 | Word | 14 | 2 | [tours/complete-ecuador-new-year/word-12-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-12-20261009-v1.webp) | 5508, 5563 |
| 15 | Word | 15 | 2 | [tours/complete-ecuador-new-year/word-11-20261009-v1.webp](https://img.adatours.ru/media/tours/complete-ecuador-new-year/word-11-20261009-v1.webp) | 5509, 5564, 6337, 6345 |
| 16 | Word | 16 | 2 | [tours/ecuador-galapagos-humpback-whales/whales-word-20261009-v1.webp](https://img.adatours.ru/media/tours/ecuador-galapagos-humpback-whales/whales-word-20261009-v1.webp) | 5558 |
| 17 | Word | 17 | 2 | [tours/brazil-agribusiness-14-days/p008-agriculture-word-05-20261010-v1.webp](https://img.adatours.ru/media/tours/brazil-agribusiness-14-days/p008-agriculture-word-05-20261010-v1.webp) | 6165, 6185 |
| 18 | Word | 18 | 2 | [tours/brazil-agribusiness-14-days/p008-agriculture-word-06-20261010-v1.webp](https://img.adatours.ru/media/tours/brazil-agribusiness-14-days/p008-agriculture-word-06-20261010-v1.webp) | 6166 |
| 19 | Word | 19 | 2 | [tours/best-of-nicaragua-10-days/masaya-word-06-20261010-p020-v1.webp](https://img.adatours.ru/media/tours/best-of-nicaragua-10-days/masaya-word-06-20261010-p020-v1.webp) | 6240, 6246, 6783 |
| 20 | Word | 20 | 2 | [tours/best-of-nicaragua-10-days/san-juan-del-sur-word-01-20261010-p020-v1.webp](https://img.adatours.ru/media/tours/best-of-nicaragua-10-days/san-juan-del-sur-word-01-20261010-p020-v1.webp) | 6260 |
| 21 | Word | 21 | 3 | [tours/guatemala-belize-maya-world-12-days/tikal-word-08-20261010-p022-v1.webp](https://img.adatours.ru/media/tours/guatemala-belize-maya-world-12-days/tikal-word-08-20261010-p022-v1.webp) | 6280 |
| 22 | Word | 22 | 3 | [tours/guatemala-belize-maya-world-12-days/flores-word-07-20261010-p022-v1.webp](https://img.adatours.ru/media/tours/guatemala-belize-maya-world-12-days/flores-word-07-20261010-p022-v1.webp) | 6293 |
| 23 | Word | 23 | 3 | [tours/guatemala-belize-maya-world-12-days/san-ignacio-word-09-20261010-p022-v1.webp](https://img.adatours.ru/media/tours/guatemala-belize-maya-world-12-days/san-ignacio-word-09-20261010-p022-v1.webp) | 6297 |
| 24 | Word | 24 | 3 | [tours/guatemala-belize-maya-world-12-days/ambergris-word-12-20261010-p022-v1.webp](https://img.adatours.ru/media/tours/guatemala-belize-maya-world-12-days/ambergris-word-12-20261010-p022-v1.webp) | 6302 |
| 25 | Word | 25 | 3 | [tours/brazil-three-ecosystems-8-days/word-1-20261010.webp](https://img.adatours.ru/media/tours/brazil-three-ecosystems-8-days/word-1-20261010.webp) | 6305, 6314 |
| 26 | Word | 26 | 3 | [tours/brazil-three-ecosystems-8-days/word-2-20261010.webp](https://img.adatours.ru/media/tours/brazil-three-ecosystems-8-days/word-2-20261010.webp) | 6306, 6307, 6320 |
| 27 | Word | 27 | 3 | [tours/brazil-three-ecosystems-8-days/word-5-20261010.webp](https://img.adatours.ru/media/tours/brazil-three-ecosystems-8-days/word-5-20261010.webp) | 6311, 6312, 6313, 6317 |
| 28 | Word | 28 | 3 | [tours/brazil-three-ecosystems-8-days/word-3-20261010.webp](https://img.adatours.ru/media/tours/brazil-three-ecosystems-8-days/word-3-20261010.webp) | 6322 |
| 29 | Word | 29 | 3 | [tours/brazil-three-ecosystems-8-days/word-4-20261010.webp](https://img.adatours.ru/media/tours/brazil-three-ecosystems-8-days/word-4-20261010.webp) | 6323 |
| 30 | Word | 30 | 3 | [tours/discover-guatemala-8-days/monterrico-word-image4-20261010-p037-v1.webp](https://img.adatours.ru/media/tours/discover-guatemala-8-days/monterrico-word-image4-20261010-p037-v1.webp) | 6393 |
| 31 | Word | 31 | 4 | [tours/panama-city-gamboa-6-days/word-4-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-4-20261010.webp) | 6426, 6434, 6435, 6793 |
| 32 | Word | 32 | 4 | [tours/panama-city-gamboa-6-days/word-3-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-3-20261010.webp) | 6428, 6841 |
| 33 | Word | 33 | 4 | [tours/panama-city-gamboa-6-days/word-5-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-5-20261010.webp) | 6430, 6442, 6773, 6839 |
| 34 | Word | 34 | 4 | [tours/panama-city-gamboa-6-days/word-10-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-10-20261010.webp) | 6433, 6438 |
| 35 | Word | 35 | 4 | [tours/panama-city-gamboa-6-days/word-6-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-6-20261010.webp) | 6436, 6792 |
| 36 | Word | 36 | 4 | [tours/panama-city-gamboa-6-days/word-2-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-2-20261010.webp) | 6439 |
| 37 | Word | 37 | 4 | [tours/panama-city-gamboa-6-days/word-8-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-8-20261010.webp) | 6444 |
| 38 | Word | 38 | 4 | [tours/panama-city-gamboa-6-days/word-9-20261010.webp](https://img.adatours.ru/media/tours/panama-city-gamboa-6-days/word-9-20261010.webp) | 6446 |
| 39 | Word | 39 | 4 | [tours/colombia-complete-11-days/cartagena-street-word-20261010-v1.webp](https://img.adatours.ru/media/tours/colombia-complete-11-days/cartagena-street-word-20261010-v1.webp) | 6525, 6549 |
| 40 | Word | 40 | 4 | [tours/colombia-complete-11-days/san-andres-beach-word-20261010-v1.webp](https://img.adatours.ru/media/tours/colombia-complete-11-days/san-andres-beach-word-20261010-v1.webp) | 6527 |
| 41 | Word | 41 | 5 | [tours/colombia-complete-11-days/medellin-panorama-word-20261010-v1.webp](https://img.adatours.ru/media/tours/colombia-complete-11-days/medellin-panorama-word-20261010-v1.webp) | 6530 |
| 42 | Word | 42 | 5 | [tours/southern-brazil-vip-7-days/canyon-picnic-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/canyon-picnic-word-20261010.webp) | 6564 |
| 43 | Word | 43 | 5 | [tours/southern-brazil-vip-7-days/helicopter-coast-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/helicopter-coast-word-20261010.webp) | 6566 |
| 44 | Word | 44 | 5 | [tours/southern-brazil-vip-7-days/vineyard-atv-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/vineyard-atv-word-20261010.webp) | 6569 |
| 45 | Word | 45 | 5 | [tours/southern-brazil-vip-7-days/gramado-town-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/gramado-town-word-20261010.webp) | 6570 |
| 46 | Word | 46 | 5 | [tours/southern-brazil-vip-7-days/itaimbezinho-canyon-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/itaimbezinho-canyon-word-20261010.webp) | 6571 |
| 47 | Word | 47 | 5 | [tours/southern-brazil-vip-7-days/balloons-word-20261010.webp](https://img.adatours.ru/media/tours/southern-brazil-vip-7-days/balloons-word-20261010.webp) | 6572 |
| 48 | Word | 48 | 5 | [tours/bolivia-chile-hidden-treasures-16-days/word-01-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-01-20261011-v1.webp) | 6863 |
| 49 | Word | 49 | 5 | [tours/bolivia-chile-hidden-treasures-16-days/word-02-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-02-20261011-v1.webp) | 6864 |
| 50 | Word | 50 | 5 | [tours/bolivia-chile-hidden-treasures-16-days/word-04-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-04-20261011-v1.webp) | 6867 |
| 51 | Word | 51 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-07-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-07-20261011-v1.webp) | 6869 |
| 52 | Word | 52 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-11-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-11-20261011-v1.webp) | 6872 |
| 53 | Word | 53 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-13-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-13-20261011-v1.webp) | 6876 |
| 54 | Word | 54 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-15-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-15-20261011-v1.webp) | 6878, 7002 |
| 55 | Word | 55 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-16-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-16-20261011-v1.webp) | 6879 |
| 56 | Word | 56 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-18-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-18-20261011-v1.webp) | 6882, 6894, 6895, 6896, 6897, 6999, 7011, 7476 |
| 57 | Word | 57 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-22-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-22-20261011-v1.webp) | 6884, 6901, 6993, 7010 |
| 58 | Word | 58 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-26-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-26-20261011-v1.webp) | 6888, 6908, 6909, 6916 |
| 59 | Word | 59 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-06-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-06-20261011-v1.webp) | 6893, 6919 |
| 60 | Word | 60 | 6 | [tours/bolivia-chile-hidden-treasures-16-days/word-14-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-14-20261011-v1.webp) | 6905, 6906 |
| 61 | Word | 61 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-03-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-03-20261011-v1.webp) | 6917 |
| 62 | Word | 62 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-05-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-05-20261011-v1.webp) | 6918 |
| 63 | Word | 63 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-08-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-08-20261011-v1.webp) | 6920 |
| 64 | Word | 64 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-10-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-10-20261011-v1.webp) | 6921 |
| 65 | Word | 65 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-09-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-09-20261011-v1.webp) | 6922 |
| 66 | Word | 66 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-17-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-17-20261011-v1.webp) | 6923 |
| 67 | Word | 67 | 7 | [tours/bolivia-chile-hidden-treasures-16-days/word-23-20261011-v1.webp](https://img.adatours.ru/media/tours/bolivia-chile-hidden-treasures-16-days/word-23-20261011-v1.webp) | 6925 |
| 68 | Word | 68 | 7 | [destinations/cuevas-pintadas-guachipas/hero-word-20261011-p107-v1.webp](https://img.adatours.ru/media/destinations/cuevas-pintadas-guachipas/hero-word-20261011-p107-v1.webp) | 6929, 6933 |
| 69 | Word | 69 | 7 | [destinations/walichu-caves/hero-word-20261011-p107-v1.webp](https://img.adatours.ru/media/destinations/walichu-caves/hero-word-20261011-p107-v1.webp) | 6932 |
| 70 | Word | 70 | 7 | [destinations/salinas-grandes/hero-word-20261011-p107-v1.webp](https://img.adatours.ru/media/destinations/salinas-grandes/hero-word-20261011-p107-v1.webp) | 6935 |
| 71 | Word | 71 | 8 | [tours/marble-caves-san-rafael-3-days/word-lake-20261011-v1.webp](https://img.adatours.ru/media/tours/marble-caves-san-rafael-3-days/word-lake-20261011-v1.webp) | 7012 |
| 72 | Word | 72 | 8 | [tours/antarctica-discovery-learning/antarctic-zodiac-word-20261011-v1.webp](https://img.adatours.ru/media/tours/antarctica-discovery-learning/antarctic-zodiac-word-20261011-v1.webp) | 7256, 7296, 7332 |
| 73 | Word | 73 | 8 | [tours/antarctica-discovery-learning/antarctic-blue-ice-word-20261011-v1.webp](https://img.adatours.ru/media/tours/antarctica-discovery-learning/antarctic-blue-ice-word-20261011-v1.webp) | 7265, 7278, 7305, 7343 |
| 74 | Word | 74 | 8 | [tours/antarctica-discovery-learning/beagle-channel-word-20261011-v1.webp](https://img.adatours.ru/media/tours/antarctica-discovery-learning/beagle-channel-word-20261011-v1.webp) | 7267, 7279, 7307, 7345 |
| 75 | Word | 75 | 8 | [tours/antarctica-discovery-learning/humpback-whale-word-20261011-v1.webp](https://img.adatours.ru/media/tours/antarctica-discovery-learning/humpback-whale-word-20261011-v1.webp) | 7268 |
| 76 | Word | 76 | 8 | [tours/antarctica-discovery-learning/chinstrap-penguins-word-20261011-v1.webp](https://img.adatours.ru/media/tours/antarctica-discovery-learning/chinstrap-penguins-word-20261011-v1.webp) | 7276 |
| 77 | PDF | 1 | 8 | [tours/south-america-luxury-33-days/pdf-x120-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x120-20261011-v1.webp) | 7399, 7422 |
| 78 | PDF | 2 | 8 | [tours/south-america-luxury-33-days/pdf-x110-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x110-20261011-v1.webp) | 7400, 7447 |
| 79 | PDF | 3 | 8 | [tours/south-america-luxury-33-days/pdf-x115-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x115-20261011-v1.webp) | 7401 |
| 80 | PDF | 4 | 8 | [tours/south-america-luxury-33-days/pdf-x208-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x208-20261011-v1.webp) | 7402, 7452 |
| 81 | PDF | 5 | 9 | [tours/south-america-luxury-33-days/pdf-x431-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x431-20261011-v1.webp) | 7403 |
| 82 | PDF | 6 | 9 | [tours/south-america-luxury-33-days/pdf-x405-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x405-20261011-v1.webp) | 7405, 7432 |
| 83 | PDF | 7 | 9 | [tours/south-america-luxury-33-days/pdf-x400-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x400-20261011-v1.webp) | 7406 |
| 84 | PDF | 8 | 9 | [tours/south-america-luxury-33-days/pdf-x535-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x535-20261011-v1.webp) | 7407, 7437 |
| 85 | PDF | 9 | 9 | [tours/south-america-luxury-33-days/pdf-x644-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x644-20261011-v1.webp) | 7411, 7470 |
| 86 | PDF | 10 | 9 | [tours/south-america-luxury-33-days/pdf-x696-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x696-20261011-v1.webp) | 7412, 7413, 7414, 7472 |
| 87 | PDF | 11 | 9 | [tours/south-america-luxury-33-days/pdf-x722-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x722-20261011-v1.webp) | 7415, 7417, 7473 |
| 88 | PDF | 12 | 9 | [tours/south-america-luxury-33-days/pdf-x141-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x141-20261011-v1.webp) | 7423 |
| 89 | PDF | 13 | 9 | [tours/south-america-luxury-33-days/pdf-x176-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x176-20261011-v1.webp) | 7424 |
| 90 | PDF | 14 | 9 | [tours/south-america-luxury-33-days/pdf-x255-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x255-20261011-v1.webp) | 7425 |
| 91 | PDF | 15 | 10 | [tours/south-america-luxury-33-days/pdf-x271-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x271-20261011-v1.webp) | 7426 |
| 92 | PDF | 16 | 10 | [tours/south-america-luxury-33-days/pdf-x302-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x302-20261011-v1.webp) | 7427 |
| 93 | PDF | 17 | 10 | [tours/south-america-luxury-33-days/pdf-x327-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x327-20261011-v1.webp) | 7429 |
| 94 | PDF | 18 | 10 | [tours/south-america-luxury-33-days/pdf-x353-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x353-20261011-v1.webp) | 7430 |
| 95 | PDF | 19 | 10 | [tours/south-america-luxury-33-days/pdf-x384-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x384-20261011-v1.webp) | 7431 |
| 96 | PDF | 20 | 10 | [tours/south-america-luxury-33-days/pdf-x426-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x426-20261011-v1.webp) | 7433 |
| 97 | PDF | 21 | 10 | [tours/south-america-luxury-33-days/pdf-x488-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x488-20261011-v1.webp) | 7435 |
| 98 | PDF | 22 | 10 | [tours/south-america-luxury-33-days/pdf-x478-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x478-20261011-v1.webp) | 7436 |
| 99 | PDF | 23 | 10 | [tours/south-america-luxury-33-days/pdf-x556-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x556-20261011-v1.webp) | 7438 |
| 100 | PDF | 24 | 10 | [tours/south-america-luxury-33-days/pdf-x623-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x623-20261011-v1.webp) | 7440 |
| 101 | PDF | 25 | 11 | [tours/south-america-luxury-33-days/pdf-x670-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x670-20261011-v1.webp) | 7441 |
| 102 | PDF | 26 | 11 | [tours/south-america-luxury-33-days/pdf-x815-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x815-20261011-v1.webp) | 7444 |
| 103 | PDF | 27 | 11 | [tours/south-america-luxury-33-days/pdf-x84-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x84-20261011-v1.webp) | 7446 |
| 104 | PDF | 28 | 11 | [tours/south-america-luxury-33-days/pdf-x198-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x198-20261011-v1.webp) | 7450 |
| 105 | PDF | 29 | 11 | [tours/south-america-luxury-33-days/pdf-x203-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x203-20261011-v1.webp) | 7451 |
| 106 | PDF | 30 | 11 | [tours/south-america-luxury-33-days/pdf-x229-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x229-20261011-v1.webp) | 7453 |
| 107 | PDF | 31 | 11 | [tours/south-america-luxury-33-days/pdf-x250-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x250-20261011-v1.webp) | 7454 |
| 108 | PDF | 32 | 11 | [tours/south-america-luxury-33-days/pdf-x297-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x297-20261011-v1.webp) | 7456 |
| 109 | PDF | 33 | 11 | [tours/south-america-luxury-33-days/pdf-x322-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x322-20261011-v1.webp) | 7457 |
| 110 | PDF | 34 | 11 | [tours/south-america-luxury-33-days/pdf-x348-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x348-20261011-v1.webp) | 7458 |
| 111 | PDF | 35 | 12 | [tours/south-america-luxury-33-days/pdf-x379-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x379-20261011-v1.webp) | 7459 |
| 112 | PDF | 36 | 12 | [tours/south-america-luxury-33-days/pdf-x452-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x452-20261011-v1.webp) | 7462 |
| 113 | PDF | 37 | 12 | [tours/south-america-luxury-33-days/pdf-x483-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x483-20261011-v1.webp) | 7463 |
| 114 | PDF | 38 | 12 | [tours/south-america-luxury-33-days/pdf-x504-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x504-20261011-v1.webp) | 7464 |
| 115 | PDF | 39 | 12 | [tours/south-america-luxury-33-days/pdf-x530-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x530-20261011-v1.webp) | 7465 |
| 116 | PDF | 40 | 12 | [tours/south-america-luxury-33-days/pdf-x551-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x551-20261011-v1.webp) | 7466 |
| 117 | PDF | 41 | 12 | [tours/south-america-luxury-33-days/pdf-x580-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x580-20261011-v1.webp) | 7467 |
| 118 | PDF | 42 | 12 | [tours/south-america-luxury-33-days/pdf-x592-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x592-20261011-v1.webp) | 7468 |
| 119 | PDF | 43 | 12 | [tours/south-america-luxury-33-days/pdf-x628-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x628-20261011-v1.webp) | 7469 |
| 120 | PDF | 44 | 12 | [tours/south-america-luxury-33-days/pdf-x680-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x680-20261011-v1.webp) | 7471 |
| 121 | PDF | 45 | 13 | [tours/south-america-luxury-33-days/pdf-x827-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x827-20261011-v1.webp) | 7477 |
| 122 | PDF | 46 | 13 | [tours/south-america-luxury-33-days/pdf-x832-20261011-v1.webp](https://img.adatours.ru/media/tours/south-america-luxury-33-days/pdf-x832-20261011-v1.webp) | 7478 |
