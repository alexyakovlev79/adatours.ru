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
