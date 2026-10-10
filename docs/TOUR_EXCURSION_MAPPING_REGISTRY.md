# Ada Tours — реестр сопоставления туров и экскурсий

Версия: 1.50
Дата старта: 2026-09-30  
Repo: `alexyakovlev79/adatours.ru`  
Ветка: `main`  
Базовый HEAD при создании реестра: `5f2a10064d6aad34718503337c62cf252af0c231`

## 0. Назначение

Этот реестр хранит результаты уже выполненного сопоставления Tour ↔ Excursion. Он читается при отдельной задаче продолжения миграции или для точного существующего tour ID. Добавление места или известной экскурсии не читает и не меняет этот реестр.

Действующая методика: `docs/workflows/tour-excursion-linking.md`; общий процесс: `docs/workflows/master.md`. Старые записи ниже сохраняют историю, но не назначают дополнительные проверки, поиск источников, отдельные служебные commits или создание мест.

Основной реестр страниц:
`Ada Tours — реестр страниц нового сайта`  
Google Sheet: `1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc`  
Лист: `Страницы`

Production tours:
`src/content/tours/`

Production excursions:
`src/content/excursions/`

### 0.1. Связь Excursion → Destination и карточка места

Карточка места на всех страницах Excursion строится автоматически в общем `ExcursionLayout.astro`.

Правила:

- `destination` в Excursion хранит стабильный ID места;
- если соответствующая Destination уже существует, название, `summary`, `hero` и ссылка берутся только из канонической Destination;
- фото и описание места в Excursion вручную не дублировать;
- URL карточки строится через `countryId` самой Destination, а не через `country` Excursion;
- если Destination еще не создана, в Excursion указывать `destinationName` как fallback-название места;
- при отсутствующей Destination показывается только `destinationName` в поле «Место», без фотографии и описания;
- после появления Destination с тем же `destination` полный блок места появляется автоматически, без правок Excursion;
- при существующей Destination ее `name` имеет приоритет над `destinationName`.

Для новой Excursion, у которой место еще не создано:

```yaml
destination: destination_country_place
destinationName: "Название места"
```

Если Destination уже существует, `destinationName` можно не указывать.

## 1. Правило сопоставления

Текущий рабочий проход идет **по уникализированным турам**, сверху вниз по строкам Google Sheets, но перед продолжением обычной очереди нужно закрывать известные случаи старой архитектуры `legacy_inside_day`.

### 1.1. Два источника самостоятельных Excursion

Самостоятельная экскурсия может быть:

1. уже оформлена отдельным itinerary-item без `day` между двумя numbered days;
2. ошибочно встроена внутрь numbered day как самостоятельный экскурсионный модуль.

Второй случай **нельзя игнорировать**.

Сильные признаки встроенной самостоятельной Excursion:

- `type: excursion`;
- отдельный подзаголовок/секция с собственным названием и описанием;
- текст прямо перечисляет отдельные экскурсии: «вас ждут еще 2 экскурсии…»;
- существует отдельная source/production Excursion;
- у активности самостоятельный продуктовый scope: собственный маршрут, механика, длительность, цена, hero или отдельный набор фактов;
- V2/original подтверждает, что это самостоятельная экскурсия.

### 1.2. Нормализация embedded Excursion

Если такая экскурсия находится внутри numbered day:

1. найти или создать каноническую Excursion;
2. удалить из дня ее дублирующие title/text/photo;
3. удалить ставшую лишней фразу-перечисление;
4. поставить отдельный `excursionRef` сразу после этого дня и до следующего numbered day;
5. сохранить исходный порядок нескольких экскурсий;
6. карточка должна получать title/body/hero только из canonical Excursion.

Пример:

```text
БЫЛО:
День 4
  водопады
  Парк птиц
  Макуко-сафари
День 5

СТАЛО:
День 4
  только программа водопадов
→ Парк птиц / excursionRef
→ Макуко-сафари / excursionRef
День 5
```

### 1.3. Что действительно игнорировать

Не создавать relation только из-за обычного проходного упоминания:

- одно упоминание названия без самостоятельного модуля;
- неотделимая часть основной программы дня;
- highlights;
- included / notIncluded;
- notes / FAQ;
- цена;
- alt / caption;
- обычный абзац без самостоятельного продуктового scope.

**Нахождение внутри `contentBlocks` само по себе больше не является основанием игнорировать экскурсию.**

### 1.4. Инварианты

До нормализации:

```text
existing_between_days = A
embedded_excursion_modules = B
```

После нормализации:

```text
standalone_between_days = N
N = A + B
mapped_relation_rows = N
production_excursion_refs = N
remaining_local_standalone_cards = 0
remaining_embedded_excursion_modules = 0
duplicate_excursion_text_inside_days = 0
missing_excursion_entities = 0
```

Тур нельзя считать полностью закрытым, пока любой из этих инвариантов нарушен.

Если подходящая каноническая Excursion уже есть — использовать ее stable ID. Если отдельной Excursion раньше не существовало, нужно **сразу создать новую production Excursion** из подтвержденного источника/блока, не додумывать отсутствующие факты, использовать подтвержденный raw source URL вида `https://brasiltours.ru/image/...`, добавить страницу в основной Google Sheets и использовать `excursionRef`. Локальный enhanced WebP создается позже отдельным photo-enhancement workflow.

### 1.5. Старые `legacy_inside_day`

После workflow v1.2 это **не допустимое постоянное состояние и не историческое исключение**.

Любая relation со статусом/положением `legacy_inside_day` означает технический долг: соответствующий тур нужно повторно нормализовать по v1.2. Уже существующую каноническую Excursion не пересоздавать; нужно только извлечь ее из numbered day и удалить дублирующий day content.

---

## 2. Статусы обхода тура

Использовать только эти значения:

- `PENDING` — полный проход по экскурсиям этого тура еще не делался;
- `IN_PROGRESS` — чат начал этот тур, но не завершил;
- `DONE_MAPPING` — тур полностью просмотрен; для каждого самостоятельного блока между днями уже существует production Excursion и определен ее `excursion_id`, но не все локальные карточки еще заменены на `excursionRef`; `missing_slots = 0`;
- `DONE_LINKED` — все найденные связи уже реализованы в production через `excursionRef` и прошли build/deploy;
- `DONE_NO_RELATIONS` — тур полностью просмотрен по workflow v1.2: нет ни самостоятельных блоков между днями, ни самостоятельных excursion-модулей внутри numbered days;
- `REVIEW` — есть неоднозначность, которую нельзя безопасно решить автоматически.

### Правило зависшего чата

Если следующий чат видит `IN_PROGRESS`, он **сначала продолжает именно этот тур**, а не берет следующий `PENDING`.

Если `IN_PROGRESS` нет, брать первый `PENDING` по возрастанию строки Google Sheets.

После полного разбора тура статус меняется на `DONE_MAPPING` или `DONE_NO_RELATIONS`. После фактической реализации всех `excursionRef` и успешного deploy — на `DONE_LINKED`.

## 3. Очередь уникализированных туров

В текущем реестре учтено **35** тур со статусом `Уникализировано`.

Важно: существующая связь с «Парком птиц» не означает, что тур уже полностью просмотрен на **все остальные экскурсии**. Поэтому на старте полный scan-status всех 16 туров = `PENDING`.

| Sheet row | Tour ID | Production file | Тур | Scan status | Найденные ранее связи | Последнее обновление |
|---:|---|---|---|---|---:|---|
| 75 | `tour_luxury_brazil_11d` | `src/content/tours/luxury-brazil-11d.md` | Роскошная Бразилия | DONE_LINKED | 10 | 2026-10-01 |
| 76 | `tour_brazil_argentina_peru_14d` | `src/content/tours/brazil-argentina-peru-14d.md` | Бразилия, Аргентина и Перу за 14 дней | DONE_LINKED | 1 | 2026-10-01 |
| 77 | `tour_peru_8d` | `src/content/tours/peru-8d.md` | Перу за 8 дней: Лима, Куско, Мачу-Пикчу и Титикака | DONE_LINKED | 7 | 2026-10-01 |
| 78 | `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `src/content/tours/brazil-sao-paulo-rio-ilha-paraty-12d.md` | Бразилия за 12 дней: Сан-Паулу, Игуасу, Рио, Илья-Гранди и Парати | DONE_LINKED | 3 | 2026-10-01 |
| 79 | `tour_brazil_adventure_17d` | `src/content/tours/brazil-adventure-17d.md` | Большое приключение по Бразилии за 17 дней | DONE_LINKED | 3 | 2026-10-01 |
| 80 | `tour_brazil_pantanal_bonito_lencois_8d` | `src/content/tours/pantanal-bonito-lencois-8d.md` | Пантанал, Бонито и Ленсойс-Мараньенсес за 8 дней | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 81 | `tour_brazil_recife_porto_noronha_10d` | `src/content/tours/brazil-northeast-recife-porto-noronha-10d.md` | Северо-восток Бразилии: Ресифи, Порту-ди-Галиньяш и Фернанду-ди-Норонья за 10 дней | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 82 | `tour_brazil_gems_14d` | `src/content/tours/brazil-gems-14d.md` | Бразилия за 14 дней: Рио, Ору-Прету, Сальвадор, Прайя-ду-Форте и Игуасу | DONE_LINKED | 2 | 2026-10-01 |
| 83 | `tour_brazil_dunes_13d` | `src/content/tours/brazil-dunes-13d.md` | Бразилия за 13 дней: Рио, Игуасу, Ленсойс-Мараньенсес и Прайя-де-Пипа | DONE_LINKED | 2 | 2026-10-01 |
| 84 | `tour_argentina_brazil_pipa_11d` | `src/content/tours/argentina-brazil-pipa-11d.md` | Аргентина и Бразилия за 11 дней | DONE_LINKED | 4 | 2026-10-01 |
| 85 | `tour_brazil_south_12d` | `src/content/tours/south-brazil-12d.md` | Южная Бразилия за 12 дней: Рио, Игуасу, Грамаду, каньоны и Флорианополис | DONE_LINKED | 3 | 2026-10-01 |
| 286 | `tour_source_tur_v_surinam_dlya_nablyudeniya_za_pticami` | `src/content/tours/tur-v-surinam-dlya-nablyudeniya-za-pticami.md` | Орнитологический тур в Суринам на 8 дней | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 291 | `tour_source_buenos_ajres_salta_iguasu` | `src/content/tours/buenos-ajres-salta-iguasu.md` | Буэнос-Айрес, Сальта и Игуасу | DONE_LINKED | 3 | 2026-10-02 |
| 292 | `tour_source_vinnyj_tur_v_argentinu_i_chili` | `src/content/tours/vinnyj-tur-v-argentinu-i-chili.md` | Тур в Чили и Аргентину с винным регионом Мендоса на 9 дней | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 293 | `tour_source_argentina_and_south_patagonia_in_the_footsteps_of_darwin` | `src/content/tours/argentina-and-south-patagonia-in-the-footsteps-of-darwin.md` | Восхождение на Аконкагуа 6962 м | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 294 | `tour_source_kongress_v_argentine` | `src/content/tours/kongress-v-argentine.md` | Корпоративный тур в Аргентину: Буэнос-Айрес и Тигре за 5 дней | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 295 | `tour_source_kruiz_mys_gorn_i_antarktida` | `src/content/tours/kruiz-mys-gorn-i-antarktida.md` | Круиз через мыс Горн и пролив Дрейка в Антарктиду | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 296 | `tour_source_patagoniya_i_chilijskie_fordy` | `src/content/tours/patagoniya-i-chilijskie-fordy.md` | Патагония и Чилийские фьорды | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 297 | `tour_source_programma_dlya_aktivnykh_lyudej` | `src/content/tours/programma-dlya-aktivnykh-lyudej.md` | Аргентина, Патагония, Сантьяго и остров Пасхи за 12 дней | DONE_LINKED | 1 | 2026-10-02 |
| 298 | `tour_source_prostory_patagonii_chili_i_argentina_v_odnom_puteshestvii` | `src/content/tours/prostory-patagonii-chili-i-argentina-v-odnom-puteshestvii.md` | Просторы Патагонии: Чили и Аргентина за 8 дней | DONE_LINKED | 2 | 2026-10-02 |
| 299 | `tour_source_rybalka_v_ushuajya` | `src/content/tours/rybalka-v-ushuajya.md` | Рыбалка в Ушуайе: поездка в Пуэрто-Альмансу и ловля королевского краба | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 300 | `tour_source_aconcagua_trek_ru` | `src/content/tours/aconcagua-trek-ru.md` | Треккинг на Аконкагуа: экспедиция на 18 дней | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 301 | `tour_source_antarktida_ekspress_vozdushnyj_kruiz` | `src/content/tours/antarktida-ekspress-vozdushnyj-kruiz.md` | Антарктида Экспресс: Ушуайя, мыс Горн и Антарктида за 6 дней | DONE_NO_RELATIONS | 0 | 2026-10-02 |
| 302 | `tour_source_vsya_argentina` | `src/content/tours/vsya-argentina.md` | Тур в Аргентину и Патагонию на 26 дней | DONE_LINKED | 5 | 2026-10-02 |
| 303 | `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `src/content/tours/lyuksovyj-tur-v-argentinu-s-buehnos-ajres-patagoniya-iguasu-na-11-dnej.md` | Аргентина Deluxe за 11 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу | DONE_LINKED | 8 | 2026-10-02 |
| 304 | `tour_source_argentina_dlya_degustatorov_khoroshej_zhizni` | `src/content/tours/argentina-dlya-degustatorov-khoroshej-zhizni.md` | Аргентина для ценителей вина, кухни и красивой жизни | DONE_LINKED | 1 | 2026-10-02 |
| 305 | `tour_source_tur_v_argentinu_na_dikuyu_prirodu` | `src/content/tours/tur-v-argentinu-na-dikuyu-prirodu.md` | Эко-тур по Аргентине на 9 дней: киты Пуэрто-Мадрина и заповедник Ибера | DONE_LINKED | 2 | 2026-10-02 |
| 306 | `tour_source_tur_v_argentinu_na_11dnej` | `src/content/tours/tur-v-argentinu-na-11dnej.md` | VIP-тур по Аргентине на 11 дней: Патагония, Ушуайя и водопады Игуасу | DONE_LINKED | 8 | 2026-10-02 |
| 307 | `tour_source_neveroyatnaya_argentina` | `src/content/tours/neveroyatnaya-argentina.md` | Невероятная Аргентина: Буэнос-Айрес, Ушуайя, Эль-Калафате и Игуасу за 13 дней | DONE_LINKED | 5 | 2026-10-02 |
| 308 | `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `src/content/tours/argentina-buenos-ajres-kalafate-iguasu.md` | Тур в Аргентину на 10 дней: Буэнос-Айрес, Патагония и Игуасу | DONE_LINKED | 9 | 2026-10-02 |
| 309 | `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `src/content/tours/argentina-buenos-ajres-kalafate-ushuaja-iguasu.md` | Тур в Аргентину на 12 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу | DONE_LINKED | 10 | 2026-10-02 |
| 310 | `tour_source_argentina_ot_lda_k_vodopadam` | `src/content/tours/argentina-ot-lda-k-vodopadam.md` | Аргентина: Буэнос-Айрес, ледник Перито-Морено и водопады Игуасу | DONE_LINKED | 5 | 2026-10-02 |
| 344 | `tour_source_amazon_clipper_cruise_traditional_3_days_2_nights` | `src/content/tours/amazon-clipper-cruise-traditional-3-days-2-nights.md` | Amazon Clipper Cruise | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 410 | `tour_source_iguacu_falls` | `src/content/tours/iguacu-falls.md` | Свадебная церемония у водопадов Игуасу | DONE_LINKED | 1 | 2026-10-01 |
| 411 | `tour_source_rio_de_janeiro_wedding` | `src/content/tours/rio-de-janeiro-wedding.md` | Свадебная церемония на пляже в Рио-де-Жанейро | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 416 | `tour_source_wedding_ceremony_tropical_package` | `src/content/tours/wedding-ceremony-tropical-package.md` | Тропическая свадебная церемония | DONE_NO_RELATIONS | 0 | 2026-10-01 |

**Исторический курсор:** результаты ниже сохранены; текущая задача выбирается по `docs/workflows/tour-excursion-linking.md`.

### Проверка v1.2 — строка 309, 2026-10-02

- **Строка 309 / `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu`:** опубликован 12-дневный индивидуальный тур «Тур в Аргентину на 12 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу» из V2 + original. Основная программа numbered days сохранена внутри дней: обзорный Буэнос-Айрес, Перито-Морено, Национальный парк «Тьерра-дель-Фуего», перелеты и обе стороны Игуасу. Извлечены 10 самостоятельных модулей: после дня 2 — `excursion_source_tango_shou_v_buenos_ajrese`; после дня 3 — Тигре, Монтевидео из Буэнос-Айреса и `excursion_source_fiesta_gaucho`; после дня 5 — `excursion_el_calafate_ice_trekking_perito_moreno`; после дня 7 — `excursion_ushuaia_martillo_penguin_boat`; после дня 9 — `excursion_iguazu_gran_aventura` и альтернативная `excursion_source_makuko_safari`; после дня 10 — Парк птиц и `excursion_iguazu_helicopter_falls`. Все 10 канонических Excursion уже существовали в production, новые сущности не создавались. Цены самостоятельных опций из source сохранены в блоке «Не включено»: Тигре $100, Монтевидео $500/$850, Fiesta Gaucho $320, ледовый треккинг $500, остров Мартильо $300, Gran Aventura $100, Парк птиц $50, вертолет $170. Инварианты: `standalone_excursion_modules = 10`, `production_excursion_refs = 10`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. В production-туре 12 numbered days, cache-WebP отсутствуют, hero и day media используют подтвержденные raw source images. Build/deploy commit `fec5ec6ae4939cc7c272e57939a971177d626c25` завершен успешно. Итог: `DONE_LINKED`.

### Проверка v1.2 — строка 308, 2026-10-02

- **Строка 308 / `tour_source_argentina_buenos_ajres_kalafate_iguasu`:** опубликован 10-дневный индивидуальный тур «Тур в Аргентину на 10 дней: Буэнос-Айрес, Патагония и Игуасу» из V2 + original. Основная программа numbered days сохранена внутри дней: обзорный Буэнос-Айрес, Перито-Морено, перелеты и обе стороны Игуасу. Извлечены 9 самостоятельных модулей: после дня 2 — `excursion_source_tango_shou_v_buenos_ajrese`; после дня 3 — Тигре, Монтевидео из Буэнос-Айреса и `excursion_source_fiesta_gaucho`; после дня 5 — новая `excursion_el_calafate_ice_trekking_perito_moreno`; после дня 7 — `excursion_iguazu_gran_aventura` и альтернативная `excursion_source_makuko_safari`; после дня 8 — Парк птиц и `excursion_iguazu_helicopter_falls`. Цены самостоятельных опций из source сохранены в блоке «Не включено»: Тигре $100, Монтевидео $500/$850, Fiesta Gaucho $320, ледовый треккинг $500, Gran Aventura $100, Парк птиц $50, вертолет $170. Для нового ледового треккинга создана отдельная production Excursion только из подтвержденных данных source; отсутствующие длительность и язык не додумывались. Инварианты: `standalone_excursion_modules = 9`, `production_excursion_refs = 9`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. В production-туре 10 numbered days, cache-WebP отсутствуют, hero и day media используют подтвержденные raw source images. Build/deploy commit `d8b2e1f4d41cd7ed5a37528397ca0a73c21631a6` завершен успешно. Итог: `DONE_LINKED`.

### Проверка v1.2 — строка 307, 2026-10-02

- **Строка 307 / `tour_source_neveroyatnaya_argentina`:** опубликован 13-дневный тур «Невероятная Аргентина: Буэнос-Айрес, Ушуайя, Эль-Калафате и Игуасу за 13 дней» из V2 + original. Сохранены 13 numbered days и исходная последовательность маршрута. Самостоятельные модули извлечены из numbered days и оформлены через 5 canonical `excursionRef`: после дня 2 — существующая `excursion_buenos_aires_tango_show_dinner_transfer`; после дня 3 — новая `excursion_ushuaia_laguna_esmeralda_trekking`; после дня 8 — новые `excursion_el_calafate_glaciares_gourmet` и `excursion_el_calafate_todo_glaciares`; после дня 10 — новая `excursion_iguazu_gran_aventura`. Национальный парк Тьерра-дель-Фуэго + канал Бигль, оффроуд к озерам, Перито-Морено + «Водное сафари» и обе основные стороны Игуасу сохранены внутри numbered days как основная программа. Destination completeness по уже опубликованным каноническим Destination: `destination_argentina_buenos_aires`, `destination_argentina_el_calafate`, `destination_brazil_iguacu`; запланированные, но еще не опубликованные Ушуайя и Пуэрто-Игуасу в `Tour.destinations` не добавлялись. Инварианты: `standalone_excursion_modules = 5`, `production_excursion_refs = 5`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. В itinerary нет cache-WebP; для обычных дней использованы raw source images из точного media mapping. Build/deploy commit `3eeb97c1b28646ce6aa696c9cfff22338b91d377` завершен успешно. Итог: `DONE_LINKED`.

### Проверка v1.2 — строка 306, 2026-10-02

- **Строка 306 / `tour_source_tur_v_argentinu_na_11dnej`:** опубликован 11-дневный VIP-тур «VIP-тур по Аргентине на 11 дней: Патагония, Ушуайя и водопады Игуасу» из V2 + original. Основная программа numbered days сохранена внутри дней: обзорный Буэнос-Айрес, Перито-Морено, Tierra del Fuego и обе стороны Игуасу. Извлечены 8 самостоятельных модулей: после дня 2 — `excursion_buenos_aires_tango_show_dinner_transfer`; после дня 3 — Тигре, Fiesta Gaucho и Колония-дель-Сакраменто; после дня 7 — `excursion_ushuaia_martillo_penguin_boat`; после дня 9 — Macuco Safari, Парк птиц и `excursion_iguazu_helicopter_falls`. Опциональный ледовый треккинг по Перито-Морено оставлен вариантом основной экскурсии дня 5, поскольку V2 не оформляет его отдельным самостоятельным продуктовым блоком. 7 канонических Excursion уже существовали в production. Для вечернего танго-шоу создана отдельная `excursion_buenos_aires_tango_show_dinner_transfer`, потому что в этом туре подтвержден включенный трансфер, а существующая `excursion_buenos_aires_tango_show_dinner` имеет другой состав услуг. Инварианты: `standalone_excursion_modules = 8`, `production_excursion_refs = 8`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Build/deploy commit `7cf41c1370829c9863317ba1f55162984c0d269d` завершен успешно. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 305, 2026-10-02

- **Строка 305 / `tour_source_tur_v_argentinu_na_dikuyu_prirodu`:** опубликован 9-дневный эко-тур «Эко-тур по Аргентине на 9 дней: киты Пуэрто-Мадрина и заповедник Ибера» из V2 + original. Основная программа numbered days сохранена внутри дней: обзорный Буэнос-Айрес, ранчо гаучо «Дон Сильвано», наблюдение за китами у Эль-Дорадильо, полуостров Вальдес и базовая программа Ibera Lodge. Извлечены 2 самостоятельных дополнительных модуля: после дня 2 вечернее танго-шоу с ужином без гида связано с существующей `excursion_buenos_aires_tango_show_dinner`; после дня 6 optional-блок «прогулка по реке Корриентес или рыбалка на дорадо» вынесен в новую каноническую `excursion_ibera_corrientes_river_or_dorado_fishing`, созданную без выдуманной цены, длительности или языка. Source hero существовал только в cache, поэтому использован подтвержденный raw image `https://brasiltours.ru/image/ibera-wetlands-argentina.png` с той же source page. Инварианты: `production_excursion_refs = 2`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 304, 2026-10-02

- **Строка 304 / `tour_source_argentina_dlya_degustatorov_khoroshej_zhizni`:** опубликован 7-дневный тур «Аргентина для ценителей вина, кухни и красивой жизни» из V2 + original. Основная обзорная экскурсия по Буэнос-Айресу, «Фиеста Гаучо» и групповой винный тур в Мендосе сохранены внутри numbered days как основная программа дней 2, 3 и 5. Отдельным дополнительным модулем после основной программы дня 2 является вечернее танго-шоу с ужином, без гида; оно извлечено из day text и связано с точной канонической `excursion_buenos_aires_tango_show_dinner`, где также зафиксированы ужин, аргентинские вина и отсутствие услуг гида. Опциональные активности Мендосы в дни 4 и 6 остаются частью текста свободного/настраиваемого дня и не превращены в самостоятельные карточки. Инварианты: `production_excursion_refs = 1`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 303, 2026-10-02

- **Строка 303 / `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej`:** опубликован 11-дневный индивидуальный Deluxe-тур из V2 + original. Основная программа numbered days сохранена внутри дней: обзорный Буэнос-Айрес, Перито-Морено, Tierra del Fuego и обе стороны Игуасу. Извлечено 8 самостоятельных модулей: после дня 2 — новый `excursion_buenos_aires_gala_tango_dinner_transfer`; после дня 3 — существующие Тигре, Fiesta Gaucha и Колония-дель-Сакраменто из Буэнос-Айреса; после дня 7 — новый `excursion_ushuaia_martillo_penguin_boat`; после дня 9 — существующие Macuco Safari и Парк птиц плюс новый `excursion_iguazu_helicopter_falls`. Опциональный треккинг по Перито-Морено оставлен как вариант основной экскурсии дня 5: V2 не оформляет его самостоятельной карточкой/секцией с отдельным продуктовым scope. Новые сущности не объединены с похожими, но отличающимися продуктами: Gala Tango имеет ужин+трансфер и цену шоу «по запросу»; Мартильо — морская навигация, а не `excursion_ushuaia_penguin_walk`; вертолет Игуасу не объединен с полетом над Рио. Инварианты: `production_excursion_refs = 8`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 302, 2026-10-02

- **Строка 302 / `tour_source_vsya_argentina`:** опубликован 26-дневный тур «Тур в Аргентину и Патагонию на 26 дней» из V2 + original. В numbered days оставлена основная программа: обзорные и природные экскурсии, винодельни, Монтевидео, Перито-Морено, Торрес-дель-Пайне, Барилоче, поездка 4x4 и Тьерра-дель-Фуэго. Извлечены 5 самостоятельных модулей: после дня 2 — `excursion_buenos_aires_tango_show_dinner`; после дня 5 — `excursion_source_makuko_safari` и `excursion_source_park_jekzoticheskih_ptic_v_iguasu`; после дня 21 — новая `excursion_el_chalten_kayaking`; после дня 23 — новая `excursion_ushuaia_penguin_walk`. Две новые сущности созданы строго из подтвержденных данных V2: каякинг — от $300 за человека без выдуманных длительности/языка/состава, прогулка с пингвинами — $350 с человека, групповой формат и англоязычный гид. Инварианты: `production_excursion_refs = 5`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 301, 2026-10-02

- **Строка 301 / `tour_source_antarktida_ekspress_vozdushnyj_kruiz`:** опубликован 6-дневный тур «Антарктида Экспресс: Ушуайя, мыс Горн и Антарктида за 6 дней» из V2 + original. Это отдельный продукт, а не дубль `tour_source_kruiz_mys_gorn_i_antarktida`: у текущей программы цена $6595, а ключевая особенность — после острова Кинг-Джордж предусмотрен перелет в Пунта-Аренас, что исключает обратный морской переход через пролив Дрейка. Zodiac-высадки, береговые выходы и наблюдение за дикой природой являются основной программой numbered days; отдельных standalone Excursion между днями нет. Source hero существовал только в cache, поэтому использован подтвержденный raw content image `https://brasiltours.ru/image/Antarc%20Adatours.png` с той же source page. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

### Проверка v1.1 — строка 300, 2026-10-02

- **Строка 300 / `tour_source_aconcagua_trek_ru`:** опубликована отдельная 18-дневная экспедиция «Треккинг на Аконкагуа: экспедиция на 18 дней» из V2 + original. Это не дубль ранее добавленной 20-дневной программы `tour_source_argentina_and_south_patagonia_in_the_footsteps_of_darwin`: отличаются source URL, продолжительность (18 против 20 дней), программа акклиматизации, даты экспедиций и цена ($10135 против $5870). Объединять сущности нельзя. Комбинированный source-блок «Дни 14–15» нормализован в 2 numbered days, поэтому production содержит ровно 18 дней. Все переходы, переносы снаряжения, высотные лагеря и выход на вершину являются основной программой экспедиции; standalone Excursion отсутствуют. Source hero был только cache, поэтому использован подтвержденный raw content image вершины Аконкагуа с той же source page. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

### Проверка v1.1 — строка 299, 2026-10-02

- **Строка 299 / `tour_source_rybalka_v_ushuajya`:** опубликована однодневная 8-часовая программа «Рыбалка в Ушуайе: поездка в Пуэрто-Альмансу и ловля королевского краба» из V2 + original. Source page классифицирована как `tour_detail`; весь маршрут Ушуайя — озеро Виктория — Пуэрто-Альманса, 25-минутный выход на лодке, сбор королевского краба и обед являются единым продуктом, а не дополнительными standalone Excursion. В исходнике нет numbered days и отдельных дополнительных карточек, поэтому production `itinerary = []`, а содержательная программа сохранена в body страницы. Hero cache не переносился: использован подтвержденный raw content image `https://brasiltours.ru/image/ushuaia.png` из `IMAGES_MASTER.csv` этой же source page. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

### Проверка v1.1 — строка 298, 2026-10-02

- **Строка 298 / `tour_source_prostory_patagonii_chili_i_argentina_v_odnom_puteshestvii`:** опубликован 8-дневный тур «Просторы Патагонии: Чили и Аргентина за 8 дней» из V2 + original. Основные программы дней — обзорный Буэнос-Айрес, Перито-Морено, Торрес-дель-Пайне и обзорный Сантьяго — сохранены внутри numbered days. Извлечены 2 самостоятельных вечерних модуля: после дня 2 танго-шоу с ужином связано с существующей `excursion_source_tango_shou_v_buenos_ajrese`; после дня 3 Nativo Experience вынесен в новую каноническую `excursion_el_calafate_nativo_experience`, созданную из утвержденного блока тура, поскольку отдельной source excursion_detail не найдено. Инварианты: `production_excursion_refs = 2`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 297, 2026-10-02

- **Строка 297 / `tour_source_programma_dlya_aktivnykh_lyudej`:** опубликован 12-дневный тур «Аргентина, Патагония, Сантьяго и остров Пасхи за 12 дней» из V2 + original. Основные экскурсионные программы соответствующих numbered days сохранены внутри дней, как в уже нормализованных турах: обзорный Буэнос-Айрес, винная долина/треккинг вокруг Сантьяго, Торрес-дель-Пайне, ледник Грей, обзорный Сантьяго и программы Рапа-Нуи являются основной программой дня, а не отдельными дополнительными вставками. Единственный самостоятельный дополнительный модуль — вечернее танго-шоу с ужином после основной программы дня 2. Он извлечен из текста дня и поставлен отдельным `excursionRef: excursion_source_tango_shou_v_buenos_ajrese` между днями 2 и 3. Инварианты: `production_excursion_refs = 1`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 296, 2026-10-02

- **Строка 296 / `tour_source_patagoniya_i_chilijskie_fordy`:** опубликован 9-дневный экспедиционный круиз «Патагония и Чилийские фьорды» из V2 + original. Маршрут проходит от Пуэрто-Монта через фьорды региона Айсен, национальный парк Сан-Рафаэль, залив Пеньяс, Калета Тортель, канал Мессье, национальный парк Бернардо О’Хиггинс, пролив Магеллана, Огненную Землю и пролив Бигль к Ушуайе. Высадки, выходы на лодках «Зодиак», ледники и наблюдение за животными являются основной программой numbered days; отдельных standalone Excursion между днями и embedded excursion-модулей нет. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

### Проверка v1.1 — строка 295, 2026-10-02

- **Строка 295 / `tour_source_kruiz_mys_gorn_i_antarktida`:** опубликован 6-дневный экспедиционный круиз «Круиз через мыс Горн и пролив Дрейка в Антарктиду» из V2 + original. Маршрут проходит через Ушуайю, Пуэрто-Вильямс, мыс Горн, пролив Дрейка, Южные Шетландские острова, остров Кинг-Джордж и Пунта-Аренас. Высадки на лодках «Зодиак», наблюдение за природой, лекции на борту и береговые выходы являются основной программой numbered days и входят в scope круиза; отдельных standalone Excursion между днями нет. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

### Проверка v1.1 — строка 294, 2026-10-02

- **Строка 294 / `tour_source_kongress_v_argentine`:** опубликована 5-дневная корпоративная MICE-программа «Корпоративный тур в Аргентину: Буэнос-Айрес и Тигре за 5 дней». В numbered days есть обзорная экскурсия по Буэнос-Айресу, вечернее танго-шоу Michelangelo и поездка в дельту Тигре, однако они являются частью конкретных корпоративных дней: связаны с утренним конгрессом, собственными трансферами, ресторанами и индивидуальной логистикой. Source действительно содержит ссылки на отдельные generic Excursion, но scope программы отличается: городская экскурсия в туре длится 4 часа и включает расширенный маршрут, танго привязано к Michelangelo и частным трансферам, Тигре — к частной лодке, рынку и музею. Извлечение их в существующие generic `excursionRef` потеряло бы подтвержденные детали. Отдельных standalone-карточек/секций между днями нет. Итог: `DONE_NO_RELATIONS`, `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`.

### Проверка v1.1 — строка 293, 2026-10-02

- **Строка 293 / `tour_source_argentina_and_south_patagonia_in_the_footsteps_of_darwin`:** опубликована 20-дневная экспедиция «Восхождение на Аконкагуа 6962 м» из V2 + original. В исходнике дни 19–20 объединены одним резервным блоком; в production они нормализованы в 2 numbered days, поэтому `durationDays = 20` и число numbered days = 20. Самостоятельных дополнительных Excursion между днями и embedded excursion-модулей нет: переходы, акклиматизационные выходы, высотные лагеря и восхождение являются основной программой экспедиции. Инварианты: `production_excursion_refs = 0`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`. Итог: `DONE_NO_RELATIONS`.

### Проверка v1.1 — строки 291–292, 2026-10-02

- **Строка 292 / `tour_source_vinnyj_tur_v_argentinu_i_chili`:** полностью просмотрена production-программа. 9 numbered days, самостоятельных карточек между днями нет, `excursionRef = 0`, embedded excursion-модулей нет. Дополнительные варианты свободного дня в Мендосе перечислены как часть общего описания дня и не оформлены как самостоятельные продуктовые модули. Итог: `DONE_NO_RELATIONS`.
- **Строка 291 / `tour_source_buenos_ajres_salta_iguasu`:** после дня 3 подтверждены 3 самостоятельные дополнительные экскурсии. «Тигре и северная зона» связана с `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa`; «Фиеста гаучо на ранчо Санта-Сусана» — с существующей `excursion_source_fiesta_gaucho`; для поездки «Колония-дель-Сакраменто, Уругвай» из Буэнос-Айреса отдельного точного source-продукта не найдено, поэтому создана каноническая `excursion_buenos_aires_colonia_del_sacramento_day_trip` из standalone-блока тура. Все 3 локальные карточки заменены на `excursionRef` в исходном порядке между днями 3 и 4. Инварианты: `standalone_between_days = 3`, `production_excursion_refs = 3`, `remaining_local_standalone_cards = 0`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`. Итог: `DONE_LINKED`.

### Проверка v1.1 — строка 416, 2026-10-01

- **Строка 416 / `tour_source_wedding_ceremony_tropical_package`:** сверены production, V2 и original. Страница представляет однодневный свадебный пакет без itinerary по дням; `excursionRef = 0`, самостоятельных дополнительных Excursion и embedded excursion-модулей в источниках нет. Итог: `DONE_NO_RELATIONS`.
- Повторно проверен основной Google Sheets по условию `Тип страницы = Тур` + `Статус = Уникализировано`: новых Tour ID сверх уже внесенных в этот registry не найдено. Текущая очередь полностью закрыта.

### Проверка v1.1 — строки 410–411, 2026-10-01

- **Строка 410 / `tour_source_iguacu_falls`:** сверены production, V2 и original. Единственная самостоятельная Excursion — Парк птиц — была ошибочно оставлена внутри `contentBlocks` дня 2. Существующая каноническая `excursion_source_park_jekzoticheskih_ptic_v_iguasu` извлечена из numbered day и поставлена отдельной карточкой после дня 2, перед днем 3. Дублирующий `Парк птиц` удален из `places` дня 2. Три numbered days сохранены. Инварианты: `standalone_between_days = 1`, `production_excursion_refs = 1`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`.
- **Строка 411 / `tour_source_rio_de_janeiro_wedding`:** сверены production, V2 и original. У страницы нет itinerary-программы по дням, `excursionRef = 0`; самостоятельных дополнительных Excursion в источниках нет. Итог: `DONE_NO_RELATIONS`.
- Production commit `bf939d2205497c71dea2d488111b643e00cf42b1`: build = success, deploy = success. Публичный URL из текущего web-fetch окружения недоступен для прямого HTML spot-check; успешный GitHub Pages deploy и собранный Pages artifact подтверждены workflow.

### Проверка v1.1 — строки 286 и 344, 2026-10-01

- **Строка 286 / `tour_source_tur_v_surinam_dlya_nablyudeniya_za_pticami`:** сверены production, V2 и original. В маршруте 8 numbered days, `excursionRef = 0`, embedded excursion-модулей нет. Ночные наблюдения, выходы в саванне, прогулки по лесу, Peperpot Nature Park, Noordwijkweg, Weg Naar Zee и Cultuurtuin являются основной включенной программой соответствующих дней, а не отдельными дополнительными продуктами. Итог: `DONE_NO_RELATIONS`.
- **Строка 344 / `tour_source_amazon_clipper_cruise_traditional_3_days_2_nights`:** сверены production, V2 и original. В маршруте 3 numbered days, `excursionRef = 0`, embedded excursion-модулей нет. Вечерний поиск животных, каноэ по озеру Жанауака, прогулка по лесу, посещение местной общины, рыбалка на пираний, экологический парк Жанауари и «Встреча вод» входят в программу круиза; V2 прямо относит все экскурсии и выходы к включенным услугам. Самостоятельных дополнительных Excursion не выявлено. Итог: `DONE_NO_RELATIONS`.

Новых Excursion по этим 2 турам создавать не потребовалось.

### Повторная проверка v1.1 — строки 84–85, 2026-10-01

- **Строка 84 / `tour_argentina_brazil_pipa_11d`:** повторно сверены production, V2 и original. Дополнительные Тигре, Fiesta Gaucho и Монтевидео уже были отдельными `excursionRef` после дня 3. Дополнительно выявлено самостоятельное вечернее танго-шоу с ужином внутри дня 2. Оно извлечено из numbered day и связано как `excursion_source_tango_shou_v_buenos_ajrese` после дня 2. Для канонической source Excursion создан production-файл из собственного source, а строка Sheets 659 переведена в статус «Добавлена». 11 numbered days сохранены. Инварианты: `standalone_between_days = 4`, `production_excursion_refs = 4`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`.
- **Строка 85 / `tour_brazil_south_12d`:** повторно сверены production, V2 и original. Самостоятельные дополнительные экскурсии: полет на вертолете над Рио после дня 3, Парк птиц и Макуко Сафари после дня 4. Все 3 уже корректно представлены отдельными `excursionRef`; embedded-модулей и дублей внутри дней не осталось. Skyglass, полет на воздушном шаре и треккинг по каньонам входят в основную программу соответствующих numbered days и отдельно не выносятся. Инварианты: `standalone_between_days = 3`, `production_excursion_refs = 3`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`.
- Production commit `f62dc7dc0d3d05561ba5343212c966af27ba93c4`: build = success, deploy = success.

### Повторная проверка v1.1 — строки 82–83, 2026-10-01

- **Строка 82 / `tour_brazil_gems_14d`:** в дне 12 были 2 самостоятельные экскурсии, ошибочно оставленные внутри numbered day: «Макуко Сафари» как локальная section и «Парк птиц» как embedded `excursionRef`. Обе вынесены отдельными карточками после дня 12 в исходном порядке: сначала `excursion_source_makuko_safari`, затем `excursion_source_park_jekzoticheskih_ptic_v_iguasu`. Дублирующий текст удален, 14 numbered days сохранены. Инварианты: `standalone_between_days = 2`, `production_excursion_refs = 2`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`.
- **Строка 83 / `tour_brazil_dunes_13d`:** «Парк птиц» извлечен из `contentBlocks` дня 5 и вынесен отдельной карточкой после дня 5. В дне 7 обнаружена самостоятельная дополнительная ознакомительная экскурсия по Сан-Луису: около 3 часов, англоговорящий гид, собственный описательный блок в V2/original. Отдельной канонической Excursion в основном реестре не было, поэтому создана `excursion_sao_luis_intro_city_tour`, добавлена в production и Google Sheets и связана после дня 7. 13 numbered days сохранены. Инварианты: `standalone_between_days = 2`, `production_excursion_refs = 2`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0`, `missing_excursion_entities = 0`.
- Production commit `9441168e161fe62680363a62af9911514f3a91bd`: build = success, deploy = success. Hero новой экскурсии переиспользует уже улучшенный asset Сан-Луиса и хранится в каноническом media-path Excursion.

### Повторная проверка v1.1 — строки 80–81, 2026-10-01

- **Строка 80 / `tour_brazil_pantanal_bonito_lencois_8d`:** повторно сверены production, V2 и original. `excursionRef = 0`, самостоятельных карточек между днями нет, `contentBlocks` с отдельными Excursion отсутствуют. Верховая езда, лодочная прогулка, фотосафари, Голубой грот, Рио-Сукури, Гранд Ленсойс и прогулка по Прегисас входят в основную программу соответствующих numbered days. Перечень активностей Пантанала описывает включенную программу пребывания, а не отдельные дополнительные продукты. Итог: `DONE_NO_RELATIONS`.
- **Строка 81 / `tour_brazil_recife_porto_noronha_10d`:** повторно сверены production, V2 и original. `excursionRef = 0`, самостоятельных excursion-модулей между днями и внутри numbered days нет. Экскурсия 4x4 по Норонье и дайвинг дня 7 являются основной программой дня. Упоминания Санто-Алексио, дополнительных погружений, лодочной прогулки и треккингов в свободные дни остаются вариантами досуга без отдельного title/body/product scope; в основном реестре отдельной Excursion для них нет. Итог: `DONE_NO_RELATIONS`.

Новых Excursion по этим 2 турам создавать не потребовалось.

### Повторная проверка v1.1 — строки 78–79, 2026-10-01

- **Строка 78 / `tour_brazil_sao_paulo_rio_ilha_paraty_12d`:** повторно сверены production, V2 и original. Самостоятельные дополнительные экскурсии: Парк птиц, Макуко Сафари, полет на вертолете над Рио. Все 3 уже вынесены в отдельные `excursionRef`; локальных дублей и embedded excursion-модулей не осталось. Инварианты: `standalone_between_days = 3`, `production_excursion_refs = 3`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.
- **Строка 79 / `tour_brazil_adventure_17d`:** повторно сверены production, V2 и original. Самостоятельные дополнительные экскурсии: Макуко Сафари, Парк птиц, Abismo Anhumas. Все 3 уже вынесены в отдельные `excursionRef`; локальных дублей и embedded excursion-модулей не осталось. Основные экскурсионные дни (Илья-Гранде, Estancia Mimosa, Голубая пещера + Рио-Сукури, сплав + Arvorismo и др.) остаются содержанием numbered day, так как это основная программа соответствующего дня, а не самостоятельные дополнительные модули. Инварианты: `standalone_between_days = 3`, `production_excursion_refs = 3`, `remaining_embedded_excursion_modules = 0`, `missing_excursion_entities = 0`.

Новых Excursion по этим 2 турам создавать не потребовалось.

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
| `tour_luxury_brazil_11d` | `excursion_buzios_coastal_boat_trip` | between_days | 10 | 11 | LINKED_EXISTING | v1.1: извлечена из дня 10 отдельная морская прогулка по Бузиосу; точного source excursion_detail нет, создана отдельная production Excursion, Sheets 738. |
| `tour_brazil_argentina_peru_14d` | `excursion_buenos_aires_tango_show_dinner` | between_days | 7 | 8 | LINKED_EXISTING | v1.1: танго-шоу с ужином извлечено из дня 7. Создан отдельный продукт «с ужином, без гида»; не объединять со старыми source tango pages с гидом/трансфером. Sheets 739. |
| `tour_peru_8d` | `excursion_cusco_cathedral_visit` | between_days | 2 | 3 | LINKED_EXISTING | v1.1: отдельная платная экскурсия в кафедральный собор Куско извлечена из дня 2; около 40 минут, $20. Создана production Excursion, Sheets 740. |
| `tour_peru_8d` | `excursion_peru_sacred_valley_full_day` | between_days | 4 | 5 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 734. Не объединять с `excursion_source_svyashchennaya_dolina_premium_gruppovoj_tur`: отличаются маршрут, формат и цена. Hero пока использует точный legacy source URL; локализация media — отдельный photo-workflow. |
| `tour_peru_8d` | `excursion_peru_paracas_ballestas` | between_days | 7 | 8 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 735. Старый `ballestas-islands-tour` объединяет Бальестас и полет над Наска, поэтому это другой scope. Hero пока использует точный legacy source URL. |
| `tour_peru_8d` | `excursion_peru_nazca_lines_flight` | between_days | 7 | 8 | LINKED_EXISTING | Создана из standalone-блока тура, строка Sheets 736; отдельной source excursion_detail с таким scope не найдено. Hero пока использует точный legacy source URL. |
| `tour_peru_8d` | `excursion_source_lima_siti_tur` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей source excursion_detail, строка Sheets 623; production-файл создан из собственного source. |
| `tour_peru_8d` | `excursion_lima_folklore_dinner_show` | between_days | 7 | 8 | LINKED_EXISTING | v1.1 QA по V2/original: восстановлена пропущенная из production вечерняя программа — ужин-шведский стол национальной кухни, фольклорное шоу и трансферы, 19:00–22:00. Создана production Excursion, Sheets 742. |
| `tour_peru_8d` | `excursion_lima_larco_museum_visit` | after_final_day | 8 | — | LINKED_EXISTING | v1.1: отдельное посещение музея Ларко извлечено из дня 8 и вынесено следующей карточкой; $50. Не объединять с 6-часовым продуктом Ларко + таверна + Парк-де-ла-Ресерва. Sheets 741. |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 3 | 4 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_makuko_safari` | between_days | 3 | 4 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `makuko-safari`; локальная карточка удалена из тура. |
| `tour_brazil_sao_paulo_rio_ilha_paraty_12d` | `excursion_source_polet_na_vertolete_nad_rio` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `polet-na-vertolete-nad-rio`; локальная карточка удалена из тура. |
| `tour_argentina_brazil_pipa_11d` | `excursion_source_tango_shou_v_buenos_ajrese` | between_days | 2 | 3 | LINKED_EXISTING | v1.1: вечернее танго-шоу с ужином извлечено из дня 2. Каноническая source excursion_detail — Sheets 659; production Excursion создана из собственного source и получила локальный hero. |
| `tour_argentina_brazil_pipa_11d` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Точный match по маршруту Буэнос-Айрес — Сан-Исидро — Тигре, прогулке по дельте и цене source metadata; production Excursion создана из собственного source, строка Sheets 641. Hero пока использует точный legacy source URL. |
| `tour_argentina_brazil_pipa_11d` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Сопоставлено с уже опубликованной канонической Excursion `fiesta-gaucho`, строка Sheets 617. |
| `tour_argentina_brazil_pipa_11d` | `excursion_source_ekskursiya_po_montevideo` | between_days | 3 | 4 | LINKED_EXISTING | Точный match: полный день из Буэнос-Айреса, паром туда-обратно, обзорная экскурсия по Монтевидео; production Excursion создана из собственного source, строка Sheets 632. Hero пока использует точный legacy source URL. |
| `tour_brazil_adventure_17d` | `excursion_source_makuko_safari` | between_days | 7 | 8 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion `makuko-safari`; локальная карточка удалена из тура. |
| `tour_brazil_adventure_17d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 7 | 8 | LINKED_EXISTING | Каноническая standalone-связь |
| `tour_brazil_adventure_17d` | `excursion_brazil_bonito_abismo_anhumas` | between_days | 12 | 13 | LINKED_EXISTING | Production Excursion создана из standalone-блока тура; строка Sheets 737. Для hero без перекодирования использован уже улучшенный Abismo Anhumas image blob из highlights этого тура, скопированный в `/media/excursions/abismo-anhumas/hero.webp`. |
| `tour_brazil_gems_14d` | `excursion_source_makuko_safari` | between_days | 12 | 13 | LINKED_EXISTING | v1.1: самостоятельный блок «Макуко-сафари» извлечен из `contentBlocks` дня 12; используется существующая каноническая Excursion. |
| `tour_brazil_gems_14d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 12 | 13 | LINKED_EXISTING | v1.1: прежняя `legacy_inside_day` связь извлечена из дня 12 и нормализована в отдельную карточку между днями 12 и 13. |
| `tour_brazil_dunes_13d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 5 | 6 | LINKED_EXISTING | v1.1: прежняя `legacy_inside_day` связь извлечена из дня 5 и нормализована в отдельную карточку между днями 5 и 6. |
| `tour_brazil_dunes_13d` | `excursion_sao_luis_intro_city_tour` | between_days | 7 | 8 | LINKED_EXISTING | v1.1: ознакомительная экскурсия по Сан-Луису (около 3 часов, англоговорящий гид) извлечена из дня 7. Отдельной source excursion_detail не найдено; production Excursion создана из V2/original и добавлена в Sheets строкой 743. |
| `tour_brazil_south_12d` | `excursion_source_polet_na_vertolete_nad_rio` | between_days | 3 | 4 | LINKED_EXISTING | Точный match по V2/original: standalone-полет над Рио после дня 3; локальная карточка заменена на существующую каноническую Excursion. |
| `tour_brazil_south_12d` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 4 | 5 | LINKED_EXISTING | Извлечена из `contentBlocks` дня 4 в отдельную карточку между днями 4 и 5; дублирующее описание внутри дня удалено. |
| `tour_brazil_south_12d` | `excursion_source_makuko_safari` | between_days | 4 | 5 | LINKED_EXISTING | Извлечена из текста дня 4 в отдельную карточку между днями 4 и 5; используется существующая каноническая Excursion `makuko-safari`. |
| `tour_source_iguacu_falls` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 2 | 3 | LINKED_EXISTING | v1.1: прежняя `legacy_inside_day` связь извлечена из `contentBlocks` дня 2 и нормализована в отдельную карточку между днями 2 и 3. |

| `tour_source_buenos_ajres_salta_iguasu` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Точное соответствие по маршруту Буэнос-Айрес — Сан-Исидро — Тигре и прогулке по дельте; локальная карточка заменена на канонический `excursionRef`. |

| `tour_source_buenos_ajres_salta_iguasu` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Сопоставлено с существующей канонической Excursion «Фиеста Гаучо»; локальная карточка тура заменена на `excursionRef`. |
| `tour_source_buenos_ajres_salta_iguasu` | `excursion_buenos_aires_colonia_del_sacramento_day_trip` | between_days | 3 | 4 | LINKED_EXISTING | Отдельного source excursion_detail с выездом из Буэнос-Айреса не найдено; создана каноническая Excursion из standalone-блока тура, отличная от source-продукта «Колония» из Монтевидео. |

| `tour_source_programma_dlya_aktivnykh_lyudej` | `excursion_source_tango_shou_v_buenos_ajrese` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином вынесено из numbered day 2 в отдельный `excursionRef`; основная обзорная программа Буэнос-Айреса осталась внутри дня. |

| `tour_source_prostory_patagonii_chili_i_argentina_v_odnom_puteshestvii` | `excursion_source_tango_shou_v_buenos_ajrese` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином вынесено из numbered day 2 после основной обзорной экскурсии по Буэнос-Айресу. |
| `tour_source_prostory_patagonii_chili_i_argentina_v_odnom_puteshestvii` | `excursion_el_calafate_nativo_experience` | between_days | 3 | 4 | LINKED_NEW | Nativo Experience вынесен из вечернего блока дня 3; отдельной source excursion_detail не найдено, создана каноническая Excursion из V2/original тура. |

| `tour_source_vsya_argentina` | `excursion_buenos_aires_tango_show_dinner` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином без гида извлечено из numbered day 2 после основной обзорной экскурсии. |
| `tour_source_vsya_argentina` | `excursion_source_makuko_safari` | between_days | 5 | 6 | LINKED_EXISTING | Самостоятельный Макуко-сафари извлечен из дня 5; основной блок бразильской стороны водопадов остался внутри numbered day. |
| `tour_source_vsya_argentina` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 5 | 6 | LINKED_EXISTING | В V2 присутствовал прямой ADA_TOURS_EXCURSION_REF; локальный текст Парка птиц удален из дня 5. |
| `tour_source_vsya_argentina` | `excursion_el_chalten_kayaking` | between_days | 21 | 22 | LINKED_NEW | Опциональный каякинг от $300 за человека извлечен из дня 21; создана каноническая Excursion без неподтвержденных деталей. |
| `tour_source_vsya_argentina` | `excursion_ushuaia_penguin_walk` | between_days | 23 | 24 | LINKED_NEW | Опциональная групповая прогулка с пингвинами за $350 с англоязычным гидом извлечена из дня 23; создана каноническая Excursion. |

| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_buenos_aires_gala_tango_dinner_transfer` | between_days | 2 | 3 | LINKED_NEW | Gala Tango с ужином и трансфером вынесено из вечерней части дня 2; отдельная source page Gala Tango в inventory недоступна (technical/502). |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная программа Tigre + San Isidro свободного дня 3 сопоставлена с существующей канонической Excursion. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Опциональный полный день Rancho / Fiesta Gaucha сопоставлен с существующей канонической Excursion. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_buenos_aires_colonia_del_sacramento_day_trip` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная поездка на пароме в Колонию-дель-Сакраменто из Буэнос-Айреса сопоставлена с ранее созданной канонической сущностью. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_ushuaia_martillo_penguin_boat` | between_days | 7 | 8 | LINKED_NEW | Морская поездка к острову Мартильо вынесена из отдельного optional-блока дня 7. Не объединять с прогулкой с пингвинами: scope отличается. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_source_makuko_safari` | between_days | 9 | 10 | LINKED_EXISTING | Дополнительный Macuco Safari дня 9 сопоставлен с существующей канонической Excursion. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 9 | 10 | LINKED_EXISTING | V2 содержит отдельный Парк птиц и прямой ADA_TOURS_EXCURSION_REF на каноническую сущность. |
| `tour_source_lyuksovyj_tur_v_argentinu_s_buehnos_ajres_patagoniya_iguasu_na_11_dnej` | `excursion_iguazu_helicopter_falls` | between_days | 9 | 10 | LINKED_NEW | Дополнительный полет над водопадами и «Горлом Дьявола» вынесен в новую сущность; цена и длительность не выдумывались. |

| `tour_source_argentina_dlya_degustatorov_khoroshej_zhizni` | `excursion_buenos_aires_tango_show_dinner` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином, без гида, вынесено из numbered day 2 после основной обзорной экскурсии по Буэнос-Айресу; scope точно совпадает с канонической Excursion. |

| `tour_source_tur_v_argentinu_na_dikuyu_prirodu` | `excursion_buenos_aires_tango_show_dinner` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином без гида вынесено из дня 2 после основной программы ранчо «Дон Сильвано». |
| `tour_source_tur_v_argentinu_na_dikuyu_prirodu` | `excursion_ibera_corrientes_river_or_dorado_fishing` | between_days | 6 | 7 | LINKED_NEW | Optional-блок дня 6 — прогулка по реке Корриентес или рыбалка на дорадо — вынесен в отдельную каноническую Excursion; подтверждено только, что она организуется по желанию и за дополнительную плату. |

| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_buenos_aires_tango_show_dinner_transfer` | between_days | 2 | 3 | LINKED_NEW | Вечернее танго-шоу с ужином и включенным трансфером вынесено из дня 2 после основной обзорной экскурсии; создана отдельная каноническая Excursion, чтобы не смешивать продукт с вариантом без подтвержденного трансфера. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная программа Тигре и Северной зоны свободного дня 3 использует существующую каноническую Excursion. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Опциональный день на ранчо / Fiesta Gaucho свободного дня 3 использует существующую каноническую Excursion. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_buenos_aires_colonia_del_sacramento_day_trip` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная поездка из Буэнос-Айреса в Колонию-дель-Сакраменто вынесена в отдельный `excursionRef`. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_ushuaia_martillo_penguin_boat` | between_days | 7 | 8 | LINKED_EXISTING | Морская поездка к острову Мартильо вынесена из optional-блока дня 7; основной Tierra del Fuego остался внутри numbered day. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_source_makuko_safari` | between_days | 9 | 10 | LINKED_EXISTING | Дополнительный Macuco Safari дня 9 заменен на канонический `excursionRef`. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 9 | 10 | LINKED_EXISTING | Парк птиц дня 9 использует существующую каноническую Excursion; локальный текст не дублируется. |
| `tour_source_tur_v_argentinu_na_11dnej` | `excursion_iguazu_helicopter_falls` | between_days | 9 | 10 | LINKED_EXISTING | Дополнительный полет над водопадами Игуасу вынесен в отдельный `excursionRef`. |

| `tour_source_neveroyatnaya_argentina` | `excursion_buenos_aires_tango_show_dinner_transfer` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином и возвращением в отель вынесено из numbered day 2 после обзорной экскурсии по Буэнос-Айресу. |
| `tour_source_neveroyatnaya_argentina` | `excursion_ushuaia_laguna_esmeralda_trekking` | between_days | 3 | 4 | CREATED_FROM_TOUR | Опциональный треккинг к лагуне Эсмеральда за $105 извлечен из дня 3; создана каноническая Excursion из V2/original. |
| `tour_source_neveroyatnaya_argentina` | `excursion_el_calafate_glaciares_gourmet` | between_days | 8 | 9 | CREATED_FROM_TOUR | Самостоятельная полнодневная навигация Glaciares Gourmet за $388 извлечена из свободного дня 8; Premium-вариант с доплатой $153 сохранен в canonical Excursion. |
| `tour_source_neveroyatnaya_argentina` | `excursion_el_calafate_todo_glaciares` | between_days | 8 | 9 | CREATED_FROM_TOUR | Самостоятельная полнодневная навигация Todo Glaciares за $336 извлечена из свободного дня 8. |
| `tour_source_neveroyatnaya_argentina` | `excursion_iguazu_gran_aventura` | between_days | 10 | 11 | CREATED_FROM_TOUR | Опциональное «Великое приключение» за $96 — Zodiac по нижнему Игуасу + 4x4 по джунглям — извлечено из дня 10. |

| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_tango_shou_v_buenos_ajrese` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином вынесено из numbered day 2 после обзорной экскурсии по Буэнос-Айресу. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная сборная экскурсия Тигре + Сан-Исидро за $100 сопоставлена с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_ekskursiya_po_montevideo` | between_days | 3 | 4 | LINKED_EXISTING | Однодневная поездка из Буэнос-Айреса в Монтевидео с паромом, трансферами и гидом сопоставлена с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Опциональный полный день Fiesta Gaucho за $320 сопоставлен с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_el_calafate_ice_trekking_perito_moreno` | between_days | 5 | 6 | CREATED_FROM_TOUR | Айс-трекинг по Перито-Морено за $500 извлечен из дня 5; создана каноническая Excursion без выдуманных длительности и языка. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_iguazu_gran_aventura` | between_days | 7 | 8 | LINKED_EXISTING | «Большое приключение» на аргентинской стороне Игуасу сопоставлено с ранее созданной canonical Excursion; текущая программа отдельно фиксирует цену $100, длительность 1 ч 15 мин и ограничение до 12 лет. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_makuko_safari` | between_days | 7 | 8 | LINKED_EXISTING | Macuco Safari вынесено как явно названная альтернатива Gran Aventura на бразильской стороне; используется существующая каноническая Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 8 | 9 | LINKED_EXISTING | Парк птиц за $50 извлечен из дня 8 и связан с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_iguasu` | `excursion_iguazu_helicopter_falls` | between_days | 8 | 9 | LINKED_EXISTING | Вертолетный полет над водопадами Игуасу за $170 извлечен из дня 8 и связан с существующей канонической Excursion. |

| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_tango_shou_v_buenos_ajrese` | between_days | 2 | 3 | LINKED_EXISTING | Вечернее танго-шоу с ужином вынесено из numbered day 2 после обзорной экскурсии по Буэнос-Айресу. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | between_days | 3 | 4 | LINKED_EXISTING | Опциональная сборная экскурсия Тигре + Сан-Исидро за $100 сопоставлена с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_ekskursiya_po_montevideo` | between_days | 3 | 4 | LINKED_EXISTING | Однодневная поездка из Буэнос-Айреса в Монтевидео с паромом, трансферами и гидом сопоставлена с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_fiesta_gaucho` | between_days | 3 | 4 | LINKED_EXISTING | Опциональный полный день Fiesta Gaucho за $320 сопоставлен с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_el_calafate_ice_trekking_perito_moreno` | between_days | 5 | 6 | LINKED_EXISTING | Айс-трекинг по Перито-Морено за $500 использует ранее созданную каноническую Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_ushuaia_martillo_penguin_boat` | between_days | 7 | 8 | LINKED_EXISTING | Опциональная поездка к колонии пингвинов на острове Мартильо за $300 вынесена из дня 7; используются подтвержденные 20 минут трансфера к порту и около 2 часов навигации. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_iguazu_gran_aventura` | between_days | 9 | 10 | LINKED_EXISTING | «Большое приключение» на аргентинской стороне Игуасу связано с canonical Excursion; в туре сохранены source-цена $100, длительность 1 ч 15 мин и ограничение до 12 лет. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_makuko_safari` | between_days | 9 | 10 | LINKED_EXISTING | Macuco Safari вынесено как явно названная альтернатива Gran Aventura на бразильской стороне. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | between_days | 10 | 11 | LINKED_EXISTING | Парк птиц за $50 извлечен из дня 10 и связан с существующей канонической Excursion. |
| `tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu` | `excursion_iguazu_helicopter_falls` | between_days | 10 | 11 | LINKED_EXISTING | Вертолетный полет над водопадами Игуасу за $170 извлечен из дня 10 и связан с существующей канонической Excursion. |

| `tour_source_issledovanie_argentiny` | `excursion_el_calafate_glaciares_gourmet` | between_days | 11 | 12 | LINKED_EXISTING | Glaciares Gourmet вынесена из свободного дня 11 и связана с существующей канонической Excursion. |
| `tour_source_issledovanie_argentiny` | `excursion_el_calafate_todo_glaciares` | between_days | 11 | 12 | LINKED_EXISTING | Todo Glaciares вынесена из свободного дня 11 и связана с существующей канонической Excursion. |
| `tour_source_issledovanie_argentiny` | `excursion_iguazu_gran_aventura` | between_days | 13 | 14 | LINKED_EXISTING | «Великое приключение» на аргентинской стороне Игуасу связано с существующей канонической Excursion. |
| `tour_source_issledovanie_argentiny` | `excursion_buenos_aires_tango_show_dinner_transfer` | between_days | 15 | 16 | LINKED_EXISTING | Включенное танго-шоу с ужином в Буэнос-Айресе связано с существующей канонической Excursion. |

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

Если подходящей канонической сущности нет, нельзя оставлять слот без связи и нельзя ограничиваться резервированием ID. Нужно сразу создать production Excursion из самостоятельного блока тура, используя только подтвержденные данные блока. Отсутствующие цену, длительность, язык, состав услуг и другие факты не додумывать. Для первичного media использовать подтвержденный raw source URL `https://brasiltours.ru/image/...`; локальный enhanced WebP создается позже отдельным photo-enhancement workflow. После создания локальную карточку тура заменить на `excursionRef` и обновить Google Sheets.

## 6. Действующий рабочий цикл

Порядок действий полностью определен в `docs/workflows/tour-excursion-linking.md`. Для конкретного тура подготовить Tour MD, недостающие Excursion MD и фактическую запись mapping одним изменением. Отдельных commits для IN_PROGRESS, промежуточной проверки и финального статуса нет. Один успешный Actions build/deploy подтверждает публикацию; затем обновляется один пакет целевых строк Google Sheets.

Исторические DONE_* сохраняются. Готовый mapping отражает содержание одного prepared commit; результат его публикации определяется связанным Actions run, а не вторым служебным commit. Будущие места записываются в Tour.destinations по каталогу уже при создании тура. Их страницы не создаются как зависимость.

## 7. Очередь

Для явно запрошенного продолжения взять сохраненный текущий ID/стадию либо заданную строку. Если пользователь просит следующую запись, выбрать следующую по закрепленной очереди. Завершенные туры заново не обходить. Создание известной экскурсии использует отдельный `docs/workflows/excursions.md`.

## 8. Возобновление

Использовать ID задачи, подготовленные пути, commit и последнюю подтвержденную стадию. Полученный текст и снимки той же версии повторно не скачивать. Ошибку исправлять в затронутом месте; новые проверки всего сайта не добавлять.

## 9. Аудит v1.2 — Перейра / Саленто, 2026-10-02

- Для `excursion_source_salento_i_dolina_kokora` после аудита создана каноническая Destination `destination_colombia_pereira` и добавлена связь `destination: destination_colombia_pereira`.
- Та же Destination применена к `excursion_source_kofejnyj_tur_v_perejra` и `excursion_source_poseshchenie_shokoladnoj_fermy`, чтобы три продукта Перейры использовали одну географическую сущность.
- Destination зарегистрирована в основном Google Sheets как `/colombia/place/pereira/`; факты подтверждены source-туром `https://brasiltours.ru/kolumbiya-c-kofe` (Перейра, кофейный треугольник, кофейные фермы, Саленто и долина Кокора).
- Для Саленто/Кокоры выполнен строгий source-media QA по v1.2 в GitHub Actions: 7 production raw URL и 2 source-media Destination Перейры вернули HTTP 200, `Content-Type: image/jpeg`, валидную сигнатуру изображения и ненулевые реальные bytes. Проверка завершилась успешным build/deploy.
- В текущих production-турах `excursion_source_salento_i_dolina_kokora` пока не встречается через `excursionRef`; поэтому блок связанных экскурсий на странице Саленто отсутствует. Это ожидаемое поведение v1.2, fallback по стране/месту не используется.
- Ручное поле `relatedExcursions` не добавлялось.


<!-- ADA_TOURS_PREPARED_BATCH:2026-10-02-planned-tours-v2 -->

## 10. Плановые туры из готового V2 — 2026-10-02

**Статус данных:** канонизированы в подготовленном commit.

Эта секция фиксирует подготовленные Tour MD, самостоятельные Excursion и фактические `excursionRef` одного пакета. Подтверждение успешной сборки, публикации и последующей синхронизации Google Sheets в неё не входит. Исторические статусы выше сохранены без изменения.

Идентификатор пакета: `2026-10-02-planned-tours-v2`. Методика: `docs/workflows/tour-excursion-linking.md`, версия 2.1.

Из 301 выбранных туров подготовлены **274**; **27** остаются за пределами пакета по причинам ниже. В готовых турах записано **463 самостоятельных модулей** с **85 уникальными Excursion ID**. Для этого пакета подготовлены **48 новые Excursion**.

В готовых турах используются **370 новых резервов Destination** из плана резервирования. Это связи с каноническими ID; создание страниц мест здесь не заявляется.

Контрольная сумма исходного отчёта сборки: `4c56742b59a026748eace80084ecd72fda6e2b0c5514e948a4afbfa7e73616c3`.

Commit определяется по изменению, содержащему эту секцию и перечисленные файлы. Его SHA до создания commit не назначается.

Штатный run нужно сопоставить с commit в [GitHub Actions](https://github.com/alexyakovlev79/adatours.ru/actions). Успешный deploy данным файлом заранее не объявляется.

### 10.1. Все готовые туры

`N` — число фактических вставок самостоятельных модулей в подготовленном Tour MD. Нулевое значение означает отсутствие таких вставок в разобранном источнике.

| Строка реестра | Tour ID | Тур и канонический URL | Production-файл | N | SHA-256 V2 |
|---:|---|---|---|---:|---|
| 313 | `tour_source_argentina_2024` | Тур в Аргентину с Патагонией по лучшим достопримечательностям · `/argentina/tour/argentina-patagonia-highlights-2024/` | `src/content/tours/argentina-2024.md` | 9 | `66f51ee2166f6f76417564609323ba2b522df5f171711160aedc02f0383a6f83` |
| 314 | `tour_source_argentina_bariloche_i_buenos_ajres` | Тур в Аргентину – Барилоче и Буэнос-Айрес, по самым красивым местам · `/argentina/tour/argentina-bariloche-buenos-aires/` | `src/content/tours/argentina-bariloche-i-buenos-ajres.md` | 0 | `f0abecf8b72426ebb619b97f6006fb4cef3243203acc6e67acf5250444ea8447` |
| 315 | `tour_source_argentina_buenos_ajres_salta_iguasu` | Тур в Аргентину, Буэнос-Айрес и Водопады Игуасу на 12 дней · `/argentina/tour/argentina-buenos-aires-salta-iguazu-12-days/` | `src/content/tours/argentina-buenos-ajres-salta-iguasu.md` | 4 | `7627ded9fd4ab54b78a5694c9105f750c8c1ab8d38c02c196049978fb891f584` |
| 318 | `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | Тур в Аргентину, Эль-Калафате, Мендосу и Водопады Игуасу · `/argentina/tour/argentina-buenos-aires-mendoza-el-calafate-iguazu/` | `src/content/tours/argentina-buenos-ajres-mendoza-kalafate-iguasu.md` | 8 | `995ee6679ce621e91c1030cbb29aaa67b0ba2214519cffc8dce4e0eb93c7bb9e` |
| 319 | `tour_source_argentina_puteshestvie_v_doistoricheskij_mir` | Тур в Аргентину: Буэнос-Айрес, Мендоса,Сан Хуан, Пуэрто Мадрин · `/argentina/tour/argentina-prehistoric-journey/` | `src/content/tours/argentina-puteshestvie-v-doistoricheskij-mir.md` | 2 | `b317c1d8fb5ad5c171083389cd096bcb8007ca53ce480392e62a7a5a4e55744f` |
| 320 | `tour_source_vlyubites_v_argentinu` | Тур в Аргентину: Буэнос-Айрес, Эль-Калафате, Сальта, Игуасу · `/argentina/tour/argentina-buenos-aires-el-calafate-salta-iguazu/` | `src/content/tours/vlyubites-v-argentinu.md` | 1 | `8d5b1135a3dd49d9440db3dd8284657da244dfc123898602bbe4d5a31d000eb6` |
| 322 | `tour_source_udivitelnaya_salta` | Удивительная Сальта · `/argentina/tour/amazing-salta/` | `src/content/tours/udivitelnaya-salta.md` | 0 | `80a458800f9532264f07feb0950008693a826e4f592f7c616ea25a3d0137775f` |
| 323 | `tour_source_fordy_ognennoj_zemli` | Фьорды Огненной Земли · `/multi-country/tour/tierra-del-fuego-fjords/` | `src/content/tours/fordy-ognennoj-zemli.md` | 0 | `380fe43fe319a8bc3d51b5f6921e3860ea62ce8322eb619084acd87a4dbb377d` |
| 324 | `tour_source_chili_argentina` | Чили & Аргентина Делюкс · `/multi-country/tour/chile-argentina-deluxe/` | `src/content/tours/chili-argentina.md` | 4 | `89fb9cc4ad3e8d2cf8c0cda7e6272130c61abf8afd19c1053dc6024da59e51d7` |
| 325 | `tour_source_chili_i_argentina_vip` | Чили и Аргентина ВИП · `/multi-country/tour/chile-argentina-vip/` | `src/content/tours/chili-i-argentina-vip.md` | 7 | `6f0dc76b78655ba5146f498d15c60ea53ae7c505f4724c5c103c7fdc83c4c808` |
| 326 | `tour_source_beliz_san_pedro_ostrov_ambergris_kaje` | Белиз · `/belize/tour/belize-san-pedro-ambergris-caye/` | `src/content/tours/beliz-san-pedro-ostrov-ambergris-kaje.md` | 0 | `d599209e4fb42fd65365f05b0732c86f679fe6a33cb6405ba5fb4c4d8bf4225b` |
| 327 | `tour_source_luchshee_iz_dvukh_mirov` | Белиз: Лучшее Из Двух Миров · `/belize/tour/belize-best-of-both-worlds/` | `src/content/tours/luchshee-iz-dvukh-mirov.md` | 0 | `5f5dc759b54ed1ec473868447180f32abdf412cae29795323a46a58fc4a253bf` |
| 328 | `tour_source_beliz_priklyuchenie_materik_ostrov` | Белиз: Приключение «Материк / Остров» · `/belize/tour/belize-mainland-island-adventure/` | `src/content/tours/beliz-priklyuchenie-materik-ostrov.md` | 0 | `91179bfb768d21364cdd6f40b783287a674fa8a06fcf6ba2d346fde71b3126b6` |
| 329 | `tour_source_beliz_strastnyj_nablyudatel_za_ptitsami` | Белиз: Страстный Наблюдатель за птицами · `/belize/tour/belize-birdwatching/` | `src/content/tours/beliz-strastnyj-nablyudatel-za-ptitsami.md` | 0 | `2f0a56048f2548b44797efb91d0aef083bf5b6935fcb580bbed5ef022d2235d0` |
| 330 | `tour_source_gvatemala_gonduras_el_salvador_beliz` | Гватемала - Гондурас- Эль Сальвадор - Белиз · `/multi-country/tour/guatemala-honduras-el-salvador-belize/` | `src/content/tours/gvatemala-gonduras-el-salvador-beliz.md` | 0 | `cbd6ff257ff749a08eef7bc31a9b07da39ce42044694d7b72a48c2cac683fd33` |
| 331 | `tour_source_gvatemala_gonduras_i_beliz` | Гватемала, Гондурас и Белиз · `/multi-country/tour/guatemala-honduras-belize/` | `src/content/tours/gvatemala-gonduras-i-beliz.md` | 1 | `c11169002c6923b8acb9f6c4258e788b2186e7ad66d5e1021ae584fac960c025` |
| 332 | `tour_source_issleduya_beliz` | Исследуя Белиз · `/belize/tour/explore-belize/` | `src/content/tours/issleduya-beliz.md` | 0 | `0c27629943f2da6e49d26a4748ce2e9438d9f0af4a6e5ad1060724c54790aac1` |
| 333 | `tour_source_luchshee_v_belize` | Лучшее в Белизе · `/belize/tour/best-of-belize/` | `src/content/tours/luchshee-v-belize.md` | 0 | `de06468183e4b74a7f706ade376cec5f41fcb76d05948e327774755726369f46` |
| 334 | `tour_source_luchshee_v_belize_za_11_dnej` | Лучшее в Белизе за 11 дней · `/belize/tour/best-of-belize-11-days/` | `src/content/tours/luchshee-v-belize-za-11-dnej.md` | 0 | `f85621ba400e8471b844b8f6cd7725f25600c74d43f2d17a1d752d8ac8dc538f` |
| 335 | `tour_source_chudesa_beliza` | Тур в Белиз, на 6 дней (с англо или русскоговорящим гидом) · `/belize/tour/belize-wonders-6-days/` | `src/content/tours/chudesa-beliza.md` | 1 | `bfa1de01efcd98d5810b0e09b19f38b342bf5b0774295f0fce7f97d31e5ac4a5` |
| 336 | `tour_source_kankun_beliz` | Тур в Канкун и Белиз на 11 дней (с русскоговорящим гидом) · `/multi-country/tour/cancun-belize-11-days/` | `src/content/tours/kankun-beliz.md` | 2 | `3a59d7e12668a92d30ca36b1cf3b3042e7a832e7ab4c12fdb1adac39331b7449` |
| 337 | `tour_source_chudesa_gvatemaly_beliza` | Чудеса Гватемалы & Белиза · `/multi-country/tour/guatemala-belize-wonders/` | `src/content/tours/chudesa-gvatemaly-beliza.md` | 1 | `9ced1461a0848336bc0d6f3fe015759d95dc3ad02776d073ac68f05cf717b179` |
| 339 | `tour_source_mechta_bolivii` | Мечта Боливии · `/bolivia/tour/bolivia-dream/` | `src/content/tours/mechta-bolivii.md` | 0 | `c2747a0d11fc3cf31638b16f32a5de6a85b1e973928f5630d3180bcbdb199b3d` |
| 341 | `tour_source_sokrovishcha_bolivii` | Тур в Боливию на 12 дней (все экскурсии с гидами) · `/bolivia/tour/bolivia-treasures-12-days/` | `src/content/tours/sokrovishcha-bolivii.md` | 0 | `133f7702532ac000a72d38c0d7ec3c050969820911abdb23604d88b5d940b2d9` |
| 342 | `tour_source_prirodnye_chudesa_bolivii` | Тур в Боливию по лучшим местам страны на 10 дней · `/bolivia/tour/bolivia-natural-wonders-10-days/` | `src/content/tours/prirodnye-chudesa-bolivii.md` | 0 | `0021402ff0c75b5a11837afb60f83c0206e446ec19f23feae73f422b075bc05f` |
| 343 | `tour_source_krasivaya_boliviya` | Тур в Боливию: солончак Уюни, Лунная Долина, Ла-Пас и Тиванку · `/bolivia/tour/bolivia-uyuni-moon-valley-la-paz-tiwanaku/` | `src/content/tours/krasivaya-boliviya.md` | 0 | `11ce5ac4d301f3da01809622f66a5a8e9a5f66e3176d0be54c755b383dd534c3` |
| 345 | `tour_source_lyuksovyj_tur_na_amazonku_v_brazilii_v_manause_i_anavilyanase_na_tri_dnya` | VIP тур в Амазонию 3 дня: гидросамолет, лодж Mirante do Gavião и розовые дельфины · `/brazil/tour/amazon-manaus-anavilhanas-vip-3-days/` | `src/content/tours/lyuksovyj-tur-na-amazonku-v-brazilii-v-manause-i-anavilyanase-na-tri-dnya.md` | 0 | `754425518d0798f8b24f3b5c8ccbb6d21440986649c0ef0247c1fbf466494b2a` |
| 346 | `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | VIP тур в Бразилию и Аргентину: Рио, Игуасу, Буэнос-Айрес · `/multi-country/tour/brazil-argentina-vip-10-days/` | `src/content/tours/vip-tur-v-braziliyu-i-argentinu-na-10-dnej.md` | 12 | `2adf30e87a497e6785a8b5f7f9fd6897171ed2bf8d4d1b18643ecb8c0946b76c` |
| 347 | `tour_source_amazoniya` | Амазония · `/brazil/tour/amazon/` | `src/content/tours/amazoniya.md` | 2 | `782b045ae3f832fd84c14dab1dd0fbaee265715af40883c6b23f35b086483b5a` |
| 348 | `tour_source_amazoniya_kruiz_tukano` | Амазония: Круиз Тукано · `/brazil/tour/amazon-tucano-cruise/` | `src/content/tours/amazoniya-kruiz-tukano.md` | 0 | `d0a61ed78cd0af625bf29f3f604702801d0813677cbfad7954623d87246faacd` |
| 349 | `tour_source_argentina_i_braziliya_ot_lda_k_solntsu` | Аргентина и Бразилия: От льда к солнцу · `/multi-country/tour/argentina-brazil-ice-to-sun/` | `src/content/tours/argentina-i-braziliya-ot-lda-k-solntsu.md` | 2 | `d3e24bfd31665ccbf85a4dfe4dcd08605e611b8a96bb521cdd831bfd57666235` |
| 350 | `tour_source_bolshoe_brazilskoe_priklyuchenie` | Большое бразильское приключение · `/brazil/tour/grand-brazil-adventure/` | `src/content/tours/bolshoe-brazilskoe-priklyuchenie.md` | 0 | `adc3ea1b1666755bedffde65bedfbf395177b149ad3bdd92c4cb279bc4a5691c` |
| 351 | `tour_source_fan_braziliya_i_argentina` | Бразилия и Аргентина Фан · `/multi-country/tour/brazil-argentina-fun/` | `src/content/tours/fan-braziliya-i-argentina.md` | 1 | `fa0b8d1ff30b7d83b88e3206558601449ec0936e4a189fec5f1687fd678e9d51` |
| 352 | `tour_source_braziliya_ot_san_paulo_do_buziosa` | Бразилия от Сан Пауло до Бузиоса · `/brazil/tour/brazil-sao-paulo-to-buzios/` | `src/content/tours/braziliya-ot-san-paulo-do-buziosa.md` | 3 | `dcdf4aad4c2300ac1764364668a31477fd14ac67f3bfdf0454fc6015565b37d9` |
| 353 | `tour_source_braziliya_s_detmi` | Бразилия с детьми · `/brazil/tour/brazil-with-kids/` | `src/content/tours/braziliya-s-detmi.md` | 7 | `6a527a771960305db280ecbaec4e8f450204759e7e126d1a0c21e33a8c1dadc7` |
| 354 | `tour_source_braziliya_s_plyazhami` | Бразилия с пляжами · `/brazil/tour/brazil-beaches/` | `src/content/tours/braziliya-s-plyazhami.md` | 2 | `eb422636763eb935a1289f440c21d943a727bce8daff62bd3a711f286cd31fd1` |
| 355 | `tour_source_braziliya_argentina_i_chili` | Бразилия, Аргентина и Чили · `/multi-country/tour/brazil-argentina-chile/` | `src/content/tours/braziliya-argentina-i-chili.md` | 7 | `6569b9117dadbc17057571cd25452d619008c24c6705532bd0af91fdd8a7885d` |
| 356 | `tour_source_braziliya_argentina_gruppovoj_tur` | Бразилия-Аргентина:групповой тур · `/multi-country/tour/brazil-argentina-group-tour/` | `src/content/tours/braziliya-argentina-gruppovoj-tur.md` | 1 | `43bfa5d2f9a472fc16a227bed4d56af0f19c05c0b411e3ef483c2dc921828a4a` |
| 357 | `tour_source_little_mix_ru` | Бразилия: Little Mix · `/brazil/tour/brazil-little-mix/` | `src/content/tours/little-mix-ru.md` | 0 | `ea7f2cc3184c25967aa579faf23f0c76f50d319dabe105f3e0df71524bebad8a` |
| 358 | `tour_source_sao_paulo_buzios_rio_iguasu` | Бразилия: Сан Пауло –Игуасу- Рио-де-Жанейро – Бузиос · `/brazil/tour/brazil-sao-paulo-iguazu-rio-buzios/` | `src/content/tours/sao-paulo-buzios-rio-iguasu.md` | 3 | `d4c50be44ee629c0cef7d332bd888c54101d70b2b67ed4160299a8276b46d8b2` |
| 359 | `tour_source_braziliya_gruppovoj_tur_na_13_dnej` | Бразилия: групповой тур на 13 дней · `/brazil/tour/brazil-group-tour-13-days/` | `src/content/tours/braziliya-gruppovoj-tur-na-13-dnej.md` | 0 | `021b2f7b056da1a615cf53477bf2abd43233454ed45d9e9069f99afbcbcba76d` |
| 360 | `tour_source_vazhnoe_brazilii` | Важное Бразилии · `/brazil/tour/essential-brazil/` | `src/content/tours/vazhnoe-brazilii.md` | 3 | `f631557941cb56030866ea54b01c0cd238d3408c4c60370501151487b7dbe91e` |
| 361 | `tour_source_vkusy_brazilii` | Вкусы Бразилии · `/brazil/tour/flavors-of-brazil/` | `src/content/tours/vkusy-brazilii.md` | 0 | `1ee63cb46a8900fa5e278a806466c0f33c5b85feab7d6846b99dfa09e62ce50e` |
| 363 | `tour_source_dostoprimechatelnosti_i_karnaval_v_rio_de_zhanejro` | Достопримечательности и Карнавал в Рио-де-Жанейро · `/brazil/tour/rio-de-janeiro-sightseeing-carnival/` | `src/content/tours/dostoprimechatelnosti-i-karnaval-v-rio-de-zhanejro.md` | 1 | `1d93e8587b9c9bf6b16af3a041602fc2e769d9757dbdd4f0d919ad7038bae276` |
| 364 | `tour_source_kofe_tur_v_brazilii` | Индивидуальный кофе-тур в Бразилию · `/brazil/tour/brazil-private-coffee-tour/` | `src/content/tours/kofe-tur-v-brazilii.md` | 5 | `72f57d7cf19844651b4758cbefdb4f0b9841d810dcb287b9ab3ddc31b3275ace` |
| 365 | `tour_source_led_solntse_i_kraj_zemli` | Индивидуальный тур в Аргентину и Бразилию на 12 дней · `/multi-country/tour/argentina-brazil-private-tour-12-days/` | `src/content/tours/led-solntse-i-kraj-zemli.md` | 1 | `c7b2b94bab657ed9d728599edb77363186902d737f5cdcf780507cdfc8f970f8` |
| 366 | `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | Индивидуальный тур в Бразилию на 12 дней: Рио, Игуасу, Пантанал и Бузиос · `/brazil/tour/brazil-rio-foz-do-iguacu-pantanal-buzios-12-days/` | `src/content/tours/rio-de-janeiro-foz-do-iguacu-pantanal-buzios.md` | 11 | `cdaa589838a3b1b2fbc08ffe2971039e3d6a37c8ed3dcf8d7fa1759b38dd6797` |
| 367 | `tour_source_rajskaya_braziliya` | Индивидуальный тур в Бразилию на 13 дней · `/brazil/tour/brazil-paradise-private-tour-13-days/` | `src/content/tours/rajskaya-braziliya.md` | 2 | `b32e966bcd55df6aa0aa3086aa657f3210150536f8644e6e403fc22233ee07f2` |
| 369 | `tour_source_parad_chempionov_karnavala_i_otdykh_na_tropicheskom_poberezhe` | Тропический Парад чемпионов 2027: Рио и Бузиос · `/brazil/tour/brazil-champions-parade-tropical-coast/` | `src/content/tours/parad-chempionov-karnavala-i-otdykh-na-tropicheskom-poberezhe.md` | 0 | `95936c857c1edf3c506f9ebff1fb15d5cbfae177342609b48c709f5bb64272e3` |
| 370 | `tour_source_nezabyvaemaya_braziliya` | Индивидуальный тур в Бразилию, по лучшим местам за 12 дней · `/brazil/tour/unforgettable-brazil-private-tour-12-days/` | `src/content/tours/nezabyvaemaya-braziliya.md` | 7 | `7b7296d3d55c89493b9ca703ca25a40797043be20a4cefd9e2ebf043c1b7b56d` |
| 371 | `tour_source_rio_i_iguasu_puteshestvie_po_kultovym_chudesam_brazilii` | Индивидуальный тур в Бразилию: Рио-де-Жанейро и Игуасу · `/brazil/tour/brazil-rio-iguazu-private-tour/` | `src/content/tours/rio-i-iguasu-puteshestvie-po-kultovym-chudesam-brazilii.md` | 2 | `7ef91f4c7222f4fbff445a98201ba2e620a01beca549263ea0116e69d5965c88` |
| 372 | `tour_source_severnyj_pantanal_vodopady_reki` | Индивидуальный тур в Бразилию: Северный Пантанал – водопады и реки · `/brazil/tour/northern-pantanal-waterfalls-rivers/` | `src/content/tours/severnyj-pantanal-vodopady-reki.md` | 0 | `71411f448d0b78c3c6f14f24823ee13afa2aa04e9cc4ecfbb9ddb104defc4bfe` |
| 373 | `tour_source_severnyj_pantanal_vodopady_reki_i_rio_de_zhanejro` | Индивидуальный тур в Бразилию: Северный Пантанал, Водопады и Рио-де-Жанейро · `/brazil/tour/northern-pantanal-waterfalls-rivers-rio-de-janeiro/` | `src/content/tours/severnyj-pantanal-vodopady-reki-i-rio-de-zhanejro.md` | 0 | `e34976eb5fbe0a38cd64eea9f73cb7412651c82bfe7c1ce3bd7fdcf3f8c5e3d9` |
| 375 | `tour_source_kongress_v_rio_de_zhanejro` | Корпоративный тур в Рио-де-Жанейро на 5 дней · `/brazil/tour/rio-de-janeiro-corporate-tour-5-days/` | `src/content/tours/kongress-v-rio-de-zhanejro.md` | 0 | `88cfbba707891a114b7759a22260ed0f5c059211dd70d8db7d092b6146664f1b` |
| 376 | `tour_source_luchshee_v_rio_de_zhanejro_dlya_mice` | Корпоративный тур в Рио-де-Жанейро на 6 дней · `/brazil/tour/rio-de-janeiro-corporate-tour-6-days/` | `src/content/tours/luchshee-v-rio-de-zhanejro-dlya-mice.md` | 0 | `b20563ff661dbe939cbf629e50aef751c28c634352eaed1f9a690fcd1a3e36a1` |
| 377 | `tour_source_brazil_coffee_tour_ru` | Кофе Тур в Бразилии на 8 дней · `/brazil/tour/brazil-coffee-tour-8-days/` | `src/content/tours/brazil-coffee-tour-ru.md` | 5 | `428bf674a201df36b1007b769308ec96c5d6894a2b7878fd0ce2c4091baf3467` |
| 378 | `tour_source_lensojs_maranenses` | Ленсойс-Мараньенсес · `/brazil/tour/lencois-maranhenses/` | `src/content/tours/lensojs-maranenses.md` | 1 | `0fb637564a18f640cedf42df4e6de187eeb545ed6247d46fa2cc9e1f4dcf68d6` |
| 379 | `tour_source_luchshee_brazilii_argentiny_i_chili` | Лучшее Бразилии, Аргентины и Чили · `/multi-country/tour/best-of-brazil-argentina-chile/` | `src/content/tours/luchshee-brazilii-argentiny-i-chili.md` | 4 | `febaedb1e3419b9778054349ba5d33f855efc29c55323634b813476a8e7402a3` |
| 380 | `tour_source_luchshee_v_brazilii_rio_iguasu_buzios` | Лучшее в Бразилии · `/brazil/tour/best-of-brazil-rio-iguazu-buzios/` | `src/content/tours/luchshee-v-brazilii-rio-iguasu-buzios.md` | 3 | `ae07fc6cbd1d06061060ae8a604b7791c2a5cc83cd0780660c7920373d910fa3` |
| 381 | `tour_source_luchshee_v_brazilii_za_9_dnej` | Лучшее в Бразилии за 9 дней · `/brazil/tour/best-of-brazil-9-days/` | `src/content/tours/luchshee-v-brazilii-za-9-dnej.md` | 2 | `e6fa09729e8f0bbdb7fac7a9d23258d41fd737c6b42b8ff68bef6d645345fe43` |
| 383 | `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | Люксовый индивидуальный тур в Бразилию с Амазонией \| 16 дней · `/brazil/tour/luxury-brazil-amazon-16-days/` | `src/content/tours/vip-tur-v-braziliyu-s-amazoniej-16-dnej.md` | 5 | `604ed1712c34c82a8153d8c993fbf26e18f360e29d8e4a87fc21b74d93970783` |
| 384 | `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu_s_alagoas` | Люксовый тур в Бразилию на Карнавал в Рио, Игуасу и Алагоас \| 11 дней · `/brazil/tour/luxury-brazil-rio-carnival-iguazu-alagoas-11-days/` | `src/content/tours/lyuksovyj-tur-na-karnaval-v-braziliyu-i-vodopady-iguasu-s-alagoas.md` | 4 | `143a5238ca32ba204226e52e0431cbc2836a59f4cc64270a8760c55569e093c7` |
| 385 | `tour_source_manaus_4_dnya_3_nochi` | Манаус: 4 дня / 3 ночи · `/brazil/tour/manaus-4-days-3-nights/` | `src/content/tours/manaus-4-dnya-3-nochi.md` | 7 | `7ec4911d896a54e7880a9a4940870d55c4f287abb7afb624256dcb243703cbea` |
| 386 | `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | Мечты сбываются на Парад Чемпионов Карнавала в Бразилии · `/multi-country/tour/brazil-carnival-champions-parade-dreams/` | `src/content/tours/mechty-sbyvayutsya-na-parad-chempionov-karnavala.md` | 4 | `0952de606b4499b3e4445b36f0e87855a0e1c84911ec6af57c22ff92bce487b8` |
| 387 | `tour_source_mototur_cherez_braziliyu` | Мото тур по Бразилии за 12 дней · `/brazil/tour/brazil-motorcycle-tour-12-days/` | `src/content/tours/mototur-cherez-braziliyu.md` | 0 | `d3d4739dd93e6fb7746d6f8422d689651f80ffef9967d96dd511cdb95cfc9fa5` |
| 388 | `tour_source_na_mototsiklakh_po_brazilii` | Мото-тур: на мотоциклах по Бразилии на 10 дней · `/brazil/tour/brazil-motorcycle-tour-10-days/` | `src/content/tours/na-mototsiklakh-po-brazilii.md` | 1 | `f24f2890f4dc6d414041a0e5bcef56c6046c17a58993ded6fd05b96fa238ef36` |
| 389 | `tour_source_nezabyvaemyj_karnaval_s_vodopadami_i_otdykhom_na_poberezhe` | Незабываемый карнавал в Рио с отдыхом на побережье и водопадами · `/brazil/tour/rio-carnival-waterfalls-coast/` | `src/content/tours/nezabyvaemyj-karnaval-s-vodopadami-i-otdykhom-na-poberezhe.md` | 4 | `2897d79e51df007d75b8fe562c704dc008c40665c7f72cfb169fc6161da31397` |
| 390 | `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | Новогодний VIP тур в Бразилию с Бонито: Рио, Игуасу \| 16 дней · `/brazil/tour/brazil-new-year-vip-bonito-rio-iguazu-16-days/` | `src/content/tours/vip-tur-v-braziliyu-s-bonito-16-dnej.md` | 5 | `6e521c1c75bebe46a4d56b044d406049dc32881bab9f37a092fc3817b571c543` |
| 391 | `tour_source_nezabyvaemyj_novyj_god_v_brazilii` | Новогодний тур в Бразилию 10 дней: Рио, Игуасу, Бузиос от $3192 · `/brazil/tour/brazil-new-year-rio-iguazu-buzios-10-days/` | `src/content/tours/nezabyvaemyj-novyj-god-v-brazilii.md` | 2 | `e39d2867fba3c96931da75aa21f33d63564e6209c874513ea68cb999de9db2e4` |
| 392 | `tour_source_mechty_sbyvayutsya_na_novyj_god` | Новогодний тур в Бразилию и Аргентину: 10 дней с русским гидом · `/multi-country/tour/brazil-argentina-new-year-10-days/` | `src/content/tours/mechty-sbyvayutsya-na-novyj-god.md` | 7 | `9c0875ba881530767d9720da9822da021ac8c8dc4ef1104f2c5186a152af509b` |
| 393 | `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | Новогодний тур в Бразилию, Аргентину и Чили 2027: 10 дней, цены · `/multi-country/tour/brazil-argentina-chile-new-year-2027-10-days/` | `src/content/tours/tur-v-braziliyu-argentinu-i-chili-na-novyj-god.md` | 4 | `38724a935a8de73ea7eaf1311099bc112e6b19ac008065f15508789cfd5964ef` |
| 395 | `tour_source_priklyucheniya_na_novyj_god_v_rio_i_na_vodopadakh_iguasu` | Новый год в Рио и на Игуасу: тур 7 дней от $1791 · `/brazil/tour/rio-iguazu-new-year-7-days/` | `src/content/tours/priklyucheniya-na-novyj-god-v-rio-i-na-vodopadakh-iguasu.md` | 2 | `856da1a47bf0c5f261235031001209dc3579f29b5e846004984ad2a7c61a953b` |
| 396 | `tour_source_nezabyvaemyj_novyj_god_v_rio` | Новый год в Рио: Копакабана, статуя Христа, Сахарная Голова · `/brazil/tour/rio-new-year-copacabana-christ-redeemer-sugarloaf/` | `src/content/tours/nezabyvaemyj-novyj-god-v-rio.md` | 5 | `0b83928c95c9f1ca9a93458108bea65a51a9310e60e38d19635e85263f929a54` |
| 397 | `tour_source_opyt_brazilii` | Опыт Бразилии · `/brazil/tour/experience-brazil/` | `src/content/tours/opyt-brazilii.md` | 2 | `571f1c2368fd54d9ffcad699a77ee6f2e401df32dc22b8cdb6020d1799767ffb` |
| 398 | `tour_source_pantanal_bonito` | Пантанал & Бонито · `/brazil/tour/pantanal-bonito/` | `src/content/tours/pantanal-bonito.md` | 1 | `e806d757179d55fa9a5664a7d3a3473c35c9c803e3eed824cc2d4cefd9f7f006` |
| 399 | `tour_source_pantanal_4dnya_3_nochi` | Пантанал 4дня/ 3 ночи · `/brazil/tour/pantanal-4-days-3-nights/` | `src/content/tours/pantanal-4dnya-3-nochi.md` | 0 | `8f865326b17feedf76e3765978a22c46f14b55c664a1ebac75fd4ac2b5378c9e` |
| 400 | `tour_source_pantanal_za_5_dnej` | Пантанал за 5 дней · `/brazil/tour/pantanal-5-days/` | `src/content/tours/pantanal-za-5-dnej.md` | 0 | `8b434597f7995cfdec9570787d16ff928664cf78099167138ce7c895fd37ecde` |
| 402 | `tour_source_peru_i_braziliya_na` | Перу и Бразилия · `/multi-country/tour/peru-brazil/` | `src/content/tours/peru-i-braziliya-na.md` | 3 | `057d4df7fe8611a348264ab2acd8db243857b58a417ef6d7f3e7b28286a92236` |
| 403 | `tour_source_belosnezhnye_zhemchuzhiny_brazilii` | Пляжный тур в Бразилию на 10 дней · `/brazil/tour/brazil-beach-tour-10-days/` | `src/content/tours/belosnezhnye-zhemchuzhiny-brazilii.md` | 0 | `e070fcaabed8eb0583d3388e106d1004a1f785916c095a136fda1e61dddc298d` |
| 404 | `tour_source_prazdnik_gordosti_v_rio_de_zhanejro` | Праздник гордости в Рио-де-Жанейро · `/brazil/tour/rio-de-janeiro-pride/` | `src/content/tours/prazdnik-gordosti-v-rio-de-zhanejro.md` | 0 | `cbfd5a591299a3401073df37cb28e731c7cea5b09e553cbea2c3d714ab82c3a6` |
| 405 | `tour_source_priklyucheniya_v_amazonke` | Приключенческий тур-выживание в Амазонских джунглях · `/brazil/tour/amazon-jungle-survival-adventure/` | `src/content/tours/priklyucheniya-v-amazonke.md` | 0 | `c851a26614f2b5c874330d0d48683b75306e1b1490bb082170daa4887cd9b5f4` |
| 406 | `tour_source_puteshestvie_po_kultovym_chudesam_brazilii` | Путешествие по культовым чудесам Бразилии · `/brazil/tour/brazil-iconic-wonders/` | `src/content/tours/puteshestvie-po-kultovym-chudesam-brazilii.md` | 2 | `50100b4372eb18eb33875f579ad12cac27a2b6c38528b61564777404ec3caef8` |
| 407 | `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | Рио-де-Жанейро - Амазония - Водопады Игуасу · `/brazil/tour/rio-de-janeiro-amazon-iguazu-falls/` | `src/content/tours/rio-de-zhanejro-amazoniya-vodopady-iguasu.md` | 5 | `18c7e01a25fb51525045d12f5454277c9e4862bc9de376013c543acf02f44f6e` |
| 408 | `tour_source_roskoshnaya_braziliya_i_argentina` | Роскошная Бразилия и Аргентина · `/multi-country/tour/luxury-brazil-argentina/` | `src/content/tours/roskoshnaya-braziliya-i-argentina.md` | 13 | `1495fad00a004e7a1216545bb2bd8bbede43b9ffa963890b9d9b939dc163210f` |
| 409 | `tour_source_rybalka_v_pantanale` | Рыбалка в Пантанале · `/brazil/tour/pantanal-fishing/` | `src/content/tours/rybalka-v-pantanale.md` | 0 | `8d56699eb54f3bb7214ab01526d59f97ca645296dcb91b2402d98264d59576cb` |
| 412 | `tour_source_sekrety_pantanala` | Секреты Пантанала · `/brazil/tour/secrets-of-the-pantanal/` | `src/content/tours/sekrety-pantanala.md` | 0 | `b42623d2472021874b09aec2c054c59d1b56af2652cf24385170d52a742018de` |
| 413 | `tour_source_tur_v_braziliyu_s_detmi` | Семейный тур в Бразилию \| Отдых с детьми в Латинской Америке · `/brazil/tour/brazil-family-tour/` | `src/content/tours/tur-v-braziliyu-s-detmi.md` | 8 | `190328c4164a92f4186836834a0b227770c503751cde23e3f4a8b1c4e08602b9` |
| 414 | `tour_source_solntse_tango_vino_i_atakama` | Солнце, Танго, Вино и Атакама · `/multi-country/tour/sun-tango-wine-atacama/` | `src/content/tours/solntse-tango-vino-i-atakama.md` | 3 | `724533b901f74b0459576a5c2eb1d1cfe708bf7d276e872b97aba090de272166` |
| 415 | `tour_source_rio_de_zhanejro` | Спортивная рыбалка – Pousada Mamori · `/brazil/tour/pousada-mamori-sport-fishing/` | `src/content/tours/rio-de-zhanejro.md` | 0 | `47436b5c90ba03cb5d839042975fd395c3a3db2f21ff2e54c2acf48bbf91e6eb` |
| 417 | `tour_source_novyj_god_v_rio_de_zhanejro_1` | Тур Новый Год в Рио-де-Жанейро · `/brazil/tour/rio-de-janeiro-new-year-tour/` | `src/content/tours/novyj-god-v-rio-de-zhanejro-1.md` | 6 | `68e76884fb127625153dd23bb754555d05195b3fe00e16def3028e2987836520` |
| 418 | `tour_source_argentina_and_brazil_ru` | Тур в Аргентину и Бразилию, лучшее за 10 дней · `/multi-country/tour/best-of-argentina-brazil-10-days/` | `src/content/tours/argentina-and-brazil-ru.md` | 1 | `54aacf1abb070fcd4375744b79c3d3b034cf9942ede3f3da64aeb44f32d9e5f1` |
| 419 | `tour_source_ekzoticheskij_karnaval_v_brazilii_rio_amazonka_vodopady_iguasu` | Тур в Бразилию - карнавал в Рио, Амазонка, водопады Игуасу · `/brazil/tour/brazil-rio-carnival-amazon-iguazu/` | `src/content/tours/ekzoticheskij-karnaval-v-brazilii-rio-amazonka-vodopady-iguasu.md` | 4 | `0c813006585f2007fb67faf618c7714aee3ade1eedb2455d78c0196409b00ddc` |
| 420 | `tour_source_tur_v_braziliyu_za_vkusami` | Тур в Бразилию в Рио де Жанейро, Илья-Гранди, Парати · `/brazil/tour/brazil-rio-ilha-grande-paraty/` | `src/content/tours/tur-v-braziliyu-za-vkusami.md` | 0 | `a15508e3a86e2f9d4f7ef0b25f7fec699aac00b0333053875aba2b721a4e6d74` |
| 421 | `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | Тур в Бразилию в Рио-де-Жанейро и Водопады Игуасу на 8 дней · `/brazil/tour/brazil-rio-iguazu-8-days/` | `src/content/tours/special-noe-predlozhenie-rio-and-vodopa-dy-iguasu.md` | 7 | `f82859fe2dffecd285c5d38f268db6b1ccbba67a66ecf1e0ef1e2aebc3d74469` |
| 422 | `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | Тур в Бразилию и Аргентину на 9 дней: Рио, Игуасу, Буэнос-Айрес \| Цена от $2775 · `/multi-country/tour/brazil-argentina-rio-iguazu-buenos-aires-9-days/` | `src/content/tours/mechty-sbyvayutsya-tur-v-braziliyu-i-argentinu-na-9-dnej.md` | 8 | `78898c84afc37e750b17350831e144ff31783df64d77ba898c729a73581ddb62` |
| 423 | `tour_source_tur_v_argentinu_i_braziliyu_ot_lda_do_solntsa` | Тур в Бразилию и Аргентину: Водопады Игуасу и ледники Патагонии · `/multi-country/tour/brazil-argentina-iguazu-patagonia-glaciers/` | `src/content/tours/tur-v-argentinu-i-braziliyu-ot-lda-do-solntsa.md` | 1 | `1602de79ce38a8f621daf8e52f322b2204d098a449039c698cc3d0a2486d6374` |
| 424 | `tour_source_braziliya_i_argentina_v_sentyabre` | Тур в Бразилию и Аргентину: Рио-де-Жанейро, Фоз де Игуасу, Буэнос Айрес · `/multi-country/tour/brazil-argentina-rio-iguazu-buenos-aires-september/` | `src/content/tours/braziliya-i-argentina-v-sentyabre.md` | 1 | `68279792632c47dc4b13d9ef203dfab7206a12df4cdb4c646205f54c471ee34f` |
| 425 | `tour_source_tur_v_braziliyu_s_amazoniej_i_argentinu` | Тур в Бразилию и Аргентину: от Манауса (Амазонка) до Игуасу · `/multi-country/tour/brazil-amazon-argentina-manaus-iguazu/` | `src/content/tours/tur-v-braziliyu-s-amazoniej-i-argentinu.md` | 2 | `d77292c305c2527897a68f905ffb29cdfde4a03cf638eeebf6a8f663fdc7656b` |
| 426 | `tour_source_braziliya_i_peru_na_novyj_god` | Тур в Бразилию и Перу на празднование Нового Года · `/multi-country/tour/brazil-peru-new-year/` | `src/content/tours/braziliya-i-peru-na-novyj-god.md` | 5 | `8f9275bd649b30be65d8b04e58961985317851098b3907c98087b9d8237cf7a2` |
| 427 | `tour_source_braziliya_s_vodopadami_na_novyj_god` | Новый год в Рио и водопады Игуасу — 2027 · `/brazil/tour/brazil-iguazu-new-year/` | `src/content/tours/braziliya-s-vodopadami-na-novyj-god.md` | 2 | `cf46457931f28e6767fe7c82a19fcb90a33bcc56519d9f67231f7e074ba76ebd` |
| 428 | `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | Тур в Бразилию индивидуальный: Рио, Игуасу, Пантанал, Бонито и Бузиос · `/brazil/tour/brazil-rio-iguazu-pantanal-bonito-buzios-private-tour/` | `src/content/tours/ekzoticheskij-koktejl-na-parad-chempionov-karnavala.md` | 5 | `b678c6c8178341645156d27ce4bf38c8e37cc89b95f14030796f404d87d9c4c1` |
| 429 | `tour_source_roskoshnyj_novyj_god_v_brazilii` | Тур в Бразилию на 10 дней – Роскошный Новый Год · `/brazil/tour/luxury-brazil-new-year-10-days/` | `src/content/tours/roskoshnyj-novyj-god-v-brazilii.md` | 4 | `ff4cac7656483f49494b37e5b7c5797e1c6720af1f4943de09c70f8d730620a7` |
| 430 | `tour_source_tropicheskij_karnaval_s_angroj_dush_rejsh` | Тур в Бразилию на 12 дней \| Карнавал в Рио с пляжным отдыхом · `/brazil/tour/brazil-rio-carnival-angra-dos-reis-12-days/` | `src/content/tours/tropicheskij-karnaval-s-angroj-dush-rejsh.md` | 1 | `f47a9df73c82f6a26e067b7d06f0bab6de2bfc2dd7f12b32c0b7da62cbdeefc8` |
| 431 | `tour_source_tur_v_braziliyu_na_6dnej` | Тур в Бразилию на 6 дней: Рио-де-Жанейро и на Водопады Игуасу · `/brazil/tour/brazil-rio-iguazu-6-days/` | `src/content/tours/tur-v-braziliyu-na-6dnej.md` | 2 | `d3006619915b53354265a9eb9d085c0bd255eac4b23728f793b20cfad16c9cac` |
| 432 | `tour_source_super_predlozhenie_rio_buzios` | Тур в Бразилию на 8 дней с Рио и пляжным отдыхом в Бузиосе · `/brazil/tour/brazil-rio-buzios-8-days/` | `src/content/tours/super-predlozhenie-rio-buzios.md` | 5 | `44ce2b95548c1f8fc5fa9aa060c90c13a467f53a6cf29ff063ad99c42311b215` |
| 433 | `tour_source_tur_v_ekzoticheskuyu_braziliyu` | Тур в Бразилию на Амазонку и водопады Игуасу с пляжным отдыхом · `/brazil/tour/brazil-amazon-iguazu-beaches/` | `src/content/tours/tur-v-ekzoticheskuyu-braziliyu.md` | 9 | `51f5282c4fe94e21910297490228880e794e4e223b31151eca9123fcd47fd268` |
| 434 | `tour_source_ekzoticheskij_karnaval_v_brazilii` | Тур в Бразилию на Карнавал в Рио \| Игуасу, Амазонка и Бузиос · `/brazil/tour/brazil-rio-carnival-iguazu-amazon-buzios/` | `src/content/tours/ekzoticheskij-karnaval-v-brazilii.md` | 6 | `7d6d35dbbe989b26fcf3a8599a522891696ed76346ccbc821823ba6d7ff68ce3` |
| 435 | `tour_source_karnaval_v_rio_de_zhanejro_vodopady` | Тур в Бразилию на Карнавал в Рио и Игуасу \| 8 дней · `/brazil/tour/brazil-rio-carnival-iguazu-8-days/` | `src/content/tours/karnaval-v-rio-de-zhanejro-vodopady.md` | 0 | `8442f1b9ffc14168b29268c2d33c5bb6fde300d3f1d826b6e2a4b69e8bed0096` |
| 436 | `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu` | Тур в Бразилию на Карнавал в Рио и водопады Игуасу \| 8 дней · `/brazil/tour/luxury-brazil-rio-carnival-iguazu-8-days/` | `src/content/tours/lyuksovyj-tur-na-karnaval-v-braziliyu-i-vodopady-iguasu.md` | 3 | `f0ad58a031ec863be8d7be24430fd2429a21d554690fb9b3d271ca839fa56eec` |
| 437 | `tour_source_tropicheskij_karnaval_v_brazilii` | Тур в Бразилию на Карнавал в Рио с пляжным отдыхом \| 12 дней · `/brazil/tour/brazil-rio-carnival-beach-12-days/` | `src/content/tours/tropicheskij-karnaval-v-brazilii.md` | 0 | `4913197eb82313acea6d6af2fa5a430ba64cb0945d2fefbfd3488a0ad3810143` |
| 438 | `tour_source_mechty_sbyvayutsya_na_karnaval` | Тур в Бразилию на Карнавал в Рио, Аргентина, Игуасу \| 10 дней · `/multi-country/tour/brazil-argentina-rio-carnival-iguazu-10-days/` | `src/content/tours/mechty-sbyvayutsya-na-karnaval.md` | 4 | `97edc350e3174c64c0df948ef3526f49ad205a22593edf62dd1ae8993ad23069` |
| 439 | `tour_source_nezabyvaemyj_karnaval_v_brazilii` | Тур в Бразилию на Карнавал с пляжным отдыхом и водопадами Игуасу · `/brazil/tour/brazil-carnival-iguazu-beaches/` | `src/content/tours/nezabyvaemyj-karnaval-v-brazilii.md` | 4 | `40d13c6181a676dce27754fa69370ebba81c7aaf673564db2fec8e684b2715ff` |
| 440 | `tour_source_novogodnie_priklyucheniya_v_brazilii` | Тур в Бразилию на Новый Год: Рио, Пантанал, Бонито, пляжи Бузиоса · `/brazil/tour/brazil-new-year-rio-pantanal-bonito-buzios/` | `src/content/tours/novogodnie-priklyucheniya-v-brazilii.md` | 1 | `8da80ff29e4b7492401d6120d698b626edf6bbf6b7caa68400d1ee70bd5eeaf1` |
| 441 | `tour_source_ekzoticheskij_novyj_god_ru` | Тур в Бразилию на Новый год: Рио, Игуасу, Амазония · `/brazil/tour/brazil-new-year-rio-iguazu-amazon/` | `src/content/tours/ekzoticheskij-novyj-god-ru.md` | 4 | `568aa7c970d421522ccf3bd4597845c8c957b532b7f0ab67a5d78c41b536a5bd` |
| 442 | `tour_source_tur_v_braziliyu_na_13_dnej` | Тур в Бразилию на водопады Игуасу с пляжным отдыхом в Бузиос · `/brazil/tour/brazil-iguazu-buzios-13-days/` | `src/content/tours/tur-v-braziliyu-na-13-dnej.md` | 4 | `868fbb2694e33b4ca87f11d135c29f30474ec7f2a07a2565be57e760da154dba` |
| 443 | `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | Тур в Бразилию на кофейные плантации и водопады Игуасу, 8 дней · `/brazil/tour/brazil-coffee-plantations-iguazu-8-days/` | `src/content/tours/tur-v-braziliyu-na-kofejnye-fazendy.md` | 9 | `df502226775e035681c3930e89284073ad190fd6cb267ecab36cd7376d5b480e` |
| 444 | `tour_source_parad_chempionov_karnavala_v_rio` | Тур в Бразилию на парад чемпионов карнавала в Рио · `/brazil/tour/brazil-rio-carnival-champions-parade/` | `src/content/tours/parad-chempionov-karnavala-v-rio.md` | 1 | `429e6e8eb4984f554ac9380dfe2620434dbb2777823b50fa12a22f02a37b8eeb` |
| 446 | `tour_source_tur_v_braziliyu_na_vodopady_iguasu_v_pantanal_bonito_portu_alegre` | Тур в Бразилию по лучшим достопримечательностям на 13 дней · `/brazil/tour/brazil-iguazu-pantanal-bonito-porto-alegre-13-days/` | `src/content/tours/tur-v-braziliyu-na-vodopady-iguasu-v-pantanal-bonito-portu-alegre.md` | 3 | `a404036659ae5f2d292e731d2b11f60b5008da08c8038b1ce68e49fcdfca8473` |
| 447 | `tour_source_ekspress_braziliya_rio_ibuzios` | Тур в Бразилию с Рио и отдыхом на курорте Бузиос «Экспресс» · `/brazil/tour/brazil-rio-buzios-express/` | `src/content/tours/ekspress-braziliya-rio-ibuzios.md` | 0 | `6faa8e4004433eccb5091e9302882c7d55607cf2254631b60caff75a7d59d857` |
| 449 | `tour_source_stolitsy_latinskoj_ameriki` | Тур в Бразилию, Аргентину и Уругвай за 13 дней · `/multi-country/tour/brazil-argentina-uruguay-13-days/` | `src/content/tours/stolitsy-latinskoj-ameriki.md` | 1 | `fb0a87049906697883ebca8c7e927759f284d32a09991b5c3c6e3b5e9801b1eb` |
| 450 | `tour_source_solntse_tango_i_vino` | Тур в Бразилию, Аргентину и Чили с Водопадами Игуасу на 12 дней · `/multi-country/tour/brazil-argentina-chile-iguazu-12-days/` | `src/content/tours/solntse-tango-i-vino.md` | 15 | `2dbfee5b9f74404d9fd6c109910d3778e39eaaf1c126c6c433e8a18a6675d4ad` |
| 451 | `tour_source_braziliya_argentina_chili_peru_ru` | Тур в Бразилию, Аргентину, Чили и Перу на 15 дней · `/multi-country/tour/brazil-argentina-chile-peru-15-days/` | `src/content/tours/braziliya-argentina-chili-peru-ru.md` | 0 | `e7ec7abda93964a5b2adc7cbcfe2e35e25634d2534f99610c5407c8f8c7503f6` |
| 452 | `tour_source_tur_v_krasochnuyu_braziliyu_2022` | Тур в Бразилию: Игуасу, Рио-де-Жанейро, Сальвадор, Ресифи · `/brazil/tour/brazil-iguazu-rio-salvador-recife-2022/` | `src/content/tours/tur-v-krasochnuyu-braziliyu-2022.md` | 2 | `65b388700d274faf3440629a615b393486b1919fe6cfe17f8e3608074245bb14` |
| 453 | `tour_source_tropicheskaya_braziliya` | Тур в Бразилию: Рио-де-Жанейро и пляжный отдых в Бузиосе · `/brazil/tour/tropical-brazil-rio-buzios/` | `src/content/tours/tropicheskaya-braziliya.md` | 5 | `c22f449c32d17bdc15ff3b2bd85666bd085484e1e0d1ac429cb71e5197d13b62` |
| 454 | `tour_source_podlinnaya_braziliya` | Тур в Бразилию: Рио-де-Жанейро, Манаус, Сальвадор, Фос-ду-Игуасу · `/brazil/tour/authentic-brazil-rio-manaus-salvador-foz-do-iguacu/` | `src/content/tours/podlinnaya-braziliya.md` | 3 | `73b1b3d1459f6457c32e1e54f47cef96697d10c664e52547dc8a1521ba9b853a` |
| 455 | `tour_source_brazilskaya_mechta` | Тур в Бразилию: Рио-де-Жанейро, Тропический остров и исторический Парати · `/brazil/tour/brazil-dream-rio-tropical-island-paraty/` | `src/content/tours/brazilskaya-mechta.md` | 0 | `6805d024a628b9e357a52087104bfa328c138d37772e73e92aac08ed6f5191eb` |
| 456 | `tour_source_braziliya_s_san_paulo` | Тур в Бразилию: Сан Пауло, Манаус, Рио-де-Жанейро, Игуасу · `/brazil/tour/brazil-sao-paulo-manaus-rio-iguazu/` | `src/content/tours/braziliya-s-san-paulo.md` | 5 | `b62b1a91a0d471688e1271ad3f5044e9cb1ecb3131a216a3ec87ad5c7ee727ef` |
| 457 | `tour_source_tur_v_braziliyu_k_mestam_sily` | Тур в Бразилию: водопады Игуасу, регион Висконде де Мауа и Парати · `/brazil/tour/brazil-iguazu-visconde-de-maua-paraty/` | `src/content/tours/tur-v-braziliyu-k-mestam-sily.md` | 0 | `2a86994c89cf72ae3220827b24cc2281f4e4dffd26bd9a4464cd05d10c5f0e17` |
| 458 | `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | Тур в Латинскую Америку \| 3 страны и Карнавал в Бразилии · `/multi-country/tour/latin-america-3-countries-rio-carnival/` | `src/content/tours/3-strany-latinskoj-ameriki-na-karnaval-v-rio.md` | 6 | `fc21f99adee22a5dc440be045ef23ddddef18551c10d8e2a86ce86abbb90ebf8` |
| 459 | `tour_source_tur_v_peru_i_braziliyu` | Тур в Перу с Мачу Пикчу и Бразилию в Рио с пляжным отдыхом · `/multi-country/tour/peru-machu-picchu-brazil-rio-beaches/` | `src/content/tours/tur-v-peru-i-braziliyu.md` | 4 | `6531f35cafcb3e53c3282a8316c83dc7e54b02f407f9e0c4b88147fada460ad8` |
| 460 | `tour_source_tur_v_4_strany_yuzhnoj_ameriki` | Тур в страны Южной Америки: Бразилия, Аргентина, Чили, Уругвай · `/multi-country/tour/brazil-argentina-chile-uruguay/` | `src/content/tours/tur-v-4-strany-yuzhnoj-ameriki.md` | 3 | `fd9b6f9ddba1532e98e475b4776b870133b64fdde5cd14cddb0c4357cef28d56` |
| 461 | `tour_source_karnaval_v_rio_de_zhanejro` | Тур на Карнавал в Рио в Бразилии: цены и программа тура · `/brazil/tour/rio-de-janeiro-carnival/` | `src/content/tours/karnaval-v-rio-de-zhanejro.md` | 1 | `ea0890fa63782868f3898363499de1c4464da9b0cac47fa201a77d62c5a2a766` |
| 462 | `tour_source_tropicheskij_novyj_god_v_brazilii` | Тур на Новый год в Бразилию: Рио и пляжный отдых в Бузиосе · `/brazil/tour/brazil-new-year-rio-buzios-beach/` | `src/content/tours/tropicheskij-novyj-god-v-brazilii.md` | 0 | `1427de052b7a6e1627bf03935f28039a586e1f5e9f5417d4086c448c832b5af8` |
| 464 | `tour_source_udivitelnaya_braziliya` | Удивительная Бразилия · `/brazil/tour/amazing-brazil/` | `src/content/tours/udivitelnaya-braziliya.md` | 0 | `3dc9bb163dc595b17c1f04d6e74c1f70bf11927d3f01fc4542013c3356a6289a` |
| 465 | `tour_source_chili_argentina_braziliya` | Чили-Аргентина- Бразилия · `/multi-country/tour/chile-argentina-brazil/` | `src/content/tours/chili-argentina-braziliya.md` | 11 | `94364c774281d68c7c32be5bf01136325dabbdd9f52655df8309328bdd81e011` |
| 466 | `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | Экзотический Карнавал (Парад Чемпионов) в Бразилии · `/brazil/tour/brazil-exotic-carnival-champions-parade/` | `src/content/tours/ekzoticheskij-karnaval-parad-chempionov-v-brazilii.md` | 6 | `f8a04c281534fb16f2ca5521e7f7f53ba5cd285234adc8bf670198bda3bb3e07` |
| 468 | `tour_source_exclusive_amazon_experience_ru` | Эксклюзивное Приключение в Амазонии · `/brazil/tour/exclusive-amazon-experience/` | `src/content/tours/exclusive-amazon-experience-ru.md` | 0 | `a770e65ed93fd5064d2cc9a36413fcfb1172a41a519465b541155ac1da07ff47` |
| 469 | `tour_source_ekspress_braziliya_rio_de_zhanejro_vodopady_iguazu` | Экспресс Бразилия: Рио де Жанейро + Водопады Игуазу · `/brazil/tour/brazil-rio-iguazu-express/` | `src/content/tours/ekspress-braziliya-rio-de-zhanejro-vodopady-iguazu.md` | 0 | `7d43ece09b60fbc4e35485a16b8318e9d13a1722f6967790e8ad2220b93b2357` |
| 471 | `tour_source_aktivnaya_venesuela_akvapark_yurskogo_perioda` | Активная Венесуэла: Аквапарк Юрского периода · `/venezuela/tour/active-venezuela-jurassic-water-world/` | `src/content/tours/aktivnaya-venesuela-akvapark-yurskogo-perioda.md` | 0 | `bc3e110f87f8f04a02c6ef73834ab0d54e81844a710d4e32a6ee542378b3e157` |
| 472 | `tour_source_venesuela_novye_konkistadory` | Венесуэла -Новые Конкистадоры · `/venezuela/tour/venezuela-new-conquistadors/` | `src/content/tours/venesuela-novye-konkistadory.md` | 0 | `19b1efe3758a9e8eda1510eb027c8d2c10ae2f6a2349897ff89c18f4e234dee9` |
| 473 | `tour_source_venesuela_populyarnye_napravleniya` | Венесуэла: Популярные направления · `/venezuela/tour/venezuela-popular-destinations/` | `src/content/tours/venesuela-populyarnye-napravleniya.md` | 1 | `65b88c34c334c6c8a2136610ea41b9d8bb14c24021bf060d37e02ddef7878afe` |
| 474 | `tour_source_kraski_venesuely` | Краски Венесуэлы · `/venezuela/tour/colors-of-venezuela/` | `src/content/tours/kraski-venesuely.md` | 8 | `47cdfb0c0008c64a531d489abf92a69cf33988f8fd7f39b03f89d3ec22c1a9c8` |
| 475 | `tour_source_populyarnye_napravleniya_venesuely` | Популярные Направления Венесуэлы от туроператора Ада Турс · `/venezuela/tour/popular-destinations-of-venezuela/` | `src/content/tours/populyarnye-napravleniya-venesuely.md` | 1 | `4961c5369f0f9903629e32e0bd53d56924cb0b47ff7274f9ba9755464ae1aed7` |
| 476 | `tour_source_skazki_venesuelskogo_lesa` | Сказки Венесуэльского Леса · `/venezuela/tour/venezuela-forest-tales/` | `src/content/tours/skazki-venesuelskogo-lesa.md` | 2 | `9d5b71f5db7207ee85bcb88a9ff7a9c9b3a7b526d571367633ceb5b2d8f90cf7` |
| 477 | `tour_source_soedinennye_shtaty_venesuely` | Соединенные Штаты Венесуэлы · `/venezuela/tour/united-states-of-venezuela/` | `src/content/tours/soedinennye-shtaty-venesuely.md` | 0 | `6bcfa56f85976b7b6a68dcbc311b445d1ec58e95f325bcd6d459f06227cb000d` |
| 478 | `tour_source_priroda_i_kultura_venesuely_bolivii` | Тур в Венесуэлу и Боливию \| Природа и культура за 12 дней · `/multi-country/tour/venezuela-bolivia-nature-culture-12-days/` | `src/content/tours/priroda-i-kultura-venesuely-bolivii.md` | 1 | `4fd820f744469e777f0b9be1024b371725e44310be1ec6dc6ada55307a9340b7` |
| 479 | `tour_source_venesuela_prirodnye_kontrasty_tropikov` | Тур в Венесуэлу на 12 дней по лучшим местам страны и пляжным отдыхом · `/venezuela/tour/venezuela-tropical-contrasts-beaches-12-days/` | `src/content/tours/venesuela-prirodnye-kontrasty-tropikov.md` | 1 | `02d2fce4e2ddc26e5cd4a7e7e3491f483d3a31489a3e3f850e8da9a0d556bfac` |
| 480 | `tour_source_krasota_venesuely` | Тур в Венесуэлу на 12 дней с пляжным отдыхом и эко-маршрутами · `/venezuela/tour/venezuela-nature-beaches-12-days/` | `src/content/tours/krasota-venesuely.md` | 1 | `0d56927a839dc32eb9cac0382dc62ab190a81be7884f624b4ee020dd709827a8` |
| 481 | `tour_source_luchshee_v_venesuele` | Тур в Венесуэлу на 12 дней с пляжным отдыхом на о.Маргарита · `/venezuela/tour/best-of-venezuela-margarita-island-12-days/` | `src/content/tours/luchshee-v-venesuele.md` | 8 | `6bae8e51cdd0245f15faa2326b9afbaceb3acba88adf5d8bd06da44025b3ae9e` |
| 482 | `tour_source_venesuela_treking_v_zateryannyj_i_pervozdannyj_mir_rorajmy` | Тур в Венесуэлу на 12 дней с трекингом на столовую гору Рорайма · `/venezuela/tour/venezuela-mount-roraima-trek-12-days/` | `src/content/tours/venesuela-treking-v-zateryannyj-i-pervozdannyj-mir-rorajmy.md` | 1 | `131e42c62bb5248674289b59712e39b13fcd03ce61124353e4ce1e3a5119e590` |
| 483 | `tour_source_3_strany_gajana_surinam_i_frantsuzskaya_gviana` | Тур в три страны Латинской Америки: Суринам, Гайана и Фр.Гвиана · `/multi-country/tour/suriname-guyana-french-guiana-3-countries/` | `src/content/tours/3-strany-gajana-surinam-i-frantsuzskaya-gviana.md` | 0 | `86c0e35251a48ce327e7f63eacd28a198b63c95140e53319d9eae0cf20e6cf5f` |
| 484 | `tour_source_luchshee_v_gvatemale` | Лучшее в Гватемале · `/multi-country/tour/best-of-guatemala/` | `src/content/tours/luchshee-v-gvatemale.md` | 0 | `ab38f3e5216b9185aec0c61788099531914c518474d0eeab477ba175dd772369` |
| 485 | `tour_source_mir_majya` | Мир Майя · `/multi-country/tour/maya-world/` | `src/content/tours/mir-majya.md` | 0 | `d4c14f902934bc4937d870df0b20400e67ad87378fae6aafdb55cbc376bdca10` |
| 486 | `tour_source_klassicheskaya_programma_po_gvatemale` | Тур в Гватемалу: Антигуа, Гватемала Сити, Сантьяго Атитлан · `/guatemala/tour/guatemala-antigua-guatemala-city-santiago-atitlan/` | `src/content/tours/klassicheskaya-programma-po-gvatemale.md` | 0 | `a99ca4552744421eb4376ed0f6c46ee53df7dc2a416b79f0d8a623156bb49830` |
| 487 | `tour_source_otkryvaya_gvatemalu` | Тур в Гватемалу: Гватемала Cити, Антигуа, Сантьяго Атитлан, Тикаль · `/guatemala/tour/guatemala-guatemala-city-antigua-atitlan-tikal/` | `src/content/tours/otkryvaya-gvatemalu.md` | 0 | `f65119791ad91cf2a2d2cc16029b350517c31ada8a65fdadea52138dc9867b14` |
| 488 | `tour_source_vivat_kolumbiya` | Виват Колумбия · `/colombia/tour/viva-colombia/` | `src/content/tours/vivat-kolumbiya.md` | 0 | `066b57f2bac735849bb3c802c88c5dd01464bef6dc7570a858f52d060ce8036d` |
| 489 | `tour_source_zateryannyj_gorod_v_santa_marte` | Затерянный город в Санта Мартe 2023 · `/colombia/tour/santa-marta-lost-city-2023/` | `src/content/tours/zateryannyj-gorod-v-santa-marte.md` | 0 | `d5418c19da937115b3ead57296340b9a2a87c1db85082b36ae2e34b722acaa10` |
| 490 | `tour_source_kolumbiya_2024` | Колумбия · `/colombia/tour/colombia-2024/` | `src/content/tours/kolumbiya-2024.md` | 1 | `a7ad7e5264ddffd9283f723d63522fd0f04c6ff462aba5c4311652a4359283f4` |
| 491 | `tour_source_kolumbiya_live` | Колумбия Live · `/colombia/tour/colombia-live/` | `src/content/tours/kolumbiya-live.md` | 0 | `4d1873c12922dccd31f32490577afed8c7cda37bab4220651d32986b9c259633` |
| 492 | `tour_source_kolumbiya_c_kofe` | Колумбия Кофе · `/colombia/tour/colombia-coffee/` | `src/content/tours/kolumbiya-c-kofe.md` | 0 | `c6583ff025a5853984d45c6edf17c34002f7da8b16fc0e722b377f3286ba44e1` |
| 493 | `tour_source_kolumbiya_metropoliten` | Колумбия Метрополитен · `/colombia/tour/metropolitan-colombia/` | `src/content/tours/kolumbiya-metropoliten.md` | 0 | `97230bc51a60fda9768b480f78300b6c5a9bc4d781f6e2e00acd277eac253d98` |
| 494 | `tour_source_kolumbiya_s_kano_kristales_i_ne_tolko` | Колумбия с «Каньо-Кристалес» и не только · `/colombia/tour/colombia-cano-cristales-beyond/` | `src/content/tours/kolumbiya-s-kano-kristales-i-ne-tolko.md` | 0 | `7628d52349a83a5f61a966ea55ce8231c96dd1a379877340e9d6fd1179ba0136` |
| 495 | `tour_source_kolumbiya_stolitsy` | Колумбия- столицы · `/colombia/tour/colombia-capitals/` | `src/content/tours/kolumbiya-stolitsy.md` | 1 | `4654cf8d14e955bafb364218dcc55c0778077ad1d4e4653848f55e8d810eaad2` |
| 496 | `tour_source_manyashchij_peru_kolumbiya` | Манящий Перу & Колумбия · `/multi-country/tour/peru-colombia-discovery/` | `src/content/tours/manyashchij-peru-kolumbiya.md` | 3 | `de7210213f956024b5ded10a90a564a71e56812444b35efc38601c15e82ceabb` |
| 497 | `tour_source_ot_venesuely_do_kolumbii` | Тур в Венесуэлу и Колумбию на 12 дней (групповой с русским гидом) · `/multi-country/tour/venezuela-colombia-group-tour-12-days/` | `src/content/tours/ot-venesuely-do-kolumbii.md` | 0 | `726c84fe8270f632af4d4f6f50fd0d6cffefbfd5b29b921a061530a9cb4ca752` |
| 499 | `tour_source_puteshestvie_k_raduzhnoj_reke_kolumbii` | Тур в Колумбию в Боготу, Ла Макарену и реку Каньо-Кристалес · `/colombia/tour/colombia-bogota-la-macarena-cano-cristales/` | `src/content/tours/puteshestvie-k-raduzhnoj-reke-kolumbii.md` | 0 | `f09ee11405f091e015350f4221882aa9764288701404fe51ac6c4d1ad83649ef` |
| 500 | `tour_source_manyashchaya_kolumbiya_baru` | Тур в Колумбию в группе на 12 дней с пляжным отдыхом на о.Бару · `/colombia/tour/colombia-baru-beach-group-tour-12-days/` | `src/content/tours/manyashchaya-kolumbiya-baru.md` | 0 | `bbb7ec7f3b7b2f3007e480b4d3df25af77fdb8b9bd427ae7b71ddd9b987bfb8e` |
| 501 | `tour_source_tur_v_kolumbiyu_za_chudesami` | Тур в Колумбию за чудесами: Богота, Картахена, Вилья-де-Лейва · `/colombia/tour/colombia-bogota-cartagena-villa-de-leyva/` | `src/content/tours/tur-v-kolumbiyu-za-chudesami.md` | 0 | `27810073c8f5b99b05c2dcc28a590d662e574c8fcaa1cfa2d45036b053ef6d0d` |
| 502 | `tour_source_manyashchaya_kolumbiya_kofe_tur` | Тур в Колумбию на 10 дней в Боготу, Медельин, Картахену с кофе-туром · `/colombia/tour/colombia-bogota-medellin-cartagena-coffee-10-days/` | `src/content/tours/manyashchaya-kolumbiya-kofe-tur.md` | 0 | `e2f57a6a02a796693c5ab71f888f4bd8ccba4751ccba0a9c7acb16f8d65b4fc6` |
| 503 | `tour_source_tur_v_kolumbiyu_na_12_dnej` | Тур в Колумбию на 12 дней по лучшим местам с пляжным отдыхом · `/colombia/tour/colombia-highlights-beaches-12-days/` | `src/content/tours/tur-v-kolumbiyu-na-12-dnej.md` | 1 | `44706cfcdf250bbf00185bcbfc7e267ded05c4c8f48a9ead3b5c1763252796bf` |
| 504 | `tour_source_ikonicheskaya_kolumbiya` | Тур в Колумбию на 14 дней - города, культура, горы и Карибы · `/colombia/tour/iconic-colombia-14-days/` | `src/content/tours/ikonicheskaya-kolumbiya.md` | 0 | `00e418978bb8cd9421e7d011dd99511bf45789670863fd2c87b22a44c6e0962c` |
| 505 | `tour_source_colombia_bogota_cultural_ru` | Тур в Колумбию на 8 дней: Богота, Медельин и Картахена · `/colombia/tour/colombia-bogota-medellin-cartagena-cultural-tour-8-days/` | `src/content/tours/colombia-bogota-cultural-ru.md` | 0 | `dbd00a28d7a45e0a85332ef6c26d325b041f9adc93fc8ac97aa8844ff9538874` |
| 506 | `tour_source_kolumbiya_bogota_ekhe_kafetero_kartakhena` | Тур в Колумбию на 9 дней в Боготу, Картахену, Перейру и на озеро Гуатавита · `/colombia/tour/colombia-bogota-eje-cafetero-cartagena-9-days/` | `src/content/tours/kolumbiya-bogota-ekhe-kafetero-kartakhena.md` | 0 | `24dbca634c7c89a630ad7dcae934487492860c3043f97012e90b082c002710d8` |
| 507 | `tour_source_manyashchaya_kolumbiya` | Тур в Колумбию – Богота, Картахена, Медельин, Сипакира и Гуатапе · `/colombia/tour/colombia-bogota-cartagena-medellin-zipaquira-guatape/` | `src/content/tours/manyashchaya-kolumbiya.md` | 0 | `5bae805548a3fa1bf012e8d3d476e0d9a9271dcafead7adc85cab0261f7d91b3` |
| 508 | `tour_source_vkusy_kolumbii` | Тур в Колумбию – Богота, Медельин и Картахена за 9 дней · `/colombia/tour/colombia-bogota-medellin-cartagena-9-days/` | `src/content/tours/vkusy-kolumbii.md` | 0 | `00760df0f21c428c96583189a29e0882c81cbe0ef9be8a24e32d0c388c994e84` |
| 509 | `tour_source_fantasticheskaya_kolumbiya` | Тур в Колумбию: Богота, Картахена, Медельин, острова Росарио и Санта-Марта · `/colombia/tour/colombia-bogota-cartagena-medellin-rosario-islands-santa-marta/` | `src/content/tours/fantasticheskaya-kolumbiya.md` | 0 | `6b785ed417295974f102e98f9691e80372cbbac954751e0ff8fa36ba33e3baf4` |
| 510 | `tour_source_kolumbiya_2024_kulturnaya` | Тур в Колумбю на 6 дней: культура и история Боготы и Картахены · `/colombia/tour/colombia-bogota-cartagena-culture-6-days-2024/` | `src/content/tours/kolumbiya-2024-kulturnaya.md` | 0 | `98ff7b266a9252f66da697516543e0f8b8eadbb5cab08516f3a7400d5fe6eae5` |
| 511 | `tour_source_3_vzglyada_na_kosta_riku` | 3 Взгляда на Коста Рику · `/costa-rica/tour/costa-rica-3-perspectives/` | `src/content/tours/3-vzglyada-na-kosta-riku.md` | 0 | `6a3184fd9d900ce084f417c80cbaa7f51ed4302f8e25d3c20acccd0adaaa7c68` |
| 512 | `tour_source_5_chudes_kosta_riki` | 5 Чудес Коста Рики · `/costa-rica/tour/costa-rica-5-wonders/` | `src/content/tours/5-chudes-kosta-riki.md` | 0 | `8e18b0c6d24399c8cb87bcb656b91516334d94563baffaee993e8d375ad28421` |
| 513 | `tour_source_pybalka_v_kosta_rike` | Pыбалка в Коста-Рике · `/costa-rica/tour/costa-rica-fishing/` | `src/content/tours/pybalka-v-kosta-rike.md` | 0 | `9b5ed2edf50b55ed276ba310e9437fc4f88bdb97c9051b5b7b1473596950eeee` |
| 514 | `tour_source_kosta_rika` | Базовая Коста-Рика · `/costa-rica/tour/costa-rica-essentials/` | `src/content/tours/kosta-rika.md` | 0 | `f82b6b549e014204f82d14a22b71212bd2c0ca7c5510676c4891dd4400263045` |
| 516 | `tour_source_zhemchuzhiny_kosta_riki_za_10_dnej` | Жемчужины Коста-Рики · `/costa-rica/tour/costa-rica-pearls-10-days/` | `src/content/tours/zhemchuzhiny-kosta-riki-za-10-dnej.md` | 0 | `71ce5cf6f6f550bd35d7fd49a9c8b7b69b5331a77dee63cfe877dcf36fdc4a01` |
| 517 | `tour_source_kosta_rika_dlya_lyubitelej_prirody` | Коста Рика для любителей природы · `/costa-rica/tour/costa-rica-for-nature-lovers/` | `src/content/tours/kosta-rika-dlya-lyubitelej-prirody.md` | 0 | `08c4184748559aea8ceaf93f09353b83f25c2244df558609eae2ecfbe9a80963` |
| 518 | `tour_source_kosta_rika_za_5_dnej` | Коста Рика за 5 дней · `/costa-rica/tour/costa-rica-5-days/` | `src/content/tours/kosta-rika-za-5-dnej.md` | 0 | `58e2e77393c897281bce22a7b280b2bea20988e85e2323ab6ddeb5c1810da1d1` |
| 519 | `tour_source_kosta_rika_korotkaya_no_polnaya_programma` | Коста Рика: Короткая, но полная программа · `/costa-rica/tour/costa-rica-short-complete-tour/` | `src/content/tours/kosta-rika-korotkaya-no-polnaya-programma.md` | 0 | `8c0fd73835c8eaf9852fe3a0fd93ce07c4b9194a90dd7baf628c6f8d0e549ba7` |
| 520 | `tour_source_kosta_rika_otdykh_na_plyazhe_i_v_gorakh` | Коста Рика: Отдых на пляже и в горах · `/costa-rica/tour/costa-rica-beaches-mountains/` | `src/content/tours/kosta-rika-otdykh-na-plyazhe-i-v-gorakh.md` | 0 | `8b6486c7ef392d0283fda258d9711da435b16731824007ebf5f18f12e6a5005c` |
| 521 | `tour_source_kosta_rika_nastoyashchie_dragotsennosti` | Коста-Рика: Настоящие Драгоценности · `/costa-rica/tour/costa-rica-gems/` | `src/content/tours/kosta-rika-nastoyashchie-dragotsennosti.md` | 0 | `436d2e8c25efbde5dcf15323a6f948d51d160ef341e6a2324902ad7e1ece3acd` |
| 522 | `tour_source_kostarikanskie_sokrovishcha` | Костариканские сокровища · `/costa-rica/tour/costa-rica-treasures/` | `src/content/tours/kostarikanskie-sokrovishcha.md` | 0 | `c10438103dbe3bd48d34a03a506f2d993554aecf424725964cc6ebc7df836082` |
| 523 | `tour_source_krasivaya_kosta_rika` | Красивая Коста Рика · `/costa-rica/tour/beautiful-costa-rica/` | `src/content/tours/krasivaya-kosta-rika.md` | 0 | `8f97efa5b51edf5544e75c8ebae20d6d63f3d761ee51498b42e44e7d3d04c98e` |
| 524 | `tour_source_costa_rica` | На машине по Коста Рике 2024 · `/costa-rica/tour/costa-rica-self-drive-2024/` | `src/content/tours/costa-rica.md` | 0 | `d0e0aaf5cba1a10c239c1585bd2c1642d7d61605ab3b20899993eb1b1c9d4822` |
| 525 | `tour_source_treasures_of_costa_rica_san_jose` | Настоящие Сокровища Коста-Рики · `/costa-rica/tour/costa-rica-san-jose-treasures/` | `src/content/tours/treasures-of-costa-rica-san-jose.md` | 0 | `69c43b15f88a7547d07219ec4bb966d26fdea4cbeeb3422d03138bab4c2da514` |
| 526 | `tour_source_panama_i_kosta_rika` | Панама и Коста Рика · `/multi-country/tour/panama-costa-rica/` | `src/content/tours/panama-i-kosta-rika.md` | 0 | `0a93728686091bdc8b9b71014322f00010be4df48c43a5a046b72ede56cc74f1` |
| 527 | `tour_source_klassicheskaya_kosta_rika` | Тур в Коста-Рику, Сан-Хосе, в леса Монтеверде и на вулкан Ареналь · `/costa-rica/tour/classic-costa-rica-san-jose-monteverde-arenal/` | `src/content/tours/klassicheskaya-kosta-rika.md` | 0 | `0779717bfec3ca1d8d913b7768bddf59b699bdadf917671ecd98edc78e206407` |
| 528 | `tour_source_luchshee_v_kosta_rike` | Тур в Коста-Рику- лучшее в Коста Рике · `/costa-rica/tour/best-of-costa-rica/` | `src/content/tours/luchshee-v-kosta-rike.md` | 0 | `76788f4a630f56308f91017a65467731fb2796c398ae0f5a903735a4b1496501` |
| 529 | `tour_source_3_shaga_po_kosta_rike` | Тур в Коста-Рику: Ареналь, Сан-Хосе и пляжный отдых на Тихом океане · `/costa-rica/tour/costa-rica-arenal-san-jose-pacific-beach/` | `src/content/tours/3-shaga-po-kosta-rike.md` | 0 | `72ef76040511788d0f7cec109136af7ff12b882a5dbe92d1e982488244dcc0e1` |
| 530 | `tour_source_ekonomichnaya_kosta_rika` | Экономичная Коста Рика · `/costa-rica/tour/budget-costa-rica/` | `src/content/tours/ekonomichnaya-kosta-rika.md` | 0 | `b434466b1b30fa7a734078cc2b3ddff3969e071ee0f672f6573517d6f0498beb` |
| 531 | `tour_source_ekstrim_v_kosta_rike` | Экстремальная Коста-Рика · `/costa-rica/tour/costa-rica-extreme-adventure/` | `src/content/tours/ekstrim-v-kosta-rike.md` | 0 | `b2189a9ab21b7281242b19df7b255fda1c76c82d8a1cde89d1845e47964ad779` |
| 532 | `tour_source_bolshie_meksikanskie_kanikuly` | Большие Мексиканские Каникулы · `/mexico/tour/grand-mexico-holiday/` | `src/content/tours/bolshie-meksikanskie-kanikuly.md` | 0 | `b7eb96ac7a047757dfe36e73887b5552bb77f5819144b81f8342329e717691e7` |
| 534 | `tour_source_vsya_meksika` | Вся Мексика · `/mexico/tour/complete-mexico/` | `src/content/tours/vsya-meksika.md` | 0 | `090778e6f9e3f943861a704033d33a552f604fd9fa810732bd8c5c32cc5ec726` |
| 535 | `tour_source_gastronomicheskoe_turne_po_meksike` | Гастрономическое турне по Мексике · `/mexico/tour/mexico-gastronomic-tour/` | `src/content/tours/gastronomicheskoe-turne-po-meksike.md` | 0 | `b4baf02368d1bcc2873c669bca4d29e25a278a9fccbefb121c0acb3a0f56bf69` |
| 536 | `tour_source_meksika_den_mertvykh` | День Мертвых в Мексике · `/mexico/tour/mexico-day-of-the-dead/` | `src/content/tours/meksika-den-mertvykh.md` | 0 | `00190007ee2d6e44b66f73fcad057b4ca89f2a352e0803ecb25116184b7e6dc8` |
| 537 | `tour_source_mexico_city_keretaro` | Колониальные Сокровища Мексики · `/mexico/tour/mexico-city-queretaro-colonial-treasures/` | `src/content/tours/mexico-city-keretaro.md` | 0 | `a3ad4939506a971f106ea010237c5634da7655de1b182d4ce706f62493b09815` |
| 538 | `tour_source_meksika_fantasticheskaya` | Мексика Фантастическая · `/mexico/tour/fantastic-mexico/` | `src/content/tours/meksika-fantasticheskaya.md` | 0 | `2b8f18158c666237bc8ae327837b5cdd1ccf11dc88db1123be86623aabf32109` |
| 539 | `tour_source_meksika_yuzhnoe_priklyuchenie_kratkij_marshrut` | Мексика: «Южное Приключение — Краткий маршрут» · `/mexico/tour/southern-mexico-short-adventure/` | `src/content/tours/meksika-yuzhnoe-priklyuchenie-kratkij-marshrut.md` | 0 | `c388db3fe6da3a12019a2b5ce5fc2dd4d292400ca38488003f24cc11d6bdc587` |
| 540 | `tour_source_meksika_treugolnik_solntsa` | Мексика: Треугольник Солнца · `/mexico/tour/mexico-triangle-of-the-sun/` | `src/content/tours/meksika-treugolnik-solntsa.md` | 0 | `42213dca8fc3d028ca0dcd0ad53d28c4ac1e926e9a2da7b1bd7c968b41a04d7d` |
| 541 | `tour_source_cancun_palenque_cenot` | Тур в Мексику Канкун, Тулум, Паленке, Ушмаль, Чичен Ица · `/mexico/tour/mexico-cancun-tulum-palenque-uxmal-chichen-itza/` | `src/content/tours/cancun-palenque-cenot.md` | 0 | `031bdfb4e0dcf74d0e8bf01c6e1caf2398d21895076562a5ed4d8bb89d083e5f` |
| 542 | `tour_source_meksika_lindo` | Тур в Мексику: Мехико- Мерида - Ушмаль и Кабах - Чичен-Ица · `/mexico/tour/mexico-city-merida-uxmal-kabah-chichen-itza/` | `src/content/tours/meksika-lindo.md` | 0 | `14785da34f4623a38659a329b83cd82225d514325ac6b7bbc1ba731683b21aff` |
| 543 | `tour_source_udivitelnyj_gastronomicheskij_tur_po_meksike_2024` | Удивительный Гастрономический Тур по Мексике по цене 3276$ \|Ada Tours · `/mexico/tour/mexico-gourmet-discovery-2024/` | `src/content/tours/udivitelnyj-gastronomicheskij-tur-po-meksike-2024.md` | 0 | `c92ed5c8f11a42e295ec4d282177836692ff520fc2c8b2f6154e0c021ca406e1` |
| 544 | `tour_source_fantasticheskij_tur_po_meksike` | Фантастический Тур по Мексике · `/mexico/tour/fantastic-mexico-tour/` | `src/content/tours/fantasticheskij-tur-po-meksike.md` | 0 | `1fa5014b93182c96d4be09c68c42f8b93e289b57a617473fc1eb4fadad9cd195` |
| 545 | `tour_source_vip_kosta_rika_nikaragua` | ВИП-тур в Коста-Рику и Никарагуа \| На частном самолете · `/multi-country/tour/costa-rica-nicaragua-vip-private-plane/` | `src/content/tours/vip-kosta-rika-nikaragua.md` | 1 | `0c7dc31839cbafa6c79c91b31413fae3ba4acf14fa60f8e7de67efca39a16c2c` |
| 546 | `tour_source_costa_rica_nicaragua_ru` | Коста Рика Никарагуа · `/multi-country/tour/costa-rica-nicaragua/` | `src/content/tours/costa-rica-nicaragua-ru.md` | 0 | `15f138ab6ed9bf1e8e4fd10743171d4a9b4993a17908486fd57c0308ebf19c08` |
| 547 | `tour_source_luchshee_v_tsentralnoj_amerike` | Лучшее в Центральной Америке · `/multi-country/tour/best-of-central-america/` | `src/content/tours/luchshee-v-tsentralnoj-amerike.md` | 0 | `f40a4a6515ffa580bba74164d764cb1fb73218fdb71f7c6c38637e9ff53ac66d` |
| 548 | `tour_source_panama_kosta_rika_nikaragua` | Панама – Коста Рика- Никарагуа · `/multi-country/tour/panama-costa-rica-nicaragua/` | `src/content/tours/panama-kosta-rika-nikaragua.md` | 0 | `88ba5300423c085aa0e29c4b5bc849c1be22af6dcab39c380b6b71263aad1df1` |
| 549 | `tour_source_otbleski_tsentralnoj_ameriki_v_5_stranakh` | Тур в Гватемалу, Гондурас, Сальвадор, Никарагуа и Коста-Рику на 19 дней · `/multi-country/tour/central-america-5-countries-19-days/` | `src/content/tours/otbleski-tsentralnoj-ameriki-v-5-stranakh.md` | 0 | `0c935380f4723f5621f6e997990924afc142d3a46e984d72e93e1a3a68e8e78d` |
| 550 | `tour_source_otbleski_tsentralnoj_ameriki` | Тур в Центральную Америку: лучшие достопримечательности · `/multi-country/tour/central-america-highlights/` | `src/content/tours/otbleski-tsentralnoj-ameriki.md` | 0 | `bd0576eccda568889ed9f2ef79d11a21f03baa7b3a71f5b73751f10ab8e24860` |
| 551 | `tour_source_vsya_panama_natsionalnye_parki_ostrova_i_doliny` | Вся Панама: Национальные парки, острова и долины · `/panama/tour/panama-national-parks-islands-valleys/` | `src/content/tours/vsya-panama-natsionalnye-parki-ostrova-i-doliny.md` | 1 | `d3b4f276cd036ee0298eab23dbe5e0ee368772068a3222da4265f5f43f0ee62d` |
| 552 | `tour_source_luchshee_v_paname` | Лучшее в Панаме 2023 · `/panama/tour/best-of-panama-2023/` | `src/content/tours/luchshee-v-paname.md` | 0 | `a49f840a6a4d44656ee292de55eeed6379c024fe2c753af40093e1c85f55d0e8` |
| 553 | `tour_source_lyuksovyj_tur_v_panamu_s_plyazhnym_otdyhom_na_ostrove_baru` | Люксовый тур в Панаму: 12 дней vip отдыха \| Ada Tours · `/panama/tour/luxury-panama-baru-island-12-days/` | `src/content/tours/lyuksovyj-tur-v-panamu-s-plyazhnym-otdyhom-na-ostrove-baru.md` | 0 | `f7376fe574a643a2c86795ffcc817a44405b8b112a9c6c25d32d738854138fc8` |
| 554 | `tour_source_panama_2024` | Панама · `/panama/tour/panama-2024/` | `src/content/tours/panama-2024.md` | 0 | `c12da03a57c22cdcb43eb5e17bc84da0326cea3f8fab4cb6e3aa82f62a75ed12` |
| 555 | `tour_source_panama_panama_siti_dolina_anton_krepost_san_lorenso` | Панама · `/panama/tour/panama-city-anton-valley-san-lorenzo/` | `src/content/tours/panama-panama-siti-dolina-anton-krepost-san-lorenso.md` | 1 | `9ba5305a4083c58419cc1f90310fb3e67a4b17ad52845afc33cd751149bd8ff0` |
| 556 | `tour_source_ostrova_san_blas_na_yakhte_lyuks_klassa` | Тур на яхте класса ВИП (люксовый) по островам Сан-Блас, Панама · `/panama/tour/panama-san-blas-luxury-yacht/` | `src/content/tours/ostrova-san-blas-na-yakhte-lyuks-klassa.md` | 0 | `aff78cf5a4b2e15157afd576ef2f8b0ca8102544d6081044db8a0808bac855c4` |
| 557 | `tour_source_klassicheskij_paragvaj` | Парагвай 2023 · `/paraguay/tour/classic-paraguay-2023/` | `src/content/tours/klassicheskij-paragvaj.md` | 0 | `a2e9effb679f59ed0df742ae46bb2cba87b097e93200d7f25ca54abe51034e25` |
| 558 | `tour_source_tur_po_uruguayu_i_paragvayu_16_dnej` | Тур в Уругвай и Парагвай 2026: скрытые сокровища Южной Америки \| 16 дней · `/multi-country/tour/uruguay-paraguay-16-days-2026/` | `src/content/tours/tur-po-uruguayu-i-paragvayu-16-dnej.md` | 2 | `8bc907da4ed082215263a176affb2f25d4d99c2c4ceaa66408cb109b14f4ef3e` |
| 559 | `tour_source_vip_tur_v_boliviyu_i_peru_na_18_dnej_s_kruizom_po_amazonke` | VIP тур в Перу 18 дней: Мачу-Пикчу, Амазонка и солончак Уюни · `/multi-country/tour/peru-bolivia-amazon-cruise-vip-18-days/` | `src/content/tours/vip-tur-v-boliviyu-i-peru-na-18-dnej-s-kruizom-po-amazonke.md` | 0 | `c8dc31f6a3047cb5663963a077a60ce06317c379ce2f32d38400e683a9c427ae` |
| 560 | `tour_source_ves_mnogolikij_peru_plyazhi_tumbesa` | Весь Многоликий Перу + пляжи Тумбеса · `/peru/tour/complete-peru-tumbes-beaches/` | `src/content/tours/ves-mnogolikij-peru-plyazhi-tumbesa.md` | 2 | `407c8edd8769cf8a443b3c092e8c6162c4ae720d1de9e3ffab95314069a9b03e` |
| 562 | `tour_source_vip_tur_v_peru` | Вип тур в Чили, Боливию и Перу · `/multi-country/tour/chile-bolivia-peru-vip/` | `src/content/tours/vip-tur-v-peru.md` | 0 | `0eccbc5da45b73f64be4de87224f3441a99aa7a994aeb6fb0a09783dcc059401` |
| 563 | `tour_source_vip_puteshestvie_v_imperiyu_inkov_na_8_dnej` | Люксовый индивидуальный тур в Перу «Инка Делюкс» \| Ada Tours · `/peru/tour/peru-inca-deluxe-8-days/` | `src/content/tours/vip-puteshestvie-v-imperiyu-inkov-na-8-dnej.md` | 3 | `e49b485609ec9a83adc6f0c3c8005cc075fbda2825afced395f8f79f0e217db8` |
| 564 | `tour_source_manyashchij_peru_i_ikitos` | Манящий ПЕРУ +ИКИТОС · `/peru/tour/peru-iquitos-discovery/` | `src/content/tours/manyashchij-peru-i-ikitos.md` | 6 | `12cec927c2cabdaa7ec8046b69171f3d4c2c8044dc0a689742a75b14734328f1` |
| 565 | `tour_source_peru_i_boliviya` | Перу и Боливия · `/multi-country/tour/peru-bolivia/` | `src/content/tours/peru-i-boliviya.md` | 0 | `5a122b95d54de69c4dde7c2ddce2a2e37f782d170c58ccbc7e6b2293aa50b723` |
| 567 | `tour_source_peru_ictoriya_velikoj_imperii_i_prazdnik_svyatoj_kandelyarii` | Перу: Иcтория Великой Империи и праздник Святой Канделярии · `/peru/tour/peru-inca-empire-candelaria-festival/` | `src/content/tours/peru-ictoriya-velikoj-imperii-i-prazdnik-svyatoj-kandelyarii.md` | 1 | `e6ff9efb0882dc7578160381836d0e141d1ee207f2e345fd4426883a4246f11c` |
| 568 | `tour_source_peru_expeditoin_ru` | Перу: Энергия Предков · `/peru/tour/peru-ancestral-energy/` | `src/content/tours/peru-expeditoin-ru.md` | 0 | `8dac8d29cec1890db6827f8268e5a4b82d9e9300a5d97cf3d4e2be8fcc1e3e1c` |
| 569 | `tour_source_ves_mnogolikij_peru_ikitos` | Тур в Перу "Весь Многоликий Перу и Икитос" на 15 дней · `/peru/tour/complete-peru-iquitos-15-days/` | `src/content/tours/ves-mnogolikij-peru-ikitos.md` | 2 | `f05f46061e0c886286ecb248e0b2500aa6649a5d2f2df6c7a81c847901a2aa72` |
| 570 | `tour_source_peru_strana_inkov` | Тур в Перу на 6 дней: Лима, Куско и Мачу Пикчу · `/peru/tour/peru-lima-cusco-machu-picchu-6-days/` | `src/content/tours/peru-strana-inkov.md` | 0 | `3f30c77d33d4881d85d553cffc8a3b00f7f248641d9015cc068ac1eb91eb70f5` |
| 571 | `tour_source_peru_priklyucheniya_v_andakh_s_belmond_kollektsiej` | Тур в Перу на поезде Belmond Hiram Bingham в Мачу-Пикчу · `/peru/tour/peru-belmond-hiram-bingham-machu-picchu/` | `src/content/tours/peru-priklyucheniya-v-andakh-s-belmond-kollektsiej.md` | 0 | `4f52f1ef7b7aee8818cfe06ce1a4487b7ffad86b2ebec9193b441e7a427f02ad` |
| 572 | `tour_source_21_dnevnoe_priklyuchenie_v_peru` | Тур в Перу – лучшее в стране за 21 день · `/peru/tour/best-of-peru-21-days/` | `src/content/tours/21-dnevnoe-priklyuchenie-v-peru.md` | 0 | `f0d354b04c5c866c8af9cf163fc1ed7547bf2627431d5ae59b2dd42d24b34d1a` |
| 573 | `tour_source_ves_mnogolikij_peru_i_senor_sipan` | Тур в Перу: Лима, Куско, Мачу-Пикчу, Арекипа, Пуно, Tрухильо, Чиклайо · `/peru/tour/peru-lima-cusco-machu-picchu-arequipa-puno-trujillo-chiclayo/` | `src/content/tours/ves-mnogolikij-peru-i-senor-sipan.md` | 2 | `f77134874753523568673fc8c199db70207f7f82d29ddb71540b50da733a4f3a` |
| 574 | `tour_source_ves_mnogolikij_peru` | Тур в Перу: Лима, Куско, Титикака, Колка, Арекипа, пустыня Наска · `/peru/tour/peru-lima-cusco-titicaca-colca-arequipa-nazca/` | `src/content/tours/ves-mnogolikij-peru.md` | 2 | `5f4a52a4abc678e66b1c935f2b14ccb32c5fff659df60a9275762cbae47e39fd` |
| 575 | `tour_source_vpechatlenie_ot_surinama` | Впечатление от Суринама · `/suriname/tour/suriname-impressions/` | `src/content/tours/vpechatlenie-ot-surinama.md` | 0 | `563b4728e69e706efc88eb408e3f0af4141189a6d8961e026d87f18f9e6c1895` |
| 576 | `tour_source_velikolepnyj_surinam` | Индивидуальный тур в Суринам на 12 дней: джунгли и культура · `/suriname/tour/suriname-jungle-culture-private-tour-12-days/` | `src/content/tours/velikolepnyj-surinam.md` | 0 | `e0c0c287667277a0598676b6d26f953692d1d880a46b14315f7ddebe6af00df5` |
| 577 | `tour_source_vpechatleniya_ot_surinama` | Суринам · `/suriname/tour/experience-suriname/` | `src/content/tours/vpechatleniya-ot-surinama.md` | 0 | `6a73b1f6d83e659da52656e659967e0dce858469bb3a90d592d033922a041048` |
| 578 | `tour_source_luchshee_v_urugvae_pyatizvjozdochnyj_marshrut` | Лучшее в Уругвае: пятизвёздочный маршрут · `/uruguay/tour/best-of-uruguay-five-star-tour/` | `src/content/tours/luchshee-v-urugvae-pyatizvjozdochnyj-marshrut.md` | 0 | `73581ab10295033aed16d77846b9ec1e7c82b9d9ec2c384c84b4331d66d628b1` |
| 579 | `tour_source_urugvaj_vino_i_traditsii_starovertsev` | Уругвай: Вино и Традиции Староверцев -тур от туроператора Ада Турс · `/uruguay/tour/uruguay-wine-old-believer-traditions/` | `src/content/tours/urugvaj-vino-i-traditsii-starovertsev.md` | 0 | `1f27a0485837b644b9c19b0b6017f965bc7c3665235f8e01522ce1083b1b706b` |
| 580 | `tour_source_priklyuchenie_v_gvianakh` | Приключение в Гвианах · `/multi-country/tour/guianas-adventure/` | `src/content/tours/priklyuchenie-v-gvianakh.md` | 0 | `3f5ecc3353c2729ed6fd4be3f9ed0eae36f5084ac755385c252d16d4154b7671` |
| 581 | `tour_source_surinam_gajana_frantsuzskaya_gviana` | Суринам, Гайана, Французская Гвиана · `/multi-country/tour/suriname-guyana-french-guiana/` | `src/content/tours/surinam-gajana-frantsuzskaya-gviana.md` | 0 | `306cd6fa77a2b1a922122ef5fb2955b30df483b7d5a9e493b8b3ee80c6007559` |
| 582 | `tour_source_vip_chili_5` | VIP Чили 5* · `/chile/tour/chile-five-star-vip/` | `src/content/tours/vip-chili-5.md` | 0 | `caa46662acd7c9dc4b06ff5b9399e7a7dec257db37cbf524559c0c3c71cde1d3` |
| 583 | `tour_source_tur_v_chili_luchshee_v_strane_i_gastronomiya_gurme` | VIP тур в Чили: Атакама, Патагония и гастрономия \| Ada Tours · `/chile/tour/chile-vip-atacama-patagonia-gourmet/` | `src/content/tours/tur-v-chili-luchshee-v-strane-i-gastronomiya-gurme.md` | 0 | `e2d098a4aeabe0786b1ac4d25ea096e74f1de0f0fb5bf03385423cdc55fbfe1c` |
| 584 | `tour_source_antarktida_programma_s_nochevkoj` | Антарктида: программа с ночевкой · `/antarctica/tour/antarctica-overnight-program/` | `src/content/tours/antarktida-programma-s-nochevkoj.md` | 0 | `eea03a099b1858f2e9bb5b75e2330a380f1a249a146edcad0033184663d0acfa` |
| 585 | `tour_source_chili_zagadki_chelovechestva` | Индивидуальный тур в Чили и на остров Пасхи на 10 дней · `/chile/tour/chile-easter-island-private-tour-10-days/` | `src/content/tours/chili-zagadki-chelovechestva.md` | 0 | `6748893237ce33d72d1f961897e4455db22adac2feb85e69b779a58531547cc8` |
| 586 | `tour_source_klassicheskaya_antarktida` | Классическая Антарктика · `/antarctica/tour/classic-antarctica-air-cruise-8-days/` | `src/content/tours/klassicheskaya-antarktida.md` | 0 | `1f24a30119985a5061cb731de0f436a46d5154efafc1b63d093c8360ab2ce3fa` |
| 587 | `tour_source_klassicheskaya_antarktika` | Классическая Антарктика · `/antarctica/tour/classic-antarctic-air-cruise-8-days/` | `src/content/tours/klassicheskaya-antarktika.md` | 0 | `16bc1cc8039d16150a971e028fbba61d7eb20f1e140545a52c4cff481486b936` |
| 588 | `tour_source_koloritnyj_santyago_i_zagadochnyj_ostrov_paskhi` | Колоритный Сантьяго и загадочный остров Пасхи · `/chile/tour/santiago-easter-island/` | `src/content/tours/koloritnyj-santyago-i-zagadochnyj-ostrov-paskhi.md` | 0 | `4ad1a929e5599626f1fa9d79e26e612edde64e257b0cc4e843f20be267b2777f` |
| 589 | `tour_source_nezabyvaemyj_tur_v_antarktidu_s_nochevkoj` | Незабываемый тур в Антарктиду(с ночевкой) · `/antarctica/tour/antarctica-overnight-adventure/` | `src/content/tours/nezabyvaemyj-tur-v-antarktidu-s-nochevkoj.md` | 0 | `b6e1e9bdf349329482fefbde921366e7abb1817a30f0570bd12d524feca03257` |
| 590 | `tour_source_antarktida_programma_na_ves_den` | Тур в Антарктиду на весь день из Пунта-Аренас (Чили) · `/antarctica/tour/antarctica-day-tour-from-punta-arenas/` | `src/content/tours/antarktida-programma-na-ves-den.md` | 0 | `c138bafaf22492b56502bd1ab5b793da60f9075d702307d2223c2b0c0bf10653` |
| 591 | `tour_source_chili_samoe_luchshee` | Тур в Чили на 12 дней по лучшим местам страны с о.Пасха · `/chile/tour/best-of-chile-easter-island-12-days/` | `src/content/tours/chili-samoe-luchshee.md` | 0 | `fcc219e07ecbd747e4603eec0889e48b348dd74ae279a1c8910465c2b7d589d5` |
| 592 | `tour_source_chili_santyago_pustynya_atakama_torres_del_pajne` | Тур в Чили с пустыней Аатакама и парком Торрес-дель-Пайне в Патагонии · `/chile/tour/chile-santiago-atacama-torres-del-paine/` | `src/content/tours/chili-santyago-pustynya-atakama-torres-del-pajne.md` | 0 | `f7907e620a3a5f8a26590b34ed636fedbdf1df8a1ab38acfe5c3f30558728ba7` |
| 594 | `tour_source_chili_kosmicheskoe_puteshestvie_na_zemle` | Чили: Космическое путешествие на Земле · `/chile/tour/chile-otherworldly-journey/` | `src/content/tours/chili-kosmicheskoe-puteshestvie-na-zemle.md` | 1 | `914dac6cb1674747deb479fc21d44f228d18a19444e64d2fabd6bafbbc14f229` |
| 595 | `tour_source_lyuksovyj_tur_v_peru_i_ehkvador_s_galapagosami_na_18_dnej` | VIP тур в Перу и Эквадор 18 дней: Мачу-Пикчу, Амазонка и Галапагосы · `/multi-country/tour/peru-ecuador-galapagos-luxury-18-days/` | `src/content/tours/lyuksovyj-tur-v-peru-i-ehkvador-s-galapagosami-na-18-dnej.md` | 0 | `3cde905a0b89881091364b3d2de0f512611b48020428b25e7512495db93c415d` |
| 596 | `tour_source_aktivnyj_ekvador_i_trekking` | Активный Эквадор и Треккинг · `/ecuador/tour/active-ecuador-trekking/` | `src/content/tours/aktivnyj-ekvador-i-trekking.md` | 0 | `fc0c046596e321a6a45d7cb15e9775dc8d54622a3ec184e8731a29267b2a6202` |
| 597 | `tour_source_aktivnyj_ekvador` | Активный Эквадор тур в Эквадор · `/ecuador/tour/active-ecuador/` | `src/content/tours/aktivnyj-ekvador.md` | 0 | `36491df98c3c034337306adf531eea1d99548dc84591080bb966837621b4ac09` |
| 598 | `tour_source_ves_ekvador_na_novyj_god` | Весь Эквадор · `/ecuador/tour/complete-ecuador-new-year/` | `src/content/tours/ves-ekvador-na-novyj-god.md` | 2 | `b616d07a26b10a2182c8347df5a1e5e2e0f7938f1502a628d4362fd19c44d558` |
| 599 | `tour_source_ves_ekvador_i_galapagosskie_ostrova` | Весь Эквадор и Галапагосские острова · `/ecuador/tour/complete-ecuador-galapagos-islands/` | `src/content/tours/ves-ekvador-i-galapagosskie-ostrova.md` | 2 | `2cbcb32135d77f9d31d97c267344258c7e05c2b4940f88d7e555efe31f4a00f2` |
| 600 | `tour_source_ves_ekvador_variant_1` | Индивидуальный тур в Эквадор (континентальный) на 5 дней · `/ecuador/tour/mainland-ecuador-private-tour-5-days/` | `src/content/tours/ves-ekvador-variant-1.md` | 0 | `402218ec9d5cbbd38fd122218b6cc679f0454484afc276e815800cd446e6c124` |
| 601 | `tour_source_luchshee_v_ekvadore_garantirovannye_zaezdy` | Лучшее в Эквадоре: Гарантированные заезды · `/ecuador/tour/best-of-ecuador-guaranteed-departures/` | `src/content/tours/luchshee-v-ekvadore-garantirovannye-zaezdy.md` | 2 | `e3ade2a98940df135dbefdae929648dd6200a48419092e7714b3c78282b8a4f8` |
| 602 | `tour_source_pochuvstvujte_peru_ekvador` | Почувствуйте Перу-Эквадор · `/multi-country/tour/experience-peru-ecuador/` | `src/content/tours/pochuvstvujte-peru-ekvador.md` | 2 | `02aadcdd8546df21abacb7927d26a66801a83791e379437abecfebb90c7fa67e` |
| 603 | `tour_source_kontinentalnyj_ekvador_roskoshnoe_puteshestvie` | Тур в Эквадор (континентальный) на 9 дней: лучшее в стране · `/ecuador/tour/luxury-mainland-ecuador-9-days/` | `src/content/tours/kontinentalnyj-ekvador-roskoshnoe-puteshestvie.md` | 0 | `4c4a687dc91a3da52e161f57329288afaf1bf9e4919482306513d8a69edba0fd` |
| 604 | `tour_source_ekvador_s_udovolstviem` | Тур в Эквадор и Галапагосы: по лучшим заповедным местам · `/ecuador/tour/ecuador-galapagos-nature-discovery/` | `src/content/tours/ekvador-s-udovolstviem.md` | 2 | `330b99c69dd0c5dfb7866567234c6ca5cb22cecea434a47a8ab45f7395dc22e2` |
| 605 | `tour_source_ekvador_aktivnyj_tur_s_galapagossom` | Тур в Эквадор и на Галапагосские острова (активити-тур) на 17 дней · `/ecuador/tour/ecuador-galapagos-adventure-17-days/` | `src/content/tours/ekvador-aktivnyj-tur-s-galapagossom.md` | 3 | `fe748423c0ffb23b3a40eb4188e876c58095253a39c89dd1bb18bb334bbe6474` |
| 607 | `tour_source_ekvador_i_galapagosskie_ostrova_v_iyule` | Тур в Эквадор и на Галапагосские острова – Кито, Килотоа, Миндо · `/ecuador/tour/ecuador-galapagos-quito-quilotoa-mindo-july/` | `src/content/tours/ekvador-i-galapagosskie-ostrova-v-iyule.md` | 0 | `f130f1b4842ae84ba8e04a7aa25699281a4790eac613bd8e3cdb2b35cf8394f8` |
| 608 | `tour_source_ekvador_v_sentyabre` | Тур в Эквадор на 11 дней: Кито, Килотоа, Баньос, Амазония · `/ecuador/tour/ecuador-quito-quilotoa-banos-amazon-september-11-days/` | `src/content/tours/ekvador-v-sentyabre.md` | 7 | `5a0e4f3fc6cb78dca863ea3a246d34b0caee1c8dd1f9ce4e83281a0dabba0bf2` |
| 609 | `tour_source_ekvador_krasota_i_priroda` | Тур в Эквадор на 9 дней – Кито, Котопакси, Машпи, Галапагосы · `/ecuador/tour/ecuador-quito-cotopaxi-mashpi-galapagos-9-days/` | `src/content/tours/ekvador-krasota-i-priroda.md` | 2 | `e4206659057bc472569c5a023f012c15bc9cf4c827fbaffc97fd6cc220e878fd` |
| 612 | `tour_source_ves_ekvador_i_gorbatye_kity` | Эквадор + Галапагосские Острова и горбатые киты · `/ecuador/tour/ecuador-galapagos-humpback-whales/` | `src/content/tours/ves-ekvador-i-gorbatye-kity.md` | 2 | `ec2daeb6ca11dc549d09361cd4e71a54c2b2ece7f598f025b070c986b1206292` |
| 615 | `tour_source_ekvador_kito_galapagosskie_ostrova` | Эквадор: Кито – Галапагосские Острова · `/ecuador/tour/ecuador-quito-galapagos-islands/` | `src/content/tours/ekvador-kito-galapagosskie-ostrova.md` | 1 | `3ad90108bcd27d36585c29fb3d6a4211ed307026cd3956d05fbbd61f612199e4` |
| 616 | `tour_source_luchshee_v_salvadore` | Тур в Сальвадор: Сан-Сальвадор, Сучитото, Залив Фонсека · `/el-salvador/tour/el-salvador-san-salvador-suchitoto-gulf-of-fonseca/` | `src/content/tours/luchshee-v-salvadore.md` | 0 | `9d4f2563ba2854be1d26dc2dc652a085514d939e53c2ad3e92fb6af9d9066f42` |

### 10.2. Фактические Excursion ID и позиции

Порядок взят из подготовленного `itinerary`. Диапазон в позиции означает сохранённый общий блок исходных дней; дополнительный день из него не придумывался. Для каждой связи состояние данных — «канонизирована в подготовленном commit; результат выпуска определяется Actions».

| Tour ID | № модуля в туре | Excursion ID | После дня | Перед днём | Сущность |
|---|---:|---|---|---|---|
| `tour_source_argentina_2024` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 2 | 3 | Существующая каноническая |
| `tour_source_argentina_2024` | 2 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_2024` | 3 | `excursion_source_ekskursiya_po_montevideo` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_2024` | 4 | `excursion_source_fiesta_gaucho` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_2024` | 5 | `excursion_mendoza_city_tour` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_argentina_2024` | 6 | `excursion_el_calafate_ice_trekking_perito_moreno` | 7 | 8 | Существующая каноническая |
| `tour_source_argentina_2024` | 7 | `excursion_iguazu_gran_aventura` | 9 | 10 | Существующая каноническая |
| `tour_source_argentina_2024` | 8 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 10 | 11 | Существующая каноническая |
| `tour_source_argentina_2024` | 9 | `excursion_iguazu_helicopter_falls` | 10 | 11 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_salta_iguasu` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 2 | 3 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_salta_iguasu` | 2 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_salta_iguasu` | 3 | `excursion_source_fiesta_gaucho` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_salta_iguasu` | 4 | `excursion_source_ekskursiya_po_montevideo` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 2 | 3 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 2 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 3 | `excursion_source_fiesta_gaucho` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 4 | `excursion_source_ekskursiya_po_montevideo` | 3 | 4 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 5 | `excursion_mendoza_city_tour` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 6 | `excursion_el_calafate_ice_trekking_perito_moreno` | 7 | 8 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 7 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 10 | 11 | Существующая каноническая |
| `tour_source_argentina_buenos_ajres_mendoza_kalafate_iguasu` | 8 | `excursion_iguazu_helicopter_falls` | 10 | 11 | Существующая каноническая |
| `tour_source_argentina_puteshestvie_v_doistoricheskij_mir` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 1 | 2 | Существующая каноническая |
| `tour_source_argentina_puteshestvie_v_doistoricheskij_mir` | 2 | `excursion_buenos_aires_porteno_tango_dinner_transfer` | 2 | 3 | Новая, подготовлена в пакете |
| `tour_source_vlyubites_v_argentinu` | 1 | `excursion_buenos_aires_tango_show_dinner_transfer` | 2 | 3 | Существующая каноническая |
| `tour_source_chili_argentina` | 1 | `excursion_source_makuko_safari` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina` | 3 | `excursion_iguazu_helicopter_falls` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina` | 4 | `excursion_buenos_aires_tango_show_dinner` | 13 | 14 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 1 | `excursion_ushuaia_helicopter_flight` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_chili_i_argentina_vip` | 2 | `excursion_source_makuko_safari` | 21 | 22 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 21 | 22 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 4 | `excursion_iguazu_helicopter_falls` | 21 | 22 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 5 | `excursion_source_tango_shou_v_buenos_ajrese` | 24 | 25 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 6 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 25 | 26 | Существующая каноническая |
| `tour_source_chili_i_argentina_vip` | 7 | `excursion_source_ekskursiya_po_montevideo` | 25 | 26 | Существующая каноническая |
| `tour_source_gvatemala_gonduras_i_beliz` | 1 | `excursion_belize_blue_hole_scenic_flight` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_chudesa_beliza` | 1 | `excursion_belize_blue_hole_scenic_flight` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kankun_beliz` | 1 | `excursion_cancun_xelha_day_trip` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_kankun_beliz` | 2 | `excursion_belize_blue_hole_scenic_flight` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_chudesa_gvatemaly_beliza` | 1 | `excursion_belize_blue_hole_scenic_flight` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 1 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 2 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 4 | `excursion_rio_caipirinha_masterclass` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 5 | `excursion_rio_churrasco_masterclass` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 6 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 7 | `excursion_rio_sugarloaf_trekking` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 8 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 9 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 10 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 11 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_i_argentinu_na_10_dnej` | 12 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_amazoniya` | 1 | `excursion_source_vstrecha_rek` | 2 | 3 | Существующая каноническая |
| `tour_source_amazoniya` | 2 | `excursion_source_plavanie_s_rozovymi_del_finami` | 2 | 3 | Существующая каноническая |
| `tour_source_argentina_i_braziliya_ot_lda_k_solntsu` | 1 | `excursion_buenos_aires_tango_show_dinner_transfer` | 2 | 3 | Существующая каноническая |
| `tour_source_argentina_i_braziliya_ot_lda_k_solntsu` | 2 | `excursion_ushuaia_martillo_penguin_boat` | 6 | 7 | Существующая каноническая |
| `tour_source_fan_braziliya_i_argentina` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 12 | 13 | Существующая каноническая |
| `tour_source_braziliya_ot_san_paulo_do_buziosa` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 3 | 4 | Существующая каноническая |
| `tour_source_braziliya_ot_san_paulo_do_buziosa` | 2 | `excursion_source_makuko_safari` | 3 | 4 | Существующая каноническая |
| `tour_source_braziliya_ot_san_paulo_do_buziosa` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 7 | 8 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 1 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 2 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 3 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 4 | `excursion_rio_itacuruca_tropical_islands` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_braziliya_s_detmi` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 6 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_braziliya_s_detmi` | 7 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_braziliya_s_plyazhami` | 1 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_plyazhami` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 1 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 3 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 4 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 5 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 6 | `excursion_source_fiesta_gaucho` | 10 | 11 | Существующая каноническая |
| `tour_source_braziliya_argentina_i_chili` | 7 | `excursion_santiago_maipo_wine_tour` | 13 | 14 | Новая, подготовлена в пакете |
| `tour_source_braziliya_argentina_gruppovoj_tur` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 12 | 13 | Существующая каноническая |
| `tour_source_sao_paulo_buzios_rio_iguasu` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 3 | 4 | Существующая каноническая |
| `tour_source_sao_paulo_buzios_rio_iguasu` | 2 | `excursion_source_makuko_safari` | 3 | 4 | Существующая каноническая |
| `tour_source_sao_paulo_buzios_rio_iguasu` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 7 | 8 | Существующая каноническая |
| `tour_source_vazhnoe_brazilii` | 1 | `excursion_amazon_night_caiman_boat_trip` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_vazhnoe_brazilii` | 2 | `excursion_amazon_caboclo_family_visit` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_vazhnoe_brazilii` | 3 | `excursion_amazon_piranha_fishing` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_dostoprimechatelnosti_i_karnaval_v_rio_de_zhanejro` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_kofe_tur_v_brazilii` | 1 | `excursion_source_botanical_garden` | 3 | 4 | Существующая каноническая |
| `tour_source_kofe_tur_v_brazilii` | 2 | `excursion_rio_itacuruca_tropical_islands` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_kofe_tur_v_brazilii` | 3 | `excursion_source_rio_nochyu` | 3 | 4 | Существующая каноническая |
| `tour_source_kofe_tur_v_brazilii` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 3 | 4 | Существующая каноническая |
| `tour_source_kofe_tur_v_brazilii` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_led_solntse_i_kraj_zemli` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 2 | 3 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 1 | `excursion_source_lapa_shou_nochnogo_rio_de_zhanejro` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 2 | `excursion_source_tajny_starogo_rio_de_zhanejro` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 3 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 5 | `excursion_source_favela_tur` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 6 | `excursion_source_botanical_garden` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 7 | `excursion_source_rio_nochyu` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 8 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 9 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 10 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_rio_de_janeiro_foz_do_iguacu_pantanal_buzios` | 11 | `excursion_buzios_coastal_boat_trip` | 11 | 12 | Существующая каноническая |
| `tour_source_rajskaya_braziliya` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_rajskaya_braziliya` | 2 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_parad_chempionov_v_rio_de_zhanejro_vodopady` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Word P149, 2027: существующая каноническая; стоимость сохранена в условиях тура |
| `tour_source_parad_chempionov_v_rio_de_zhanejro_vodopady` | 3 | `excursion_iguazu_helicopter_falls` | 5 | 6 | Word P149, 2027: существующая каноническая; стоимость сохранена в условиях тура |
| `tour_source_nezabyvaemaya_braziliya` | 1 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemaya_braziliya` | 2 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemaya_braziliya` | 3 | `excursion_rio_itacuruca_tropical_islands` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_nezabyvaemaya_braziliya` | 4 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemaya_braziliya` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemaya_braziliya` | 6 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_nezabyvaemaya_braziliya` | 7 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_rio_i_iguasu_puteshestvie_po_kultovym_chudesam_brazilii` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_rio_i_iguasu_puteshestvie_po_kultovym_chudesam_brazilii` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_brazil_coffee_tour_ru` | 1 | `excursion_source_botanical_garden` | 3 | 4 | Существующая каноническая |
| `tour_source_brazil_coffee_tour_ru` | 2 | `excursion_rio_itacuruca_tropical_islands` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_brazil_coffee_tour_ru` | 3 | `excursion_source_rio_nochyu` | 3 | 4 | Существующая каноническая |
| `tour_source_brazil_coffee_tour_ru` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 3 | 4 | Существующая каноническая |
| `tour_source_brazil_coffee_tour_ru` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_lensojs_maranenses` | 1 | `excursion_sao_luis_city_tour_four_hours` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_luchshee_brazilii_argentiny_i_chili` | 1 | `excursion_source_makuko_safari` | 3 | 4 | Существующая каноническая |
| `tour_source_luchshee_brazilii_argentiny_i_chili` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 3 | 4 | Существующая каноническая |
| `tour_source_luchshee_brazilii_argentiny_i_chili` | 3 | `excursion_iguazu_helicopter_falls` | 3 | 4 | Существующая каноническая |
| `tour_source_luchshee_brazilii_argentiny_i_chili` | 4 | `excursion_buenos_aires_tango_show_dinner_transfer` | 5 | 6 | Существующая каноническая |
| `tour_source_luchshee_v_brazilii_rio_iguasu_buzios` | 1 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_luchshee_v_brazilii_rio_iguasu_buzios` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_luchshee_v_brazilii_rio_iguasu_buzios` | 3 | `excursion_iguazu_helicopter_falls` | 4 | 5 | Существующая каноническая |
| `tour_source_luchshee_v_brazilii_za_9_dnej` | 1 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_luchshee_v_brazilii_za_9_dnej` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | 2 | `excursion_source_makuko_safari` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | 4 | `excursion_iguazu_helicopter_falls` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_amazoniej_16_dnej` | 5 | `excursion_source_vstrecha_rek` | 10 | 11 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu_s_alagoas` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu_s_alagoas` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu_s_alagoas` | 3 | `excursion_iguazu_helicopter_falls` | 6 | 7 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu_s_alagoas` | 4 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_manaus_4_dnya_3_nochi` | 1 | `excursion_amazon_night_caiman_boat_trip` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_manaus_4_dnya_3_nochi` | 2 | `excursion_amazon_caboclo_family_visit` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_manaus_4_dnya_3_nochi` | 3 | `excursion_amazon_piranha_fishing` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_manaus_4_dnya_3_nochi` | 4 | `excursion_amazon_pink_dolphin_observation` | 4 | — | Новая, подготовлена в пакете |
| `tour_source_manaus_4_dnya_3_nochi` | 5 | `excursion_source_vstrecha_rek` | 4 | — | Существующая каноническая |
| `tour_source_manaus_4_dnya_3_nochi` | 6 | `excursion_amazon_jungle_survival_trekking` | 4 | — | Новая, подготовлена в пакете |
| `tour_source_manaus_4_dnya_3_nochi` | 7 | `excursion_amazon_monkey_forest_canoe` | 4 | — | Новая, подготовлена в пакете |
| `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | 3 | `excursion_iguazu_helicopter_falls` | 5 | 6 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala` | 4 | `excursion_buenos_aires_tango_show_dinner` | 7 | 8 | Существующая каноническая |
| `tour_source_na_mototsiklakh_po_brazilii` | 1 | `excursion_sao_paulo_city_tour_six_hours` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_nezabyvaemyj_karnaval_s_vodopadami_i_otdykhom_na_poberezhe` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_s_vodopadami_i_otdykhom_na_poberezhe` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_s_vodopadami_i_otdykhom_na_poberezhe` | 3 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_s_vodopadami_i_otdykhom_na_poberezhe` | 4 | `excursion_iguazu_helicopter_falls` | 6 | 7 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | 2 | `excursion_source_makuko_safari` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | 3 | `excursion_iguazu_helicopter_falls` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | 4 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 7 | 8 | Существующая каноническая |
| `tour_source_vip_tur_v_braziliyu_s_bonito_16_dnej` | 5 | `excursion_brazil_bonito_abismo_anhumas` | 9 | 10 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_brazilii` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_brazilii` | 2 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 1 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 4 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 5 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 9 | 10 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 6 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_novyj_god` | 7 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | 3 | `excursion_buenos_aires_tango_show_optional_dinner` | 7 | 8 | Новая, подготовлена в пакете |
| `tour_source_tur_v_braziliyu_argentinu_i_chili_na_novyj_god` | 4 | `excursion_santiago_maipo_wine_tour` | 9 | 10 | Новая, подготовлена в пакете |
| `tour_source_priklyucheniya_na_novyj_god_v_rio_i_na_vodopadakh_iguasu` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_priklyucheniya_na_novyj_god_v_rio_i_na_vodopadakh_iguasu` | 2 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_rio` | 1 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_rio` | 2 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_rio` | 3 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_rio` | 4 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_nezabyvaemyj_novyj_god_v_rio` | 5 | `excursion_source_polet_na_deltaplane_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_opyt_brazilii` | 1 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_opyt_brazilii` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_pantanal_bonito` | 1 | `excursion_brazil_bonito_abismo_anhumas` | 5 | 6 | Существующая каноническая |
| `tour_source_peru_i_braziliya_na` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 8 | 9 | Существующая каноническая |
| `tour_source_peru_i_braziliya_na` | 2 | `excursion_iguazu_helicopter_falls` | 8 | 9 | Существующая каноническая |
| `tour_source_peru_i_braziliya_na` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 10 | 11 | Существующая каноническая |
| `tour_source_puteshestvie_po_kultovym_chudesam_brazilii` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_puteshestvie_po_kultovym_chudesam_brazilii` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | 1 | `excursion_rio_zona_sul_bike_tour` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | 2 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | 3 | `excursion_source_vstrecha_rek` | 3 | 4 | Существующая каноническая |
| `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | 4 | `excursion_iguazu_gran_aventura` | 6 | 7 | Существующая каноническая |
| `tour_source_rio_de_zhanejro_amazoniya_vodopady_iguasu` | 5 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 7 | 8 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 1 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 2 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 4 | `excursion_rio_caipirinha_masterclass` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 5 | `excursion_rio_churrasco_masterclass` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 6 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 7 | `excursion_rio_sugarloaf_trekking` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 8 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 9 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 10 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 11 | `excursion_buenos_aires_gastronomic_tour` | 9 | 10 | Новая, подготовлена в пакете |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 12 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_roskoshnaya_braziliya_i_argentina` | 13 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 1 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 2 | `excursion_rio_maracana_stadium_tour` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_tur_v_braziliyu_s_detmi` | 3 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 4 | `excursion_rio_itacuruca_tropical_islands` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_tur_v_braziliyu_s_detmi` | 5 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 6 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 7 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_detmi` | 8 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_solntse_tango_vino_i_atakama` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_solntse_tango_vino_i_atakama` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_solntse_tango_vino_i_atakama` | 3 | `excursion_source_tango_shou_v_buenos_ajrese` | 7 | 8 | Существующая каноническая |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 2 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 3 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 4 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 5 | `excursion_rio_pedra_bonita_trekking` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_novyj_god_v_rio_de_zhanejro_1` | 6 | `excursion_source_polet_na_deltaplane_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_argentina_and_brazil_ru` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 2 | 3 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii_rio_amazonka_vodopady_iguasu` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii_rio_amazonka_vodopady_iguasu` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii_rio_amazonka_vodopady_iguasu` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii_rio_amazonka_vodopady_iguasu` | 4 | `excursion_iguazu_helicopter_falls` | 6 | 7 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 1 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 2 | `excursion_source_tajny_starogo_rio_de_zhanejro` | 4 | 5 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 3 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 5 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 6 | `excursion_source_rafain_shou` | 5 | 6 | Существующая каноническая |
| `tour_source_special_noe_predlozhenie_rio_and_vodopa_dy_iguasu` | 7 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 7 | 8 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 2 | `excursion_source_rio_nochyu` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 3 | `excursion_source_zaliv_guanabara_morskaya_progulka` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 4 | `excursion_source_tajny_starogo_rio_de_zhanejro` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 6 | `excursion_source_botanical_garden` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 7 | `excursion_source_favela_tur` | 9 | — | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_tur_v_braziliyu_i_argentinu_na_9_dnej` | 8 | `excursion_source_polet_na_deltaplane_nad_rio` | 9 | — | Существующая каноническая |
| `tour_source_tur_v_argentinu_i_braziliyu_ot_lda_do_solntsa` | 1 | `excursion_buenos_aires_tango_show_dinner_transfer` | 2 | 3 | Существующая каноническая |
| `tour_source_braziliya_i_argentina_v_sentyabre` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 7 | 8 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_amazoniej_i_argentinu` | 1 | `excursion_source_vstrecha_rek` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_s_amazoniej_i_argentinu` | 2 | `excursion_source_tango_shou_v_buenos_ajrese` | 12 | 13 | Существующая каноническая |
| `tour_source_braziliya_i_peru_na_novyj_god` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_braziliya_i_peru_na_novyj_god` | 2 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_i_peru_na_novyj_god` | 3 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_i_peru_na_novyj_god` | 4 | `excursion_rio_pedra_bonita_trekking` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_braziliya_i_peru_na_novyj_god` | 5 | `excursion_source_polet_na_deltaplane_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_vodopadami_na_novyj_god` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_braziliya_s_vodopadami_na_novyj_god` | 2 | `excursion_source_makuko_safari_he` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 3 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 4 | `excursion_iguazu_helicopter_falls` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala` | 5 | `excursion_brazil_bonito_abismo_anhumas` | 10 | 11 | Существующая каноническая |
| `tour_source_roskoshnyj_novyj_god_v_brazilii` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_roskoshnyj_novyj_god_v_brazilii` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_roskoshnyj_novyj_god_v_brazilii` | 3 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_roskoshnyj_novyj_god_v_brazilii` | 4 | `excursion_source_plavanie_s_rozovymi_del_finami` | 10 | — | Существующая каноническая |
| `tour_source_tropicheskij_karnaval_s_angroj_dush_rejsh` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_6dnej` | 1 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_6dnej` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_super_predlozhenie_rio_buzios` | 1 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_super_predlozhenie_rio_buzios` | 2 | `excursion_source_tajny_starogo_rio_de_zhanejro` | 4 | 5 | Существующая каноническая |
| `tour_source_super_predlozhenie_rio_buzios` | 3 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_super_predlozhenie_rio_buzios` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_super_predlozhenie_rio_buzios` | 5 | `excursion_source_favela_tur` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 1 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 2 | `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 3 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 4 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 5 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 6 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 7 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 8 | `excursion_source_vstrecha_rek` | 8 | 9 | Существующая каноническая |
| `tour_source_tur_v_ekzoticheskuyu_braziliyu` | 9 | `excursion_source_plavanie_s_rozovymi_del_finami` | 8 | 9 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 4 | `excursion_iguazu_helicopter_falls` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 5 | `excursion_source_vstrecha_rek` | 9 | 10 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_v_brazilii` | 6 | `excursion_source_plavanie_s_rozovymi_del_finami` | 9 | 10 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_lyuksovyj_tur_na_karnaval_v_braziliyu_i_vodopady_iguasu` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_karnaval` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_karnaval` | 2 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 9 | 10 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_karnaval` | 3 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_mechty_sbyvayutsya_na_karnaval` | 4 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_v_brazilii` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_v_brazilii` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_v_brazilii` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_nezabyvaemyj_karnaval_v_brazilii` | 4 | `excursion_iguazu_helicopter_falls` | 6 | 7 | Существующая каноническая |
| `tour_source_novogodnie_priklyucheniya_v_brazilii` | 1 | `excursion_brazil_bonito_abismo_anhumas` | 8 | 9 | Существующая каноническая |
| `tour_source_ekzoticheskij_novyj_god_ru` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_novyj_god_ru` | 2 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_ekzoticheskij_novyj_god_ru` | 3 | `excursion_source_vstrecha_rek` | 9 | 10 | Существующая каноническая |
| `tour_source_ekzoticheskij_novyj_god_ru` | 4 | `excursion_source_plavanie_s_rozovymi_del_finami` | 9 | 10 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_13_dnej` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_13_dnej` | 2 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_13_dnej` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_13_dnej` | 4 | `excursion_brazil_bonito_abismo_anhumas` | 10 | 11 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 1 | `excursion_source_rio_nochyu` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 2 | `excursion_source_zaliv_guanabara_morskaya_progulka` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 4 | `excursion_source_botanical_garden` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 5 | `excursion_source_favela_tur` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 6 | `excursion_source_lapa_shou_nochnogo_rio_de_zhanejro` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 7 | `excursion_source_rafain_shou` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 8 | `excursion_source_makuko_safari` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_kofejnye_fazendy` | 9 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 4 | 5 | Существующая каноническая |
| `tour_source_parad_chempionov_karnavala_v_rio` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_vodopady_iguasu_v_pantanal_bonito_portu_alegre` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_vodopady_iguasu_v_pantanal_bonito_portu_alegre` | 2 | `excursion_rio_caipirinha_masterclass` | 3 | 4 | Существующая каноническая |
| `tour_source_tur_v_braziliyu_na_vodopady_iguasu_v_pantanal_bonito_portu_alegre` | 3 | `excursion_source_makuko_safari` | 9 | 10 | Существующая каноническая |
| `tour_source_stolitsy_latinskoj_ameriki` | 1 | `excursion_iguazu_gran_aventura` | 4 | 5 | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 7 | 8 | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 2 | `excursion_source_rio_nochyu` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 3 | `excursion_source_tajny_starogo_rio_de_zhanejro` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 4 | `excursion_source_polet_na_vertolete_nad_rio` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 5 | `excursion_source_botanical_garden` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 6 | `excursion_source_favela_tur` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 7 | `excursion_source_polet_na_deltaplane_nad_rio` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 8 | `excursion_source_rafain_shou` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 9 | `excursion_source_makuko_safari` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 10 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 11 | `excursion_iguazu_helicopter_falls` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 12 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 13 | `excursion_source_ekskursiya_po_montevideo` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 14 | `excursion_source_fiesta_gaucho` | 12 | — | Существующая каноническая |
| `tour_source_solntse_tango_i_vino` | 15 | `excursion_santiago_maipo_wine_tour` | 12 | — | Новая, подготовлена в пакете |
| `tour_source_tur_v_krasochnuyu_braziliyu_2022` | 1 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_tur_v_krasochnuyu_braziliyu_2022` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_tropicheskaya_braziliya` | 1 | `excursion_source_botanical_garden` | 4 | 5 | Существующая каноническая |
| `tour_source_tropicheskaya_braziliya` | 2 | `excursion_rio_itacuruca_tropical_islands` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_tropicheskaya_braziliya` | 3 | `excursion_source_rio_nochyu` | 4 | 5 | Существующая каноническая |
| `tour_source_tropicheskaya_braziliya` | 4 | `excursion_source_polet_na_vertolete_nad_rio` | 4 | 5 | Существующая каноническая |
| `tour_source_tropicheskaya_braziliya` | 5 | `excursion_source_royal_petropolis_private_tour_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_podlinnaya_braziliya` | 1 | `excursion_source_rafain_shou` | 9 | 10 | Существующая каноническая |
| `tour_source_podlinnaya_braziliya` | 2 | `excursion_source_makuko_safari` | 10 | 11 | Существующая каноническая |
| `tour_source_podlinnaya_braziliya` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 10 | 11 | Существующая каноническая |
| `tour_source_braziliya_s_san_paulo` | 1 | `excursion_source_vstrecha_rek` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_san_paulo` | 2 | `excursion_source_plavanie_s_rozovymi_del_finami` | 4 | 5 | Существующая каноническая |
| `tour_source_braziliya_s_san_paulo` | 3 | `excursion_source_polet_na_vertolete_nad_rio` | 7 | 8 | Существующая каноническая |
| `tour_source_braziliya_s_san_paulo` | 4 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 9 | 10 | Существующая каноническая |
| `tour_source_braziliya_s_san_paulo` | 5 | `excursion_source_makuko_safari` | 9 | 10 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 1 | `excursion_source_makuko_safari` | 6 | 7 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 6 | 7 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 3 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 4 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 9 | 10 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 5 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_3_strany_latinskoj_ameriki_na_karnaval_v_rio` | 6 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_tur_v_peru_i_braziliyu` | 1 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 8 | 9 | Существующая каноническая |
| `tour_source_tur_v_peru_i_braziliyu` | 2 | `excursion_source_makuko_safari` | 8 | 9 | Существующая каноническая |
| `tour_source_tur_v_peru_i_braziliyu` | 3 | `excursion_iguazu_helicopter_falls` | 8 | 9 | Существующая каноническая |
| `tour_source_tur_v_peru_i_braziliyu` | 4 | `excursion_source_polet_na_vertolete_nad_rio` | 10 | 11 | Существующая каноническая |
| `tour_source_tur_v_4_strany_yuzhnoj_ameriki` | 1 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_tur_v_4_strany_yuzhnoj_ameriki` | 2 | `excursion_source_makuko_safari` | 12 | 13 | Существующая каноническая |
| `tour_source_tur_v_4_strany_yuzhnoj_ameriki` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 12 | 13 | Существующая каноническая |
| `tour_source_karnaval_v_rio_de_zhanejro` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 2 | 3 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 1 | `excursion_santiago_maipo_wine_tour` | 2 | 3 | Новая, подготовлена в пакете |
| `tour_source_chili_argentina_braziliya` | 2 | `excursion_source_tango_shou_v_buenos_ajrese` | 8 | 9 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 3 | `excursion_source_fiesta_gaucho` | 9 | 10 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 4 | `excursion_source_ekskursiya_po_montevideo` | 9 | 10 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 5 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | 9 | 10 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 6 | `excursion_source_makuko_safari` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 7 | `excursion_iguazu_helicopter_falls` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 8 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 11 | 12 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 9 | `excursion_source_botanical_garden` | 14 | 15 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 10 | `excursion_source_royal_petropolis_private_tour_full_day` | 14 | 15 | Существующая каноническая |
| `tour_source_chili_argentina_braziliya` | 11 | `excursion_source_polet_na_vertolete_nad_rio` | 14 | 15 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 1 | `excursion_source_polet_na_vertolete_nad_rio` | 3 | 4 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 2 | `excursion_source_makuko_safari` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 3 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 4 | `excursion_iguazu_helicopter_falls` | 5 | 6 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 5 | `excursion_source_vstrecha_rek` | 9 | 10 | Существующая каноническая |
| `tour_source_ekzoticheskij_karnaval_parad_chempionov_v_brazilii` | 6 | `excursion_source_plavanie_s_rozovymi_del_finami` | 9 | 10 | Существующая каноническая |
| `tour_source_venesuela_populyarnye_napravleniya` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 1 | `excursion_venezuela_avila_humboldt_visit` | 1 | 2 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 2 | `excursion_canaima_pemon_village_visit` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 3 | `excursion_venezuela_angel_helicopter_flight` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 4 | `excursion_venezuela_angel_airplane_flight` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 5 | `excursion_venezuela_kavak_angel_flight` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 6 | `excursion_venezuela_kuravaina_trekking` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 7 | `excursion_venezuela_blue_lagoon_trip` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_kraski_venesuely` | 8 | `excursion_venezuela_sakaika_cycling` | 5 | 6 | Новая, подготовлена в пакете |
| `tour_source_populyarnye_napravleniya_venesuely` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_skazki_venesuelskogo_lesa` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_skazki_venesuelskogo_lesa` | 2 | `excursion_venezuela_avila_humboldt_visit` | 12 | — | Новая, подготовлена в пакете |
| `tour_source_priroda_i_kultura_venesuely_bolivii` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_venesuela_prirodnye_kontrasty_tropikov` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_krasota_venesuely` | 1 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 1 | `excursion_venezuela_avila_humboldt_visit` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 2 | `excursion_canaima_pemon_village_visit` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 3 | `excursion_venezuela_angel_helicopter_flight` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 4 | `excursion_venezuela_kavak_angel_helicopter` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 5 | `excursion_venezuela_kavak_angel_flight` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 6 | `excursion_venezuela_kuravaina_trekking` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 7 | `excursion_venezuela_blue_lagoon_trip` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_luchshee_v_venesuele` | 8 | `excursion_venezuela_sakaika_lagoon_trip` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_venesuela_treking_v_zateryannyj_i_pervozdannyj_mir_rorajmy` | 1 | `excursion_canaima_pemon_village_visit` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_kolumbiya_2024` | 1 | `excursion_colombia_guatape_helicopter_flight` | 7 | 8 | Новая, подготовлена в пакете |
| `tour_source_kolumbiya_stolitsy` | 1 | `excursion_colombia_san_pedro_majagua_day_trip` | 7 | 8 | Новая, подготовлена в пакете |
| `tour_source_manyashchij_peru_kolumbiya` | 1 | `excursion_cusco_cathedral_visit` | 3 | 4 | Существующая каноническая |
| `tour_source_manyashchij_peru_kolumbiya` | 2 | `excursion_peru_sacred_valley_full_day` | 5 | 6 | Существующая каноническая |
| `tour_source_manyashchij_peru_kolumbiya` | 3 | `excursion_colombia_baru_agua_azul_day_trip` | 13 | 14 | Новая, подготовлена в пакете |
| `tour_source_tur_v_kolumbiyu_na_12_dnej` | 1 | `excursion_source_kofejnyj_tur_v_perejra` | 2 | 3 | Существующая каноническая |
| `tour_source_vip_kosta_rika_nikaragua` | 1 | `excursion_costa_rica_monteverde_viento_fresco_day_trip` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_vsya_panama_natsionalnye_parki_ostrova_i_doliny` | 1 | `excursion_panama_chorro_del_macho_canopy` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_panama_panama_siti_dolina_anton_krepost_san_lorenso` | 1 | `excursion_panama_chorro_del_macho_canopy` | 2 | 3 | Новая, подготовлена в пакете |
| `tour_source_tur_po_uruguayu_i_paragvayu_16_dnej` | 1 | `excursion_source_makuko_safari` | 14 | 15 | Существующая каноническая |
| `tour_source_tur_po_uruguayu_i_paragvayu_16_dnej` | 2 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | 14 | 15 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru_plyazhi_tumbesa` | 1 | `excursion_cusco_cathedral_visit` | 3 | 4 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru_plyazhi_tumbesa` | 2 | `excursion_peru_paracas_nazca_full_day` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_vip_puteshestvie_v_imperiyu_inkov_na_8_dnej` | 1 | `excursion_peru_sacred_valley_via_ferrata` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_vip_puteshestvie_v_imperiyu_inkov_na_8_dnej` | 2 | `excursion_peru_sacred_valley_zipline` | 4 | 5 | Новая, подготовлена в пакете |
| `tour_source_vip_puteshestvie_v_imperiyu_inkov_na_8_dnej` | 3 | `excursion_lima_larco_museum_visit` | 7 | 8 | Существующая каноническая |
| `tour_source_manyashchij_peru_i_ikitos` | 1 | `excursion_cusco_cathedral_visit` | 2 | 3 | Существующая каноническая |
| `tour_source_manyashchij_peru_i_ikitos` | 2 | `excursion_peru_sacred_valley_full_day` | 4 | 5 | Существующая каноническая |
| `tour_source_manyashchij_peru_i_ikitos` | 3 | `excursion_peru_paracas_nazca_full_day` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_manyashchij_peru_i_ikitos` | 4 | `excursion_peru_caral_day_trip` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_manyashchij_peru_i_ikitos` | 5 | `excursion_lima_city_gold_museum` | 10 | 11 | Новая, подготовлена в пакете |
| `tour_source_manyashchij_peru_i_ikitos` | 6 | `excursion_lima_folklore_dinner_show` | 10 | 11 | Существующая каноническая |
| `tour_source_peru_ictoriya_velikoj_imperii_i_prazdnik_svyatoj_kandelyarii` | 1 | `excursion_cusco_cathedral_visit` | 2 | 3 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru_ikitos` | 1 | `excursion_cusco_cathedral_visit` | 3 | 4 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru_ikitos` | 2 | `excursion_peru_paracas_nazca_full_day` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_ves_mnogolikij_peru_i_senor_sipan` | 1 | `excursion_cusco_cathedral_visit` | 3 | 4 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru_i_senor_sipan` | 2 | `excursion_peru_paracas_nazca_full_day` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_ves_mnogolikij_peru` | 1 | `excursion_cusco_cathedral_visit` | 3 | 4 | Существующая каноническая |
| `tour_source_ves_mnogolikij_peru` | 2 | `excursion_peru_paracas_nazca_full_day` | 11 | 12 | Новая, подготовлена в пакете |
| `tour_source_chili_kosmicheskoe_puteshestvie_na_zemle` | 1 | `excursion_chile_atacama_astronomy_tour` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_ves_ekvador_na_novyj_god` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 10 | 11 | Существующая каноническая |
| `tour_source_ves_ekvador_na_novyj_god` | 2 | `excursion_source_ostrov_plasa` | 10 | 11 | Существующая каноническая |
| `tour_source_ves_ekvador_i_galapagosskie_ostrova` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 7 | 8 | Существующая каноническая |
| `tour_source_ves_ekvador_i_galapagosskie_ostrova` | 2 | `excursion_source_ostrov_plasa` | 7 | 8 | Существующая каноническая |
| `tour_source_luchshee_v_ekvadore_garantirovannye_zaezdy` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 10 | 11 | Существующая каноническая |
| `tour_source_luchshee_v_ekvadore_garantirovannye_zaezdy` | 2 | `excursion_source_ostrov_plasa` | 10 | 11 | Существующая каноническая |
| `tour_source_pochuvstvujte_peru_ekvador` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 17 | 18 | Существующая каноническая |
| `tour_source_pochuvstvujte_peru_ekvador` | 2 | `excursion_source_ostrov_plasa` | 17 | 18 | Существующая каноническая |
| `tour_source_ekvador_s_udovolstviem` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 11 | 12 | Существующая каноническая |
| `tour_source_ekvador_s_udovolstviem` | 2 | `excursion_source_ostrov_plasa` | 11 | 12 | Существующая каноническая |
| `tour_source_ekvador_aktivnyj_tur_s_galapagossom` | 1 | `excursion_ecuador_mindo_river_tubing` | 3 | 4 | Новая, подготовлена в пакете |
| `tour_source_ekvador_aktivnyj_tur_s_galapagossom` | 2 | `excursion_source_ostrov_severnyj_sejmur` | 16 | 17 | Существующая каноническая |
| `tour_source_ekvador_aktivnyj_tur_s_galapagossom` | 3 | `excursion_source_ostrov_plasa` | 16 | 17 | Существующая каноническая |
| `tour_source_ekvador_v_sentyabre` | 1 | `excursion_ecuador_misicocha_forest_walk` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_ekvador_v_sentyabre` | 2 | `excursion_ecuador_cosano_amazoonico` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_ekvador_v_sentyabre` | 3 | `excursion_ecuador_kichwa_family_crafts` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_ekvador_v_sentyabre` | 4 | `excursion_ecuador_casa_suizo_river_island_walk` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_ekvador_v_sentyabre` | 5 | `excursion_ecuador_casa_suizo_butterfly_farm` | 6 | 7 | Новая, подготовлена в пакете |
| `tour_source_ekvador_v_sentyabre` | 6 | `excursion_source_ostrov_severnyj_sejmur` | 10 | 11 | Существующая каноническая |
| `tour_source_ekvador_v_sentyabre` | 7 | `excursion_source_ostrov_plasa` | 10 | 11 | Существующая каноническая |
| `tour_source_ekvador_krasota_i_priroda` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 8 | 9 | Существующая каноническая |
| `tour_source_ekvador_krasota_i_priroda` | 2 | `excursion_source_ostrov_plasa` | 8 | 9 | Существующая каноническая |
| `tour_source_ves_ekvador_i_gorbatye_kity` | 1 | `excursion_source_ostrov_severnyj_sejmur` | 7 | 8 | Существующая каноническая |
| `tour_source_ves_ekvador_i_gorbatye_kity` | 2 | `excursion_source_ostrov_plasa` | 7 | 8 | Существующая каноническая |
| `tour_source_ekvador_kito_galapagosskie_ostrova` | 1 | `excursion_quito_equator_six_hour_tour` | 1 | 2 | Новая, подготовлена в пакете |

### 10.3. Заблокированные туры для продолжения

Эти ID не включены в готовые Tour-файлы пакета. Сначала разрешается указанная причина по точному источнику или mapping; затем повторяется сборка затронутых данных. Исключённый источник не становится очередью публикации автоматически.

Причины ниже взяты из итогового адресного разбора источников, включая результат проверки точного Original там, где она выполнена. SHA-256 этого разбора: `8b3c0dfe1d4151f9f3e8743e154e7f1549f24c8f1a890ac066e7cf2df75833bb`.

| Строка реестра | Tour ID | Стадия | Конкретные причины | Проверенный источник |
|---:|---|---|---|---|
| 312 | `tour_source_tur_v_argentinu_v_patagoniyu` | Требуется разрешить блокировку | В день 8 после Ушуайи указан выезд в аэропорт Калафате, но транспорт между этими городами не описан. Точный Original повторяет эту связку. | [V2](https://drive.google.com/file/d/1ihJ6M_I3yGwNoqQKZjqJECV6YoUVanvJ/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/12d0MV65-Cj-LufF8vRZU5ln1Xi2RwGyQ/view?usp=drivesdk) · SHA-256 Original: `a01f3ec0571ff1224f59ec04cf9960fcc979209959dde3cf37fdd356e4493203` |
| 316 | `tour_source_prekrasnaya_patagoniya_i_solonchak_uyuni` | Требуется разрешить блокировку | Перечень перелётов и включённых услуг содержит Рио и Игуасу, которых нет в подробной программе Аргентины, Чили и Боливии. В Original соответствующие списки пусты, поэтому условия не удалось подтвердить. | [V2](https://drive.google.com/file/d/1dNdMAaIb5bvL-FMKEGuj5_qy6QCEkMfA/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1kmGBApOHtAluPM4C2IZePo8uYfkqJ_yB/view?usp=drivesdk) · SHA-256 Original: `f47ca008b3723647b6883056f90fa542077b043227bf46b87de220d14067eb74` |
| 317 | `tour_source_argentina_chili_boliviya` | Требуется разрешить блокировку | Перечень перелётов и включённых услуг содержит Рио и Игуасу, которых нет в подробной программе Аргентины, Чили и Боливии. В Original соответствующие списки пусты, поэтому условия не удалось подтвердить. | [V2](https://drive.google.com/file/d/1W8ovBDU435OY8C1h1Uekv77nkgd5B709/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1LANhMIKuqPEUMHqLM6lcpk_0Abp51Mx8/view?usp=drivesdk) · SHA-256 Original: `93127059286446131d6b8d4a80f3f40efeaf5948ec965d5c785de9bba1c36bfc` |
| 321 | `tour_source_kruiznyj_tur_po_luchshim_mestam_argentiny_chili_i_bolivii` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/1gcFSZ3j6cFll304P8SWxLUDJs0K2trDP/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1TM9yhh7VsCCV8gbhT2ENH_FfIYEw_8Ih/view?usp=drivesdk) · SHA-256 Original: `aea552aec4fcd2400b88f73b7a9f908deb2782131e2739becffe84de5576a055` |
| 338 | `tour_source_solonchak_uyuni` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/1xnPYMsQKI8n36d-ekdcIJ9ZSrPWuZ9sS/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1Oajx4hWyMaaK7O_BOaQdgzbeKznVcoQg/view?usp=drivesdk) · SHA-256 Original: `e380367c3747505f800ea92115dcba40e3352109d474041667e8fcfce5af013f` |
| 340 | `tour_source_priklyucheniya_v_bolivii` | Требуется разрешить блокировку | В дне Ла-Паса и Лунной долины названы чилийские Кордильера-де-ла-Саль и Лос-Фламенкос без переезда в Чили. Такое же противоречие есть в Original. | [V2](https://drive.google.com/file/d/1e9nlNWXZxBtD8FEmtGFeECUuK6-V7rRH/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1GXFvYKBzZp4eQwU5f6QiIN47YMLfeY3X/view?usp=drivesdk) · SHA-256 Original: `a2fcec6a31107a4a0309ed8f3af5b35a5d5fa49ea3b3904fc47342cc9af4329f` |
| 362 | `tour_source_5_stran_latinskoj_ameriki` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/14_PyOo8ZDuAiXeu4rMyPkDhd5SLAb0Hg/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1ZW4KPkdpt5MTCrYR7PdsqxA8izBEbcw1/view?usp=drivesdk) · SHA-256 Original: `88615b6b8b6901cf85cccf871198f2e1620d9eec9445e9643b63cb1cfc9fb1dd` |
| 368 | `tour_source_nezabyvaemyj_parad_chempionov_v_brazilii` | Требуется разрешить блокировку | В перечне перелётов указан Манаус, хотя программа проходит через Рио, Игуасу и Бузиос. В Original списки услуг пусты; также расходятся обозначенная и подробная длительность. | [V2](https://drive.google.com/file/d/1rW2RVz3vsX171LYMVOdKZjmbVFZ_nqYr/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1KW9UIxaZQdogdOPT4BLvjKGseqt7-MfG/view?usp=drivesdk) · SHA-256 Original: `7082e0380d62fcd35a17528879e4e6f065188b83accc28a4c16f8361a881c2e2` |
| 374 | `tour_source_karnaval_5_stran` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/1vg1mD1sMutKZHvcGAM8_vNYJ4ppDTKGj/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1UVuZS9tANtOSfXbjKJzOyOVehWWG-2A3/view?usp=drivesdk) · SHA-256 Original: `8f408c994ab078095e8b5591bac126036ac9bce06886ae89aa11a2efb3e37da8` |
| 382 | `tour_source_luchshee_v_rio_de_zhanejro` | Требуется разрешить блокировку | Заявлены 7 дней / 6 ночей, но подробно расписаны дни 1–8 с вылетом в день 8. Original содержит то же расхождение. | [V2](https://drive.google.com/file/d/14kreGDJi8jmToszpfyXd-8rza6F78RxS/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1sS5aDZ10Fc4GAAov5E8Klo_DrpaIBDmR/view?usp=drivesdk) · SHA-256 Original: `6dd10e76e53612d70dee6d634c902a3dbbe7565f32d9543ef679f7b291176e10` |
| 394 | `tour_source_5_stran_latinskoj_ameriki_na_16_dnej_na_novyj_god` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/1X9xvFC1bpZiyxNyVYUzWHAfni5XOD9ov/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1o9Ae8I4l1HrQ85ucn-KdPaEHTy32WJQc/view?usp=drivesdk) · SHA-256 Original: `8ee36f974e5685ee579fcaef8da0037185f7f710fabc56c3fe3043166d458981` |
| 445 | `tour_source_ekzoticheskij_parad_chempionov_v_brazilii` | Требуется разрешить блокировку | Шапка обещает две ночи в Бузиосе, но день 10 возвращает из Амазонии в Рио, а день 11 завершает тур вылетом из Рио. Original не разрешает расхождение. | [V2](https://drive.google.com/file/d/1COKJGlLabzkoE1-zE5Tsmax6ivkwHukn/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1VEQ3XuvhYEyj4wYR00Q5tYFdNJh5sliR/view?usp=drivesdk) · SHA-256 Original: `b4bbf1f558b740f41f2a84f7ff7a531f1db673e451a784df2d48b7cc4e75c209` |
| 448 | `tour_source_romanticheskaya_braziliya` | Требуется разрешить блокировку | Название и маршрут обещают Коста-ду-Сауипе, а дни 8–12 описывают отдых и выезд из Прайя-ду-Форте. Выбор или замена курорта не оговорены и в Original. | [V2](https://drive.google.com/file/d/1oxlpfJ0LcMojqSVDW6igF6yl_lZQ25h7/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/14Q8rkqDETgJPwLv0tUUWy3SDsPEwvSzE/view?usp=drivesdk) · SHA-256 Original: `578c6c42ca7029879b828acd51ecdead8fbecb28e0478e0b604f67f6d0218e63` |
| 463 | `tour_source_5_stran_latinskoj_ameriki_i_parad_chempionov_karnavala` | Требуется разрешить блокировку | «Остров Рыб» в Уюни не позволяет однозначно выбрать Инкауаси или Исла-Пескадо. Точный Original тоже не называет остров; предполагаемый ID не создавался. | [V2](https://drive.google.com/file/d/1ZXQdgUQgbvKmj7RFavqjAyoTha17Fplh/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1LHR7QTq7xoZ5OpV90VOqvaRtcOkoccfU/view?usp=drivesdk) · SHA-256 Original: `3b3a11ec87ed9c8a91c435ecdde0035b986b3c995464d3f4b0e792cc7460c0f4` |
| 467 | `tour_source_ekzoticheskij_koktejl_na_parad_chempionov_karnavala_v_brazilii` | Требуется разрешить блокировку | В цене внутренних перелётов указан Кампу-Гранди, хотя дни 7–9 описывают Манаус и Амазонию. В Original списки услуг пусты; маршрут через Кампу-Гранди и сумма USD 800 там не подтверждены. | [V2](https://drive.google.com/file/d/14P315bp2Xlner0nNdat0WhSuintRX0AO/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1yGXSAL9AMU8TUGuZfxl8lZPI7-i3PNF0/view?usp=drivesdk) · SHA-256 Original: `87230838b7a6f70db924e42c679de7618334b0da9be87243abdcd0cd1437c1a8` |
| 470 | `tour_source_emotsii_brazilii` | Требуется разрешить блокировку | Статус Макуко-Сафари расходится между программой и перечнем дополнительных услуг. В V2 также остались служебные фразы об исходном описании. Original не позволяет определить включённость экскурсии. | [V2](https://drive.google.com/file/d/15Zw6YM0OMn2h5FnpUWxmIW0AVbFV8reO/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1rss8kmWixki4wsIY4hVi8T86wTr7axZv/view?usp=drivesdk) · SHA-256 Original: `1676c7d4fc71f4d3d3ae80d7a57747e27591433eefb57fa26c2cdef152d6e7ee` |
| 498 | `tour_source_tur_v_kolumbiyu_na_10_dnej` | Требуется разрешить блокировку | В колумбийском туре среди дополнительных экскурсий указан вертолётный полёт над Рио. Original с пустыми списками услуг не подтверждает эту строку. | [V2](https://drive.google.com/file/d/1T-ie16JSmpharVOTK7tU7XAfg2nYPIPy/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1Qr3iqYH_qogzbmw1OFLWzzl3_InyUwEK/view?usp=drivesdk) · SHA-256 Original: `ed54b29dc26f9dfc05b90b0c2d9dd01bbf5ff971c1d92a06af57c2521cf71a57` |
| 515 | `tour_source_gvatemala_kosta_rika` | Требуется разрешить блокировку | Шапка включает Поас, водопады Ла-Пас и Монтеверде, но подробные дни проходят по другому маршруту Коста-Рики. То же расхождение присутствует в Original. | [V2](https://drive.google.com/file/d/11slsiQv4cYW4hFklos0if0SER8ez1ZZA/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1bjfdrhcxJeo4nBOzvuTCPGz0-_XoAa2m/view?usp=drivesdk) · SHA-256 Original: `5e18f64439e8e139c34f2e50f5a977215b78f83be92b9c565a7e514490242da7` |
| 533 | `tour_source_viva_meksika` | Требуется разрешить блокировку | Шапка включает Паленке, Кампече, Сумидеро и Сан-Кристобаль, которых нет в подробных днях. Original повторяет расхождение; Пуэбла описана лишь как вариант автотрансфера. | [V2](https://drive.google.com/file/d/1hrJ47C30A9KaPGhWWPg07n85bMeO2FH8/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1HJTK31fj0amXChnX-S4kbeD6k3ReajfE/view?usp=drivesdk) · SHA-256 Original: `b2b9eae7bdeb867cb875d145dfbf954b4ac395ab3952b17881383d056bb082ab` |
| 561 | `tour_source_ves_mnogolikij_peru_i_prazdnik_sv_kandelarii` | Требуется разрешить блокировку | Заголовок дня 7 добавляет Лиму, хотя текст возвращает в Пуно; заголовок дня 10 добавляет Наску, хотя текст заканчивается перелётом в Лиму. Original содержит те же ошибки. | [V2](https://drive.google.com/file/d/1IWkV6aazJkOpMai5_gpRshl1xxMQ2HGf/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1Sl5OnNI-cgX8k8JfV_eurehMggq-ATN8/view?usp=drivesdk) · SHA-256 Original: `8d6618d83b5840964bba7803d1c5a666d8b7bcf746ca3a4aa5455a5523dbb897` |
| 566 | `tour_source_peru_na_prazdnik_sv_kandelyarii` | Источник исключён; не публиковать | Выбранный V2 имеет status: excluded: программа исключена из нового сайта по решению Анны от 28.09.2026. Это отдельное явное исключение, а не автоматическое удаление всех датированных программ. | [V2](https://drive.google.com/file/d/1DYAr9gYVva0QfxcfRrHW00PJq6tVtv-j/view?usp=drivesdk) |
| 593 | `tour_source_velikij_tur_po_yuzhnoj_amerike` | Требуется разрешить блокировку | Названия «Рыбачий остров» и «Кочани» не позволяют однозначно определить места. Original не уточняет остров и не подтверждает написание Колчани. | [V2](https://drive.google.com/file/d/1Of-rCEbo7uTXOBvvXzNiFYyt8TC5a2Wn/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1bDtn-FVcdYlM-oCSIFI276Mw3rGghs2a/view?usp=drivesdk) · SHA-256 Original: `a1bee30f2527dd966110cdab1d22cfa7b363a8aa23a790ddd764ca61ab928081` |
| 606 | `tour_source_ekvador_zhivaya_priroda_s_kruizom_na_galapagosakh` | Требуется разрешить блокировку | Парк Кондор запланирован на понедельник, а в том же дне указан режим закрытия по понедельникам и вторникам. Original повторяет противоречие. | [V2](https://drive.google.com/file/d/1l0-bTlulZuyQmjhJ5yU85K9R4TFq8Etp/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1dbDiJbsQyV7eM8qntO0KJrPskb071lvR/view?usp=drivesdk) · SHA-256 Original: `74f13ba0b54ebbc89831385ffd9eff13f422e4ae1e5f2d986b66691201bc089b` |
| 610 | `tour_source_galapagosskie_ostrova_na_vip_yakhte` | Требуется разрешить блокировку | Названия «Старый Дафне» / «Дафне» не позволяют однозначно выбрать Daphne Major или Daphne Minor. Original не уточняет остров. | [V2](https://drive.google.com/file/d/16Ck2YmhiPe5rZwMWeXsOKJhyG5kIj0nk/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1_8mAexfPceMS3fPtxwJGyqmtmqY5ZzYI/view?usp=drivesdk) · SHA-256 Original: `4a09afe05575e8e4fa0fec493669001837c9eede14c8e77600510e296d805c9f` |
| 611 | `tour_source_kontinentalnyj_ekvador_amazoniya` | Требуется разрешить блокировку | Во вводный блок V2 попала экскурсия через Сипакиру и Вилья-де-Лейву в Колумбии, хотя программа проходит по Эквадору. В Original этой вставки нет; замена без редакционного решения не подготовлена. | [V2](https://drive.google.com/file/d/11wwczX85gDnEqH-Rf59Uh8D-N6rOHb0g/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1VkRQarBDda9VhzaLT4zAg4PVJRCc5_jN/view?usp=drivesdk) · SHA-256 Original: `a28a76fc2e423c46e515274541b0cd204034ae18b7b072d78697d63fb5003b43` |
| 613 | `tour_source_ves_ekvador_galapagosskie_ostrova` | Требуется разрешить блокировку | Куэнка есть в общей строке маршрута, но отсутствует в подробных днях. Отдельно оплачиваемый перелёт Гуаякиль–Галапагосы также не согласован с отправлением из Кито; пустые списки услуг Original не разрешают вопрос. | [V2](https://drive.google.com/file/d/1XmePdA0ajjWZlYfpTRGnGsnk6Gkeq8Te/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1I4CeVPF9lDGQQMAs3naJ_DWh0V8n3NJ0/view?usp=drivesdk) · SHA-256 Original: `3f1f6ac681c0e2115e7ccc2b77008f3e11367dec3c4807c4ea63c142172786a7` |
| 614 | `tour_source_ekvador_zhivaya_priroda` | Требуется разрешить блокировку | Килотоа присутствует в общей строке маршрута, но не посещается по подробной программе. Original содержит то же расхождение. | [V2](https://drive.google.com/file/d/1d_Qh3Eih0O3CwhTSshAWPtfw-V21akNK/view?usp=drivesdk) · [Original](https://drive.google.com/file/d/1R00iFsSsw16B85EhNKk3H-10_zlcudxO/view?usp=drivesdk) · SHA-256 Original: `e1e1b280fd396e217809da66548d177f473ab62c8e73d34700b9c027aed85ff3` |

### 10.4. Известные ограничения подготовленных данных

- У 168 готовых туров есть дни без доказанного соответствия собственной фотографии. Чужие или случайные изображения не подставлялись.
- У 7 готовых туров сохранены нераспределимые диапазоны дней. Диапазон указан в названии блока; длительность тура взята из подтверждённого источника.
- У 35 новых канонических экскурсий отсутствует подтверждённый hero. Отсутствие отражено в source entry и не замаскировано подстановкой фотографии.

Следующая стадия: включить подготовленные файлы одним логическим commit, получить результат одного штатного Actions build/deploy и после успешного выпуска обновить только соответствующие строки реестра и очереди материалов. Самостоятельный служебный commit ради статуса этого журнала не требуется.

<!-- /ADA_TOURS_PREPARED_BATCH:2026-10-02-planned-tours-v2 -->

## Сверка очереди Анны — 2026-10-03

- `tour_source_luchshee_v_rio_de_zhanejro`: N=0; самостоятельных отделимых модулей нет; обычные дни сохранены.
- `tour_source_prekrasnaya_patagoniya_i_solonchak_uyuni`: N=2; `excursion_el_calafate_ice_trekking_perito_moreno`, `excursion_santiago_maipo_wine_tour`.
- `tour_source_argentina_chili_boliviya`: N=2; `excursion_el_calafate_ice_trekking_perito_moreno`, `excursion_santiago_maipo_wine_tour`.
- `tour_source_romanticheskaya_braziliya`: N=2; `excursion_source_makuko_safari_he`, `excursion_source_park_jekzoticheskih_ptic_v_iguasu`.
- `tour_source_ves_ekvador_galapagosskie_ostrova`: N=8; `excursion_ecuador_misicocha_forest_walk`, `excursion_ecuador_cosano_amazoonico`, `excursion_ecuador_kichwa_family_crafts`, `excursion_ecuador_casa_suizo_river_island_walk`, `excursion_ecuador_casa_suizo_butterfly_farm`, `excursion_source_ostrov_bartolome_morskaya_ekskursiya`, `excursion_source_ostrov_severnyj_sejmur`, `excursion_source_ostrov_plasa`.
- `tour_source_gvatemala_kosta_rika`: N=0; самостоятельных отделимых модулей нет; обычные дни сохранены.
- `tour_source_kontinentalnyj_ekvador_amazoniya`: N=0; самостоятельных отделимых модулей нет; обычные дни сохранены.
- `tour_source_tur_v_kolumbiyu_na_10_dnej`: N=1; `excursion_colombia_el_ocaso_coffee_tour`.

Для программы Эквадора 11 дней блоки дня 6 — альтернативы по выбору с гидом, а в день 10 посещается один из двух островов. Для аргентинских программ Mil Outdoor и длинный треккинг не обещаны как подтвержденные; вопрос сохранен в журнале и у менеджеров.


## P030 — восстановление по Word Анны, 09.10.2026

Тур `tour_source_ves_ekvador_na_novyj_god`. Самостоятельные модули из дней 4–7 перенесены в канонические экскурсии; размещение и питание остались в датированных днях. Альтернативы дня 10 полностью сохранены в программе, прежние вставки заменены актуальным текстом Word.

| День | Excursion ID | Статус данных |
|---|---|---|
| 4 | `excursion_ecuador_banos_waterfalls_day` | Опубликовано; Word сверён |
| 5 | `excursion_ecuador_chimborazo_ingapirca_day` | Опубликовано; Word сверён |
| 6 | `excursion_ecuador_cuenca_city_hats` | Опубликовано; Word сверён |
| 7 | `excursion_ecuador_cajas_cacao_day` | Опубликовано; Word сверён |

Публикация P030 и всех четырёх модулей подтверждена: https://github.com/alexyakovlev79/adatours.ru/actions/runs/37923090452; commit `f71ddd03163de98106b1edaa632e6e137765e81d`. Реестр страниц: строки 974–977.


## P032 — восстановление из Word Анны, 09.10.2026

Тур `tour_source_ves_ekvador_i_gorbatye_kity`; 11 дней. Источник: https://drive.google.com/file/d/18-m9Is7xIKzVM3aQSSt4y6qCBWtjoKuk/view. Перенесены 8 самостоятельных модулей: 4 новые экскурсии и 4 существующие. У Сеймура и Пласы альтернативные маршруты одного дня.

| После дня | Excursion ID | Результат |
|---|---|---|
| 2 | `excursion_ecuador_quito_panecillo_equator` | Создана из Word |
| 3 | `excursion_ecuador_quilotoa_tigua_banos` | Создана из Word |
| 4 | `excursion_ecuador_banos_waterfalls_quito` | Создана из Word |
| 5 | `excursion_source_ostrov_santa_krus` | Переиспользована каноническая экскурсия |
| 6 | `excursion_source_ostrov_bartolome_morskaya_ekskursiya` | Переиспользована каноническая экскурсия |
| 7 | `excursion_source_ostrov_severnyj_sejmur` | Переиспользована каноническая экскурсия |
| 7 | `excursion_source_ostrov_plasa` | Переиспользована каноническая экскурсия |
| 10 | `excursion_ecuador_punta_centinela_whales` | Создана из Word |

09.10.2026: P146 восстановлен по свежему Word Анны 2027. Прежняя вертолетная экскурсия отсутствует в Word и удалена из этого тура; самостоятельных excursionRef в новой программе нет. Исходный hash в историческом списке относится к прежнему V2.


## P145 — восстановление по Word Анны, 09.10.2026

Тур `tour_source_nezabyvaemyj_parad_chempionov_v_brazilii`; источник: https://docs.google.com/document/d/12QJtd211FeAN8NdNUvLeLvn4p_iGfYfA/edit. Программа 10 дней / 9 ночей, 12–21.02.2027. N=3: после дня 5 подключены самостоятельные факультативные модули. Основные экскурсии по Рио и двум сторонам Игуасу сохранены внутри обычных дней.

| После дня | Excursion ID | Результат |
|---|---|---|
| 5 | `excursion_source_makuko_safari_he` | Переиспользована; условия Word $135 и около 3 км на автомобиле сохранены в туре |
| 5 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | Переиспользована; стоимость этого тура $65 |
| 5 | `excursion_iguazu_helicopter_falls` | Переиспользована; стоимость этого тура $170 |

Старая вертолетная вставка над Рио отсутствует в Word 2027 и в восстановленную программу не переносится. Новые сущности и изображения не создавались. Публикация подтверждена: https://github.com/alexyakovlev79/adatours.ru/actions/runs/37953238666. Реестр Страницы: строка 368; Фото: 5600–5610, все записи проверены. Работа завершена.
## Ответы Анны — первая тройка, 09.10.2026

Ответ в Telegram подтверждает остров Инкауаси. Исторические блокеры раздела 10.3 для трех ID ниже сняты; остальные записи не изменены.

- `tour_source_kruiznyj_tur_po_luchshim_mestam_argentiny_chili_i_bolivii`: 18 дней, 42 канонических мест, 2 самостоятельных экскурсионных вставок. Пакет подготовлен к штатному deploy.
- `tour_source_solonchak_uyuni`: 3 дней, 18 канонических мест, 0 самостоятельных экскурсионных вставок. Пакет подготовлен к штатному deploy.
- `tour_source_5_stran_latinskoj_ameriki`: 18 дней, 41 канонических мест, 3 самостоятельных экскурсионных вставок. Пакет подготовлен к штатному deploy.


## Ответы Анны — вторая тройка, 09.10.2026

Исторический вопрос «остров Рыб» снят: Инкауаси.

- `tour_source_karnaval_5_stran`: 19 дней; канонические вставки: `excursion_source_park_jekzoticheskih_ptic_v_iguasu`, `excursion_source_makuko_safari_he`, `excursion_santiago_maipo_wine_tour`.
- `tour_source_5_stran_latinskoj_ameriki_na_16_dnej_na_novyj_god`: 19 дней; канонические вставки: `excursion_source_park_jekzoticheskih_ptic_v_iguasu`, `excursion_source_makuko_safari_he`, `excursion_santiago_maipo_wine_tour`, `excursion_chile_atacama_astronomy_tour`.
- `tour_source_5_stran_latinskoj_ameriki_i_parad_chempionov_karnavala`: 18 дней; канонические вставки: `excursion_source_park_jekzoticheskih_ptic_v_iguasu`, `excursion_source_makuko_safari_he`, `excursion_santiago_maipo_wine_tour`, `excursion_chile_atacama_astronomy_tour`.

09.10.2026: P143 восстановлен по Word Анны 2027, групповой вариант Рио + Игуасу. Вертолет над Рио отсутствует в Word и удален; Парк птиц и активная каноническая Макуко-сaфари сохранены как факультативные. Тарифы тура $50/$130 и особенность 3 км на джипе записаны в условиях тура; исторический source hash относится к прежнему V2.


## P151 — восстановление по Word Анны 2027 · 09.10.2026

Тур: `tour_source_mechty_sbyvayutsya_na_parad_chempionov_karnavala`, прежний URL сохранен. Рио 3н + Фоз 2н + Буэнос-Айрес 3н; 12–20.02.2027. Word: https://docs.google.com/document/d/1qkPpWu99FABWC0lOUv80QsAPHJGIahUG/edit. Девять тарифов, внутренние перелеты включены. Все дополнительные условия, включая расхождения тарифов Игуасу, сохранены в днях тура; общие Excursion не переписаны.

| После дня | excursionRef | Результат |
| --- | --- | --- |
| 3 | `excursion_rio_samba_capoeira_show_only` | Новая самостоятельная экскурсия из Word |
| 3 | `excursion_source_zaliv_guanabara_morskaya_progulka` | Канонический существующий продукт |
| 3 | `excursion_source_tajny_starogo_rio_de_zhanejro` | Канонический существующий продукт |
| 3 | `excursion_source_polet_na_vertolete_nad_rio` | Канонический существующий продукт |
| 3 | `excursion_source_botanical_garden` | Канонический существующий продукт |
| 3 | `excursion_rio_rocinha_favela_jeep_tour` | Новая самостоятельная экскурсия из Word |
| 3 | `excursion_source_polet_na_deltaplane_nad_rio` | Канонический существующий продукт |
| 5 | `excursion_source_makuko_safari_he` | Канонический существующий продукт |
| 5 | `excursion_source_park_jekzoticheskih_ptic_v_iguasu` | Канонический существующий продукт |
| 5 | `excursion_iguazu_helicopter_falls` | Канонический существующий продукт |
| 5 | `excursion_source_rafain_shou` | Канонический существующий продукт |
| 7 | `excursion_buenos_aires_tango_show_dinner` | Канонический существующий продукт |
| 8 | `excursion_source_ekskursiya_v_tigre_i_po_severnym_provintsiyam_buenos_ajresa` | Канонический существующий продукт |
| 8 | `excursion_source_ekskursiya_po_montevideo` | Канонический существующий продукт |
| 8 | `excursion_source_fiesta_gaucho` | Канонический существующий продукт |

Росинья на джипе отличается от `excursion_source_favela_tur` (Видигал, мото-такси и трек на Два Брата). Шоу за $120 исключает трансферы, в отличие от сопровождаемой программы `excursion_source_rio_nochyu`. Созданы самостоятельные ID без клонирования этих продуктов. 9 разных обычных дневных фото и 15 разных героев экскурсионных вставок, без пересечений. Использованы существующие media assets; новых S3 загрузок и GPT Images нет. Статус: content prepared; Actions/Sheets pending.


### P151 — завершено 09.10.2026

Опубликован commit `f7a57f3cfa2fdcfe34aa539b07217a6382d8826b` в успешном deploy https://github.com/alexyakovlev79/adatours.ru/actions/runs/37959941071 (потомок `4081945f613ecac7e0633ae7f85f4c8e2332a34f`, целевые MD/entries сохранены без изменений). Штатная синхронизация `sync-tour-inventory.mjs --apply` выполнена в Actions 37958483949; финальная опись тем же генератором отражает `work: done`. Таблица проверена по всем значениям и нативной структуре: Страницы 386, 983–984; Фото 5614–5625. Старая дата 02.10.2026 и «Принята» сохранены. Новый источник содержит разные тарифы Игуасу, неясную единицу $230 Гуанабара и назначение трансфера по прилету; все 3 уточнения явно сохранены в публичных условиях для подтверждения при бронировании. Новых файлов медиа нет.


## Уточнения Анны — 09.10.2026, подготовлено, deploy ожидается

Viva Mexico: 9 самостоятельных модулей перенесены из точного Word; ночевки сохранены в туре.

- `tour_source_viva_meksika` → `excursion_mexico_mexico_city_history_anthropology`, после дня 2.
- `tour_source_viva_meksika` → `excursion_mexico_teotihuacan_guadalupe`, после дня 3.
- `tour_source_viva_meksika` → `excursion_mexico_xochimilco_south_mexico_city`, после дня 4.
- `tour_source_viva_meksika` → `excursion_mexico_oaxaca_walking`, после дня 6.
- `tour_source_viva_meksika` → `excursion_mexico_monte_alban_craft_villages`, после дня 7.
- `tour_source_viva_meksika` → `excursion_mexico_mitla_hierve_el_agua_mescal`, после дня 8.
- `tour_source_viva_meksika` → `excursion_mexico_uxmal_cenote`, после дня 10.
- `tour_source_viva_meksika` → `excursion_mexico_santa_barbara_cenotes`, после дня 11.
- `tour_source_viva_meksika` → `excursion_mexico_chichen_itza_valladolid_caribbean`, после дня 12.


## P005 — Argentina Experience, 10.10.2026

`tour_argentina_experience_6_days`: 5 самостоятельных модулей, 4 новых, 1 существующий (Колония из Буэнос-Айреса). Word полностью сверен; generic продукты с исключённым обедом, другим залом танго или другим составом услуг не подставлены. Модули связаны через `excursionRef` после дней 2, 3, 4 и 5. Основные места: Буэнос-Айрес, Тигре, Колония-дель-Сакраменто, Санта-Сусана. Сан-Исидро и конкретные городские районы не гарантируются источником.


## P009 — Игуасу incentive 3 дня, 10.10.2026

`tour_iguazu_incentive_3_days`: 7 модулей в исходном порядке. Rafain → бразильские водопады → Macuco Safari → Парк птиц → факультативный вертолет 10 минут → вечер асадо → аргентинские водопады. 6 существующих экскурсий переиспользованы, новый гастрономический модуль `excursion_iguazu_argentine_asado_wine` создан из Word. Оба национальных парка сопоставлены с каноническими местами Фоз-ду-Игуасу / Пуэрто-Игуасу; созданы самостоятельные страницы Парка птиц и Глотки Дьявола и добавлены их связи к соответствующим экскурсиям. Бразилия основная страна с размещением, Аргентина обязательный приграничный выезд. Даты, стоимость, отели и размер группы в Word отсутствуют.

## P013 — три экосистемы Мату-Гросу, 10.10.2026

Tour: `tour_brazil_three_ecosystems_8_days`; источник https://docs.google.com/document/d/1Teplr6p6WIA5ow9sf9yOkCzMjDmgX3B-/edit

| После дня | Канонический модуль | Состояние |
|---|---|---|
| 2 | `excursion_jardim_amazonia_forest_canoe` | CANONICALIZED — MD/entry готовы; deploy ожидается |
| 3 | `excursion_bom_jardim_aquario_salobra_snorkeling` | CANONICALIZED — MD/entry готовы; deploy ожидается |
| 4 | `excursion_chapada_waterfalls_trails` | CANONICALIZED — MD/entry готовы; deploy ожидается |
| 6 | `excursion_araras_canoe_trek_night_safari` | CANONICALIZED — MD/entry готовы; deploy ожидается |
| 7 | `excursion_araras_horseback_rondon_trail` | CANONICALIZED — MD/entry готовы; deploy ожидается |

8 обычных дней сохранены, самостоятельные тексты вынесены в 5 Excursion без потери питания/ночёвок и условий.


## P034 — Канайма и Анхель, 4 дня / 3 ночи (Word Анны, 2027)

Источник: https://docs.google.com/document/d/1l3NZVOJImL-ZtZAmlFjBDPrOpyMT2C56/edit; точная проверка: `data/audits/word-tour-p034-20261010.json`. Все семь блоков используют canonical экскурсии.

| Тур | День / блок | Экскурсия | Результат |
|---|---|---|---|
| `tour_venezuela_canaima_angel_falls_4_days` | 1 / 1 | `excursion_canaima_sapo_hacha_lagoon` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 2 / 1 | `excursion_canaima_angel_falls_full_day` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 3 / 2 | `excursion_venezuela_kavak_angel_flight` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 3 / 4 | `excursion_venezuela_blue_lagoon_trip` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 3 / 6 | `excursion_venezuela_kuravaina_trekking` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 3 / 8 | `excursion_canaima_yuri_yurilu` | canonical_excursion_linked |
| `tour_venezuela_canaima_angel_falls_4_days` | 3 / 10 | `excursion_venezuela_angel_helicopter_flight` | canonical_excursion_linked |


## P039 — От Анд до Карибского моря, 10.10.2026

Свежий Word: https://docs.google.com/document/d/1s8C2hA5M8Xq9v-uealzohr9okK55ebU_/edit. Сохранены 5 дней/4 ночи, 6 тарифов и все коммерческие условия.

| Tour ID | Excursion ID | Позиция | Результат |
|---|---|---|---|
| tour_colombia_essential_5_days | excursion_source_siti_tur_v_bogote | День 1, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_essential_5_days | excursion_source_colombia_bogota_zipaquira_con_guatavita | День 2, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_essential_5_days | excursion_source_siti_tur_po_kartakhene | День 3, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_essential_5_days | excursion_colombia_san_pedro_majagua_day_trip | День 4, contentBlock 1 | canonical_excursion_linked |


## P041 — Колумбия за 7 дней, 10.10.2026

Word: https://docs.google.com/document/d/16Yho_hI1w_jZ1yah_LrAH8cKU0V5Wddt/edit. Все 7 дней/6 ночей, 6 тарифов, отели и коммерческие условия сверены.

| Tour ID | Excursion ID | Позиция | Результат |
|---|---|---|---|
| tour_colombia_highlights_7_days | excursion_source_siti_tur_v_bogote | День 1, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_highlights_7_days | excursion_source_colombia_bogota_zipaquira_con_guatavita | День 2, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_highlights_7_days | excursion_colombia_medellin_comuna13_el_castillo | День 3, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_highlights_7_days | excursion_colombia_guatape_rock_and_town | День 4, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_highlights_7_days | excursion_source_siti_tur_po_kartakhene | День 5, contentBlock 1 | canonical_excursion_linked |
| tour_colombia_highlights_7_days | excursion_colombia_san_pedro_majagua_day_trip | День 6, contentBlock 1 | canonical_excursion_linked |


## P043 — Перу и Боливия, 10 дней / 9 ночей, 10.10.2026

Источник: https://drive.google.com/file/d/1cLVaZTUZWg3v12X6Kuqa8etRRaY39kfu/view (PDF). 10 обычных дней, 10 самостоятельных вставок; 5 новых модулей, 5 существующих. Условия пакета, включая обед Мачу-Пикчу и факультативные поездки, сохранены в Tour.

| День | Excursion ID | Результат |
|---|---|---|
| 2 | `excursion_peru_lima_miraflores_casa_aliaga` | Создана |
| 3 | `excursion_peru_cusco_coricancha_sacsayhuaman` | Создана |
| 4 | `excursion_source_ekskursiya_v_zateryannyj_gorod_machu_pikchu` | Переиспользована |
| 5 | `excursion_peru_sacred_valley_full_day` | Переиспользована |
| 5 | `excursion_source_ekskursiya_na_raduzhnuyu_goru_vinikunka` | Переиспользована |
| 6 | `excursion_peru_cusco_puno_andes_bus` | Создана |
| 7 | `excursion_bolivia_titicaca_isla_del_sol_catamaran` | Создана |
| 8 | `excursion_bolivia_la_paz_moon_valley_tiwanaku` | Создана |
| 9 | `excursion_peru_paracas_nazca_full_day` | Переиспользована |
| 10 | `excursion_lima_larco_museum_visit` | Переиспользована |


## P040 — Word Анны, 10.10.2026

`tour_colombia_complete_11_days`: 11 обычных дней и 8 канонических модулей. Коммерческие условия тура сохранены в днях; несовпадение ночевок таблицы отелей и программы вынесено в условия до оплаты.

| День | excursion_id | Результат |
|---|---|---|
| 1 | `excursion_source_siti_tur_v_bogote` | Каноническая экскурсия подключена |
| 2 | `excursion_source_colombia_bogota_zipaquira_con_guatavita` | Каноническая экскурсия подключена |
| 3 | `excursion_source_salento_i_dolina_kokora` | Каноническая экскурсия подключена |
| 3 | `excursion_colombia_el_ocaso_coffee_tour` | Каноническая экскурсия подключена |
| 4 | `excursion_colombia_coffee_region_zipline_horseback` | Каноническая экскурсия подключена |
| 5 | `excursion_source_siti_tur_po_kartakhene` | Каноническая экскурсия подключена |
| 9 | `excursion_colombia_medellin_comuna13_el_castillo` | Каноническая экскурсия подключена |
| 10 | `excursion_colombia_guatape_rock_and_town` | Каноническая экскурсия подключена |

## P042 — Colombia Explorer, Word 2027

Источник: https://docs.google.com/document/d/1S9Yxr3o4Yn77DDkStiW3PXI-drhZT3xk/edit

Отдельный 9-дневный продукт; 9 модулей, 8 готовых и 1 новый без посещений площади Ботеро и Музея Антьокии. Все места опубликованы.

| tour_id | excursion_id | Позиция | Результат |
|---|---|---|---|
| `tour_colombia_explorer_9_days` | `excursion_source_siti_tur_v_bogote` | После дня 1 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_source_colombia_bogota_zipaquira_con_guatavita` | После дня 2 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_source_salento_i_dolina_kokora` | После дня 3 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_colombia_el_ocaso_coffee_tour` | После дня 3 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_colombia_coffee_region_zipline_horseback` | После дня 4 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_colombia_medellin_veracruz_comuna13_castillo` | После дня 5 | Создана по P042 |
| `tour_colombia_explorer_9_days` | `excursion_colombia_guatape_rock_and_town` | После дня 6 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_source_siti_tur_po_kartakhene` | После дня 7 | Переиспользована |
| `tour_colombia_explorer_9_days` | `excursion_colombia_san_pedro_majagua_day_trip` | После дня 8 | Переиспользована |


## P055: Южная Бразилия VIP, 7 дней / 6 ночей · 10.10.2026

Тур: `tour_brazil_southern_vip_7_days`. Источник: https://docs.google.com/document/d/1WLLe6iOY4dkgnQbQl9oiK31QweUUA-rq/edit. Полный Word-проход: 7 обычных дней, 5 самостоятельных экскурсионных модулей, 6 канонических опубликованных мест. Прогулка по виноградникам относится к проживанию; вертолет является трансфером.

| tour_id | excursion_id | Позиция | Канонизация |
|---|---|---|---|
| `tour_brazil_southern_vip_7_days` | `excursion_brazil_bento_vineyard_atv` | После дня 2 | Создана из самостоятельного блока Word; excursionRef |
| `tour_brazil_southern_vip_7_days` | `excursion_brazil_gramado_private_full_day` | После дня 3 | Создана из самостоятельного блока Word; excursionRef |
| `tour_brazil_southern_vip_7_days` | `excursion_brazil_itaimbezinho_full_day` | После дня 4 | Создана из самостоятельного блока Word; excursionRef |
| `tour_brazil_southern_vip_7_days` | `excursion_brazil_cambara_balloon_picnic` | После дня 5 | Создана из самостоятельного блока Word; excursionRef |
| `tour_brazil_southern_vip_7_days` | `excursion_brazil_florianopolis_private_city` | После дня 7 | Создана из самостоятельного блока Word; excursionRef |


## P080 — 4 дня в Рио, Word 2027 · 2026-10-11

Источник: https://docs.google.com/document/d/1K7mXZs3iOQm9U7fDH-HRmgE3lOn6i6lD/edit. 4 обычных дня, 4 самостоятельных модуля; 2 обязательных и 2 факультативных. Существующие варианты отличаются длительностью, маршрутом или услугами: вечерняя англоязычная Сахарная Голова; старый Рио с дополнительными остановками; Корковаду с поездом/джипом; Росинья с джипом/Видигалом. Новый маршрут эти услуги не обещает. Новые модули имеют stable ID, независимые от тура. Шоу содержит ужин в чурраскарии, а существующий show-only его исключает.

| tour_id | excursion_id | Позиция | Статус программы |
|---|---|---|---|
| `tour_brazil_rio_four_days` | `excursion_rio_night_show_churrascaria_dinner` | После дня 1 | Факультативно, оплачивается отдельно |
| `tour_brazil_rio_four_days` | `excursion_rio_sugarloaf_urca_four_hours` | После дня 2 | Включено |
| `tour_brazil_rio_four_days` | `excursion_rio_corcovado_tijuca_four_hours` | После дня 3 | Включено |
| `tour_brazil_rio_four_days` | `excursion_rio_rocinha_private_walk` | После дня 3 | Факультативно, оплачивается отдельно |


## P096 · tour_brazil_best_rio_express_six_days · 2026-10-11

6 numbered days; 3 modules on original positions: after day 2 `excursion_rio_corcovado_train_christ`, after day 3 `excursion_rio_sugarloaf_urca_four_hours`, after day 4 `excursion_angra_ilha_grande_day_trip_from_rio`. Numbered days retain meals, hotel nights, transfer and tour-specific panorama details. Boat module is a distinct guided six-hour program without unsupported lunch or Blue Lagoon stops. All 10 hero/program images are distinct. Content prepared; publication tracked in exact entry and Drive inventory.
