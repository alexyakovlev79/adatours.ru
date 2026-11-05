# Ada Tours EN — независимая проверка пакетных переводов, 04.11.2026

Рабочая очередь: `i18n/translation-mass-staging`, `data/i18n/translation-mass/v2`.
Проверки выполняет независимый reviewer `amanda-en-independent-qa-20261104` по `docs/plans/english-site/03-translation-editorial.md`, `33-mass-translation-queue.md`, `34-mass-translation-worker.md` и `scripts/i18n/translation-mass-qa.mjs` из `main`. Нет права менять цены, RU, медиа или публиковать EN. `ready` не означает опубликовано.

## Подтверждённые `ready` (этот QA-проход)

| Job ID | Проверено | Git commit |
| --- | --- | --- |
| `en:bulk:tour:tour_guatemala_belize_maya_world_12_days:b002` | 8 route labels: подтверждённый Word 2027, география и последовательность | [11a5077](https://github.com/alexyakovlev79/adatours.ru/commit/11a50772bb4a4984163df0a40c04893f278a47a6) |
| `en:bulk:tour:tour_chile_easter_island_3_days_2027:b003` | 8 included / notIncluded: точные услуги, исключения и USD 1,500 в Word 2027 | [04a00a3](https://github.com/alexyakovlev79/adatours.ru/commit/04a00a3390c427c0957a886a107c7385c617f979) |
| `en:bulk:tour:tour_panama_city_gamboa_6_days:b002` | 6 route labels + 2 included: топонимы и источники включений в Word 2027 | [cd0c96c](https://github.com/alexyakovlev79/adatours.ru/commit/cd0c96ce970ef37d5bd45de102b2ce68d3d14146) |
| `en:bulk:tour:tour_argentina_experience_6_days:b004` | 8 included / notIncluded: сверено с точным английским Word | [6a3bfe0](https://github.com/alexyakovlev79/adatours.ru/commit/6a3bfe0b5f73dee468b68b1d2822a9e14d0350b4) |

Для этих пакетов отдельно сверены присвоение блока, сохранённый EN, текущий SHA исходного RU-файла, смысл, факты, голос и структура. Статусы переведены `review → ready` только через штатный CAS QA API и immutable result blob.

## Обнаружено при выборочной проверке — `review` сохранён

1. `en:bulk:tour:tour_chile_marble_caves_san_rafael_three_days:b001`:
   блок цены `/priceNote` содержит `USD 2,000 per person, based on 2 travellers`, обозначен `word_aligned`, но выбранный `MarbleCaves_2027_3D2N.docx` подтверждает только ценовую основу `Price per person, based on 2 travellers.`; сумма 2 000 в тексте Word не найдена. Она есть в RU-блоке. Перед `ready` требуется исправить доказательство происхождения суммы: не выдавать RU-derived компонент за Word-утверждённый, при этом не менять общую цену.
   Job result: `data/i18n/translation-mass/v2/results/en_bulk_tour_tour_chile_marble_caves_san_rafael_three_days_b001/ada_en_abf469133bbf_tour_chile_marble_caves_san_rafael_three_days_b001.json`.
2. `en:bulk:tour:tour_argentina_best_14_days:b010`:
   результат самостоятельно содержит `unresolvedConflicts.type=word_ru_programme_difference`: фрагменты Word 2027 `Days 6–7` сопоставлены с позициями RU itinerary 12–13. Нужна адресная проверка, что полная последовательность дней, отели и коммерческий контекст остаются правильными при применении этих EN-текстов; несовпадение с устаревшей RU версией само по себе не означает ошибку. Пока шесть QA-флагов подтверждать нельзя.
   Job result: `data/i18n/translation-mass/v2/results/en_bulk_tour_tour_argentina_best_14_days_b010/en_bulk_tour_tour_argentina_best_14_days_b010_submit-v1.json`.

## Границы и продолжение

Это предметная проверка выбранных сохранённых пакетов, **не** полный QA всех `review` и не итоговое одобрение 353 туров. Остальные `review` пакеты проверять по одному: выбранный точный Word, frozen Job, immutable submitted result, актуальный RU source blob, 6 QA критериев `word,meaning,facts,voice,structure,relations`; `ready` ставить только при полном подтверждении. При расхождении сохранять `review` и заносить адресный дефект в этот журнал без изменения immutable результата. Не считать успешный технический валидатор семантической проверкой. Короткие route labels и included списки не доказывают готовность всей программы соответствующего Tour. Прежде чем исправлять выявленный пакет, использовать текущий SHA staging и не перезаписывать другие изменения.

## Дополнительный независимый проход — 04.11.2026 (5 пакетов)

Проверены пять ранее не отмеченных в журнале пакетов со статусом `review`. Для каждого прочитаны immutable result и frozen job с исходными RU-блоками (не более восьми), сверены SHA текущего RU-файла в `main` и result blob, открыт именно закреплённый Word по `fileId` и проверена версия `modifiedTime`. Все шесть критериев (Word provenance/paragraph evidence, смысл, факты и цены, голос, структура, связи/маршрут) проверялись раздельно; правило языка обслуживания применено к RU-derived частям без редактирования дословного Word 2027. Ни один immutable result не изменён.

### Новые `ready` — подтверждено 3

| Job ID | Блоки | Основание семантической приёмки | CAS-коммит |
| --- | ---: | --- | --- |
| `en:bulk:tour:tour_argentina_grand_tour_15_days_2027:b001` | 8 | Word 2027 `1QkTe_ZNywIecx29otLIyGHjhNP_KgAhn`: дословные утверждённые title и USD 12,500 net / 2 travellers, адресные Word-основания для lead, private и маршрута Buenos Aires → Iguazú → Salta → Guachipas; условия и порядок сохранены. | [e46f54d](https://github.com/alexyakovlev79/adatours.ru/commit/e46f54d7f73e92b7ac155e626e9bfd03c5e4dbc1) |
| `en:bulk:tour:tour_guatemala_belize_maya_world_12_days:b015` | 5 | Word 2027 `1SFMrsSLCcDQDvsSHBzcvrKK1-cw12VzD`: 4 RU-derived подписи изображений и единый body; 12 дней, отели, тарифы DBL/SGL/TPL, 2–16 участников, исключённые даты, отдельные перелёты и оговорка о сухопутном переходе против списка доплат сохранены без необоснованных обещаний. | [ae9a685](https://github.com/alexyakovlev79/adatours.ru/commit/ae9a685bf57f2addff7bfaa17da416ffbbb9b0a1) |
| `en:bulk:tour:tour_brazil_foz_iguazu_three_days:b006` | 6 | Word 2027 `1f-s5PVE55Y7O2HVcliOid_NuetKLc8Bi`: Day 3 Word-aligned с удалённым маркером дня, остальные подписи и body переведены из актуального RU; проверены две стороны водопадов, включённый Bird Park, отдельный Macuco, Vivaz Cataratas 2 ночи, USD 1500/862/764 с базой SGL/DBL/TRP по RU. Числовые тарифы не приписывались Word: в доступном текстовом извлечении Word 2027 цифровых сумм нет. | [3ed20af](https://github.com/alexyakovlev79/adatours.ru/commit/3ed20af73df2f919d3693584ddeee4e61beacc8c) |

### Адресные дефекты — `review` оставлен, 2

1. `en:bulk:tour:tour_brazil_argentina_chile_new_year_11_days_2027:b012` — блок `tour:body:47f6c11f40afc686`, путь `/__body`: публичный EN содержит внутренний редакционный комментарий `The Word document lists both 2 nights and 7–8 January for Santiago`. Это пересказ источника от лица постороннего редактора, а не голос Ada Tours; он также выставляет внутренний Word как основание коммерческого расхождения. Word 2027 `1VCW8zrPr4Inu3DKOa4FKpk3HcXQVLh6j` действительно содержит противоречие: 5★ Santiago 2 nights, 07.01–08.01, тогда как программа завершается 09.01.2027. Нужна адресная формулировка условия/неподтверждённости дат для клиента и предметное подтверждение размещения; нельзя молча менять тариф, дату или защищённый Word. Остальные 4 блока (маршрут Santiago и 3 подписи) сверены с RU/Word; одобрить пакет целиком пока нельзя.
2. `en:bulk:tour:tour_brazil_three_ecosystems_8_days:b012` — блок `tour:body:47f6c11f40afc686`, путь `/__body`: актуальный RU и EN утверждают `Throughout 2027` и цену `USD 5,514` для 2–3 человек, а выбранный Word по неизменяемому `fileId=1kNh04OFL-WUFvScuhfvqmz9QVHCFY2hA` (`yearFolder=2027`) фактически назван `3 Ecosystems Student group 2026 ...` и внутри имеет `All Year 2026` при той же сумме USD 5,514. Оба SHA RU/result совпадают с receipt, русский текст переведён верно, но применение Word из сезона 2026 к доказательству цены/доступности в 2027 требует адресного коммерческого решения; не менять matching и не переносить старый год автоматически. Блоки `/hero/alt` и `/hero/hover` — корректные RU-derived описания, но весь пакет остаётся `review`.

Счётчики после прохода проверяются по текущему `data/i18n/translation-mass/v2/index.json`; `ready` не равно публикации. Полный каталог не проверен.

## Решения после запрета возврата переводчикам — 04.11.2026

Независимый QA завершил две ранее спорные работы без возврата переводчикам. Оба пакета решены по совокупности свидетельств и допущены до стадии `ready` (публикация EN на сайте остаётся отключена).

- `en:bulk:tour:tour_brazil_argentina_chile_new_year_11_days_2027:b012` — **ready после исправленной immutable EN-ревизии** `amanda-qa-20261104-newyear-b012-v1`; блок `tour:body:47f6c11f40afc686`. В утверждённом Word (fileId `1VCW8zrPr4Inu3DKOa4FKpk3HcXQVLh6j`, SHA-256 `44355f86a17eccb5be2b7118971653ba5bc939786f519e79354672270521f509`) в таблице 5★ стоит 2 ночи 07.01–08.01, но программа завершается 09.01, а таблица 4★ и две ночи в Сантьяго задают интервал 07–09.01. **Наиболее вероятно, 07.01–08.01 — ошибочный конец периода** (экспертная оценка 96%). Из EN удалены мета-комментарий о Word и сноска; в 5★ указан 7–9 January, 2 nights. Отели, тарифы, тип номера, другие даты, услуги и медиа сохранены. Старый blob `e3d346c964c48152dd551054ab1ae424d8d69e84` остался в `qaRevisions`; новый `aa53090b2a22cd9b6f002bf3642d76d5eb80a8f6`, результат `data/i18n/translation-mass/v2/results/en_bulk_tour_tour_brazil_argentina_chile_new_year_11_days_2027_b012/qa-amanda-qa-20261104-newyear-b012-v1-aa53090b2a22cd9b.json`. Это редакционное разрешение неоднозначности, не утверждение, что Word дословно содержал 7–9.
- `en:bulk:tour:tour_brazil_three_ecosystems_8_days:b012` — **ready без изменения EN**; блок `tour:body:47f6c11f40afc686`. Текущий RU по исходному Git blob `d3b23e4fea6f1862a0162aac77a988d3fd55cc4b` явно задаёт «весь 2027 год» и 5 514 USD, а Word в папке 2027 (fileId `1kNh04OFL-WUFvScuhfvqmz9QVHCFY2hA`, SHA-256 `c35bca73e2de2ebb08f2f58da2537e279732b15834442420a4ff17620ce2ea08`) внутри помечен 2026, но подтверждает те же 5 514 USD, маршрут, 7 ночей и включённые услуги. Выбрана действующая RU-редакция 2027 как источник EN-периода (экспертная оценка 85%), без изменения валюты, суммы или внешних условий; доступность конкретных дат по тексту подтверждается при бронировании. Provenance `ai_translation` верно отражает отсутствие дословного Word 2027 для блока, поэтому исправление исходного перевода не нужно.

Проверены шесть критериев каждого пакета: Word/provenance, смысл, факты, голос Ada Tours, структура и география. **Вероятностный вывод в журнале не заменяет исходный Word.** Пакеты не возвращались переводчикам, отдельные результаты из прошлых сдач не перезаписывались.


## Дополнительный независимый QA — 04.11.2026, 23:14:54 (МСК)

Обновление прежних незавершённых замечаний по Marble Caves и Argentina Best: оба закрыты независимым QA. Каждый из пяти перечисленных пакетов прошел шесть отдельных checks: word, meaning, facts, voice, structure, relations; текущий RU blob совпадал с pinned sourceBlobSha, immutable EN result совпал с receipt. Word открыт по exact fileId и сверена версия. CAS переводил review в ready, без изменения RU, глобальных цен, Word, публикации; publicationEnabled=false.

### `en:bulk:tour:tour_argentina_grand_tour_15_days_2027:b002` — ready

Восемь подписей Cafayate–El Calafate соответствуют Word 2027 и RU. Топонимы, порядок и написания сохранены.

CAS: https://github.com/alexyakovlev79/adatours.ru/commit/1d8c9c2aa38908eb5715f8a600b30f595e003c54; accepted immutable blob `340a844ed6c78fa50f0b995c674b016591a98c46`.
RU blob `ee9a870e191d4b6a27baa21bdbda96657fdb8be9`; Word fileId `1QkTe_ZNywIecx29otLIyGHjhNP_KgAhn`; pinned Word SHA-256 `658d28ef6440ba90d2b71eaa4473f9c03585ab1da92957aee5deaf15c7f25952`; frozen modifiedTime `2026-09-30T13:49:31.141Z`.
Проверены blockId (8): `tour:itinerary_label:a8a39aba8e52fd93`, `tour:itinerary_label:eb9b35d8b806d899`, `tour:itinerary_label:af78a1ba9e8b85ee`, `tour:itinerary_label:09d86887ef4455fd`, `tour:itinerary_label:d528ae90267ce1e5`, `tour:itinerary_label:7b6749d81052c0a9`, `tour:itinerary_label:e4ebd93db8bd5d35`, `tour:itinerary_label:9b3f87db07393c2f`.

### `en:bulk:tour:tour_bolivia_chile_hidden_treasures_16_days:b002` — ready

Восемь топонимов от Puerto Natales до Santiago совпадают с 16D/15N Word и RU. VIK — сокращенная маршрутная подпись Viña Vik. Уверенность 97%.

CAS: https://github.com/alexyakovlev79/adatours.ru/commit/e93bfe2201fdaa8c0fec6008d410ada5fa4f79ad; accepted immutable blob `f307884ff2367d0a6797026b7f5945c21c208bd0`.
RU blob `882ec10fb84fc4858c88051e57e238bf747bd9d4`; Word fileId `1iDDWJn3nE4yuEwxneW1nVevFt5fD4-Vw`; pinned Word SHA-256 `b3681c6cfba3e05282c7d13869add977e657b7c580b6adacb7f2e831f9a1e009`; frozen modifiedTime `2026-10-22T14:05:36.417Z`.
Проверены blockId (8): `tour:itinerary_label:12fde0b243846520`, `tour:itinerary_label:08abf0b76ce9052d`, `tour:itinerary_label:858fa40dbf9ebf08`, `tour:itinerary_label:268943f960b42834`, `tour:itinerary_label:81ddce99016ad72a`, `tour:itinerary_label:51342c1a534a5483`, `tour:itinerary_label:e6ae8d10486bbfc2`, `tour:itinerary_label:05d7c958b87212c3:2`.

### `en:bulk:tour:tour_chile_marble_caves_san_rafael_three_days:b001` — ready

Ревизия amanda-qa-20261104-marble-b001-v1. Изменен только provenance priceNote с word_aligned на ai_translation: Word подтверждает базу цены на человека при двух путешественниках, но не содержит суммы USD 2,000; цифра подтверждена действующим RU priceFrom/priceNote. Публичный EN и прочие блоки не менялись. Старый immutable blob 6a66a52300925ebc3d5c14ed405017c5cc07b19f сохранен в qaRevisions. Уверенность 98%.

CAS: https://github.com/alexyakovlev79/adatours.ru/commit/2865f2dfb41d8ba11bbdbf1d75fc38159cf2ead6; accepted immutable blob `b6f925802aa81a564504e007d12fe6d980f73ee5`.
RU blob `7d1a7685949839b0906b7dd1cb8b8f8402c354fc`; Word fileId `1EsjAPL89p5K0ulIjNEmwtzhfOu1wwmSx`; pinned Word SHA-256 `dc32658a1aadb3bcf945b6471efc98ba5ba85fda5c20da99ae40d056457594d0`; frozen modifiedTime `2026-10-22T14:06:52.263Z`.
Проверены blockId (8): `tour:title:aaf2320646108059`, `tour:lead:e3456bc1f4d270f4`, `tour:priceNote:9b6b7f5cf7b1e557`, `tour:formatLabel:e904c9ccfa425ff0`, `tour:itinerary_label:28d2d149682ad276`, `tour:itinerary_label:fff6bf46f19a933c`, `tour:itinerary_label:858fa40dbf9ebf08`, `tour:itinerary_label:82ee50e526966bdf`.

### `en:bulk:tour:tour_brazil_rio_four_days:b004` — ready

Шесть топонимов Rio, Urca Hill, Sugar Loaf, Tijuca Forest, Corcovado и две RU-derived media.alt сверены с точным Word и RU. Новых фактов нет.

CAS: https://github.com/alexyakovlev79/adatours.ru/commit/80eafc92dee81cd29a5833e3e7990ee5d4f675be; accepted immutable blob `dbc593d5f6fc8dc50b9c062afaaa1efba8f78fda`.
RU blob `b2596730f9b029dc398d9704ea483f1511c80eb8`; Word fileId `1hHW-AYy4WdTIjIgU3WOQCdzy9KHpcFKU`; pinned Word SHA-256 `1e4cc3f3dd2684b4c9684fb3561525413a2484cb2df0bf809e62515222b5949e`; frozen modifiedTime `2026-10-21T20:19:00.892Z`.
Проверены blockId (8): `tour:media_alt:07172fd6ca3b791b`, `tour:itinerary_label:6eee82a2b72a1a8c`, `tour:itinerary_label:fad087100c51e11d`, `tour:itinerary_label:c2bdac36630388b5`, `tour:itinerary_label:b2f0e19acda78198`, `tour:itinerary_label:3513f80c57dd3c9d`, `tour:itinerary_label:6222538407b181fe`, `tour:media_alt:fc0908d150be64e9`.

### `en:bulk:tour:tour_argentina_best_14_days:b010` — ready

Прежний конфликт Days 6–7 устранен семантически: индексы массива itinerary/12–13 на самом деле соответствуют русским day:6 и day:7, которые совпадают с Word 2027 (Ushuaia). Не путать порядковый индекс структуры и день маршрута. Бинарный DOCX независимо проверен SHA-256 0612abba285db9917be89860efc045fe68dda196030c4a038b47b2a55e27d3a2, несмотря на смену modifiedTime 20.10→30.10. Перелеты не объявлены включенными, Martillo optional, Word программа приоритетна. Уверенность 99%.

CAS: https://github.com/alexyakovlev79/adatours.ru/commit/f77b300cd182d68d791b805ba272e565b974cc40; accepted immutable blob `cf4a23eccd8953828e90607c647217522e2bcb39`.
RU blob `30ba0233d75ec9be38d1f1a1dc3b61f849d60487`; Word fileId `1KbvQKYTq3UYSQuBCRbvjvxv0-kAx0igy`; pinned Word SHA-256 `0612abba285db9917be89860efc045fe68dda196030c4a038b47b2a55e27d3a2`; frozen modifiedTime `2026-10-20T19:43:30.596Z`.
Проверены blockId (8): `tour:itinerary_title:e1dddf681303f0bd`, `tour:itinerary_text:b9ad3e14216c2f08`, `tour:itinerary_label:4bd82be0e9f89208`, `tour:itinerary_label:5dfd2dfb75550881`, `tour:media_alt:a1e78bc13379af51`, `tour:media_hover:16dda3c08175eb0b`, `tour:itinerary_title:ed497b2a669f6ce4`, `tour:itinerary_text:2e780f63f4172747`.


### `en:bulk:tour:tour_chile_argentina_private_grand_tour_17_days:b008` — ready (продолжение того же прохода)

Восемь frozen блоков: семь географических подписей Rano Raraku volcano → Ahu Tongariki → Poike peninsula → Ahu Te Pito Kura → Anakena Beach → Ahu Nau Nau → Hanga Roa дословно подтверждены точным Word 2027. Восьмой — RU-derived alt-подпись пляжа Анакена: без добавленных деталей. Сохранены структура, маршрут Easter Island, 17 дней / 16 ночей; новых цен/обязательств нет. Все шесть checks выполнены.
CAS: https://github.com/alexyakovlev79/adatours.ru/commit/2e2566af595bb0b846bf0cfad044507287e405c6. Immutable result blob `7b0bb921fdb62971c62a249caeabefd803aeb45a`.
RU blob `c7f72884bcd690f8891a46f87260fd934f0fc1ca`; Word fileId `1mOARKNZLOOQPZyTGrV3uBkY-3ghv2rI9`; Word SHA-256 pinned `8d5e55918593b84b955f2ecabf1d9458182d13a7982344017b95ff6a4513e08b`; modifiedTime `2026-09-30T20:16:32.777Z`.
Проверены blockId: `tour:itinerary_label:c96b72d103cdc28c`, `tour:itinerary_label:4a0f5e36e3378ce9`, `tour:itinerary_label:446e9df03f1c2e9c`, `tour:itinerary_label:e78c032dbb6001ab`, `tour:itinerary_label:35eb3eb99adb4095`, `tour:itinerary_label:d001266e30ed580a`, `tour:itinerary_label:d9729e7cbc24071f`, `tour:media_alt:d7e7bf0a3c730c72`.


## Независимый QA — дополнительный проход 04.11.2026, 23:58:21 (МСК)

Проверила 4 ранее сданных `review` из **точного** `state/00.json`/`jobs/00.json`; исключены все `ready`. Для каждого открыты immutable result (SHA совпал с receipt), frozen RU (все блоки), текущий RU из `main` (blob SHA совпал с pinned), англоязычный Word по `selectedWord.fileId` и Google Drive `modifiedTime` (совпал с frozen). Шесть предметных проверок (`word`, `meaning`, `facts`, `voice`, `structure`, `relations`) выполнены до вызова штатного CAS `approve`. Указанные ниже SHA-256 Word — **закрепленные job fingerprints**, а не утверждение о новом независимом хешировании бинарного DOCX; проверен тот же exact fileId и тот же Drive modifiedTime, просмотрен текст Word. `publicationEnabled=false`; RU, Word, цены и медиа не изменялись. Непроверенных из-за технического сбоя в этом проходе: 0.

### `en:bulk:tour:tour_source_chili_argentina:b013` — ready (CAS approve)

Три RU-derived подписи изображений корректно переведены по RU; SEO/body сохраняет географический порядок Santiago → Puerto Natales/Torres del Paine → El Calafate/Perito Moreno → Bariloche → Iguaçu (включая Macuco и полёт над водопадами) → Buenos Aires. Exact Word 2027 14D/13N подтверждает состав программы, верные включения/исключения перелётов; дополнительный редакционный абзац отсутствует в Word и честно обозначен `ai_translation`. Ни экскурсия с гидом на русском, ни новые коммерческие обязательства в этих четырёх блоках не добавлены. Уверенность 98%.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/da239407e0dad8aaec9597e50a53b3583534c968; accepted immutable blob `a4fc28413e6e6a5206495de57b784f69fc91109b`.
- RU source: `src/content/tours/chili-argentina.md`; Git blob `7e318fe74df1edd91ff5ab8366977ef2eef39183`; sourceFingerprint `c71897dd58ffb42a635604c04773864a41f333d8285a76c824777ab35138f3df`.
- Exact Word: fileId `1aWUbUU6YPlsMBoyRKpXYQxnELzXegGOR`; pinned SHA-256 `cd5c9d0e54f0166e1c3ed8f6c03be635dc44daca3563550e3450f0cca8520dae`; frozen/observed modifiedTime `2026-10-20T19:54:21.814Z`.
- Frozen blocks (4): `tour:media_hover:5a56a17e253e54c2`, `tour:media_alt:68ebdd10346d3d20`, `tour:media_hover:77871c8f58bdcbc6`, `tour:body:47f6c11f40afc686`.

### `en:bulk:tour:tour_bolivia_chile_hidden_treasures_16_days:b025` — ready (CAS approve)

Точные Word-привязки Cachapoal Valley, Millahue Valley, Vik Winery, Santiago de Chile и Valparaíso/Viña del Mar сверены с днём 13–14; кабины канатной дороги даны только RU-derived image captions. Расхождение заголовка файла `15d14n` с программой и RU разрешено по содержимому Word (внутри 16D/15N, Days 1–16), RU и маршруту: принимаем 16D/15N без добавления даты года и цены; уверенность 98%. Фактов о бронировании/полётах новые подписи не добавляют.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/af4fa5aba4865d0b60b450db0b5a503a320bee2b; accepted immutable blob `db56bc697e632524538176debefd6e53dee1cb4c`.
- RU source: `src/content/tours/bolivia-chile-hidden-treasures-16-days.md`; Git blob `882ec10fb84fc4858c88051e57e238bf747bd9d4`; sourceFingerprint `59a3f412abbc94d04c437a66629883d02e71e6c067b60da66c46effd83899ed0`.
- Exact Word: fileId `1iDDWJn3nE4yuEwxneW1nVevFt5fD4-Vw`; pinned SHA-256 `b3681c6cfba3e05282c7d13869add977e657b7c580b6adacb7f2e831f9a1e009`; frozen/observed modifiedTime `2026-10-22T14:05:36.417Z`.
- Frozen blocks (8): `tour:itinerary_label:4986fdcfdc640867`, `tour:media_alt:10a3d9e6a51f0d50`, `tour:media_hover:0be2c28ad1d12e86`, `tour:itinerary_label:d62b56b4c22fba29`, `tour:itinerary_label:24d4a10a40ffaf16`, `tour:itinerary_label:088a55611083d65b`, `tour:itinerary_label:2c4cab80ad373eef`, `tour:itinerary_title:d514d6f2e1b0214a`.

### `en:bulk:tour:tour_colombia_essential_5_days:b006` — ready (CAS approve)

Word 2027 5D/4N подтверждает Bogotá → Cartagena → Rosario Islands, содержание тура, транспорт shared speedboat и английских гидов; `Cartagena` действительно присутствует в Word и сохранена дословно. Word называет остров `Isla Majagua`, а текущий RU имеет независимые подписи `Исла-Гранде` и `Сан-Педро-де-Махагуа`; не смешивала их и не маркировала как Word exact: сохранены точные названия RU-derived как подписи мест. Вероятность корректности выбранной трактовки местных подписей 95%, при этом она не подтверждает конкретное место высадки или включение дополнительной лодки. Пять описаний изображений сверены с замороженными RU; цены не содержатся в этом пакете.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/8928481ceff96bd8b76459dd5a8f1903fb1be6e4; accepted immutable blob `f8136cded8513c00684b418c94706968be8595a5`.
- RU source: `src/content/tours/colombia-essential-5-days.md`; Git blob `86bff21d6a1838df290dfff81f517ea88dad78f4`; sourceFingerprint `fef6c5128751d8c1b72f4ba3ef356bb6c0dd721198bca7bbe5474ad9a0cc8cd2`.
- Exact Word: fileId `1ZeKsI_PyOEZ2mngc35U2xnLmc2OlwuVa`; pinned SHA-256 `40634c5ebc1297acf5bd25a6fdcbeab712dc367835916a34e35e5f5fd5c42335`; frozen/observed modifiedTime `2026-10-26T18:00:11.436Z`.
- Frozen blocks (8): `tour:itinerary_label:1f7e609143e8315d`, `tour:itinerary_label:15957acb079c4f52`, `tour:media_alt:3dfab1ec2fa7482a`, `tour:media_hover:92f2bc6f2faab61d`, `tour:itinerary_label:83478908471f1b24`, `tour:media_alt:189d61d44cbd26aa`, `tour:media_hover:608e4884135b1f61`, `tour:media_alt:68ebdd10346d3d20`.

### `en:bulk:tour:tour_source_5_chudes_kosta_riki:b008` — ready (CAS approve)

Word 2027 9D/8N совпадает с `word_exact` днём 7–8: `Days 7–8 · Transfer to the Pacific coast for two days of rest and free time on the beach. (B)`; сохранено дословно, не заменяла сокращённым старым RU `Свободный день... Ночь в Wyndham Tamarindo`. В Word отель указано как `Wyndham Tamarindo or Pasatiempo Hotel (to be confirmed)` — EN-сегмент не делает ложной гарантии конкретного отеля. `Pacific coast`, `Liberia` подтверждены Word, Monteverde/Santa Elena и картинки с белкой и пляжем — RU-derived; 9 дней и маршрут сохранены. Уверенность 99%.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/697016ef31753f634558960cb97ea5a9da8a040f; accepted immutable blob `cb5635a65d01514e1368f35de660e2471c01aeea`.
- RU source: `src/content/tours/5-chudes-kosta-riki.md`; Git blob `17d83addbdb104a5e9d46b0f2ba0f65206d832fa`; sourceFingerprint `ca5027777251353b7685f5944d2f85c452903324169536afda228a8aef6575f0`.
- Exact Word: fileId `1T5sSpBPWF4D-su6vbAettn4oU6nsz5yj`; pinned SHA-256 `6eafb6c0a7d8faf42133a98c544f9ec542c912e158dd9fbe565cad3c1946b0c2`; frozen/observed modifiedTime `2026-10-26T18:16:01.279Z`.
- Frozen blocks (8): `tour:itinerary_label:dd77013a13a1a441`, `tour:media_alt:fa9b5aac40559803`, `tour:media_hover:d2292332edfee0f8`, `tour:itinerary_title:2fb5525f94c7ffcd`, `tour:itinerary_text:fb5db666cae6efb7`, `tour:media_alt:ae025c1050ee7c5b`, `tour:media_hover:c899fca26f8f6b0d`, `tour:itinerary_title:ab3fd6cac362f6b0`.


## Независимый QA — следующий конечный проход 05.11.2026, 01:27:23 (МСК)

Из существующей очереди `data/i18n/translation-mass/v2` рассмотрены **4 ранее сохранённых пакета**, всего **30 frozen-блоков**, все четыре получили **ready** по штатному CAS `approve`. В каждом случае прочитаны: запись `state/00.json`, соответствующий immutable `jobs/00.json`, результат `results/` с проверкой Git blob SHA относительно receipt, все назначенные RU-блоки, актуальный Git blob текущего RU (`main`) и полный текст **точного** Word 2027 по закреплённому Drive `fileId`. Drive `modifiedTime` совпал с закреплённым. Проверены `word`, `meaning`, `facts`, `voice`, `structure`, `relations`; сопоставлены дни, ночи, маршруты, коммерческие оговорки и допустимость локализации языка гида для RU-derived текста. SHA-256 DOCX ниже — закреплённые fingerprints в job, **не новое независимое хеширование бинарных DOCX**. Данные о ценах и условиях не переписывались, EN-ревизий не понадобилось. Инструментальных препятствий для этих 4 проверок: **0**. Работа не означает QA остальных записей.

### `en:bulk:tour:tour_brazil_southern_vip_7_days:b008` — ready, 8 блоков

Проверила раздел о каньоне Итаимбезинью: выбранный Word 2027 содержит **Day 4** с маршрутом Gramado → Cambará do Sul → Itaimbezinho Canyon, возвращением в Cambará do Sul во второй половине дня; согласованное название в заголовке, подписях и маршруте совпадает. Сохранён Word-exact текст дня, включая его рекламный стиль как защищённый Word 2027; не подменяла текст подробностями из RU о питании. Подписи к изображению `media.alt` и `media.hover` соответствуют RU, отсутствуют как самостоятельные подписи в Word и правильно отмечены `ai_translation`. Общая программа 7 дней / 6 ночей; погодная оговорка о воздушном шаре и вертолёте в Word не изменена, новых обязательств в этом пакете нет. Уверенность редакционного решения **99%**.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/774cad00274c7cb0f38070e20a10d36776460ead; accepted result Git blob `b26cc8a1f12a813eb1c7f4b1f939833199bc0da5`.
- RU: `src/content/tours/southern-brazil-vip-7-days.md`, текущий/pinned Git blob `60ff4b0c851d4476a400e08028efb66ac3e78d98`; sourceFingerprint `ed986bc2d89a361ff66e03b4a26b6e8f6f0f3bc5a8007ff82b7c9ac81b7b1820`.
- Word 2027: exact fileId `15xqDgjW57k5FWWwaZbXCBhEKIR75cD3S`; pinned SHA-256 `2319bd3f1c856c366cadeaced7e1d2328de47e9dcfb397f1fa1ef0c2a2b10601`; frozen/observed modifiedTime `2026-10-19T19:14:32.463Z`.
- BlockIds: `tour:itinerary_label:735798c76cc623a3`, `tour:itinerary_title:ce8fa4f4df9e3974`, `tour:itinerary_text:ec46e3209ab74818`, `tour:itinerary_label:db131575044fde2b`, `tour:itinerary_label:d9cfe133970a2cb6`, `tour:media_alt:0eb20c430077bbb8`, `tour:media_hover:3361f9572e0d4841`, `tour:itinerary_label:f60ccaf902463edc`.

### `en:bulk:tour:tour_brazil_tropical_champions_parade_rio_angra_2027:b006` — ready, 8 блоков

По точному Word 2027 подтверждены **12–21 февраля 2027, 10 дней / 9 ночей**, три ночи в Рио и шесть в Ангра-дус-Рейс, одобрено `Days 5–9` об отдыхе на базе all-inclusive в Vila Galé Angra. Отель указан как программный, с общим условием Word/RU о возможности замены на аналогичный; сохранён защищённый утверждённый Word-фрагмент, не добавлено отдельной гарантии наличия. `Rio de Janeiro` и `Angra dos Reis` соответствуют документу, две фото-подписи — дословно по смыслу RU с честным `ai_translation`. В блоках не добавлены авиабилеты, даты и цены. Уверенность **99%**.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/80a08cfdbd37ba10f86d634a36b326d44005741c; accepted blob `622c32f12f4244b003de8f2ab35b9152e47683c7`.
- RU: `src/content/tours/tropical-champions-parade-rio-angra-2027.md`, blob `434af7cb604dd4cd56aa19407a13e7deb925dcb0`; sourceFingerprint `ba82c95011c33cbdf03d2ff8f30a866d9f5145eb1b0ab875a1138d9af181f59d`.
- Word 2027: fileId `1hmIJPtN_0bWvKAmlH4Aipt-3yfbnW0p_`; pinned SHA-256 `960ba4e684e5b7ba7e99c6823005085464557c55ea7f1a3e8d526d8a52dcb8d9`; frozen/observed modifiedTime `2026-10-26T13:05:52.351Z`.
- BlockIds: `tour:itinerary_label:1b7ac15bbf82b0ae`, `tour:itinerary_label:42b1d5c35e6d34c5`, `tour:media_alt:d3b056f42cb861e0`, `tour:itinerary_title:9d160262ccf40bb8`, `tour:itinerary_text:b04d5d61d358e759`, `tour:itinerary_label:fd4bba9e89f09032`, `tour:media_alt:00c8b70b82bffac2`, `tour:itinerary_title:e1dddf681303f0bd`.

### `en:bulk:tour:tour_brazil_gems_14d:b008` — ready, 8 блоков

Утверждённый Word 2027 **14D/13N** содержит экскурсию `Day 7` по историческому Салвадору и дальнейший переезд в Praia do Forte. Все утверждённые `Salvador`, `Praia do Forte`, маршрут дня и полный Word-exact абзац сохранены; добавленные фото-alt/hover Иньотима и Салвадора сверены с RU и не выданы за Word. В RU отдельно упомянут англоязычный гид и возможный русскоязычный по запросу, но проверяемый `word_exact` Day 7 не содержит языка гида и корректен без приписывания дополнительного обещания; документ в целом обозначает английское сопровождение. Согласованность продолжения маршрута через Фос-ду-Игуасу подтверждена Word. Уверенность **98%**.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/0fda0cef9a681819a08e0e75a2e7783e25a28520; accepted blob `a159b3e86b7d23475a10c3e7b78e6f0c42d39896`.
- RU: `src/content/tours/brazil-gems-14d.md`, blob `2f6a87e26a001d51a27d4616c9d1edeacdc1a729`; sourceFingerprint `49ce8c71f5a5e754db205142fcd2bf39bf5f24a290304e67e64fb2925e811ebb`.
- Word 2027: fileId `16NqiEGIeCV-f-TajYQA5HsQ7SXiaszyI`; pinned SHA-256 `eff683625139b7fb68f7a8e6a81c50760fcb53071ab959f47fb27cffbdf7a8c9`; frozen/observed modifiedTime `2026-10-21T20:47:38.620Z`.
- BlockIds: `tour:itinerary_label:c12f8d3cb0052213`, `tour:media_alt:dea113f3a15319b8`, `tour:media_hover:66403fad7da2be7a`, `tour:itinerary_title:ed497b2a669f6ce4`, `tour:itinerary_text:2e780f63f4172747`, `tour:itinerary_label:179afc5b619ea227`, `tour:itinerary_label:f593e8098afbf224`, `tour:media_alt:14755d46b6f87dd3`.

### `en:bulk:tour:tour_source_kongress_v_rio_de_zhanejro:b005` — ready, 6 блоков

Точный Word содержит **5 дней / 4 ночи**, корпоративную программу в Рио, конгрессные сессии дней 2–4, Corcovado, Sugar Loaf, выбор дополнительной активности и **Day 5: after breakfast, transfer to the airport**. EN финального дня сохраняет эти условия и не выдумывает новых услуг. Статья `body` и фото-подписи отсутствуют в Word как самостоятельные блоки: корректно переведены по текущему RU, с `ai_translation`, без ложной Word-атрибуции, сохранён Markdown-заголовок и перечень ресторанов с оговоркой о перестановке порядка. Дополнительный ресторан `Fogo de Chão` из Word, отсутствующий в RU-статье, не добавлен в RU-derived `body`; это не пропуск обязательной строки уже существующего Word-абзаца. Уверенность **97%**.

- CAS: https://github.com/alexyakovlev79/adatours.ru/commit/e17cd3dd77e409e901e9ae633410b12ca03942b9; accepted blob `f93c70aa96debd449be7dce88d9846fa07a69c97`.
- RU: `src/content/tours/kongress-v-rio-de-zhanejro.md`, blob `dfe72719ed0eaa42ac41660ef2f8163344bf06b2`; sourceFingerprint `0df51e2e54bc8b4991465df327a9810e7ac07885c40f0d6a076b9541248768c4`.
- Word 2027: fileId `14nRX0wYh8xtWOCRYW3YxthdOeZdCM3Xh`; pinned SHA-256 `cd871686a1930b3d4ded4d5adada17af9400a6a7b6009d6dbf3af08dadb18c42`; frozen/observed modifiedTime `2026-10-07T14:17:04.531Z`.
- BlockIds: `tour:itinerary_title:9d160262ccf40bb8`, `tour:itinerary_text:b04d5d61d358e759`, `tour:media_alt:faac2d4212dc95a2`, `tour:media_alt:68ebdd10346d3d20`, `tour:media_hover:77871c8f58bdcbc6`, `tour:body:47f6c11f40afc686`.

## Дополнительный конечный проход QA — 05.11.2026 МСК, reviewer ada-independent-semantic-qa-20261104-t4

Дата фиксации: 05.11.2026, 01:38:26 (МСК). Проверяющая: `ada-independent-semantic-qa-20261104-t4` (отдельно от переводчиков). Канонические инструкции и код QA прочитаны из `main`, HEAD `c7dffb624835530c19dd91f7929880b2e8582217`: editorial `5426b00b9220b66b4969b18a8867ce4bcaa2d370`, queue `32c36a4d27d445feacd3f362f5304013021db30f`, worker `ca92225d88c1ec92516aa9ebc1a00656f43ef80f`, independent QA `fa6ee9b6520b7ba97c79c8d270d618497390b065`, QA adapter `15f8e1e6d5e5e23fbac45813e6c5a1a2a657afe2`, core `6a2539330250a8db9a724b6c975b78b5dd9d1102`. Проверено 3 ранее сохранённых пакета / 24 блока; 3 CAS-approve → ready, ни одной ревизии. GitHub не использовался для перезаписи source, исходных переводов или Word. Шесть проверок `word, meaning, facts, voice, structure, relations` выполнены по каждому из указанных ниже пакетов. Drive DOCX открыт по exact fileId; имена, содержимое и modifiedTime сверены с закреплёнными сведениями. Pinned SHA-256 DOCX использован как fingerprint, **не** заявляется повторное вычисление криптографического хеша из бинарного DOCX.

### `en:bulk:tour:tour_bolivia_chile_hidden_treasures_16_days:b001` — ready (8 блоков)
- Решение: сохранённый заголовок `Hidden Treasures of Bolivia and Chile` и полный `word_exact` lead дословно присутствуют в Word 2027. Порядок La Paz → Uyuni → San Pedro de Atacama → Santiago, затем Patagonia/Marble Caves/San Rafael/Viña Vik/Valparaíso соответствует документу и RU. `Private` подтверждён Word. RU-derived priceNote содержит только запрос стоимости и подтверждение услуг, без суммы и без неподтверждённых гарантий. В Word содержится отдельная таблица тарифов, но её перенос в общий тариф не входит в этот QA-пакет.
- Неоднозначность: filename Word содержит `15d14n`, однако **тело** Word подтверждает Days 1–16 / `16D / 15N`, действующий RU содержит `durationDays=16`, `durationNights=15` и маршрут до Day 16. Принята программа 16/15; уверенность **99%**. Само имя файла не меняет коммерческих обязательств.
- Word 2027 fileId `1iDDWJn3nE4yuEwxneW1nVevFt5fD4-Vw`, pinned SHA-256 `b3681c6cfba3e05282c7d13869add977e657b7c580b6adacb7f2e831f9a1e009`, verified modifiedTime `2026-10-22T14:05:36.417Z`. RU `src/content/tours/bolivia-chile-hidden-treasures-16-days.md`, current/pinned Git blob `882ec10fb84fc4858c88051e57e238bf747bd9d4`; sourceFingerprint `e4b7e140d5607dae7348085fa5b5d3c5fa84afde9d4a16e3be484b4a167307c6`. Original/accepted immutable blob `a58fd814158233a23008f8122d46a65f19eb10b5`; CAS ready commit `3152f95f0f0f77e12a438ba5cfcb451e46cf5737`.
- BlockIds: `tour:title:aaf2320646108059`, `tour:lead:e3456bc1f4d270f4`, `tour:priceNote:9b6b7f5cf7b1e557`, `tour:formatLabel:e904c9ccfa425ff0`, `tour:itinerary_label:32d7b9d28ab90e4b`, `tour:itinerary_label:2811c9b0d6dea37f`, `tour:itinerary_label:76aa895a43d4eb29`, `tour:itinerary_label:05d7c958b87212c3`.

### `en:bulk:tour:tour_brazil_argentina_chile_new_year_11_days_2027:b001` — ready (8 блоков)
- Решение: RU-derived lead точно передаёт 30.12.2026–09.01.2027 / 11 дней и 10 ночей, Новый год на Копакабане, обе стороны Игуасу, танго в Буэнос-Айресе и Сантьяго. `English-speaking guides` — согласованная адаптация RU-derived `русскоговорящими` (§4.1), причём Word программы независимо содержит English-speaking group guide. Цена `$5,008` за TPL/3★, девять ставок 3★/4★/5★, включённые внутренние перелёты и условие подтверждения при бронировании сопоставлены с Word и действующим RU, дополнительных обещаний нет. Маршрут 4+2+2+2 ночи и даты всех основных переездов подтверждены.
- Неоднозначность: одна строка таблицы **5★** для Santiago в Word указана как `07.01–08.01`, тогда как 11-дневная программа заканчивается 09.01, остальные строки и RU называют 2 ночи в Сантьяго; для общего `route/3` обоснованно принят вариант **2 ночи**, соответствующий сумме 10 ночей. Таблица 5★ не редактировалась. Уверенность **98%**, это согласование маршрута, не обещание отдельного тарифа.
- Word 2027 fileId `1VCW8zrPr4Inu3DKOa4FKpk3HcXQVLh6j`, pinned SHA-256 `44355f86a17eccb5be2b7118971653ba5bc939786f519e79354672270521f509`, verified modifiedTime `2026-05-21T14:35:42.000Z`. RU `src/content/tours/brazil-argentina-chile-new-year-11-days-2027.md`, current/pinned Git blob `d61ebcf6238082d3fea8eff407ecbf19bdc3cb6f`; sourceFingerprint `b380b41c9455b02eda43f86eabc63e77a4334347ef0aeb2dde975b73aadb22be`. Original/accepted immutable blob `c0b86481c7fc0dd7ed4dac72aac2a0d58a45696b`; CAS ready commit `5e5eadf63f3b6805bc16a2c5597057e27dcd477d`.
- BlockIds: `tour:title:aaf2320646108059`, `tour:lead:e3456bc1f4d270f4`, `tour:priceNote:9b6b7f5cf7b1e557`, `tour:formatLabel:e904c9ccfa425ff0`, `tour:itinerary_label:4c165ecc8a1f423b`, `tour:itinerary_label:c8ffbd6fc38d01b3`, `tour:itinerary_label:8711a253902b9244`, `tour:itinerary_label:0b9ea8397b57933b`.

### `en:bulk:tour:tour_mexico_lindo_eight_days:b001` — ready (8 блоков)
- Решение: Word 2027 `Mexico Lindo 2027` подтверждает полную программу 8 дней / 7 ночей, дни 1–4 в Мехико и 5–7 в Мериде, с высадкой на побережье в день 8. Все 4 маршрутных подписи и lead соответствуют Word и действующему RU (Teotihuacan/Guadalupe, Xochimilco, Mérida, Uxmal, Kabah, Santa Bárbara, Chichén Itzá, Valladolid). Word отмечает `Languages: English and Spanish` для экскурсий. `priceNote` подтверждён по тарифам 2027: TPL $1,855, DBL $1,908, SGL $2,372; внутренний перелёт Mexico City–Mérida и ночёвка на Caribbean coast не включены, по Word оба требуют отдельного заказа. Формат `Excursions` переведён с RU, не объявлен дословным Word. Уверенность **99%**.
- Word 2027 fileId `1r_kV3bsX5sSfHUwMz0xU-JEbsqip1rrP`, pinned SHA-256 `3fd6de603bf6026e3da714c70cba5b5c358b4895dbde0fc7c9545eb52d6a6d9b`, verified modifiedTime `2026-10-08T14:01:21.046Z`. RU `src/content/tours/mexico-lindo-eight-days.md`, current/pinned Git blob `9c30125cf1004e4d887bc3b21a79d2068e2d1091`; sourceFingerprint `6b8026bf59b927bba92a1a34efebe3b9121c90b2e2175360aa8cd11f631a5366`. Original/accepted immutable blob `6b8c1e9a3d6484a6830acdbe3faa73b5eaa12ee8`; CAS ready commit `5c4deec29024e8abf4f4238f378ce8398888dc4e`.
- BlockIds: `tour:title:aaf2320646108059`, `tour:lead:e3456bc1f4d270f4`, `tour:priceNote:9b6b7f5cf7b1e557`, `tour:formatLabel:e904c9ccfa425ff0`, `tour:itinerary_label:d08bad5b79b9e6a4`, `tour:itinerary_label:31ad3781c9a47a6f`, `tour:itinerary_label:fd817dd0bf06e945`, `tour:itinerary_label:b7f17bae132f28ca`.


## Независимый проход 05.11.2026 — ada-independent-semantic-qa-20261105-t5

Дата фиксации (МСК): 05.11.2026, 03:29:07. Проверено **3 ранее сохранённых пакета / 24 блока**, CAS `approve → ready` = **3**, исправленных immutable EN-ревизий = **0**. Выполнены все шесть предметных критериев (`word`, `meaning`, `facts`, `voice`, `structure`, `relations`) индивидуально по каждому пакету. Reviewer `ada-independent-semantic-qa-20261105-t5` не является переводчиком этих пакетов. Прочитаны актуальные main-инструкции и QA/core: editorial `5426b00b9220b66b4969b18a8867ce4bcaa2d370`; queue `32c36a4d27d445feacd3f362f5304013021db30f`; worker `ca92225d88c1ec92516aa9ebc1a00656f43ef80f`; QA policy `fa6ee9b6520b7ba97c79c8d270d618497390b065`; QA script `15f8e1e6d5e5e23fbac45813e6c5a1a2a657afe2`; core `6a2539330250a8db9a724b6c975b78b5dd9d1102` (main HEAD `c7dffb624835530c19dd91f7929880b2e8582217`). Сверено точное Drive `fileId`, доступный текст Word и `modifiedTime` с frozen job; pinned document SHA-256 использован для контроля атрибуции, **бинарный DOCX заново не хешировался**. Сверены immutable result и receipt Git blob SHA, текущий RU Git blob SHA, все исходные frozen RU-блоки. Публикация не производилась.

### `en:bulk:tour:tour_brazil_rio_iguazu_sao_paulo_group_9d:b006` — ready,  8 блоков

Одобрены исключения visa fees (if applicable), tips/gratuities и early check-in/out, с сохранением оговорок. Примечание Batch 1 — 40+1 FOC, USD на человека, тариф 5★ hotels + services при отдельном уточнении размещения. Word явно исключает проживание, если оно не оговорено отдельно; RU-пояснение не превратилось в гарантию. Дополнительные обеды, ужины, Theme Parties и отдельно оплачиваемые напитки подтверждены перечнями Word/RU. 9 дней / 8 ночей, Rio → Foz do Iguaçu → São Paulo. Язык сопровождения английский; исключения гражданства/виз не перепутаны. Word фрагменты 'What’s Not Included', тарифная основа и meals проверены содержательно. Вероятность предметного вывода **98%**; это редакционная оценка по Word+RU, не изменение коммерческих обязательств. Шесть QA-критериев подтверждены; новая EN-ревизия не понадобилась.

- CAS commit [`acc90586d1`](https://github.com/alexyakovlev79/adatours.ru/commit/acc90586d1fe67bccc8fa6d5e9a028d967e7c989); immutable accepted/original result blob `e92b5df053eddd9336b4f8729940e5ce5e368f42`.
- Frozen job fingerprint `b3e526aca4a7ad6119cbaf1a610bbc64a16f894c57956b7d443e3181abe6426c`; RU `src/content/tours/rio-iguazu-sao-paulo-group-9-days.md`, frozen/current blob `396d725dfc3b081ce1caacce5d96089cdfaf51b5`.
- Word 2027 exact `fileId` `1PmzcBgufhbeKGNeLMzdZSg-LT_Tl0b8J`; pinned SHA-256 `10fb294901e072d35c513e3fff8eafc968fb8f0b45c6a2e6b98d5524159f4375`; сверенный modifiedTime `2026-03-05T15:40:37.487Z`.
- `blockId` / поле / frozen path: `tour:notIncluded:c6bb5bb3fc6ea0b2` (notIncluded, `/notIncluded/7`); `tour:notIncluded:7d4199bb6447ce2d` (notIncluded, `/notIncluded/8`); `tour:notIncluded:81d0395f218f5f0d` (notIncluded, `/notIncluded/9`); `tour:note:db8f22dedb40f394` (note, `/notes/0`); `tour:note:4541ade74590048e` (note, `/notes/1`); `tour:note:e251152d423f5d8b` (note, `/notes/2`); `tour:note:9e55c6317995964a` (note, `/notes/3`); `tour:note:952f5361da522e4d` (note, `/notes/4`).

### `en:bulk:tour:tour_source_5_stran_latinskoj_ameriki:b019` — ready,  8 блоков

Word 2027 подтверждает 18D/17N и Day 17 Cusco & Lima: Qorikancha, Q’enqo, Puka Pukara, Tambomachay, Sacsayhuamán и переезд в Лиму. Дословный Word-блок сохранён без правки, топонимы подтверждены Word; English-speaking guide соответствует утверждённому тексту. Позиция frozen job /itinerary/19 при фактическом day:17 в RU — структурный индекс, не номер дня; контекст соседних Days 16/18 проверен. Перелёт Cusco–Lima подтверждён Word в перечне включённых перелётов и соседним RU. Коммерческих обещаний и новых цен нет. Вероятность предметного вывода **99%**; это редакционная оценка по Word+RU, не изменение коммерческих обязательств. Шесть QA-критериев подтверждены; новая EN-ревизия не понадобилась.

- CAS commit [`3ccf335b24`](https://github.com/alexyakovlev79/adatours.ru/commit/3ccf335b24f1eaa29a0c88832326abee92291e86); immutable accepted/original result blob `64b6611249adff06a07393715f35b80214aed849`.
- Frozen job fingerprint `8d0e688192a3942e904e7cf1516aa1fc87671399671cb447011ce8f27fec816f`; RU `src/content/tours/5-stran-latinskoj-ameriki.md`, frozen/current blob `4bdda3b8226ae74c2310feba37c249dc86b46bc5`.
- Word 2027 exact `fileId` `1D9b9CT24BvopVtwbWVZClhDY4V-81Q5M`; pinned SHA-256 `08e0d302e63195697d0b6b436bbaa7bd566d75aa46e060ec8fb0006011d8960c`; сверенный modifiedTime `2026-10-26T14:08:55.978Z`.
- `blockId` / поле / frozen path: `tour:itinerary_title:c4b9450eed473263` (itinerary.title, `/itinerary/19/title`); `tour:itinerary_text:1e1fcafafd438aa8` (itinerary.text, `/itinerary/19/text`); `tour:itinerary_label:9a7f04406fb2813b` (itinerary.label, `/itinerary/19/places/0`); `tour:itinerary_label:545dcfe3343879c1` (itinerary.label, `/itinerary/19/places/1`); `tour:itinerary_label:76b4cbde700e2e70` (itinerary.label, `/itinerary/19/places/2`); `tour:itinerary_label:585c4eff0daa7683` (itinerary.label, `/itinerary/19/places/3`); `tour:itinerary_label:16c4a4d61c6b8e61` (itinerary.label, `/itinerary/19/places/4`); `tour:itinerary_label:aed4521d8e523346` (itinerary.label, `/itinerary/19/places/5`).

### `en:bulk:tour:tour_source_5_stran_latinskoj_ameriki_i_parad_chempionov_karnavala:b017` — ready,  8 блоков

Word 2027 '5 Countries & the Champions Parade' подтверждает 18D/17N, даты 12 февраля — 1 марта 2027, Day 17 Cusco → Lima; дословно сохранена английская экскурсия с Qorikancha, Q’enqo, Puka Pukara, Tambomachay, Sacsayhuamán и перелётом в Лиму. Отдельные route labels взяты из того же Word; current RU day:17 и соседние Days 16/18 совпадают, хотя техническая позиция /itinerary/20. Русскоязычный гид RU не перенесён: для Word-exact 2027 сохранено English-speaking guide. Стоимость и включённые перелёты не изменены. Вероятность предметного вывода **99%**; это редакционная оценка по Word+RU, не изменение коммерческих обязательств. Шесть QA-критериев подтверждены; новая EN-ревизия не понадобилась.

- CAS commit [`be5b9fb8ba`](https://github.com/alexyakovlev79/adatours.ru/commit/be5b9fb8bac88731d3348952ff56eb3d85271f92); immutable accepted/original result blob `ba145a578ce7555d359af6ba7f240321e0ac873f`.
- Frozen job fingerprint `f9ee965afbb1751712f5a8ec7a7389fee092a951dd57dd5e14a34adc5c69ad50`; RU `src/content/tours/5-stran-latinskoj-ameriki-i-parad-chempionov-karnavala.md`, frozen/current blob `f70bbfc62742001dcb640b3039952511c0402256`.
- Word 2027 exact `fileId` `1p43mEGxeh35l0VLkcj1IlUV9E-hKpInp`; pinned SHA-256 `3fee51854bf61a45547d1df8df4f548db569100525537afde1e341551188fbdf`; сверенный modifiedTime `2026-10-23T19:10:33.819Z`.
- `blockId` / поле / frozen path: `tour:itinerary_title:c4b9450eed473263` (itinerary.title, `/itinerary/20/title`); `tour:itinerary_text:1e1fcafafd438aa8` (itinerary.text, `/itinerary/20/text`); `tour:itinerary_label:9a7f04406fb2813b` (itinerary.label, `/itinerary/20/places/0`); `tour:itinerary_label:545dcfe3343879c1` (itinerary.label, `/itinerary/20/places/1`); `tour:itinerary_label:76b4cbde700e2e70` (itinerary.label, `/itinerary/20/places/2`); `tour:itinerary_label:585c4eff0daa7683` (itinerary.label, `/itinerary/20/places/3`); `tour:itinerary_label:16c4a4d61c6b8e61` (itinerary.label, `/itinerary/20/places/4`); `tour:itinerary_label:aed4521d8e523346` (itinerary.label, `/itinerary/20/places/5`).


### Дополнение к проходу t5: две исправленные immutable-ревизии

Фиксация (МСК): 05.11.2026, 03:32:51. После 3 первичных CAS-approve дополнительно завершена независимая предметная проверка **2 пакетов / 16 блоков** по шести критериям. Прежние неизменяемые receipts сохранены в `qaRevisions`; оба результата перешли `review → ready` через штатный `revise_and_approve` с новым `submission` и CAS. Точный EN Word 2027 получен из Google Drive по fileId; сверены название, текст и modifiedTime, SHA-256 документа **не** пересчитывался из бинарного файла. Текущий RU Git blob SHA сверялся с frozen. Это продолжение того же конечного прохода t5, не новый проход. Суммарно за t5 **5 пакетов / 40 блоков, 5 ready (2 с новой EN-ревизией)**.

#### `en:bulk:tour:tour_colombia_complete_11_days:b004` — ready / revised, 8 блоков

Точный Word 2027 подтверждает 11D/10N; гостиничная таблица и краткая таблица ночей указывают Cartagena = 1, Bogotá = 2, Pereira = 2, San Andrés = 3, Medellín = 2. Дневная программа также подтверждает 1 ночь в Картахене. В исходном EN-примечании повторялось неактуальное RU-утверждение, будто гостиничная таблица Word содержит 2 ночи / всего 11. Новая immutable EN-ревизия убрала ложное противоречие; сохранён запрос подтвердить окончательные условия и цену до оплаты. Отдельно сверены Word exclusions: optional tours, extra meals/drinks, tips, personal expenses, а также условия all inclusive на San Andrés, допустимость замены отелей, изменения порядка и пропуска завтрака при раннем выезде. Не изменяла тарифы или RU. Уверенность предметного заключения **99%** (экспертная оценка, не замена подтверждения коммерческих условий). Проверены происхождение Word, смысл, факты/цены/условия, голос, структура и связи/маршрут.

- CAS commit [`a9e032f157`](https://github.com/alexyakovlev79/adatours.ru/commit/a9e032f157e92fc53d17fd6183c617a0855e7287); accepted result blob `363e1844a4507cb4ae48cc0b84dfdaeb722fe8a4`; revised path `data/i18n/translation-mass/v2/results/en_bulk_tour_tour_colombia_complete_11_days_b004/qa-qa-20261105-t5-colombia-b004-01-363e1844a4507cb4.json`; preserved previous submission blob `03d8566e0d25db32bdc846a90f8a82d87eeced8a`; revisionId `qa-20261105-t5-colombia-b004-01`; changed blockId `tour:note:86ab84107d29b126`.
- Frozen sourceFingerprint `d9dd4623515392c1d2c1e40c37abc3180f30a2a0c08c837cfafbfb6b4225bf77`; RU `src/content/tours/colombia-complete-11-days.md`, Git blob `850cbfa3c9f1a4c3d1fd1802c1b7ee94cef7e3a1` (unchanged); Word 2027 exact `fileId` `1cTDAAUrOBtW3lO-3mgPoc2ol9xcBKEsc`, pinned SHA-256 `b5f8782bb93c5b312e8f2989c411265e7af671a71e8ed626dfaa8150c12951b2`, verified modifiedTime `2026-10-26T17:58:24.563Z`.
- Все `blockId`: `tour:notIncluded:cbf51738536ca22f` (notIncluded, `/notIncluded/2`); `tour:notIncluded:f9c1ec798364fe9c` (notIncluded, `/notIncluded/3`); `tour:notIncluded:dd8eb2ee319d9d99` (notIncluded, `/notIncluded/4`); `tour:notIncluded:a0b0ac37984ff5a4` (notIncluded, `/notIncluded/5`); `tour:note:86ab84107d29b126` (note, `/notes/0`); `tour:note:daad65ee74730fec` (note, `/notes/1`); `tour:note:cf102f5073001b6d` (note, `/notes/2`); `tour:note:ca90b6c1a56f9faa` (note, `/notes/3`).

#### `en:bulk:tour:tour_source_meksika_lindo:b001` — ready / revised, 8 блоков

Word 2027 «Mexico Lindo 2027» = 8 дней / 7 ночей, Mexico City → Mérida → Uxmal/Kabah → Chichén Itzá → Riviera Maya; названия маршрута и 4 утверждённых Word-параграфа lead не изменены. Тарифы Word 2027: TPL USD 1 855, DBL 1 908, SGL 2 372 на человека. Старый RU priceNote содержит USD 1 475, что не подтверждено Word 2027. Чтобы не выдавать неподтверждённую цену за действующую и не вмешиваться в общую коммерческую модель, в новой immutable EN-ревизии заменён ТОЛЬКО блок priceNote на просьбу подтвердить индивидуальную цену по размещению. Общая цена RU/priceFrom остаётся без изменений — её должен отдельно согласовать коммерческий мастер; это ограничение QA явно записано. Факт включения внутреннего перелёта не придуман: в Word Mexico City–Mérida flight explicitly not included. Уверенность предметного заключения **97%** (экспертная оценка, не замена подтверждения коммерческих условий). Проверены происхождение Word, смысл, факты/цены/условия, голос, структура и связи/маршрут.

- CAS commit [`9965e38f1f`](https://github.com/alexyakovlev79/adatours.ru/commit/9965e38f1fe3732dcc4b9835bf6c57c89312ba6f); accepted result blob `ac993677c3b8f86935dd2b54577a043d7f649fc5`; revised path `data/i18n/translation-mass/v2/results/en_bulk_tour_tour_source_meksika_lindo_b001/qa-qa-20261105-t5-mexico-b001-01-ac993677c3b8f869.json`; preserved previous submission blob `854370395aeb15ea528fb0257e61cfe1577ee181`; revisionId `qa-20261105-t5-mexico-b001-01`; changed blockId `tour:priceNote:9b6b7f5cf7b1e557`.
- Frozen sourceFingerprint `3d12c82f430deaa2ceffab56919d62512666ea9860aa6e2c546e4b98675d9827`; RU `src/content/tours/meksika-lindo.md`, Git blob `9fd5970ac95cec1ada70884acf26ae57039f5d77` (unchanged); Word 2027 exact `fileId` `1r_kV3bsX5sSfHUwMz0xU-JEbsqip1rrP`, pinned SHA-256 `3fd6de603bf6026e3da714c70cba5b5c358b4895dbde0fc7c9545eb52d6a6d9b`, verified modifiedTime `2026-10-08T14:01:21.046Z`.
- Все `blockId`: `tour:title:aaf2320646108059` (title, `/title`); `tour:lead:e3456bc1f4d270f4` (lead, `/lead`); `tour:priceNote:9b6b7f5cf7b1e557` (priceNote, `/priceNote`); `tour:itinerary_label:dea9c008fe6d0176` (itinerary.label, `/route/0`); `tour:itinerary_label:6f3058ac67755137` (itinerary.label, `/route/1`); `tour:itinerary_label:df0fd2fc4ec2ae80` (itinerary.label, `/route/2`); `tour:itinerary_label:3831edf82343d3b7` (itinerary.label, `/route/3`); `tour:itinerary_label:a0c29288a7923b0a` (itinerary.label, `/route/4`).
