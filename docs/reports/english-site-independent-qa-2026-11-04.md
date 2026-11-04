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
