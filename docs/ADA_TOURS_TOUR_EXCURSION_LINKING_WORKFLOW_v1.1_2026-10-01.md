# Ada Tours — Tour ↔ Excursion linking workflow

**Версия:** 1.1  
**Дата:** 2026-10-01  
**Репозиторий:** `alexyakovlev79/adatours.ru`  
**Ветка:** `main`  
**Назначение:** последовательный обход уникализированных туров, нормализация экскурсионных модулей маршрута, выделение самостоятельных Excursion между днями, сопоставление их с существующими каноническими Excursion и немедленное создание новых Excursion, если подходящей сущности еще нет.

---

# 0. Главный принцип

Экскурсия на новом сайте — самостоятельная сущность.

Если экскурсия оформлена отдельной карточкой программы между пронумерованными днями, тур не должен хранить собственную постоянную копию ее title/text/photo.

Правильная модель:

```text
Tour itinerary
  → excursionRef
      → canonical Excursion
          → title
          → body / lead
          → hero
          → metadata
```

После завершения прохода по туру не должно оставаться ни одной самостоятельной экскурсии, которая хранит собственные title/text/photo внутри numbered day или локальной карточки тура вместо ссылки на каноническую Excursion.

Если самостоятельная экскурсия ошибочно встроена в numbered day, сначала извлечь ее из дня в отдельный `excursionRef` между этим днем и следующим. Если подходящей Excursion раньше не было — создать ее сразу.

---

# 1. Где хранится прогресс

Постоянный реестр:

`docs/TOUR_EXCURSION_MAPPING_REGISTRY.md`

Каждый новый чат сначала читает его.

Алгоритм продолжения:

```text
есть IN_PROGRESS → продолжить его
нет IN_PROGRESS → первый PENDING
DONE_LINKED → не трогать без отдельной причины
```

Нельзя начинать обход уже проверенных туров заново.

Основной production-реестр:

`Ada Tours — реестр страниц нового сайта`

Google Sheet:

`1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc`

Лист:

`Страницы`

---

# 2. Канонические технические места

- Tours: `src/content/tours/`
- Excursions: `src/content/excursions/`
- Content schema: `src/content.config.ts`
- Itinerary renderer: `src/components/tour/Itinerary.astro`
- Tour layout: `src/layouts/TourLayout.astro`
- Deploy workflow: `.github/workflows/deploy.yml`
- Mapping registry: `docs/TOUR_EXCURSION_MAPPING_REGISTRY.md`

---

# 3. Источники и их роли

## 3.1. V2 тура

V2 — источник утвержденного публичного русского текста тура.

Для standalone-вставки именно ее V2-блок определяет:

- title;
- body;
- позицию в маршруте.

Не переписывать V2 ради удобства архитектуры.

## 3.2. Original snapshot тура

Original используется для проверки:

- порядка дней;
- самостоятельных дополнительных вставок;
- цен;
- длительности;
- условий;
- исходной привязки фотографии.

## 3.3. Отдельная source Excursion

Если standalone-блок соответствует уже существующей отдельной экскурсии, канонической становится Excursion.

Если production-файл уже есть — использовать его.

Если Excursion есть в основном Google Sheets, но production-файла еще нет — создать production-сущность из собственного источника этой экскурсии:

1. ее V2, если он есть;
2. иначе original/source snapshot + действующие rewrite-правила.

Блок тура используется для подтверждения match, но не должен перезаписывать более полный собственный источник экскурсии.

## 3.4. Media

Использовать `IMAGES_MASTER.csv` и уже существующие production media.

Повторный crawl без необходимости не делать.

---

# 4. Нормализация экскурсионных модулей

Перед подсчетом standalone-карточек нужно просмотреть **каждый numbered day целиком**, включая `text`, `contentBlocks`, вложенные секции и изображения.

Самостоятельная Excursion может находиться в двух состояниях.

## 4.1. Уже отдельная карточка между днями

Признаки:

- у itinerary-item нет `day`;
- он стоит после numbered day и до следующего numbered day;
- визуально/семантически это отдельная экскурсия или активность.

Пример:

```text
День 4
→ Тропические острова
→ Ночное шоу
→ Полет на вертолете
→ День 5
```

Каждая такая вставка обязана стать отдельным `excursionRef`.

## 4.2. Самостоятельная экскурсия ошибочно встроена внутрь numbered day

Ее **нужно извлечь из дня**, а не игнорировать.

Сильные признаки самостоятельного экскурсионного модуля:

- внутри дня есть `type: excursion`;
- есть отдельный подзаголовок/секция с названием экскурсии и собственным описанием;
- текст прямо сообщает о нескольких самостоятельных экскурсиях, например: «в этот же день вас ждут еще 2 экскурсии: Парк птиц и Макуко-сафари»;
- у активности есть отдельная source Excursion / production Excursion;
- активность имеет собственный продуктовый scope: маршрут, механику, длительность, цену, отдельный hero или самостоятельный набор фактов;
- V2/original подтверждает, что это отдельная экскурсия, а не просто часть обзорного рассказа о дне.

### Что делать

Если самостоятельная экскурсия встроена в день:

1. определить ее каноническую Excursion;
2. если ее нет — создать production Excursion;
3. удалить из numbered day **дублирующие** title/text/photo этой экскурсии;
4. удалить служебную фразу-перечисление вроде «вас ждут еще 2 экскурсии…», если после извлечения она становится дублем;
5. поставить отдельный itinerary-item с `excursionRef` **сразу после этого дня и до следующего numbered day**;
6. сохранить исходный порядок нескольких экскурсий;
7. контент и hero карточки должны приходить только из canonical Excursion.

Пример нормализации:

```text
БЫЛО:

День 4
  водопады
  Парк птиц — собственный текст/фото
  Макуко-сафари — собственный текст/фото

День 5

СТАЛО:

День 4
  только собственная программа водопадов

Парк птиц → excursionRef
Макуко-сафари → excursionRef

День 5
```

## 4.3. Что не является самостоятельной Excursion

Не создавать relation только из-за обычного проходного упоминания:

- название экскурсии упомянуто одной фразой без собственного модуля;
- активность является неотделимой частью основной программы дня;
- упоминание находится только в highlights;
- included / notIncluded;
- FAQ;
- notes;
- цене;
- alt/caption;
- обычном абзаце без самостоятельного продуктового scope.

**Критически важно:** нахождение внутри `contentBlocks` **не является основанием игнорировать экскурсию**. Сначала определить, является ли блок самостоятельным экскурсионным продуктом.

---

# 5. Нулевой допуск к дыркам

Сначала посчитать найденные до нормализации сущности:

```text
existing_between_days = A
embedded_excursion_modules = B
```

После извлечения embedded-модулей:

```text
standalone_between_days = N
N = A + B
```

Финально должно быть:

```text
production_excursion_refs = N
remaining_local_standalone_cards = 0
remaining_embedded_excursion_modules = 0
duplicate_excursion_text_inside_days = 0
missing_excursion_entities = 0
```

Тур нельзя ставить `DONE_LINKED`, пока хотя бы один из этих инвариантов нарушен.

---

# 6. Как искать существующую Excursion

Для каждой standalone-вставки:

1. искать exact / close match в основном Google Sheets среди `Тип страницы = Экскурсия`;
2. проверить stable ID, source URL, title, aliases;
3. сравнить географию;
4. сравнить реальную механику продукта;
5. при нескольких кандидатах прочитать source content;
6. проверить аналогичные связи в других турах.

Совпадение по одному слову в title недостаточно.

## Не сливать разные продукты по одной достопримечательности

Пример:

- экскурсия на Сахарную Голова с канатной дорогой;
- треккинг / пеший подъем на Сахарную Голова.

Это разные Excursion.

Для треккинга создан отдельный ID:

`excursion_rio_sugarloaf_trekking`

## Дубли старых source-pages

Если старый сайт содержит несколько похожих source excursion_detail:

1. сравнить тексты;
2. проверить язык / назначение;
3. выбрать один canonical stable ID;
4. зафиксировать решение в mapping registry.

Пример:

`excursion_source_makuko_safari`

используется вместо дубля:

`excursion_source_makuko_safari_he`

---

# 7. Если existing Excursion найдена

## Production-файл уже существует

Заменить локальную карточку тура на:

```yaml
- excursionRef: excursion_source_example
  places: ["..."]
```

Не оставлять рядом:

- title;
- text;
- images;
- локальный hero.

Текущий `Itinerary.astro` получает title/body/hero из Excursion.

## Production-файла еще нет

Сначала создать:

`src/content/excursions/<slug>.md`

из собственного источника этой экскурсии.

Только после этого ставить `excursionRef`.

Missing ID должен считаться ошибкой, а не промежуточным финальным состоянием.

---

# 8. Если такой Excursion вообще нет

Standalone-блок тура может стать первым источником новой канонической Excursion.

В этом случае:

- не оставлять локальную карточку;
- не ограничиваться резервированием ID;
- не ждать отдельного будущего прохода по экскурсиям;
- создать production Excursion сразу.

---

# 9. Новая Excursion из блока тура

## Разрешено брать

Из утвержденного standalone-блока:

- title;
- body;
- явную географию;
- places;
- фотографию;
- явно указанную duration;
- явно указанную price;
- явно указанный format;
- явно указанные included/notIncluded;
- другие прямо подтвержденные факты.

## Нельзя придумывать

Если данных нет — оставить поле пустым / не указывать.

Не выдумывать:

- price;
- duration;
- language;
- адрес;
- расписание;
- included;
- restrictions;
- возраст;
- трансфер;
- количество участников;
- дополнительные маршруты;
- маркетинговые обещания.

Пустое поле лучше выдуманного факта.

---

# 10. Минимальная структура новой Excursion

Пример:

```yaml
---
id: excursion_rio_caipirinha_masterclass
locale: ru
title: "Мастер-класс по приготовлению кайпириньи"
slug: master-klass-po-prigotovleniyu-kajpirini
status: approved
searchAliases: []
country: country_brazil
destination: destination_brazil_rio
themes: []
language: []
hero:
  src: /media/excursions/master-klass-po-prigotovleniyu-kajpirini/hero.webp
  alt: Бразильская кайпиринья
gallery: []
route:
  - Рио-де-Жанейро
lead: "..."
included: []
notIncluded: []
notes: []
updatedAt: 2026-09-30
---

<утвержденный текст standalone-блока>
```

## Stable ID

Новый ID:

- уникален;
- стабилен;
- описывает Excursion;
- не зависит от конкретного тура.

Допустимые примеры:

```text
excursion_rio_caipirinha_masterclass
excursion_rio_churrasco_masterclass
excursion_rio_sugarloaf_trekking
```

Не включать tour ID в идентичность Excursion.

## Slug

Slug описывает экскурсию, а не тур.

---

# 11. Lead новой Excursion

`lead` обязателен схемой.

Он должен:

- опираться только на тот же standalone-блок;
- не добавлять новые факты;
- быть коротким;
- по возможности использовать уже существующие формулировки.

Body сохраняет утвержденный смысл и факты блока тура.

---

# 12. Фото новой Excursion

Standalone-карточка тура может дать исходный hero новой Excursion.

Но после выделения сущности media должна принадлежать Excursion.

Канонический путь:

```text
public/media/excursions/<excursion-slug>/hero.webp
```

В MD:

```yaml
hero:
  src: /media/excursions/<excursion-slug>/hero.webp
```

Если фото уже улучшено и подходит, повторно генерировать / перекодировать его не нужно.

Можно перенести/скопировать тот же blob без потери качества.

После `excursionRef` локальный `images:` у карточки тура больше не нужен.

---

# 13. Служебные данные не класть в публичные поля

Критическая ошибка первого прохода: provenance новой Excursion был записан в `notes`.

`notes` публичны и отображаются как «Важные условия».

Поэтому служебные фразы типа:

```text
Каноническая Excursion создана из standalone-блока...
source excursion_detail отсутствовал...
tour_luxury_brazil_11d...
```

нельзя помещать в публичный MD.

## Где хранить provenance

Только в:

- `docs/TOUR_EXCURSION_MAPPING_REGISTRY.md`;
- Google Sheets → `Источник / комментарий`;
- commit message при необходимости.

Если реальных пользовательских условий нет:

```yaml
notes: []
```

## Source metadata

Если отдельной старой Excursion никогда не было — не выдумывать:

```yaml
sourceUrl:
sourceSnapshot:
```

Их можно просто не указывать.

---

# 14. Что менять в tour MD

Было:

```yaml
- label: "ДОП."
  title: "Мастер-класс по шурраско"
  places: ["Рио-де-Жанейро"]
  text: |-
    ...
  images:
    - src: ...
      alt: ...
```

Должно стать:

```yaml
- excursionRef: excursion_rio_churrasco_masterclass
  places: ["Рио-де-Жанейро"]
```

Не оставлять старый text/images рядом.

---

# 15. Порядок в маршруте неизменяем

Если было:

```text
День 4
A
B
C
День 5
```

после канонизации:

```text
День 4
excursionRef A
excursionRef B
excursionRef C
День 5
```

Нельзя:

- сортировать по алфавиту;
- переносить в конец;
- собирать отдельный блок «Дополнительные экскурсии»;
- менять порядок ради верстки.

Позиция — часть программы.

---

# 16. Отображение в itinerary

Standalone Excursion:

- нет `day`;
- нет видимого `ДОП.`;
- номерная колонка пустая;
- title/body/hero идут из canonical Excursion;
- позиция сохраняется.

Обычные дни продолжают показывать:

`01, 02, 03...`

Нельзя ради удаления `ДОП.` сломать day numbering.

---

# 17. Google Sheets для новой Excursion

Лист:

`Страницы`

Минимум:

| Колонка | Значение |
|---|---|
| A | `/ekskursii/<slug>/` |
| B | реальный source URL, иначе пусто |
| C | `Экскурсия` |
| D | публичное название |
| E | после успешного deploy → `Добавлена` |
| F | дата добавления |
| H | stable ID |
| I | служебный provenance/comment |

В I допустимо:

```text
Каноническая сущность создана из standalone-блока tour <stable_id>;
отдельной source excursion_detail не было
```

Это служебный реестр, не публичная страница.

Не ставить `Добавлена` до build/deploy/QA.

---

# 18. Mapping registry

Файл:

`docs/TOUR_EXCURSION_MAPPING_REGISTRY.md`

Для relation фиксировать:

```text
tour_id
excursion_id
placement = between_days
after_day
before_day
status
note
```

## Статусы тура

- `PENDING`
- `IN_PROGRESS`
- `DONE_MAPPING`
- `DONE_LINKED`
- `DONE_NO_RELATIONS`
- `REVIEW`

`DONE_LINKED` — все standalone-вставки заменены на рабочие `excursionRef`, build/deploy прошли.

## Статусы relation

- `MATCHED_TO_INSERT`
- `CREATED_FROM_TOUR`
- `LINKED_EXISTING`
- `REVIEW`

---

# 19. Не закрывать неоднозначность угадыванием

«Без дыр» не означает «выбрать любой похожий ID».

При нескольких кандидатах:

1. прочитать source;
2. сравнить географию;
3. сравнить механику;
4. сравнить duration/route;
5. проверить другие туры;
6. только потом выбрать.

Если доказать match нельзя — `REVIEW`.

Тур не получает `DONE_LINKED` до решения.

Не создавать новый дубль, если велика вероятность, что продукт уже существует.

---

# 20. Полный алгоритм одного тура

```text
1. Прочитать TOUR_EXCURSION_MAPPING_REGISTRY.md.

2. Есть IN_PROGRESS → продолжить.
   Иначе первый PENDING.

3. Поставить IN_PROGRESS.

4. Прочитать production MD тура полностью.

5. Сверить V2 / original при необходимости.

6. Найти ВСЕ standalone items без day между numbered days.

7. standalone_between_days = N.

8. Для каждого:
   - искать existing Excursion;
   - при неоднозначности читать source;
   - existing → использовать stable ID;
   - not existing → создать production Excursion сразу.

9. Для новой Excursion:
   - stable ID;
   - slug;
   - минимальный frontmatter;
   - только подтвержденные факты;
   - body из блока;
   - canonical hero path;
   - notes без service text;
   - строка Google Sheets.

10. В tour MD заменить каждую local card на excursionRef.

11. Проверить порядок.

12. Проверить:
    production_excursion_refs = N
    remaining_local_standalone_cards = 0
    missing_excursion_entities = 0

13. Убедиться, что обычные day не изменились.

14. Commit.

15. Build success.

16. Deploy success.

17. QA deploy / Pages artifact.

18. Google Sheets:
    новые Excursion → Добавлена.

19. Mapping registry:
    relations → LINKED_EXISTING;
    tour → DONE_LINKED.

20. Следующий тур.
```

---

# 21. Build / deploy QA

Обязательно:

```text
build = success
deploy = success
```

До этого финальные статусы не выставлять.

`Itinerary.astro` должен считать missing `excursionRef` ошибкой.

Нельзя поставить ссылку сейчас, а сущность создавать потом.

---

# 22. QA tour MD

Проверить:

```text
standalone_between_days = N
production_excursion_refs = N
remaining_local_standalone_cards = 0
remaining_embedded_excursion_modules = 0
duplicate_excursion_text_inside_days = 0
missing_excursion_entities = 0
```

Дополнительно:

- порядок refs сохранен;
- число обычных дней не изменилось;
- обычные проходные mentions inside day не превращены в relations; самостоятельные excursion-модули inside day извлечены в `excursionRef`, а их дублирующий текст/фото удалены из numbered day.

---

# 23. QA каждой Excursion

- ID уникален;
- slug уникален;
- country правильный;
- destination правильный, если однозначен;
- title соответствует продукту;
- разные продукты не слиты;
- body без выдуманных фактов;
- price только при источнике;
- duration только при источнике;
- language только при источнике;
- hero существует;
- hero лежит в `/media/excursions/<slug>/`;
- `notes` не содержит service provenance;
- `sourceUrl/sourceSnapshot` не выдуманы;
- schema проходит build.

---

# 24. Публичный текст

Нельзя выводить посетителю:

- stable IDs;
- названия внутренних файлов;
- «создано из блока тура»;
- «source отсутствовал»;
- migration notes;
- QA notes.

Публичная страница должна выглядеть как обычная страница Excursion Ada Tours.

---

# 25. Эталон первого полного прохода

Tour:

`tour_luxury_brazil_11d`

«Роскошная Бразилия».

Было:

```text
standalone_between_days = 9
```

Финально:

```text
production_excursion_refs = 9
remaining_local_standalone_cards = 0
remaining_embedded_excursion_modules = 0
duplicate_excursion_text_inside_days = 0
missing_excursion_entities = 0
status = DONE_LINKED
```

## Existing / source Excursion matches

1. `excursion_source_tropicheskie_ostrova_rajskoe_naslazhdenie`
2. `excursion_source_rio_nochyu`
3. `excursion_source_polet_na_vertolete_nad_rio`
4. `excursion_source_botanical_garden`
5. `excursion_source_park_jekzoticheskih_ptic_v_iguasu`
6. `excursion_source_makuko_safari`

## Новые Excursion, созданные из standalone-блоков

7. `excursion_rio_caipirinha_masterclass`
8. `excursion_rio_churrasco_masterclass`
9. `excursion_rio_sugarloaf_trekking`

Это эталон механики, но не повод автоматически переносить match на другой тур без проверки.

---

# 26. Антиошибки первого прохода

1. **Искать только среди уже опубликованных Excursion** — неправильно. Ищем во всем основном реестре.
2. **Оставлять unmatched standalone-блок на потом** — неправильно. Если доказано, что аналога нет, создаем Excursion сразу.
3. **Только зарезервировать ID** — недостаточно. Нужен реальный MD.
4. **Положить provenance в `notes`** — нельзя, это публичное поле.
5. **Оставить hero в папке тура** — нельзя как финальную архитектуру; media должна принадлежать Excursion.
6. **Слить продукты из-за одной географии** — нельзя.
7. **Считать любое упоминание внутри дня relation** — нельзя.
8. **Поставить DONE_LINKED до deploy** — нельзя.

Правильный порядок:

```text
code → build → deploy → QA → registries
```

---

# 27. Definition of Done

Тур получает `DONE_LINKED` только если:

- найден каждый standalone-between-days;
- посчитан N;
- каждому блоку соответствует один stable excursion ID;
- не создано случайных дублей;
- отсутствующие Excursion созданы как production entities;
- новые сущности не содержат выдуманных фактов;
- media вынесена в canonical excursion paths;
- service provenance не попал в публичные поля;
- local standalone cards = 0;
- excursionRefs = N;
- missing entities = 0;
- порядок вставок сохранен;
- обычные дни сохранены;
- build success;
- deploy success;
- Pages artifact / public result проверен;
- Google Sheets синхронизирован;
- mapping registry синхронизирован.

---

# 28. Продолжение после потери контекста

Новый чат читает:

1. этот workflow;
2. `docs/TOUR_EXCURSION_MAPPING_REGISTRY.md`;
3. текущий `main`;
4. основной Google Sheets.

Затем продолжает с текущего статуса, а не повторяет уже закрытые туры.

---

# 29. Экономия ресурсов

Обычно достаточно:

1. mapping registry;
2. основной Google Sheets;
3. GitHub current production;
4. V2 тура;
5. Original snapshot;
6. IMAGES_MASTER / production media.

Повторный web crawl без необходимости не делать.

---

# 30. Короткая формула

```text
Tour
→ find every standalone block between days
→ match existing Excursion
→ existing? link
→ not existing? create Excursion immediately
→ canonical media
→ replace local card with excursionRef
→ verify N refs / 0 local cards / 0 missing entities
→ build
→ deploy
→ QA
→ Google Sheets
→ mapping registry
→ next Tour
```

**Главный инвариант:** самостоятельная экскурсия между днями существует в архитектуре сайта как каноническая `Excursion`, а Tour хранит только позиционную связь через `excursionRef`.
