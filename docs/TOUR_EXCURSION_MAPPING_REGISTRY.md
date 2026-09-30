# Ada Tours — реестр сопоставления туров и экскурсий

Версия: 1.0  
Дата старта: 2026-09-30  
Repo: `alexyakovlev79/adatours.ru`  
Ветка: `main`  
Базовый HEAD при создании реестра: `5f2a10064d6aad34718503337c62cf252af0c231`

## 0. Назначение

Этот файл — постоянная точка продолжения работы по связям `Tour ↔ Excursion`.

**Любой новый чат, продолжающий сопоставление экскурсий с турами, сначала читает этот файл и продолжает с текущего статуса. Нельзя начинать обход уникализированных туров заново.**

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

Связь с канонической Excursion создается/фиксируется только тогда, когда самостоятельная экскурсия стоит **отдельным элементом маршрута между двумя пронумерованными днями**.

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
- `DONE_RELATIONS` — тур полностью просмотрен, найдены и зафиксированы связи;
- `DONE_NO_RELATIONS` — тур полностью просмотрен, подходящих самостоятельных экскурсий между днями нет;
- `REVIEW` — есть неоднозначность, которую нельзя безопасно решить автоматически.

### Правило зависшего чата

Если следующий чат видит `IN_PROGRESS`, он **сначала продолжает именно этот тур**, а не берет следующий `PENDING`.

Если `IN_PROGRESS` нет, брать первый `PENDING` по возрастанию строки Google Sheets.

После полного разбора тура статус обязательно меняется на `DONE_RELATIONS` или `DONE_NO_RELATIONS`.

## 3. Очередь уникализированных туров

На момент создания реестра в Google Sheets найдено **16** туров со статусом `Уникализировано`.

Важно: существующая связь с «Парком птиц» не означает, что тур уже полностью просмотрен на **все остальные экскурсии**. Поэтому на старте полный scan-status всех 16 туров = `PENDING`.

| Sheet row | Tour ID | Production file | Тур | Scan status | Найденные ранее связи | Последнее обновление |
|---:|---|---|---|---|---:|---|
| 75 | `tour_luxury_brazil_11d` | `src/content/tours/luxury-brazil-11d.md` | Роскошная Бразилия | PENDING | 1 | 2026-09-30 |
| 76 | `tour_brazil_argentina_peru_14d` | `src/content/tours/brazil-argentina-peru-14d.md` | Бразилия, Аргентина и Перу за 14 дней | PENDING | 0 | 2026-09-30 |
| 77 | `tour_peru_8d` | `src/content/tours/peru-8d.md` | Перу за 8 дней: Лима, Куско, Мачу-Пикчу и Титикака | PENDING | 0 | 2026-09-30 |
| 78 | `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `src/content/tours/brazil-sao-paulo-rio-ilha-paraty-12d.md` | Бразилия за 12 дней: Сан-Паулу, Игуасу, Рио, Илья-Гранди и Парати | PENDING | 1 | 2026-09-30 |
| 79 | `tour_brazil_adventure_17d` | `src/content/tours/brazil-adventure-17d.md` | Большое приключение по Бразилии за 17 дней | PENDING | 1 | 2026-09-30 |
| 80 | `tour_brazil_pantanal_bonito_lencois_8d` | `src/content/tours/pantanal-bonito-lencois-8d.md` | Пантанал, Бонито и Ленсойс-Мараньенсес за 8 дней | PENDING | 0 | 2026-09-30 |
| 81 | `tour_brazil_recife_porto_noronha_10d` | `src/content/tours/brazil-northeast-recife-porto-noronha-10d.md` | Северо-восток Бразилии: Ресифи, Порту-ди-Галиньяш и Фернанду-ди-Норонья за 10 дней | PENDING | 0 | 2026-09-30 |
| 82 | `tour_brazil_gems_14d` | `src/content/tours/brazil-gems-14d.md` | Бразилия за 14 дней: Рио, Ору-Прету, Сальвадор, Прайя-ду-Форте и Игуасу | PENDING | 1 | 2026-09-30 |
| 83 | `tour_brazil_dunes_13d` | `src/content/tours/brazil-dunes-13d.md` | Бразилия за 13 дней: Рио, Игуасу, Ленсойс-Мараньенсес и Прайя-де-Пипа | PENDING | 1 | 2026-09-30 |
| 84 | `tour_argentina_brazil_pipa_11d` | `src/content/tours/argentina-brazil-pipa-11d.md` | Аргентина и Бразилия за 11 дней | PENDING | 0 | 2026-09-30 |
| 85 | `tour_brazil_south_12d` | `src/content/tours/south-brazil-12d.md` | Южная Бразилия за 12 дней: Рио, Игуасу, Грамаду, каньоны и Флорианополис | PENDING | 1 | 2026-09-30 |
| 286 | `tour_source_tur_v_surinam_dlya_nablyudeniya_za_pticami` | `src/content/tours/tur-v-surinam-dlya-nablyudeniya-za-pticami.md` | Орнитологический тур в Суринам на 8 дней | PENDING | 0 | 2026-09-30 |
| 344 | `tour_source_amazon_clipper_cruise_traditional_3_days_2_nights` | `src/content/tours/amazon-clipper-cruise-traditional-3-days-2-nights.md` | Amazon Clipper Cruise | PENDING | 0 | 2026-09-30 |
| 410 | `tour_source_iguacu_falls` | `src/content/tours/iguacu-falls.md` | Свадебная церемония у водопадов Игуасу | PENDING | 1 | 2026-09-30 |
| 411 | `tour_source_rio_de_janeiro_wedding` | `src/content/tours/rio-de-janeiro-wedding.md` | Свадебная церемония на пляже в Рио-де-Жанейро | PENDING | 0 | 2026-09-30 |
| 416 | `tour_source_wedding_ceremony_tropical_package` | `src/content/tours/wedding-ceremony-tropical-package.md` | Тропическая свадебная церемония | PENDING | 0 | 2026-09-30 |

**Следующий тур для полного прохода:** строка **75**, `tour_luxury_brazil_11d`.

## 4. Уже существующие Tour↔Excursion связи

| Tour ID | Excursion ID | Положение | После дня | Перед днем | Статус | Примечание |
|---|---|---|---:|---:|---|---|
| `tour_luxury_brazil_11d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 6 | 7 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 3 | 4 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_adventure_17d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 7 | 8 | LINKED_EXISTING | Каноническая standalone-связь |
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
- `NEEDS_EXCURSION_ENTITY` — самостоятельная экскурсия между днями есть, но каноническая Excursion пока не найдена;
- `REVIEW` — неоднозначное сопоставление.

Не придумывать новый Excursion ID, если подходящей канонической сущности нет.

## 6. Обязательный рабочий цикл одного тура

1. Прочитать этот файл.
2. Если есть `IN_PROGRESS` — продолжить его.
3. Иначе взять первый `PENDING` по Sheet row.
4. Перед содержательным разбором поменять его статус здесь на `IN_PROGRESS`, чтобы параллельный/следующий чат не начал тот же тур.
5. Прочитать текущий production MD тура целиком.
6. Просмотреть последовательность `itinerary`.
7. Рассматривать только самостоятельные элементы между двумя пронумерованными днями.
8. Для каждого такого элемента попытаться найти каноническую сущность в `src/content/excursions/`.
9. Если match надежный — добавить relation в раздел 4 и внести production-связь по принятой архитектуре.
10. Если канонической Excursion нет — записать `NEEDS_EXCURSION_ENTITY`.
11. Если подходящих элементов нет — это нормальный результат.
12. После завершения поставить туру `DONE_RELATIONS` или `DONE_NO_RELATIONS`.
13. Обновить дату и, если были GitHub-изменения, зафиксировать актуальный commit.
14. Только после этого переходить к следующей строке.

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
