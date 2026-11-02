# Ada Tours: аудит SEO, языка и Schema.org перед EN-версией

**Дата:** 28.10.2026. **Проверенный срез:** `alexyakovlev79/adatours.ru`, `b1b14ed3a8abab9773053f836fed28c2ff77204f`. Аудит исходного кода; отдельный live HTML/build в этой работе не запускался. Это не подтверждение публикации английского сайта.

## Вывод

Существующие страницы уже имеют английские URL и стабильные ID; это хорошая основа для общего каталога. Но наличие `locale: en` в схеме и `lang` у `BaseLayout` не означает поддержку английской сборки. Выбор данных, SEO-формулы, JSON-LD, поиск, подписи изображений и даже финальная оптимизация HTML пока содержат русскоязычные зависимости. Простая подмена домена или `SITE.locale` выпустила бы русский контент с английской языковой меткой.

Сохраняем один код, одни фактические данные и media registry. EN получает переводы текстовых полей и свои метаданные через общий слой локализации. Формулы счетчиков, цены, пагинация, география, связи, архив и логика фильтров остаются общими.

## 1. Как сейчас получаются метаданные

Реальная последовательность:

1. Страница/layout передает исходный `title` и `description` из формулы, константы или данных сущности.
2. `BaseLayout.astro` применяет `seoCompactTitle()` и добавляет ` | Ada Tours`, если бренда еще нет. `seoCompactTitle()` сокращает русское «достопримечательности» до «локации» только в SEO title.
3. `pageStructuredData()` строит один граф JSON-LD из тех же данных и HTML, определяет текущую логическую подборку и ее цены.
4. `enrichSeoPriceMetadata()` подставляет реальную сумму в уже существующую фразу о цене. Для каталога рассматривается полная подборка, не текущие 10 карточек; непохожие валюты не смешиваются. Сегодня определение ценового интента и форматирование жестко русские.
5. `page-schema.ts` добавляет к description рассчитанную фразу о стартовой цене.
6. `russianGuideSeoMetadata()` после цены добавляет выбранным RU-географиям «русский гид». Это правило уже проверяет `lang === 'ru'`; EN не должна включать его с подменой на «English-speaking guide».
7. Итоговые `metaTitle`/`metaDescription` одновременно идут в `<title>`, description, OG/Twitter и узел WebPage. H1 управляется отдельно через Hero/заголовок страницы.
8. После Astro build `build-social-previews.mjs` меняет социальные image-теги; затем `dedupe-site-shell.mjs` выносит общий shell. Эти этапы также надо локализовать.

### Файлы, определяющие последовательность

- `src/layouts/BaseLayout.astro`: props/fallback 43–57; canonical 53–55; preview robots 58, 74–76; OG locale 77; RU breadcrumb labels 88–100; SEO/GEO включение только `lang === 'ru'` 104–108; `pageStructuredData` 136–141; метатеги 155–179; общий `LeadForm` получает locale, остальные shell-компоненты сейчас locale не получают.
- `src/lib/seo-meta.mjs`: глобальные утвержденные SEO-константы и `seoFill`; числа позицией `[число]`, страны `[24]`, страны минус две `[22]`; `seoYearRange()` вычисляет текущий и следующий год по Europe/Moscow. При нулевых счетчиках убираются соответствующие русские части фразы.
- `src/lib/seo-page.mjs`: 16 функций конкретных SEO-шаблонов плюс helpers; имена/H1 не заменяют SEO title.
- `src/lib/page-schema.ts`: фактический финальный pipeline цены → RU-guide → WebPage, а не только JSON-LD renderer.
- `src/lib/seo-price-meta.mjs`: выбор полной текущей подборки общий по смыслу, но `PRICE_CLAIM`, `INLINE_AMOUNT`, `seoPriceQuote()` и `formatSeoMoney()` требуют locale-aware представления.
- `src/data/seo/russian-guide-targets.json`, `src/lib/russian-guide-seo.mjs`, `docs/workflows/russian-guide-seo.md`: отдельное правило от 27.10.2026; правка MD для него не требуется.

**Выявленная граница ценового алгоритма:** `seoPriceQuote()` проверяет единую валюту USD, но структура `priceOf()` содержит только `id/kind/currency/amount`, без базы `per_person/per_group/per_tour`. Поэтому этот модуль сам по себе не доказывает сопоставимость цены за человека и за группу. Перевод сохраняет текущую сумму/базу; при выделении общих коммерческих фактов нужен явный `priceBasis` и сравнение только совместимых предложений. Отдельный `seo-geo.mjs` уже пытается определить базу из русского `priceNote`; переносить этот строковый разбор на EN нельзя.

## 2. Матрица типов страниц

| Тип | Title сейчас | Description сейчас | H1 сейчас | Источник |
|---|---|---|---|---|
| Главная | `seoFill(SEO.home.title)`; активные туры/страны/годы | `SEO.home.description` | «Латинская Америка. Ваша история путешествия» | `src/pages/index.astro` |
| Все страны | `seoFill(SEO.countriesIndex.title)` | константа `SEO.countriesIndex.description` | «Латинская Америка на ваших условиях» | `src/pages/country/index.astro` |
| Все туры/места/экскурсии | `SEO.*Index` + `seoFill`; затем общий каталог | глобальная константа; для мест счетчик достопримечательностей | отдельные фиксированные marketing H1 | `src/pages/[...path].astro`, `EntityCatalogLayout.astro` |
| Страна | `seoCountryTitle(name, places, excursions, tours)` | `seoAttractionsDescription(summary, places, country-case)` | `d.name` | `CountryLayout.astro` |
| Место | `seoDestinationTitle(name, country, excursions, tours)` | «Достопримечательности и экскурсии: {name}.» + `d.summary` + доступность связанных туров | `d.name` | `DestinationLayout.astro` |
| Тур | `seoTourTitle(d)`; название + USD цена + годы + языковой qualifier | `d.lead`; только если название содержит «достопримечательност», добавляется число опубликованных основных мест | `d.title` | `TourLayout.astro` |
| Экскурсия | `seoExcursionTitle(d, geography, relatedTours)` | `d.lead` + сообщение, если нет связанного тура | `d.title` | `ExcursionLayout.astro` |
| Интерес | `seoThemeHubTitle(name, count)` | `d.summary` | `d.name` | `ThemeLayout.astro` |
| Индекс интересов | фиксированный title | динамическое число интересов + перечисление | «Начните с того, ради чего едете» | `src/pages/interests/index.astro` |
| Страна → туры/места/экскурсии | соответствующие `seoCountry*CatalogTitle` | составные фразы в catch-all | собственный `h1Title` или title | `src/pages/[...path].astro` |
| Место → туры/optional-tours/экскурсии | `seoDestination*CatalogTitle` | составные фразы catch-all | `h1Title` или title | тот же файл |
| Экскурсия → туры | `seoExcursionTourCatalogTitle` | составная фраза | самостоятельный заголовок | тот же файл |
| Интерес/интерес × страна → туры | `seoThemeCatalogTitle` | `tourFilterDescription` | `tourFilterTitle` | `src/pages/interests/[...catalog].astro`, `vip-copy.mjs` |
| VIP главный | `SEO.vip` + активное число | `SEO.vip` + популярные страны | «Путешествие, устроенное вокруг вас» | `src/pages/vip/index.astro` |
| VIP × страна/интерес | `vipFilterTitle`/`vipFilterDescription`, варианты общего каталога | данные выбора и шаблоны | `vipFilterTitle` | `src/pages/vip/[...country].astro`, `vip-copy.mjs` |
| Multi-country главный | `SEO.multiCountry`, число туров | число + список стран | отдельный фиксированный H1 | `src/pages/multi-country/index.astro` |
| Сочетание стран ± интерес | `multiCountrySeoMetadata()` | минимальная USD цена, реальные места, количество, условия адаптации | комбинация стран/интереса | `src/pages/multi-country/[...selection].astro`, `multi-country-seo.mjs` |
| Пагинация | `seoPaginatedTitle` или `page N of total` по variant | диапазон карточек, номер/общее число, страны текущей страницы | заголовок + номер страницы | `EntityCatalogLayout.astro`, `multi-country/[...selection].astro` |
| Кейс | `entry.data.title` + layout | `entry.data.summary`; если отсутствует, `{title}. Кейс Ada Tours: задача, логистика, выполненные работы и результат.` | `entry.data.title` | `CaseLayout.astro` |
| Человек | шаблон `{name}: {role}`; отдельные Анна title/description | expertise либо специальная Анна-фраза | `entry.data.name` | `src/pages/team/[slug].astro` |
| СМИ/вебинары/партнеры | `page.title` | `page.description` | `page.h1` | `src/data/authority-pages.json` + соответствующие `src/pages/*` |
| About/DMC/MICE/contacts/reviews/team/cases и legal | в основном строковые константы | строковые константы; legal сейчас использует общий fallback | независимый Hero title/H1 | соответствующие `src/pages/**/index.astro` |

У `privacy` и `personal-data` нет отдельного description в вызове `BaseLayout`: сейчас туда попадает общий SITE description. При EN-переносе это надо явно учесть в ведомости, не считать текстом, хранящимся в юридической странице.

## 3. Близкие английские эквиваленты шаблонов

Это спецификация перевода шаблонов, а не строки, вручную сохраненные для каждой страницы. `{years}` остается динамическим, `{price}` — из общей коммерческой записи, нулевые части пропускаются. Все названия берутся из утвержденной EN-локализации.

| Семейство | Английская формула |
|---|---|
| Страна | `{country}: {N places} and {M excursions}. {years} catalogue: {K tours} and prices from Ada Tours` |
| Страна без туров | `{country}: {available places/excursions}. Travel in {years} with Ada Tours` |
| Место | `{place} in {country}: places to visit, {M excursions} and {K tours}. {years} catalogue and prices from local tour operator Ada Tours` |
| Нет связанных туров места | `We currently have no tours visiting this place.` |
| Нет связанных туров экскурсии | `We currently have no tours including this excursion.` |
| Тур | `{approved English tour title}{price phrase}, {years}, direct from Ada Tours` + подтвержденный qualifier языка услуги при необходимости |
| Экскурсия | `{approved English excursion title} in {place}, {country}{price phrase} | Ada Tours` |
| Интерес | `{interest}: {N tours} and experiences | Ada Tours`; без туров `{interest}: experiences | Ada Tours` |
| Каталог по стране | `{years} tours in {country}: book direct with local tour operator Ada Tours` |
| Места страны | `{N places} to visit in {country} | Ada Tours` |
| Экскурсии страны | `{N excursions} in {country} | Ada Tours` |
| Туры через место | `{N tours} visiting {place}, {country}, in {years}: book direct with Ada Tours` |
| Факультативный заезд | `{N tours} with an optional visit to {place}, {country}, in {years} | Ada Tours` |
| Туры с экскурсией | `{N tours} including “{excursion}” in {place}, {country}, {years} | Ada Tours` — `including` только означает состав маршрута; платность остается явно указана отдельно |
| Интерес × страна | `{country}, {interest}: {N tours} in {years}, direct from Ada Tours` |
| Multi-country | `{countries}{interest}: {years} catalogue, {N tours}{and prices from USD N} | Ada Tours` |
| Пагинация | `{title} — page {page} | Ada Tours`; специальные подборки сохраняют `page {page} of {totalPages}` |
| Диапазон карточек | `Page {page} of {totalPages}, tours {from}–{to} of {totalItems}.` |

Формулы передают смысл; окончательные EN-константы могут точнее следовать исходной длине. Слова «по лучшей цене» в текущих RU-шаблонах являются уже утвержденной коммерческой формулировкой. Переводчик не должен сам усиливать ее до `guaranteed lowest price`, `best price guarantee` или сравнения со всеми конкурентами. Нейтральная адаптация `book direct` допустима как отдельное явно записанное редакционное решение, а не как незаметная утрата исходного условия.

**Языковой qualifier — особый случай.** `seoTourTitle()` сейчас всегда содержит «с русскоговорящими гидами», а глобальные SEO-тексты упоминают русский язык. Новый RU-guide modifier отдельный и уже отключен для EN. В `ORG.service.languages` английский подтвержден Анной на уровне компании, но это не доказывает английского гида для конкретного тура. Нельзя просто заменить Russian → English. В общих EN метаданных допустимо говорить о local tour operator; в условиях конкретной программы сохранить фактический язык, а новый языковой вариант услуги хранить в общей модели продукта.

### Одноразовые метаданные, которые следует перевести централизованно

| Страница | Близкий EN title | Примечание |
|---|---|---|
| `/about/` | `Ada Tours: DMC in Brazil and Latin America` | H1 такой же смысл |
| `/contacts/` | `Ada Tours contact details and addresses` | Hero отдельно: `Let's plan your trip` |
| `/team/` | `The Ada Tours team in Brazil and Latin America` | роли/биографии — отдельные переводы |
| `/team/anna-avanesova/` | `Anna Avanesova: Founder and CEO of Ada Tours` | написание имени закрепить в glossary из approved EN |
| `/reviews/` | `Ada Tours reviews from travellers, agencies and partners` | оригинальные отзывы не выдавать за исходно английские |
| `/cases/` | `Ada Tours case studies: groups, delegations and complex itineraries` | факты кейсов общие |
| `/dmc/` | `DMC in Brazil and Latin America for tour operators | Ada Tours` | B2B состав предложения сохранить |
| `/dmc/travel-agencies/` | `DMC for travel agencies: Brazil and Latin America | Ada Tours` | не обещать комиссии/сроки вне ORG |
| `/dmc/terms/` | `Working with Ada Tours: rates and bookings for agencies` | условия не превращаются в новый EN договор |
| `/mice/` | `MICE in Brazil and Latin America | Ada Tours` | MICE сохраняется |
| `/mice/business-delegations/` | `Business delegations to Brazil and Latin America | Ada Tours` | professional visits требуют подтверждения принимающей стороны |
| `/mice/programmes/` | `MICE and B2B programmes in Latin America | Ada Tours` | fixed marketing cards также локализуются |
| `/privacy/` | `Privacy policy | Ada Tours` | отдельный EN description, правовые адаптации review |
| `/personal-data/` | `Personal data processing | Ada Tours` | отдельный EN description |
| `/404` | `Page not found | Ada Tours` | H1 можно близко: `The route has changed` |

Основные marketing H1: «Латинская Америка. Ваша история путешествия» → `Latin America. Your travel story`; «Латинская Америка на ваших условиях» → `Latin America, on your terms`; «Начните с того, ради чего едете» → `Start with what brings you here`; «Путешествие, устроенное вокруг вас» → `A journey planned around you`. Эти фразы не подменяют более предметные SEO titles.

## 4. Реальные блокеры локализации в коде

| Файл/группа | Что сейчас мешает | Требуемое изменение |
|---|---|---|
| `src/content.config.ts`, `content-identity.mjs` | enum уже включает `en`, ключ `${locale}:${id}` уже стабилен | использовать тот же entity ID; не создавать вторую коммерческую сущность |
| `src/pages/[...path].astro`, почти все layouts | коллекции отфильтрованы `data.locale === 'ru'` | общий resolver фактов + локализованных текстов для выбранной сборки |
| `src/lib/site.ts` | SITE, меню, defaultTitle/Description на русском | конфигурация домена отдельно от locale, централизованный словарь |
| `src/lib/page-schema.ts` | `loadRecords` только RU, singleton cache, origin checks `SITE.url` и `.com` | ключ кеша по locale/release, фактические localized records, нормализованные пары |
| `seo-page.mjs`, `seo-meta.mjs`, `seo-grammar.mjs` | русские падежи, словоформы, price phrases | английские функции представления на тех же общих числах/ID |
| `seo-price-meta.mjs` | поиск `тур/экскурс` в title определяет вид, RU regex цен | передавать kind структурно; отдельные англоязычные слова/Intl formatting |
| `seo-geo-articles.ts` | единственный RU каталог статей, activeRu, кеш только по path, RU tourTable/счетчики | загрузка по locale + path, локализованные переменные и fallback без русского |
| `seo-geo.mjs` | база цены распознается по русской строке `на человека/за группу/за тур` | хранить basis enum в shared facts; форматировать по locale |
| `seo-geo-faq-format.mjs`, `seo-geo-schema.mjs`, `structured-data-html.mjs` | распознаются русские FAQ-заголовки и `FAQ`, но не полное `Frequently asked questions` | добавить EN-разбор или явную семантическую метку FAQ |
| `structured-data.mjs` | RU labels маршрута, дня, длительности, условий, сервиса, FAQ | словарь schema labels; коммерческие поля/географию не переводить как структуру |
| `routes.ts` | URL английские, breadcrumb labels русские, названия стран в routing catalog русские | оставить paths/IDs, localized labels отдельно |
| `content-validation.ts` | часть maps keyed только entityId; проверка имени заполненного места против русского резерва | shared identity checks отдельно от localized text checks; не требовать EN name == RU name |
| `TourLayout.astro` | особый description-prefix включается по русскому слову в title | вынести смысловую причину в общее структурное поле/источник; английское имя не должно случайно отключать принятую SEO-логику |
| `RedirectLayout.astro` | отдельный от BaseLayout технический HTML/JSON-LD жестко `ru` | локализовать техническую страницу; canonical/redirect относятся к текущему locale, aliases не считать альтернативным hreflang |
| `image-captions.mjs` | RU override выбирается по src и имеет приоритет над fallback | ключ `(mediaId/normalized src, locale)`; одна фотография, разные alt/hover |
| `geo-map-astro.ts`, `search-geo-places.json.ts` | данные карты/поиска RU, часть maps только для RU | общие координаты/геометрия, локализованные названия и поисковые aliases |
| `interest-copy.json`, `vip-copy.mjs`, `vip-countries.mjs`, `multi-country-seo.mjs` | публичные подписи динамических каталогов на русском | централизованные переводы шаблонов; sorting и selection общие |
| `build-social-previews.mjs` | hardcode RU origin/allowed image hosts и русский image alt | site/media config + localized alt; сами готовые изображения переиспользовать |
| `dedupe-site-shell.mjs` | RU fallback navigation и `lang="ru"` у shared fragment | per-locale shell, хеш от реального localized markup, locale-aware fallback |
| `astro.config.mjs` | уже использует SITE_ORIGIN/SITE_BASE, но noindex определен не здесь | сохранить универсальность; явный release/preview flag вместо косвенного base !== '/' |
| `.github/workflows/deploy.yml` | один RU origin и один Pages deployment | один release SHA, две locale-сборки и явный manifest обеих публикаций |

Для каталогов английские счетчики должны соответствовать доступным EN-страницам либо честно описывать общий ассортимент с отдельной доступностью языка. Нельзя обещать 394 открываемых тура и вывести 5 переведенных карточек без объяснения; нельзя закреплять число в тексте и не пересчитывать его при обновлениях.

## 5. Schema.org и языковые пары

### Уже существует

`page-schema.ts` → `structured-data.mjs` формируют один общий `@graph`: Organization/TravelAgency, WebSite, WebPage/CollectionPage, туристические сущности, Offers, BreadcrumbList, Article/FAQ/Table и географические связи. Новый локализатор должен расширить этот renderer, а не добавить второй JSON-LD рядом с ним.

Organization ID сейчас выводится из `organization.url`; фактическая компания — `Ada Tours 2007 - Operadora de Turismo LTDA`, общие контакты/CNPJ/адрес и подтвержденные языки уже в `src/data/organization/ada-tours.ts`. Домен EN не создает новую организацию. Стабильный ID компании следует сохранить отдельно от host текущего рендера, чтобы замена будущего EN-домена не создала третью компанию.

В `data/external-identity/adatours-com-correspondences.json`: **2 793 строки, 331 confirmed**. В более новом `site-sameas-20261022.json`: **351 пара adatours.com**, плюс 1 271 VIP и 674 brasiltours; runtime adjudication нового среза имеет приоритет. Это внешние соответствия старому сайту, не подтвержденный мэппинг Word 2026/2027. Нельзя объявлять все 331/351 готовыми переводами.

### Что добавить

1. На EN-страницах сохранять одну идентичность Ada Tours и добавить официальный `https://adatours.ru/` в `sameAs` узла Organization/TravelAgency. Так пользовательское требование связи с русским сайтом выполнено на правильном уровне. Самостоятельные WebSite и WebPage на разных языках имеют собственные URL и `inLanguage`.
2. Каждая EN WebPage имеет `inLanguage: "en"`, RU — `ru`. `WebSite.publisher`, `WebPage.publisher`, Article.publisher и provider туров ссылаются на общий Organization ID.
3. Для действительно переведенной WebPage/Article можно связывать EN `translationOfWork` с RU произведением, RU `workTranslation` — с EN. Если Word является независимо утвержденным английским описанием с частичной адаптацией, не выдавать весь материал за буквальный перевод конкретной RU статьи: связь должна соответствовать реальному происхождению и быть задана на нужном уровне. Schema.org задает `translationOfWork`/`workTranslation` для CreativeWork, не для Country или TouristTrip [S3–S4].
4. Физические места и коммерческие продукты сохраняют shared stable ID и проверенные внешние sameAs/QID/GEO. Можно сохранить существующие RU entity `@id` как общие идентификаторы, а языковые WebPage сделать локальными; не мигрировать все `@id` случайной подменой домена. Если выбрана модель отдельных локальных entity nodes, нужна явная связь к одной общей идентичности, а не только одинаковое имя.
5. `sameAs` обозначает идентичность вещи, а не любую похожую страницу/маршрут. Новые языковые пары должны быть доказаны через единый entityId и фактический scope [S5]. Не создавать sameAs между непохожими экскурсиями или между каталогом и одним туром.
6. Локализовать публичные `name`, `description`, labels `Day`, `Itinerary`, `Duration`, `Frequently asked questions`, alt/captions; числовые facts, Offer currency, координаты, entity references и language-of-service не подменять.
7. `datePublished` у новой EN-статьи соответствует ее первой реальной EN-публикации; дату исходного RU материала сохранять в provenance. `dateModified` меняется по содержательной редакции, а не на каждой сборке.
8. Старые `.com` внешние URL при замене сайта превратятся в миграционные источники. Сначала строится подтвержденная old `.com` → new EN route карта 301; самоссылки и редиректные старые URL убираются из актуальных sameAs. Если первый EN-запуск идет на другом домене, не добавлять фиктивную опубликованную `.com`-пару заранее.

### SEO-связи языков и доменная смена

Каждая опубликованная RU/EN пара получает собственный canonical на своем реальном домене. EN canonical не указывает на RU. В `<head>` обеих страниц одинаковый набор полных ссылок `hreflang="ru"` и `hreflang="en"`, включая ссылку на саму себя; разные домены разрешены. `x-default` необязателен и задается только осмысленному языковому выбору/нейтральному входу. Непереведенные, не опубликованные, архивные или noindex страницы в набор пар не попадают [S1–S2].

Для сохранения доменной заменяемости выделить `ruOrigin`, `enOrigin`, `basePath`, режим indexability и publication registry. После смены origin пересобрать canonical, hreflang, sitemap, OG URL, locale WebSite/WebPage IDs, внутренние absolute ссылки и redirect destinations. Общие IDs/цены/медиа не должны измениться. После публичной миграции старого EN-домена нужны постоянные постраничные редиректы; одной замены конфигурации недостаточно.

Hreflang лучше выпускать одним способом из общей manifest-модели; дублирование одновременно HTML/header/sitemap не требуется. Отдельные sitemap по фактическому host должны отражать только доступные URL [S1].

## 6. Практическая последовательность и приемка

1. Зафиксировать locale/domain/availability контракт, shared IDs и переводимые поля. Создать dictionary для короткого UI и отдельные metadata templates.
2. Подключить единый localized content resolver, исправить RU-фильтры и кеши. Сначала закрыть страну/место/тур/экскурсию/каталог на маленьком полном наборе взаимосвязанных сущностей.
3. Передавать locale в BaseLayout, shell, breadcrumbs, date/price/count labels, schema и postprocessors. Отдельно покрыть legal/contacts/search/empty/archive/pagination состояния.
4. Подключить EN SEO/GEO articles и английские dynamic tokens, FAQ parser, price basis. Убедиться, что нет публикуемого русского fallback.
5. Включить только подтвержденные языковые пары, общий Organization и scoped schema translation relations.
6. Провести узкую машинную приемку пилота: две страны/два места, Word-exact tour, смешанный Word+AI tour, AI-only tour, экскурсия, один обычный и один multi-country каталог, пагинация, пустая связанная подборка, архив, FAQ, форма и 404.
7. Проверить предметные сценарии синхронизации: новая цена отражается в обоих HTML/Offers; новый общий image path меняет обе версии при разных alt; RU текстовая правка делает только связанный EN-блок stale; правка EN текста не меняет USD/route; новый фильтр попадает в обе сборки; смена временного EN origin не меняет ID.
8. Отдельно подтвердить фактические deployment receipts обоих доменов. `ready`, Git commit и успешный unit test не означают EN published.

## Первичные внешние источники

- **S1:** [Google Search Central: Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), проверено 28.10.2026; self/reciprocal hreflang, абсолютные URL, разные домены, x-default, эквивалентность способов.
- **S2:** [Google Search Central: Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), проверено 28.10.2026; self-canonical и canonical того же языка.
- **S3:** [Schema.org: translationOfWork](https://schema.org/translationOfWork), проверено 28.10.2026; связь переведенного CreativeWork с исходным.
- **S4:** [Schema.org: workTranslation](https://schema.org/workTranslation), проверено 28.10.2026; обратная связь к переводу.
- **S5:** [Schema.org: sameAs](https://schema.org/sameAs), проверено 28.10.2026; идентичность сущности.

Рекомендации об общей модели, блоковых ревизиях, принятии перевода и публикации — архитектурные выводы этого аудита, а не обещания Google о ранжировании.
