# WHITE GARNET REFERENCE CORE FOR ADA TOURS

Адреса объектов задаются `docs/workflows/urls.md`; использовать текущий URL из entry. Смена публичного slug не переименовывает существующие content-файлы, медиа и их реестровые ID.

**Версия:** 2.2

**Актуализировано:** 05.10.2026

Назначение: справочник принятой дизайн-системы для отдельно заказанной разработки шаблонов. Канонический путь: `docs/workflows/design-reference.md`.

При добавлении страны, места, экскурсии или тура этот файл не перечитывается. Чат заполняет существующий шаблон по соответствующему workflow. Размеры desktop/mobile ниже — исторические параметры спецификации, а не задания на проверку экрана. Самостоятельная визуальная приемка страниц и результатов GPT Image не выполняется; замечания по внешнему виду дает пользователь.

Архитектуру, источники, связи и приемку определяют `docs/workflows/master.md` и специализированный workflow. Точные тексты и raw-фото закреплены в `data/source-index/entries/<entityId>.json`; альтернативные источники не ищутся. Адреса с `/image/cache/` не используются.

## Настройка стороны текста в текущем проекте

Country, Destination, Tour, Excursion и Theme поддерживают необязательное `imageTextAlign: left | right`. Явное значение показанной сущности определяет сторону всего текста поверх ее фотографий вместе с CTA/метаданными: в собственном hero, баннерах главной/каталогов, рекомендациях и overlay-карточках. Настройка передается из сущности, а не из страницы-контейнера; каноническая экскурсия сохраняет свое значение внутри тура.

Без поля сохраняются текущие стороны и чередование общих компонентов. Указание «перенеси текст Никарагуа влево» меняет только `imageTextAlign: left` в Country MD Никарагуа. Фото, crop и обычный текст над/под изображением не меняются. Примеры положения текста в исторической спецификации ниже не переопределяют явно заданное значение. Конкретным сущностям поле не назначается при введении механизма или по самостоятельной эстетической оценке чата.

Для такой настройки не нужны GPT Image, чтение новых источников, визуальная приемка или массовая правка страниц. Ее выполняет обычный content-чат одной целевой правкой и штатным commit/CI.

---

# WHITE GARNET VISUAL AUDIT

# White Garnet — визуальный аудит для Ada Tours

Дата фиксации: 23 сентября 2026. Основные страницы: [главная](https://whitegarnet.com/), [Аргентина](https://whitegarnet.com/argentina), [Бразилия](https://whitegarnet.com/brazil). Viewport: desktop 1440×900, mobile 390×844, zoom 100%.

## 1. Короткий вывод

White Garnet строит ощущение дорогого авторского travel-продукта не сложностью интерфейса, а сочетанием пяти приёмов:

1. фотография почти всегда является самой крупной поверхностью экрана;
2. крупная узкая типографика работает как графика, а не как служебная подпись;
3. композиция чередует спокойные полноэкранные кадры, большие цифры и очень большие поля;
4. интерфейсных рамок, иконок и «карточечного UI» почти нет;
5. продажа встроена в редакционный рассказ: CTA появляется в hero и в ключевых паузах, но не спорит с фотографиями.

Для Ada Tours следует переносить именно это соотношение «изображение → крупная фраза → воздух → факт → CTA», а не абсолютные координаты Tilda Zero Block.

## 2. Область справочника

Значения ниже зафиксированы в прежнем исследовании White Garnet. Они описывают выбранное направление дизайна; обновлять исследования и получать новые скриншоты при наполнении сайта не требуется. Фактическая структура и CSS текущих общих компонентов имеют приоритет перед историческими измерениями.

## 3. Глобальная дизайн-система

### 3.1. Контейнеры и сетка

**Desktop 1440 px**

- Базовая рабочая ширина: около **1160–1200 px**, центрирование; типичные внешние поля **120–142 px**.
- Широкие заголовки секций: x≈287–288, w≈865 — визуальный контейнер около **60% viewport**.
- Обычный текст/строки программы: x≈142, w≈940.
- Hero-контент начинается около x=51–52; это отдельная full-bleed-композиция, не общий контейнер.
- Основные двухколоночные композиции близки к 40/60 или 45/55, но намеренно асимметричны.
- Главная не использует сетку карточек: каждый тур — отдельный full-width band высотой **650 px**.
- Tour hero — **900 px**, ровно высота тестового viewport (100vh).
- Большие секции: 382–1224 px; editorial/highlights-секция объединяет много сцен в длинный блок около 5 000 px.
- Вертикальные паузы между смысловыми группами обычно 80–160 px; внутри больших артбордов расстояние часто заложено абсолютной композицией.

**Mobile 390 px**

- Рабочие поля контента: **45–46 px** слева и около 39–45 px справа; полезная ширина ≈300–305 px.
- Главная: каждый тур — full-width band **390×400 px**.
- Tour hero: **390×844 px**, то есть ровно 100vh тестового устройства.
- Колонки складываются в одну; факты в hero собираются в 1–2 строки, CTA становится почти full-width (≈300 px).
- Большие секционные заголовки имеют ширину 233–315 px; картинки часто выходят за текстовую колонку или становятся full-bleed.

### 3.2. Типографика

Основное семейство, подтверждённое computed styles: **FuturaPT, Arial, sans-serif**. Фирменная пластика создаётся узким геометрическим рисунком FuturaPT и контрастом размеров. В DOM крупные заголовки часто имеют `font-weight: 700`, хотя визуально часть display-начертания выглядит тоньше — точный файл шрифта и начертание задаются общей дизайн-системой при отдельной разработке шаблонов.

| Роль | Desktop | Mobile | Примечание |
|---|---:|---:|---|
| Tour hero H1 | 80/80, 700 | 45/52, 700 | белый; слева; переносы заданы композицией |
| Доп. строка hero | 70/70 или 20–22/≈28 | 18–20/≈24 | зависит от страницы; не конкурирует с H1 |
| Большой секционный H2 | 70/84, 700 | 43/52, 700 | часто ширина 865 desktop / 305 mobile |
| Highlight title | 60/70, 700 | 36/42, 700 | 2–4 строки, рядом/поверх фото |
| Главная: название тура | 38/44, 700, tracking ≈2 px | 36/42, 700 | белый, uppercase/смешанный регистр |
| Большая цифра | 120/150, 700 | 70/88, 700 | отдельный визуальный слой |
| Itinerary row | 28/39, 400 | обычно 18–22/≈26–31 | строка + маленький жёлтый управляющий знак |
| Price title | 40/56, 500 | 30/36, 500 | внутри светлой ценовой карточки |
| Price | 28/39, 500 | 28/34, 500 | рядом или ниже названия |
| Body | 18–20/24–30, 300–400 | 16–18/21–27 | комфортная, не слишком широкая строка |
| Навигация | 18/23, 400 | menu labels около 18 | белая в hero; мобильный burger |
| CTA | 18/27.9, 400–500 | 16–18/22–28 | без uppercase, спокойный тон |
| Микротекст/legal | 13–16 | 13–16 | тонкое начертание |

Характерные приёмы:

- display-заголовок занимает 40–65% ширины, а не всю строку;
- крупные слова намеренно ломаются на 2–4 строки;
- uppercase используется для географических/секционных акцентов, но body и CTA остаются обычного регистра;
- числа 70–120 px формируют собственный ритм;
- жирный sans не выглядит «маркетплейсно», потому что вокруг него много воздуха и почти нет UI-хрома;
- визуальная иерархия строится скачками масштаба: 16 → 28 → 60/70 → 100/120.

### 3.3. Цвета

Измеренная базовая палитра:

| Токен | HEX | Использование |
|---|---|---|
| Warm white | `#FFFCF8` | основной светлый фон, белый текст на тёмном |
| Ink | `#1A1A1A` | основной текст, тёмные overlays |
| Deep near-black | `#131412` | тёмные CTA/секции |
| Primary gold | `#F2CC67` | CTA, акцентные строки, маркеры |
| Gold hover/dark | `#E6BA43` | более насыщенное состояние/вариант |
| Pale gold | `#F7E0A4` | светлая поддержка, мягкие подложки |
| Champagne | `#E9D5A2` | чипы/вторичный премиальный акцент |
| Deep gold | `#C89A20` | тёмный акцент/граница |
| Muted gray | `#C5C5C5` | вторичные линии/подписи |
| White | `#FFFFFF` | локальные элементы и формы |

Главный визуальный контраст: `#FFFCF8` ↔ `#1A1A1A`; золото используется дозированно. На фотографиях — чёрный overlay ориентировочно **35–45%**; на главной измерен слой `#1A1A1A` с opacity **0.4**.

### 3.4. Фотографии

- Главная: full-bleed кадр на всю ширину, `cover`, desktop 1440×650 (2.22:1), mobile 390×400 (0.975:1).
- Tour hero: `cover`, 1440×900 / 390×844; важный объект смещается `object-position`/разными кадрами по breakpoint.
- Highlights: не сетка одинаковых thumbnail. Чередуются портретные и пейзажные изображения, текстовые поля и большие пустые зоны.
- Скругления у крупных изображений практически отсутствуют; где есть локальные карточки/аватар, радиус мал и не становится системообразующим.
- Текст на фото всегда получает достаточный затемняющий слой или выбирается спокойная зона кадра.
- На mobile кадры не просто уменьшаются: меняется crop, иногда используется отдельный фон; композиция становится вертикальной.

Премиальность возникает из режиссуры: один сильный кадр на сцену, крупный масштаб, редкие переходы, отсутствие бейджей/рейтингов/плашек поверх изображения.

### 3.5. Кнопки и ссылки

Основной CTA:

- фон `#F2CC67`;
- тёмный текст `#1A1A1A`;
- высота ориентировочно 50–52 px desktop и 49–50 px mobile;
- desktop ширина около 210 px, mobile около 300 px;
- прямоугольник без выраженного скругления (0–2 px);
- горизонтальный padding около 32–40 px;
- текст 16–18 px, medium/regular;
- hover: более насыщенный `#E6BA43` или лёгкое затемнение, transition около 0.2 s.

Вторичные действия — текстовые ссылки, телефон/e-mail и якорная навигация. Не используются четыре равноправные кнопки.

Рекомендация для Ada Tours: один жёлтый CTA «Оставить заявку»; WhatsApp/Telegram/телефон — текстовые или иконка+текст actions. На mobile допустима спокойная sticky contact bar высотой 56–64 px: primary занимает ≈60%, два messenger icon-actions — остаток.

## 4. Header, menu, footer

### Header desktop

- Прозрачный, расположен поверх hero.
- Логотип слева примерно в зоне x=50–170, y=20–125.
- Меню — одна строка справа/по центру; белый FuturaPT около 18 px.
- Нет отдельной фоновой панели, рамки или тени.
- На главной отдельная классическая шапка почти отсутствует: логотип встроен в первый визуальный band.

### Header/mobile menu

- Логотип около 70×60 px в верхней левой зоне; burger справа, три белые/тёмные линии.
- Шапка остаётся частью hero; визуальная высота около 90–110 px.
- Открытое меню tour pages — светлая off-canvas панель шириной около **300 px** из 390 px; слева остаётся затемнённая полоса hero около 90 px. Вверху logo и X, ниже 6 вертикальных ссылок, CTA прижат к нижней части панели.
- Menu transition следует воспроизводить как fade+slide 200–350 ms, без сложной хореографии.

### Footer

- Светлый `#FFFCF8`, большие поля.
- Блоки сертификаций/логотипов, подписка, контактные строки, social links, legal.
- Desktop — несколько спокойных колонок; mobile — последовательный стек.
- Контакты заметные (около 24 px), но не оформлены как агрессивные кнопки.

## 5. Главная

Главная — последовательность из 15 самостоятельных travel-постеров. Каждый desktop band — 650 px, каждый mobile band — 400 px.

Паттерн band:

- full-bleed фото;
- 40% overlay;
- географический chip/короткая метка в отдельных блоках;
- название 36–38 px, белое, обычно в нижней/левой трети;
- дата/эмоциональная подпись 16–20 px;
- вся поверхность кликабельна;
- расположение текста меняется от карточки к карточке, поэтому лента ощущается редакционной, а не магазинной.

Для Ada Tours при большом количестве направлений:

1. верхние 6–10 приоритетных направлений оставить крупными editorial bands;
2. следующие группы собирать в асимметричные пары 7/5 или 8/4 колонок;
3. каждые 6–8 элементов возвращать full-width «якорь»;
4. фильтры держать отдельной компактной строкой, не помещать их внутрь изображений;
5. пагинацию/«Показать ещё» делать после визуального выпуска, а не бесконечной стеной одинаковых карточек.

## 6. Шаблон tour detail

### Hero

- 100vh: 900 px desktop, 844 px mobile.
- Desktop H1 x≈51, y≈515–535; ширина 878–940 px; 80/80.
- Mobile H1 x≈45, y≈350; ширина ≈303 px; 45/52.
- Навигация сверху; метаданные и CTA — в нижней трети.
- Desktop CTA отделён от H1 и метаданных; mobile становится full-width и завершает hero.

### Вводный narrative + показатели

- Светлый фон, крупные цифры 120/150 desktop и 70/88 mobile.
- 4 показателя в ряд desktop; сетка 2×2 mobile.
- Эмоциональный заголовок 70/84 → 36/43.
- Большие поля превращают факты в editorial spread.

### Highlights

- Длинная асимметричная композиция: текстовые заголовки 60/70 desktop и 36/42 mobile чередуются с изображениями.
- Изображения разных пропорций; нет рамок и одинаковых карточек.
- Desktop часть элементов может входить сбоку/использовать горизонтальное движение; mobile преобразует это в вертикальный storytelling.

### Программа по дням

- Заголовок 70/84 desktop, 43/52 mobile.
- Каждая строка — отдельный блок высотой около 112 px desktop; mobile 116–206 px в зависимости от длины.
- Основной текст desktop 28/39, чёрный; справа небольшой золотой круг/плюс.
- Поведение — accordion; раскрытая часть должна появляться под строкой, не в модальном окне.

### Маршрут

- Светлая секция с заголовком 60/70 desktop, 36/42 mobile.
- Desktop: текст/легенда и вертикальная карта/схема в асимметрии.
- Mobile: сначала заголовок и последовательность, затем карта; высота около 683–723 px.

### «Почему с нами»

- Тёмный/фотографический блок около 1067 px desktop и 1832 px mobile.
- Заголовок белый 70/84 → 43/52.
- Факты разделены воздухом и фотографией, а не стандартными icon cards.

### Стоимость

- Отдельный заголовочный блок 382 px desktop / 252 px mobile.
- Основная карточка: 712 px для Argentina, 1122 px для Brazil; mobile 1677/2404 px.
- Тёплый светлый фон, тонкие линии, большая цена, колонки «включено / не включено».
- Brazil расширяет тот же шаблон опциональной программой — это не новый компонент.

### Booking + form

- Повторный CTA после цены (≈357 px desktop / 317 px mobile).
- Отдельно объясняется порядок оплаты (≈610 px desktop / 1073–1123 px mobile).
- Большой тёмный lead-form блок с oversized фразой 100/100 desktop, 50/50 mobile и золотым акцентом.

### Автор и другие поездки

- Авторский профиль: портрет + биография + контакты; 848 px desktop / 1480 px mobile.
- «Другие путешествия»: заголовок + 3 крупных image cards; desktop ряд, mobile стек по 400 px.
- Footer завершает историю, не обрывая её системным UI.

## 7. Argentina vs Brazil

Общая структура одинакова: hero → показатели → эмоциональный statement → highlights → itinerary → disclaimer → route → why-us → price → CTA → booking → form → author → related → footer.

Различия:

- `/argentina`: intro 1144 px, highlights 5110 px, price card 712 px; 9 itinerary rows.
- `/brazil`: intro 1224 px, highlights 5010 px, price card 1122 px; 8 основных/дополнительных itinerary rows; добавлена опциональная Амазония.
- Brazil показывает, что шаблон масштабируется добавлением offer-row внутри price section, а не отдельным визуальным языком.

## 8. Responsive-правила

- Breakpoint фактически проявляется ниже 480 px для главной (650 → 400 px) и между desktop/mobile вариантами tour blocks; для Astro рекомендуется формализовать 480/768/1200.
- H1 80 → 45 px; section H2 70 → 43 px; highlight 60 → 36 px; big number 120 → 70 px.
- Desktop контейнер 1160–1200 → mobile 300–305 px с полями 45 px.
- 4 stats → 2×2; pricing columns → последовательный стек; related cards row → stack.
- Hero остаётся 100vh, но используется отдельный portrait crop.
- Меню меняется на burger; CTA расширяется до ширины контента.
- Длинные itinerary rows остаются accordion, высота становится контентной.
- Горизонтальные/highlight-сцены на mobile идут вертикально; скрытые desktop-дубли не должны попадать в accessibility tree.

## 9. Анимации и интерактив

Наблюдаемые/заложенные паттерны:

- fade/reveal Zero Block-элементов при появлении;
- мягкие transitions background/color/border, в стилях встречается 0.2 s;
- accordion программы;
- hamburger panel;
- hover на CTA и кликабельных travel bands;
- возможное боковое движение отдельных highlights (в DOM присутствуют элементы за пределами viewport).

Для Ada Tours достаточно: reveal 400–600 ms (`cubic-bezier(.22,1,.36,1)`), menu 250–350 ms, CTA 180–220 ms, image zoom 600–900 ms не более 1.03–1.05. Parallax использовать редко и отключать при `prefers-reduced-motion`.

## 10. Что сохранить обязательно

1. Full-bleed travel photography.
2. Тёплый белый вместо чистого холодного фона.
3. Чёрно-золотую акцентную систему.
4. Futura-подобную геометрическую типографику.
5. Hero 85–100vh.
6. Крупные заголовки с авторскими переносами.
7. Асимметричные editorial-композиции.
8. Большие числовые показатели.
9. Отсутствие мелкой одинаковой карточечной сетки в первом уровне.
10. 40% затемнение поверх сложных фото.
11. Один главный CTA.
12. Длинный narrative tour page.
13. Accordion itinerary.
14. Сильные повторные CTA после цены и в конце.
15. Автор/команда как часть доверия, а не служебная страница.

## 11. Что плохо масштабируется и как адаптировать

- **Абсолютные Zero Block координаты** → заменить CSS Grid/Flex и container tokens, сохранив итоговую асимметрию.
- **15 полноширинных bands подряд** → оставить для curated selection; полный каталог строить editorial-модулями 1+2, 2+1, full-width anchor.
- **Oversized текст 100 px, уходящий за viewport** → ограничить `clamp()` и `overflow-wrap`; декоративный выход допускается только как управляемый слой.
- **Длинный highlights-блок 4–5 тыс. px** → разбить на повторяемые StoryPair, StoryFullBleed, StatInterlude.
- **Скрытые дубли под разные breakpoint** → один семантический DOM, layout меняется CSS; отдельные изображения допустимы через `<picture>`.
- **Форма подписки и tour-form с брендовой механикой WG** → сохранить композиционный принцип, но использовать CTA/contact model Ada Tours.

## 12. Исторические измерения

Материалы прежнего исследования не входят в обязательный рабочий вход. При наполнении сайта используются действующие общие компоненты.

---

# WHITE GARNET COMPONENT INVENTORY

# White Garnet — component inventory

Размеры приведены для 1440×900 и 390×844. Имена компонентов — рекомендуемые имена будущих Astro-компонентов, не названия исходного кода White Garnet.

## WG-SITE-HEADER → `SiteHeader.astro`

Где: tour pages; на главной логотип интегрирован в travel band.

Назначение: бренд + якорная навигация.

- Desktop: transparent overlay, logo слева, 6 ссылок в строку, высота визуальной зоны 100–125 px.
- Mobile: logo + burger, зона около 90–110 px.
- Состояния: transparent/light, menu-open, scrolled (для Ada Tours допустим фон `#FFFCF8E8` + blur).
- Ada Tours: нужен глобально, но на hero остаётся прозрачным.

## WG-MOBILE-MENU → `MobileMenu.astro`

Где: `/argentina`, `/brazil` mobile.

- Светлая off-canvas панель около 300 px при viewport 390 px; слева остаётся затемнённый scrim около 90 px. Logo + X сверху, 6 вертикальных ссылок, primary CTA внизу.
- Закрытие по X/Escape/переходу; focus trap обязателен.
- Transition 250–350 ms.

## WG-DESTINATION-BAND → `DestinationBand.astro`

Где: каждый элемент главной.

- Desktop: 100%×650 px; mobile: 390×400 px.
- Состав: full-bleed image, overlay ≈40%, title 38/44 → 36/42, dates/tagline, optional pill, full-surface link.
- Состояния: default, hover (image scale 1.03, overlay чуть светлее/темнее), focus-visible.
- Ada Tours: home highlights, country index anchors, theme promos.

## WG-TOUR-HERO → `TourHero.astro`

Где: `/argentina`, `/brazil`.

- Desktop: 1440×900, H1 x≈51/y≈515, 80/80; CTA ≈210×50.
- Mobile: 390×844, inner width ≈300, H1 45/52; CTA ≈300×50.
- Состав: responsive image, overlay, header, title/subtitle, metadata, urgency line, primary CTA.
- Варианты: group tour, individual available, optional extension.

## WG-STAT-GRID → `TripStats.astro`

Где: начало tour page.

- Desktop: 4 columns внутри ≈1160 px; числа 120/150.
- Mobile: 2×2; числа 70/88.
- Состав: value, short label; без иконок и карточечных рамок.

## WG-EDITORIAL-STATEMENT → `EditorialStatement.astro`

Где: между stats и highlights.

- Заголовок 70/84 desktop, 36/43 mobile.
- Центрированный/асимметричный, широкие верхний/нижний отступы.
- Ada Tours: intro страны, темы, MICE proposition.

## WG-STORY-PAIR → `StoryPair.astro`

Где: highlights.

- Desktop: image + text в 40/60 или 55/45; возможен reverse.
- Mobile: вертикальный stack; текст 36/42, image с индивидуальным crop.
- Варианты: image-left/right, portrait/landscape, dark/light.

## WG-STORY-FULLBLEED → `StoryFullBleed.astro`

Где: эмоциональные паузы/highlights.

- Большое изображение или видеослой, короткая крупная фраза.
- Overlay 30–45%; заголовок белый.
- Ada Tours: key experience, country mood, Luxury anchor.

## WG-ITINERARY-HEADER → `ItineraryHeader.astro`

Где: обе tour pages.

- Desktop 439 px; mobile 343 px.
- H2 70/84 → 43/52, date/range below.

## WG-ITINERARY-DAY → `ItineraryDay.astro`

Где: программа по дням.

- Desktop collapsed height ≈112 px, label 28/39.
- Mobile 116–206 px, content-driven.
- Состав: day label, title, gold plus/arrow, expandable details.
- Состояния: collapsed, expanded, hover, focus-visible.

## WG-TRAVEL-NOTE → `TravelNote.astro`

Где: после itinerary.

- Светлая секция 418–458 px desktop / 500–550 px mobile.
- Большой title «Важно!» + компактный disclaimer.

## WG-ROUTE-MAP → `RouteMap.astro`

Где: обе tour pages.

- Desktop 834–914 px; mobile 683–723 px.
- Состав: route title, ordered route string/legend, illustrative map.
- Mobile: text before map; map не должна требовать pinch zoom.

## WG-WHY-US → `WhyUsEditorial.astro`

Где: обе tour pages.

- Тёмный блок 1067 px desktop / 1832 px mobile.
- H2 70/84 → 43/52, факты и фото без boxed icon cards.
- Ada Tours: преимущества, service principles, DMC capabilities.

## WG-PRICE-SECTION → `TourPricing.astro`

Где: `/argentina`, `/brazil`.

- Heading band 382/252 px.
- Offer card: 712–1122 px desktop; 1677–2404 px mobile.
- Состав: offer name, date/duration, current/old price, promo, included/not included, optional add-on.
- Состояния: base offer, discounted, optional extension; не делать «pricing SaaS cards».

## WG-CTA-BAND → `CtaBand.astro`

Где: hero, после pricing, перед/в form.

- Primary gold button, short urgency/supporting line.
- Desktop band ≈357 px, mobile ≈317 px.
- Ada Tours: label «Оставить заявку»; secondary WhatsApp/Telegram links.

## WG-BOOKING-STEPS → `BookingSteps.astro`

Где: после первого post-price CTA.

- Desktop ≈610 px; mobile ≈1073–1123 px.
- Большой section title + 3–4 текстовых шага/условия.
- Ada Tours: inquiry → консультация → программа → подтверждение.

## WG-LEAD-FORM → `LeadForm.astro`

Где: конец conversion sequence.

- Dark/full-width background.
- Oversized statement 100/100 desktop, 50/50 mobile; gold accent.
- Поля простые, без тяжёлых borders; primary button gold.
- Состояния: idle, focus, validation error, sending, success.

## WG-AUTHOR-PROFILE → `ExpertProfile.astro`

Где: обе tour pages.

- Desktop image+bio, ≈848 px; mobile stacked, ≈1480 px.
- Состав: portrait, name, credentials/story, social/contact.
- Ada Tours: Anna/team member variants.

## WG-RELATED-TRIPS → `RelatedTrips.astro`

Где: конец tour page.

- H2 band ≈384/303 px.
- Desktop 3 large visual cards in row; mobile sequential 400 px bands.
- Reuses DestinationBand visual grammar.

## WG-NEWSLETTER → `NewsletterForm.astro`

Где: footer.

- E-mail field + gold submit; short consent copy.
- Ada Tours: использовать только если подписка реально нужна; не смешивать с tour inquiry.

## WG-SITE-FOOTER → `SiteFooter.astro`

Где: все tour pages.

- Desktop columns; mobile stack.
- Certifications, contacts, social links, legal, back-to-top.
- Основной фон `#FFFCF8`, contact text до 24 px.

## Дополнительные компоненты для Ada Tours из тех же паттернов

- `EditorialIndex.astro`: чередование DestinationBand и асимметричных пар.
- `CountryHero.astro`: TourHero без urgency/price metadata.
- `RegionMosaic.astro`: StoryPair-система для городов/регионов.
- `FactStrip.astro`: TripStats с business facts для MICE/DMC.
- `CaseStudyBand.astro`: StoryPair + измеримый результат.
- `ContactRail.astro`: desktop text links; mobile sticky bar.

---

# ADA TOURS VISUAL MAPPING

# Ada Tours — карта страниц на паттерны White Garnet

## Общий принцип

Каждая страница должна собираться из четырёх слоёв: **сильный hero → editorial narrative → структурированные факты → спокойный conversion block**. Увеличение каталога решается разнообразием модулей и иерархией, а не переходом к одинаковым product cards.

| Страница Ada Tours | Паттерны White Garnet | Адаптация |
|---|---|---|
| Home | TourHero/первый DestinationBand, DestinationBand feed, EditorialStatement, StoryPair, TripStats, AuthorProfile, CtaBand | 6–10 крупных приоритетов; отдельные bands для Luxury/MICE/DMC; не пытаться показать весь каталог |
| Countries index | DestinationBand, RelatedTrips, EditorialStatement | Featured country full-width; затем модули 1+2 / 2+1; компактный алфавит/региональные фильтры над лентой |
| Country hub | CountryHero, TripStats, StoryPair, RouteMap grammar, RelatedTrips, CtaBand | Hero-позиционирование; регионы; впечатления; туры; «когда ехать»; practical/FAQ как спокойные accordions |
| City/region hub | CountryHero, StoryPair, RelatedTrips | Короткий hero; sights/activities editorial pairs; связанные туры; связанные места по общим маршрутам, включая межстрановые связи при фактическом пересечении туров |
| Tours index | DestinationBand + asymmetric editorial grid | Фильтры отдельно; curated first screen; дальнейшая лента из крупных/средних модулей; не более 2–3 cards в ряд |
| Tour detail | Полный шаблон Argentina/Brazil | Сохранить порядок блоков; metadata/price/CTA заменить реальными полями Ada Tours |
| Theme hub | Hero, InterestCard, тематические туры, компактная география, связанные интересы, LeadForm | Автоматическая редакционная подборка по `interests.md`; без ручных списков стран и стены страновых баннеров |
| VIP/Luxury | StoryFullBleed, large photography, TripStats, ExpertProfile | Меньше элементов, больше воздуха; сервисные детали как narrative facts; без золотого «люксового шума» |
| MICE | TourHero grammar, FactStrip, StoryPair, CaseStudyBand, BookingSteps | Чуть плотнее факты; цифры, форматы мероприятий, география, кейсы; те же шрифты/цвета/фото |
| B2B/DMC | Hero, FactStrip, RouteMap, CaseStudyBand, BookingSteps | Capabilities/coverage/process; фото остаются крупными; CTA «Запросить предложение» |
| About | EditorialStatement, TripStats, StoryPair, AuthorProfile | История компании, годы/страны/партнёры, принципы, команда |
| Team | AuthorProfile series | Крупные портреты + краткая история; alternating layout, без мелкой employee grid в первом уровне |
| Contact | CtaBand, LeadForm, Footer contact grammar | Один primary form; WhatsApp/Telegram/phone secondary; карта/офис при необходимости |

## Home — рекомендуемая последовательность

1. Full-height hero с одной поездкой/позицией бренда.
2. Короткий EditorialStatement об Ada Tours.
3. 4 stats: опыт, страны, программы, повторные клиенты.
4. 3–5 selected countries через DestinationBand/StoryPair.
5. Featured tours: один large + два medium.
6. Luxury/VIP full-bleed anchor.
7. MICE и B2B/DMC как асимметричная пара, но в общей палитре.
8. Multi-country feature.
9. Anna/команда через ExpertProfile.
10. Final CtaBand + контакты.

## Countries index

- Верх: спокойный светлый hero и крупный заголовок 70/84 desktop, 43/52 mobile.
- Фильтры: регион/сезон/тип; компактные text chips, не toolbar маркетплейса.
- Первый уровень: 1 featured country full-width 520–650 px.
- Далее: асимметричные пары 7/5 и 5/7, высота 420–520 px.
- После 6–8 стран — ещё один full-width anchor.
- Количество программ показывать малой подписью, не badge в углу.

## Country hub

1. CountryHero 85–100vh.
2. Позиционирование + 3–4 stats.
3. Регионы/города — editorial mosaic.
4. Key experiences — 3–6 StoryPair.
5. Лучшие туры — RelatedTrips grammar.
6. Темы поездок — два крупных bands.
7. «Когда ехать» — горизонтальная сезонная шкала, стилистически как itinerary, без таблицы.
8. Practical info/FAQ — accordion.
9. Final CTA.

## City/region hub

- Hero немного короче: 70–85vh.
- 1 эмоциональный statement и 2–3 факта.
- «Зачем ехать» — чередование StoryPair.
- Экскурсии/активности — не более двух модулей в строке.
- Связанные туры и связанные места по общим маршрутам — крупные image bands. Межстрановые рекомендации допустимы, если они следуют из фактических Tour relations.

## Tours index

Система масштабирования:

- модуль A: featured 12/12, 560–650 px;
- модуль B: 7/5, 480–560 px;
- модуль C: 4/8, 420–520 px;
- модуль D: два равных, только для вторичного уровня;
- каждая 3-я группа получает иной ритм;
- filter/search панель занимает одну спокойную строку и сворачивается на mobile;
- метаданные ограничить названием, географией, датой/форматом, короткой фразой.

## Theme hub: 13 интересов

Модель данных и ранжирование — `docs/workflows/interests.md`. Порядок: hero/тезис → до 5 крупных визуальных историй из собственно тематических мест/экскурсий → до 10 релевантных туров → до 7 компактных стран со счётчиками → до 10 других впечатлений → до 4 соседних интересов → полезный текст и CTA.

Первая история крупная, следующие пары поддерживают редакционный ритм; без рамок, декоративных иконок и бейджевой стены. Нижняя лента не повторяет верхнюю. Страны — производная география и текстовые ссылки на тематический каталог страны, не 18 полноэкранных баннеров. Пустые блоки скрываются; число карточек не добивается чужими темами. Используются существующие фотографии объектов и общие токены. На мобильном пары складываются в одну колонку. Не выдумывать экспертов/отзывы для заполнения шаблона: завершение — действующая форма Ada Tours.

## VIP / Luxury

VIP/Luxury — уровень сервиса, не четырнадцатый интерес. Для Luxury избегать обилия золота: премиальность White Garnet создают масштаб и отбор фотографий, а не декоративные рамки.

## MICE и B2B/DMC

Разрешённая «деловая плотность»:

- hero 70–85vh;
- FactStrip 4–6 показателей;
- coverage/geography в RouteMap;
- capabilities как 3–5 StoryPair;
- cases как широкие CaseStudyBand с одной фотографией, задачей и 2–3 результатами;
- process на базе BookingSteps;
- final form.

Нельзя вводить отдельную синюю корпоративную палитру, другой шрифт, SaaS-карточки, иконки в кружках или dashboard-визуальность.

## CTA-система Ada Tours

- Primary: **«Оставить заявку»** — gold button.
- Secondary: WhatsApp и Telegram — text/icon links.
- Tertiary: телефон `tel:` как текстовый контакт.
- Hero: один primary + максимум два secondary links.
- После ключевого narrative: короткий CtaBand.
- После pricing/offer: primary повторяется.
- Конец страницы: полноценная form + быстрые контакты.
- Mobile sticky bar: 56–64 px, primary ≈60%, WhatsApp/Telegram иконками; скрывать при пересечении с финальной формой.

## Контентные ограничения

- Не переносить тексты, фотографии, логотипы или фирменные символы White Garnet.
- Использовать фотографии Ada Tours с сопоставимой режиссурой: один главный сюжет, чистое место под текст, человеческий масштаб, глубокий цвет.
- Авторские переносы заголовков задавать контентно (`<span>`/редактор), но сохранять корректный accessibility text.

---

# DESIGN TOKENS DRAFT

# Ada Tours — draft design tokens по White Garnet

Статус: рабочий черновик для Astro. `measured` — значение подтверждено rendered styles; `derived` — систематизация измеренного диапазона.

```css
:root {
  /* Color — measured */
  --color-bg: #fffcf8;
  --color-surface: #ffffff;
  --color-ink: #1a1a1a;
  --color-ink-deep: #131412;
  --color-muted: #c5c5c5;
  --color-gold: #f2cc67;
  --color-gold-hover: #e6ba43;
  --color-gold-soft: #f7e0a4;
  --color-champagne: #e9d5a2;
  --color-gold-deep: #c89a20;
  --overlay-photo: rgb(26 26 26 / 40%);

  /* Typography */
  --font-sans: "Futura PT", FuturaPT, Arial, sans-serif;
  --font-body: "Futura PT", FuturaPT, Arial, sans-serif;
  --weight-light: 300;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-bold: 700;

  /* Container — derived from x=120–142 and 1440 viewport */
  --container-max: 1200px;
  --container-reading: 940px;
  --container-display: 865px;
  --gutter-desktop: clamp(32px, 8.33vw, 120px);
  --gutter-mobile: 45px;

  /* Spacing — derived */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 80px;
  --space-10: 112px;
  --space-11: 144px;
  --section-space-desktop: clamp(96px, 10vw, 144px);
  --section-space-mobile: 72px;

  /* Radius */
  --radius-none: 0;
  --radius-xs: 2px;
  --radius-sm: 6px;
  --radius-pill: 999px;

  /* Buttons — measured/derived */
  --button-height: 50px;
  --button-padding-inline: 36px;
  --button-font-size: 18px;
  --button-line-height: 1.55;
  --button-radius: 0px;
  --button-transition: 200ms ease-in-out;

  /* Image ratios */
  --ratio-home-band-desktop: 1440 / 650;
  --ratio-home-band-mobile: 390 / 400;
  --ratio-portrait: 3 / 4;
  --ratio-landscape: 4 / 3;
  --ratio-wide: 16 / 9;
  --hero-height: 100svh;
  --hero-min-height-desktop: 760px;
  --hero-min-height-mobile: 720px;

  /* Motion */
  --motion-fast: 200ms;
  --motion-menu: 300ms;
  --motion-reveal: 500ms;
  --ease-out-editorial: cubic-bezier(.22, 1, .36, 1);

  /* Breakpoints — derived for implementation */
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1200px;
  --bp-xl: 1440px;
}
```

## Fluid type recommendations

```css
.type-hero {
  font: var(--weight-bold) clamp(45px, 5.56vw, 80px) / 1 var(--font-sans);
  letter-spacing: 0;
}

.type-section {
  font: var(--weight-bold) clamp(43px, 4.86vw, 70px) / 1.2 var(--font-sans);
}

.type-highlight {
  font: var(--weight-bold) clamp(36px, 4.17vw, 60px) / 1.167 var(--font-sans);
}

.type-number {
  font: var(--weight-bold) clamp(70px, 8.33vw, 120px) / 1.25 var(--font-sans);
}

.type-itinerary {
  font: var(--weight-regular) clamp(20px, 1.94vw, 28px) / 1.4 var(--font-sans);
}

.type-body {
  font: var(--weight-regular) clamp(16px, 1.25vw, 18px) / 1.5 var(--font-body);
}
```

## Component tokens

| Token | Desktop | Mobile | Уверенность |
|---|---:|---:|---|
| `hero.height` | 900 px at 1440×900 / 100vh | 844 px at 390×844 / 100svh | высокая |
| `homeBand.height` | 650 px | 400 px | высокая |
| `content.max` | 1160–1200 px | 300–305 px | высокая |
| `content.gutter` | 120–142 px | 45–46 px | высокая |
| `hero.gutter` | 51–52 px | 45 px | высокая |
| `itinerary.row.minHeight` | 112 px | 116–206 px | высокая |
| `cta.height` | 50–52 px | 49–50 px | средняя |
| `cta.width.hero` | ≈210 px | ≈300 px | средняя |
| `photo.overlay` | 35–45% | 30–45% | высокая/диапазон |
| `section.heading.width` | ≈865 px | 233–315 px | высокая |
| `body.reading.width` | ≈940 px | ≈300 px | высокая |

## Grid recipe

```css
.container {
  width: min(var(--container-max), calc(100% - 2 * var(--gutter-desktop)));
  margin-inline: auto;
}

.editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: clamp(20px, 2.2vw, 32px);
}

@media (max-width: 767px) {
  .container {
    width: auto;
    margin-inline: var(--gutter-mobile);
  }
  .editorial-grid { grid-template-columns: 1fr; }
}
```

## States

- `:hover` CTA: background `--color-gold-hover`; no jump in geometry.
- `:focus-visible`: 2 px outline `--color-gold-deep`, 3 px offset.
- Image link hover: scale 1.03–1.05, overlay opacity shift ≤8%.
- Accordion open: icon rotates 45° or plus→minus; content reveal 250–350 ms.
- `prefers-reduced-motion`: remove transforms/parallax, keep opacity transition ≤150 ms or none.

## Font licensing / fallback

Для отдельной разработки используется шрифт с правом web-применения и закрепленный в общих CSS fallback. Добавление сущности не меняет шрифты и не запускает сравнение начертаний.

---

# SUMMARY

# White Garnet → Ada Tours: summary

## Ядро визуального стиля

White Garnet — это editorial travel storytelling: full-bleed фотография, очень крупная узкая типографика FuturaPT, тёплый белый фон, почти чёрный текст, дозированный золотой акцент, много воздуха и асимметрия. Интерфейс сознательно незаметен; продукт продают ритм, кадр и история.

## 15 паттернов, которые важно сохранить

1. Hero высотой 85–100vh.
2. Full-bleed фотографии с управляемым crop.
3. Затемнение фото около 40%.
4. Futura-подобный геометрический grotesk.
5. H1 80/80 desktop → 45/52 mobile.
6. H2 70/84 desktop → 43/52 mobile.
7. Авторские переносы крупных заголовков.
8. Тёплый белый `#FFFCF8` и ink `#1A1A1A`.
9. Gold CTA `#F2CC67`, один primary action.
10. Асимметричные image/text spreads.
11. Большие цифры 120 px → 70 px.
12. Editorial itinerary accordion.
13. Full-width CTA-паузы после важных блоков.
14. Автор/команда как доказательство доверия.
15. Related trips как крупные travel posters, а не product tiles.

## Что адаптировать при масштабировании

- 15+ полноширинных bands подряд оставить только для curated home; каталоги собирать ритмом full-width + 7/5 + 5/7 + 6/6.
- Абсолютные координаты Zero Block заменить 12-колоночной CSS Grid, сохранив визуальную асимметрию.
- Один семантический DOM вместо desktop/mobile дублей; отдельные crop через `<picture>`.
- Длинный highlights-блок разбить на StoryPair, StoryFullBleed и StatInterlude.
- Фильтры вынести в компактную строку над editorial-лентой.
- MICE/B2B сделать плотнее по фактам, но не менять шрифт, палитру, фото и CTA-систему.
- Для связи использовать один primary «Оставить заявку»; WhatsApp, Telegram и телефон — secondary actions.

## Комплект

- `WHITE_GARNET_VISUAL_AUDIT.md`
- `WHITE_GARNET_COMPONENT_INVENTORY.md`
- `ADA_TOURS_VISUAL_MAPPING.md`
- `DESIGN_TOKENS_DRAFT.md`

---
