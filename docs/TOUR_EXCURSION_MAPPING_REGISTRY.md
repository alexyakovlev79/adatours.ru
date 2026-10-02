# Ada Tours — реестр сопоставления туров и экскурсий

Версия: 1.41  
Дата старта: 2026-09-30  
Repo: `alexyakovlev79/adatours.ru`  
Ветка: `main`  
Базовый HEAD при создании реестра: `5f2a10064d6aad34718503337c62cf252af0c231`

## 0. Назначение

Этот файл — постоянная точка продолжения работы по связям `Tour ↔ Excursion`.

**Любой новый чат, продолжающий сопоставление экскурсий с турами, сначала читает этот файл и продолжает с текущего статуса. Нельзя начинать обход уникализированных туров заново.**

Полная методика обхода, сопоставления и создания новых Excursion:

`ADA_TOURS_TOUR_EXCURSION_LINKING_WORKFLOW_v1.2_2026-10-02(1).md` — канонический Project source, заменяет repo-копию v1.1.

Новый чат должен прочитать **оба источника**: Project source workflow v1.2 + текущий registry. При конфликте с историческими формулировками этого registry действует workflow v1.2.

Основной реестр страниц:
`Ada Tours — реестр страниц нового сайта`  
Google Sheet: `1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc`  
Лист: `Страницы`

Production tours:
`src/content/tours/`

Production excursions:
`src/content/excursions/`

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

В текущем реестре учтено **31** тур со статусом `Уникализировано`.

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
| 344 | `tour_source_amazon_clipper_cruise_traditional_3_days_2_nights` | `src/content/tours/amazon-clipper-cruise-traditional-3-days-2-nights.md` | Amazon Clipper Cruise | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 410 | `tour_source_iguacu_falls` | `src/content/tours/iguacu-falls.md` | Свадебная церемония у водопадов Игуасу | DONE_LINKED | 1 | 2026-10-01 |
| 411 | `tour_source_rio_de_janeiro_wedding` | `src/content/tours/rio-de-janeiro-wedding.md` | Свадебная церемония на пляже в Рио-де-Жанейро | DONE_NO_RELATIONS | 0 | 2026-10-01 |
| 416 | `tour_source_wedding_ceremony_tropical_package` | `src/content/tours/wedding-ceremony-tropical-package.md` | Тропическая свадебная церемония | DONE_NO_RELATIONS | 0 | 2026-10-01 |

**Следующий проход v1.2:** строка 305 закрыта. Перед следующим проходом проверить Google Sheets на новые уникализированные туры.

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

## 6. Обязательный рабочий цикл одного тура

1. Прочитать этот файл.
2. Если есть `IN_PROGRESS` — продолжить его.
3. Иначе взять первый `PENDING` по Sheet row.
4. Перед содержательным разбором поменять его статус здесь на `IN_PROGRESS`, чтобы параллельный/следующий чат не начал тот же тур.
5. Прочитать текущий production MD тура целиком.
6. Просмотреть последовательность `itinerary` и содержимое каждого numbered day (`text`, `contentBlocks`, вложенные секции, images).
7. Найти уже существующие самостоятельные элементы между numbered days: `existing_between_days = A`.
8. Найти самостоятельные excursion-модули, ошибочно встроенные внутрь numbered days: `embedded_excursion_modules = B`; извлечь их после соответствующего дня, удалить дублирующие title/text/photo и сохранить порядок.
9. После нормализации посчитать `standalone_between_days = N`, где `N = A + B`.
9. Для каждого элемента найти каноническую Excursion в основном Google Sheets / `src/content/excursions/`.
10. Если match надежный — записать существующий stable ID.
11. Если канонической Excursion нет — сразу создать production Excursion из данных standalone-блока тура; не выдумывать отсутствующие факты. Создать stable ID и URL, добавить строку в Google Sheets, поставить подтвержденный raw hero `https://brasiltours.ru/image/...` и заменить карточку тура на `excursionRef`. Локальный enhanced hero создается позже отдельным photo-enhancement workflow.
12. Проверить `mapped_relation_rows = N`, `production_excursion_refs = N`, `remaining_embedded_excursion_modules = 0`, `duplicate_excursion_text_inside_days = 0` и `missing_slots = 0`.
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


## 9. Аудит v1.2 — Перейра / Саленто, 2026-10-02

- Для `excursion_source_salento_i_dolina_kokora` после аудита создана каноническая Destination `destination_colombia_pereira` и добавлена связь `destination: destination_colombia_pereira`.
- Та же Destination применена к `excursion_source_kofejnyj_tur_v_perejra` и `excursion_source_poseshchenie_shokoladnoj_fermy`, чтобы три продукта Перейры использовали одну географическую сущность.
- Destination зарегистрирована в основном Google Sheets как `/napravleniya/kolumbiya/perejra/`; факты подтверждены source-туром `https://brasiltours.ru/kolumbiya-c-kofe` (Перейра, кофейный треугольник, кофейные фермы, Саленто и долина Кокора).
- Для Саленто/Кокоры выполнен строгий source-media QA по v1.2 в GitHub Actions: 7 production raw URL и 2 source-media Destination Перейры вернули HTTP 200, `Content-Type: image/jpeg`, валидную сигнатуру изображения и ненулевые реальные bytes. Проверка завершилась успешным build/deploy.
- В текущих production-турах `excursion_source_salento_i_dolina_kokora` пока не встречается через `excursionRef`; поэтому блок связанных экскурсий на странице Саленто отсутствует. Это ожидаемое поведение v1.2, fallback по стране/месту не используется.
- Ручное поле `relatedExcursions` не добавлялось.
