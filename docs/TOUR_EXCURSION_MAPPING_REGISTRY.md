# Ada Tours — реестр сопоставления туров и экскурсий

Версия: 1.9  
Дата старта: 2026-09-30  
Repo: `alexyakovlev79/adatours.ru`  
Ветка: `main`  
Базовый HEAD при создании реестра: `5f2a10064d6aad34718503337c62cf252af0c231`

## 0. Назначение

Этот файл — постоянная точка продолжения работы по связям `Tour ↔ Excursion`.

**Любой новый чат, продолжающий сопоставление экскурсий с турами, сначала читает этот файл и продолжает с текущего статуса. Нельзя начинать обход уникализированных туров заново.**

Полная методика обхода, сопоставления и создания новых Excursion:

`docs/ADA_TOURS_TOUR_EXCURSION_LINKING_WORKFLOW_v1.0_2026-09-30.md`

Новый чат должен прочитать **оба файла**: workflow + текущий registry.

Основной реестр страниц:
`Ada Tours — реестр страниц нового сайта`  
Google Sheet: `1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc`  
Лист: `Страницы`

Production tours:
`src/content/tours/`

Production excursions:
`src/content/excursions/`

## 1. Правило сопоставления

Текущий рабочий проход идет **по уникализированным турам**, сверху вниз по строкам Google Sheets.

Связь с канонической Excursion создается/фиксируется для **каждого самостоятельного элемента маршрута между двумя пронумерованными днями**. Это обязательный инвариант: самостоятельных текстовых карточек без целевой Excursion после завершения прохода оставаться не должно.

Пример допустимой позиции:

```text
День 6
→ самостоятельная экскурсия
→ День 7
```

Тогда в реестре фиксируются:

- `tour_id`;
- `excursion_id`;
- после какого дня стоит экскурсия;
- перед каким днем стоит экскурсия;
- статус связи.

Для каждого тура сначала считается:

```text
standalone_between_days = N
mapped_relation_rows = M
missing_slots = N - M
```

Тур нельзя считать полностью размеченным, пока `missing_slots != 0`.

Если подходящая каноническая Excursion уже есть — использовать ее stable ID. Если отдельной Excursion раньше не существовало, нужно **сразу создать новую production Excursion из самостоятельного блока тура**: присвоить stable ID и URL, использовать только подтвержденные данные блока, не додумывать отсутствующие факты, вынести изображение в канонический `/media/excursions/{slug}/`, добавить страницу в основной Google Sheets и заменить локальную карточку тура на `excursionRef`. Самостоятельную карточку нельзя оставлять «просто текстом без связи».

### Игнорировать в новом проходе

Не создавать новую Tour↔Excursion связь, если экскурсия:

- упомянута только внутри текста дня;
- находится внутри `contentBlocks` конкретного дня;
- встречается в highlights;
- встречается в included / notIncluded;
- упомянута в notes / FAQ / цене / условиях;
- присутствует только в alt / caption / фотографии;
- встречается где-либо еще, где нет формализованной позиции **между днями**.

Такие упоминания не считать совпадением и отдельно в реестр не заносить.

Важно: это правило относится только к упоминаниям **внутри пронумерованного дня или других блоков**. Любой самостоятельный itinerary-item без `day`, стоящий между двумя днями, наоборот, обязан получить связь с Excursion.

### Историческое исключение — «Парк птиц»

«Парк птиц в Игуасу» был канонизирован **до принятия текущего правила**. В `main` уже существуют 7 связей с:

`excursion_source_park_jekzoticheskih_ptic_v_iguasu`

Каноническая excursion:

`src/content/excursions/park-jekzoticheskih-ptic-v-iguasu.md`

URL:

`/ekskursii/park-jekzoticheskih-ptic-v-iguasu/`

Из этих 7 связей 3 стоят отдельными itinerary-элементами между днями, 4 находятся внутри `contentBlocks` дня. **Эти 4 старые связи не использовать как прецедент для новых экскурсий и не удалять автоматически в рамках нового прохода.**

## 2. Статусы обхода тура

Использовать только эти значения:

- `PENDING` — полный проход по экскурсиям этого тура еще не делался;
- `IN_PROGRESS` — чат начал этот тур, но не завершил;
- `DONE_MAPPING` — тур полностью просмотрен; для каждого самостоятельного блока между днями уже существует production Excursion и определен ее `excursion_id`, но не все локальные карточки еще заменены на `excursionRef`; `missing_slots = 0`;
- `DONE_LINKED` — все найденные связи уже реализованы в production через `excursionRef` и прошли build/deploy;
- `DONE_NO_RELATIONS` — тур полностью просмотрен, самостоятельных блоков между днями нет;
- `REVIEW` — есть неоднозначность, которую нельзя безопасно решить автоматически.

### Правило зависшего чата

Если следующий чат видит `IN_PROGRESS`, он **сначала продолжает именно этот тур**, а не берет следующий `PENDING`.

Если `IN_PROGRESS` нет, брать первый `PENDING` по возрастанию строки Google Sheets.

После полного разбора тура статус меняется на `DONE_MAPPING` или `DONE_NO_RELATIONS`. После фактической реализации всех `excursionRef` и успешного deploy — на `DONE_LINKED`.

## 3. Очередь уникализированных туров

На момент создания реестра в Google Sheets найдено **16** туров со статусом `Уникализировано`.

Важно: существующая связь с «Парком птиц» не означает, что тур уже полностью просмотрен на **все остальные экскурсии**. Поэтому на старте полный scan-status всех 16 туров = `PENDING`.

| Sheet row | Tour ID | Production file | Тур | Scan status | Найденные ранее связи | Последнее обновление |
|---:|---|---|---|---|---:|---|
| 75 | `tour_luxury_brazil_11d` | `src/content/tours/luxury-brazil-11d.md` | Роскошная Бразилия | DONE_LINKED | 9 | 2026-09-30 |
| 76 | `tour_brazil_argentina_peru_14d` | `src/content/tours/brazil-argentina-peru-14d.md` | Бразилия, Аргентина и Перу за 14 дней | DONE_NO_RELATIONS | 0 | 2026-09-30 |
| 77 | `tour_peru_8d` | `src/content/tours/peru-8d.md` | Перу за 8 дней: Лима, Куско, Мачу-Пикчу и Титикака | DONE_LINKED | 4 | 2026-09-30 |
| 78 | `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `src/content/tours/brazil-sao-paulo-rio-ilha-paraty-12d.md` | Бразилия за 12 дней: Сан-Паулу, Игуасу, Рио, Илья-Гранди и Парати | DONE_LINKED | 3 | 2026-09-30 |
| 79 | `tour_brazil_adventure_17d` | `src/content/tours/brazil-adventure-17d.md` | Большое приключение по Бразилии за 17 дней | DONE_LINKED | 3 | 2026-09-30 |
| 80 | `tour_brazil_pantanal_bonito_lencois_8d` | `src/content/tours/pantanal-bonito-lencois-8d.md` | Пантанал, Бонито и Ленсойс-Мараньенсес за 8 дней | DONE_NO_RELATIONS | 0 | 2026-09-30 |
| 81 | `tour_brazil_recife_porto_noronha_10d` | `src/content/tours/brazil-northeast-recife-porto-noronha-10d.md` | Северо-восток Бразилии: Ресифи, Порту-ди-Галиньяш и Фернанду-ди-Норонья за 10 дней | DONE_NO_RELATIONS | 0 | 2026-09-30 |
| 82 | `tour_brazil_gems_14d` | `src/content/tours/brazil-gems-14d.md` | Бразилия за 14 дней: Рио, Ору-Прету, Сальвадор, Прайя-ду-Форте и Игуасу | DONE_NO_RELATIONS | 1 | 2026-09-30 |
| 83 | `tour_brazil_dunes_13d` | `src/content/tours/brazil-dunes-13d.md` | Бразилия за 13 дней: Рио, Игуасу, Ленсойс-Мараньенсес и Прайя-де-Пипа | DONE_NO_RELATIONS | 1 | 2026-10-01 |
| 84 | `tour_argentina_brazil_pipa_11d` | `src/content/tours/argentina-brazil-pipa-11d.md` | Аргентина и Бразилия за 11 дней | IN_PROGRESS | 0 | 2026-10-01 |
| 85 | `tour_brazil_south_12d` | `src/content/tours/south-brazil-12d.md` | Южная Бразилия за 12 дней: Рио, Игуасу, Грамаду, каньоны и Флорианополис | PENDING | 1 | 2026-09-30 |
| 286 | `tour_source_tur_v_surinam_dlya_nablyudeniya_za_pticami` | `src/content/tours/tur-v-surinam-dlya-nablyudeniya-za-pticami.md` | Орнитологический тур в Суринам на 8 дней | PENDING | 0 | 2026-09-30 |
| 344 | `tour_source_amazon_clipper_cruise_traditional_3_days_2_nights` | `src/content/tours/amazon-clipper-cruise-traditional-3-days-2-nights.md` | Amazon Clipper Cruise | PENDING | 0 | 2026-09-30 |
| 410 | `tour_source_iguacu_falls` | `src/content/tours/iguacu-falls.md` | Свадебная церемония у водопадов Игуасу | PENDING | 1 | 2026-09-30 |
| 411 | `tour_source_rio_de_janeiro_wedding` | `src/content/tours/rio-de-janeiro-wedding.md` | Свадебная церемония на пляже в Рио-де-Жанейро | PENDING | 0 | 2026-09-30 |
| 416 | `tour_source_wedding_ceremony_tropical_package` | `src/content/tours/wedding-ceremony-tropical-package.md` | Тропическая свадебная церемония | PENDING | 0 | 2026-09-30 |

**Следующий тур для полного прохода:** строка **84**, `tour_argentina_brazil_pipa_11d`.

## 4. Уже существующие Tour↔Excursion связи

| Tour ID | Excursion ID | Положение | После дня | Перед днем | Статус | Примечание |
|---|---|---|---:|---:|---|---|
| `tour_luxury_brazil_11d` | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | between_days | 4 | 5 | LINKED_EXISTING | Точное соответствие source excursion_detail, строка Sheets 711 |
| `tour_luxury_brazil_11d` | `excursion_source_rio_nochyu` | between_days | 4 | 5 | LINKED_EXISTING | Ночное сценическое шоу: самба/танцы, гид, опциональный ужин. Ближайшая каноническая source-экскурсия «Шоу мулаток», строка 627; `rio-nochyu-lapa` не подходит по содержанию |
| `tour_luxury_brazil_11d` | `excursion_source_polet_na_vertolete_nad_rio` | between_days | 4 | 5 | LINKED_EXISTING | Точное соответствие source excursion_detail, строка Sheets 626 |
| `tour_luxury_brazil_11d` | `excursion_rio_caipirinha_masterclass` | between_days | 4 | 5 | LINKED_EXISTING | Production Excursion создана из standalone-блока тура; строка Sheets 731 |
| `tour_luxury_brazil_11d` | `excursion_rio_churrasco_masterclass` | between_days | 4 | 5 | LINKED_EXISTING | Production Excursion создана из standalone-блока тура; строка Sheets 732 |
| `tour_luxury_brazil_11d` | `excursion_source_botanical_garden` | between_days | 4 | 5 | LINKED_EXISTING | Точное соответствие source excursion_detail, строка Sheets 622 |
| `tour_luxury_brazil_11d` | `excursion_rio_sugarloaf_trekking` | between_days | 4 | 5 | LINKED_EXISTING | Это именно треккинг/восхождение; не объединять с канатной дорогой `excursion_source_ekskursiya_na_sakharnuyu_golovu`. Production Excursion создана из standalone-блока тура; строка Sheets 733 |
| `tour_luxury_brazil_11d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 6 | 7 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_luxury_brazil_11d` | `excursion_source_makuko_safari` | between_days | 6 | 7 | LINKED_EXISTING | Точное соответствие русской source excursion_detail, строка Sheets 694; вариант `makuko-safari-he` не использовать |
| `tour_peru_8d` | `excursion_peru_sacred_valley_full_day` | between_days | 4 | 5 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 734. Не объединять с `excursion_source_svyashchennaya_dolina_premium_gruppovoj_tur`: отличаются маршрут, формат и цена. Hero пока использует точный legacy source URL; локализация media — отдельный photo-workflow. |
| `tour_peru_8d` | `excursion_peru_paracas_ballestas` | between_days | 7 | 8 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 735. Старый `ballestas-islands-tour` объединяет Бальестас и полет над Наска, поэтому это другой scope. Hero пока использует точный legacy source URL. |
| `tour_peru_8d` | `excursion_peru_nazca_lines_flight` | between_days | 7 | 8 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 736; отдельной source excursion_detail с таким scope не найдено. Hero пока использует точный legacy source URL. |
| `tour_peru_8d` | `excursion_source_lima_siti_tur` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей source excursion_detail, строка Sheets 623; production-файл создан из собственного source. |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 3 | 4 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_makuko_safari` | between_days | 3 | 4 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `makuko-safari`; локальная карточка удалена из тура. |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_polet_na_vertolete_nad_rio` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `polet-na-vertolete-nad-rio`; локальная карточка удалена из тура. |
| `tour_brazil_adventure_17d` | `excursion_source_makuko_safari` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `makuko-safari`; локальная карточка удалена из тура. |
| `tour_brazil_adventure_17d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 7 | 8 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_adventure_17d` | `excursion_brazil_bonito_abismo_anhumas` | between_days | 12 | 13 | LINKED_EXISTING | Production Excursion создана из standalone-блока тура; строка Sheets 737. Для hero без перекодирования использован уже улучшенный Abismo Anhumas image blob из highlights этого тура, скопированный в `/media/excursions/abismo-anhumas/hero.webp`. |
| `tour_brazil_gems_14d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | legacy_inside_day | 12 | 13 | LINKED_EXISTING_LEGACY | В текущем `main` relation находится внутри `contentBlocks` дня 12. В предыдущем V2-аудите был сигнал о ложном marker-match; автоматически не менять в рамках нового прохода. |
| `tour_brazil_dunes_13d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | legacy_inside_day | 5 | 6 | LINKED_EXISTING_LEGACY | Внутри `contentBlocks` дня 5; историческое исключение |
| `tour_brazil_south_12d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | legacy_inside_day | 4 | 5 | LINKED_EXISTING_LEGACY | Внутри `contentBlocks` дня 4; историческое исключение |
| `tour_source_iguacu_falls` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | legacy_inside_day | 2 | 3 | LINKED_EXISTING_LEGACY | Внутри `contentBlocks` дня 2; историческое исключение |

## 5. Как фиксировать новую найденную экскурсию

Для каждой новой самостоятельной экскурсии между днями добавить строку в таблицу раздела 4:

```text
Tour ID
Excursion ID
Положение = between_days
После дня = N
Перед днем = N+1
Статус
Примечание
```

Статусы связи:

- `LINKED_EXISTING` — связь уже реально есть в production;
- `MATCHED_TO_INSERT` — каноническая Excursion найдена, позиция определена, production-связь еще не внесена;
- `CREATED_FROM_TOUR` — отдельной канонической Excursion раньше не было; production-сущность создана непосредственно из standalone-блока тура и затем связана через `excursionRef`;
- `REVIEW` — неоднозначное сопоставление, которое пока не позволяет закрепить один `excursion_id`.

Если подходящей канонической сущности нет, нельзя оставлять слот без связи и нельзя ограничиваться резервированием ID. Нужно сразу создать production Excursion из самостоятельного блока тура, используя только подтвержденные данные блока. Отсутствующие цену, длительность, язык, состав услуг и другие факты не додумывать. Изображение нужно вынести в канонический `/media/excursions/{slug}/`, после чего локальную карточку тура заменить на `excursionRef` и обновить Google Sheets.

## 6. Обязательный рабочий цикл одного тура

1. Прочитать этот файл.
2. Если есть `IN_PROGRESS` — продолжить его.
3. Иначе взять первый `PENDING` по Sheet row.
4. Перед содержательным разбором поменять его статус здесь на `IN_PROGRESS`, чтобы параллельный/следующий чат не начал тот же тур.
5. Прочитать текущий production MD тура целиком.
6. Просмотреть последовательность `itinerary`.
7. Рассматривать только самостоятельные элементы между двумя пронумерованными днями.
8. Посчитать все самостоятельные itinerary-item без `day` между пронумерованными днями: `standalone_between_days = N`.
9. Для каждого элемента найти каноническую Excursion в основном Google Sheets / `src/content/excursions/`.
10. Если match надежный — записать существующий stable ID.
11. Если канонической Excursion нет — сразу создать production Excursion из данных standalone-блока тура; не выдумывать отсутствующие факты. Создать stable ID и URL, добавить строку в Google Sheets, вынести hero в канонический media-path и заменить карточку тура на `excursionRef`.
12. Проверить `mapped_relation_rows = N`, `production_excursion_refs = N` и `missing_slots = 0`.
13. Если самостоятельных элементов нет — это нормальный результат и статус `DONE_NO_RELATIONS`.
14. Если `missing_slots = 0` — поставить туру `DONE_MAPPING`.
15. После фактической замены локальных карточек на `excursionRef`, создания недостающих Excursion и успешного deploy — `DONE_LINKED`.
16. Обновить дату и commit.
17. Только после этого переходить к следующей строке.

## 7. Что делать при появлении новых уникализированных туров

Перед началом новой рабочей сессии быстро проверить Google Sheets на новые строки:

`Тип страницы = Тур` + `Статус = Уникализировано`.

Если такого Tour ID еще нет в разделе 3:

- добавить его в таблицу;
- поставить `PENDING`;
- не менять статусы уже обработанных туров;
- не пересобирать очередь с нуля.

## 8. Критерий продолжения после потери контекста

Новому чату достаточно прочитать этот файл и текущий `main`.

Он должен определить:

1. есть ли `IN_PROGRESS`;
2. если нет — какой первый `PENDING`;
3. какие relations уже зафиксированы;
4. какие туры имеют `DONE_*`.

После этого работа продолжается с этой точки. Повторный обход `DONE_*` запрещен без отдельного указания пользователя.
