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
