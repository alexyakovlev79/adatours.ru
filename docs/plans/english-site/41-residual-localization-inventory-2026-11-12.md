# Ada Tours EN — опись оставшейся локализации вне переводческих роев

Дата исходного аудита: 12.11.2026. Статус: **опись и план последующих адресных переводов**; это не выпуск EN-сайта и не разрешение индексации.

## 1. Версии, границы и способ проверки

- Канонический код: alexyakovlev79/adatours.ru, main, SHA **f451de39f413152ad893902c594eaa93ddb47250**.
- Срез переводческих очередей: i18n/translation-mass-staging, SHA **611ac1b11434ff0e84ef5d5a4758ac88743741c0**.
- Исследованы исходники всех 37 src/pages, 70 src/components, 9 src/layouts, 98 src/lib и 10 src/scripts: **224 исполняемых файла**. В них 1 510 строк с кириллицей: 659 / 229 / 173 / 425 / 24 соответственно. Это **кандидаты**, а не 1 510 доказанных дефектов: включены RU-ветви, комментарии, регулярные выражения и уже обслуживаемые словарём строки.
- Просмотрены доступные текстовые данные src/data, источники SEO и Schema.org, публикационные инструкции и очереди. Отдельно инвентаризированы все 8 Content Collections и опубликованная RU-структура.
- Ограничение: получить и проверить полный собранный EN HTML через веб-инструмент не удалось. Крупные JSON реестров фотографий (image-captions.json — 13,1 МБ, image-caption-overrides.json — 3,85 МБ, mobile-hero-registry.json — 14,3 МБ) целиком не выдаются текущим файловым коннектором. Поэтому этот документ является **подробной описью источников и зон риска**, не результатом исчерпывающего DOM-прохода всех EN URL. Фактические остатки необходимо подтвердить автоматическим сканированием собранного EN HTML и крупногабаритных JSON на checkout.
- Нельзя заменять русские тексты в общей RU-истине. EN — отдельное представление поверх общих stable ID, географии, цены, медиа и ссылок. Не менять RU, тарифы, медиа, source identity и существующие lease.

## 2. Уже охвачено существующими очередями — повторно не переводить

| Источник | Состояние на указанном SHA | Решение |
|---|---|---|
| EN FULLTEXT | 7 056 Markdown-текстов: 1 411 из 1 412 пакетов saved, один leased №977 | Завершать только штатный lease; не создавать копию очереди |
| EN Tour blocks | 4 006 из 4 006 пакетов: 3 956 review, 50 ready, 0 queued/leased | Сохранено в staging; корректное применение к HTML — отдельная проверка |
| UI dictionary | src/data/i18n/ui-copy.json: **259 семантических ключей**, у каждого непустой EN | Не переводить ключи заново; довести wiring и устранить отсутствующие ключи |
| Interest copy | src/data/i18n/interest-copy.en.json: 15 EN наборов | Перевод готов, но файл помечен translated_foundation_not_wired |
| Пилотные материалы | 18 ранее переведённых пилотов исключены из новой FULLTEXT-очереди | Сохранять provenance и точное сопоставление |

Review здесь означает сохранённый перевод, допущенный действующим решением к технической noindex EN-выкладке, а не обязательную независимую смысловую проверку. Состояние очередей может измениться после зафиксированного SHA; при исполнении читать новые контрольные файлы.

## 3. Новые переводческие массивы вне FULLTEXT/Tour

| Приоритет | Файл или владелец | Выявленный объём | Что переводить / особые условия |
|---|---|---:|---|
| P1 | src/data/authority-pages.json | **478** русскоязычных строковых значений | Press, webinars, partners: H1, title, description, lead, section heading, FAQ, аннотации, category, CTA. Сохранять реальные названия и язык внешних публикаций и их URL; EN аннотации отдельно |
| P1 | src/pages/dmc/**, src/pages/mice/** | **6 крупных Astro-страниц** | H1, title/description, разделы, переговорные предложения, FAQ и CTA. Не входили в Markdown-рой |
| P1 | src/pages/index.astro, about/, contacts/, country/, cases/, reviews/, team/, vip/, multi-country/, interests/, 404.astro | Много отдельных фраз и SEO-полей | Английские тексты сервисных/каталожных страниц, состояние пустой подборки, ошибки и призывы; проверить существующее UI-подключение до нового перевода |
| P1 | src/data/media/multi-country-heroes.json | **319 alt**, плюс 80 полей scene для генерации | Перевести только отображаемый alt, scene/технические подсказки оставлять в служебном слое; не менять media URL |
| P1 | src/data/media/catalog-hero-overrides.json | **31 alt** | EN alt для каталожных обложек по тем же media IDs и canonical URL |
| P1 | src/data/organization/team.json | **48** русскоязычных значений | Должности, подписи и биографии; имена собственные — согласованная латинская форма, не механический перевод |
| P1 | src/data/reviews/ada-tours.ts | **42** строки исходного кода с кириллицей | Отзывы, авторы, подписи; сохранять оригинал, provenance и корректно обозначать факт перевода цитаты |
| P1 | src/data/organization/ada-tours.ts | **32** строки кода с кириллицей | Факты о компании, service description и маркетинговые формулировки; те же утверждённые факты |
| P2 | src/data/commercial/mice-programme-examples.json | **9** значений (3 названия, 3 summary, 3 duration) | Малый самостоятельный EN-набор; не заменять общий RU файл |
| P2 | src/data/media/image-captions.json и image-caption-overrides.json | Большие JSON, точный EN-остаток не подсчитан | Отдельный checkout-скан видимых caption, alt, hover. Не считать технический provenance текстом для EN |
| P2 | src/data/media/mobile-hero-registry.json | Большой JSON, полный scan не завершён | Отфильтровать только реально выводимые подписи/alt; служебные координаты и reason не переводить |

Количества по кодовым файлам — строки с кириллицей, по JSON — строковые значения; они не складываются в число уникальных фрагментов. В частности, имена, названия оригинальных публикаций, RU-грамматика и дублирующиеся видимые подписи требуют дедупликации и смысловой классификации.

**НЕ переводить весь src/data/seo/geo-case-table.json в исходном файле:** там **2 309** русскоязычных строковых значений, преимущественно name/prepositional/preposition и падежные формы. Это русская грамматическая проекция. Для EN нужны английские названия по stable ID и locale-aware форматирование, а не замена русских падежей.

## 4. Общий UI, плавающие подписи и JS

Область: src/components/**, src/layouts/**, src/scripts/**, src/lib/site.ts и src/data/i18n/ui-copy.json.

- 259 готовых EN ключей покрывают значительную часть меню, фильтров, формы, поиск, хлебные крошки и подписи. Однако статус словаря — translated_foundation_not_fully_wired. Текущий exact-match HTML postprocessor не переводит произвольный текст, JSX/JS-подстроки и содержимое script/style. Требуется централизованное явное подключение по ключам в каждом компоненте и клиентском скрипте.
- Проверенные **отсутствующие в словаре как точная RU-строка** примеры: «Сбросить и показать» (MultiCountrySelector), «Отзыв о поездке» (cases/[slug]), «О путешествии» (tour-intro-heading), «Вопросы и ответы» (AuthorityFaq/DmcFaq), «Организация MICE и корпоративных поездок» (Schema Service). Строки «Маршрут», «Главные впечатления», «Страница не найдена», «Продолжительность», «Направления» уже имеют соответствующие ключи; не дублировать их.
- Дополнительные места: src/components/global/{Breadcrumbs,SearchOverlay,SearchResults,SiteHeader,ArchiveNotice}; src/components/forms/{LeadForm,PhoneField}; src/components/catalog/{MultiCountryRelated,MultiCountrySelector}; src/components/editorial/{InterestLinks,MediaGallery,SeoGeoSection}; src/components/maps/GeoRouteMap; src/components/proof/{ReviewCarousel,ReviewQuote}; src/components/tour/{Itinerary,TripStats,VipBadge}.
- Клиентские состояния: src/scripts/{catalog-load-more.ts,multi-country-selector.ts,multi-country-menu.ts,geo-map-client.mjs,search-places-map.mjs,video-covers.mjs}. Динамический текст в JS надо передавать из общего словаря, а не ожидать, что серверный перевод DOM изменит его после нажатия.
- 404, privacy, personal-data — самостоятельные пользовательские страницы. Юридический EN-текст должен сохранять точные правовые условия и явный jurisdiction; автоматический буквальный перевод не достаточен для утверждения юридической эквивалентности.
- Внутреннее письмо serverless/adatours-form/index.py содержит русские подписи полей для сотрудников. Это **не утечка русского в EN-интерфейс** и не переводческая задача. Аналогично технические ошибки валидаторов, русская нормализация поиска и комментарии могут сохраняться.

## 5. SEO title, description, H1, Open Graph и пагинация

**P0 перед публичной индексацией.** Главные владельцы:
- src/lib/seo-meta.mjs, seo-page.mjs, seo-grammar.mjs, multi-country-seo.mjs, vip-copy.mjs, vip-countries.mjs, seo-price-meta.mjs;
- src/layouts/{BaseLayout,CountryLayout,DestinationLayout,ExcursionLayout,TourLayout,EntityCatalogLayout,ThemeLayout}.astro;
- src/pages/{index.astro,[...path].astro,interests/[...catalog].astro,multi-country/[...selection].astro,multi-country/page/[page].astro,vip/[...country].astro,404.astro} и статические сервисные страницы.

Здесь десятки RU шаблонов с динамическими числами, годами, склонениями, ценами, названием страны, тегами интересов и номером страницы. Нельзя заменить один русский шаблон статическим EN title на всех каталогах. Реализовать EN генераторы, общие факты и правила price basis; для страниц page/2+ сохранять собственные title/description/canonical; передавать язык в OG, Twitter и breadcrumbs. Не делать английские обещания о русскоговорящем гиде из русского SEO; реальные условия и Word-правило у переводческих worker — отдельное полномочие.

У EN staging сейчас намеренно noindex; открытие индексации, домен, reciprocal hreflang, sitemap и публичные canonical — **отдельный release gate**, их нельзя включать одной переводческой правкой.

## 6. Schema.org / JSON-LD

**P0 до EN indexable release, но не считать текущим видимым дефектом:** в BaseLayout для sharedEnglishContent сейчас graph:null и JSON-LD намеренно не выводится. Исходный общий builder src/lib/structured-data.mjs остаётся RU-ориентированным.

Локализовать по schema locale:
- Organization/TravelAgency, Service: serviceType, category, keywords, description;
- WebPage/CollectionPage и ItemList: name, description, заголовки подборок, BreadcrumbList;
- TouristTrip/Trip: «Маршрут», «День N», «Продолжительность», «Формат», подпрограммы, description и itinerary;
- Offer: «Стоимость от…», валюта и база тарифа; FAQPage/Review: name, question/acceptedAnswer, language, reviewBody;
- Person и Place: name/role/description, EN-имена из overlays, сохранив ID, sameAs, координаты, URL и реальные связи.

Источники: src/lib/{structured-data.mjs,page-schema.ts,seo-geo-schema.mjs,structured-data-html.mjs,seo-geo-articles.ts}. Сейчас page-schema.ts загружает RU records. Для EN нужен locale-aware граф, иначе он будет содержать русские имена, тексты и список маршрута даже при английском H1. Не переводить названия свойств Schema.org (@type, @id, inLanguage), URL и QID.

## 7. Что провести машинно по полной EN-сборке

Для всех канонических, доступных EN URL на одном закреплённом main + staging SHA:
1. Распарсить готовые HTML и собирать кандидатов с кириллицей по точному URL, DOM-селектору, атрибуту и значению: title, meta description, OG/Twitter, H1–H6, текстовые узлы, aria-label/title/placeholder/alt, JSON-LD, form error/status и search templates. Считать динамические тексты JS по литературным ключам отдельно.
2. Разделить **русский fallback по текущему контракту**, реально пропущенную UI-локализацию, намеренно оригинальную цитату/собственное имя, технический текст и неготовый публичный SEO/schema слой. Повтор существующего перевода не создавать.
3. Для каждой записи: source path + поле/ключ + canonical URL + sample + число повторных URL + текущий словарь/receipt + EN перевод или новая задача + статус. Отчёт не должен автоматически изменять RU.
4. Прогонять по всем страницам пагинации, странам, местам, экскурсиям, турам, 15 интересам, multi-country сочетаниям, VIP, MICE, DMC, пресс-разделам, команде, отзывам, юридическим страницам и 404.
5. Для каждого noindex EN URL проверять фактический html lang (ru при RU fallback, en при готовом EN), отсутствие несогласованной индексации/Schema и реальность применённого перевода. Позже для indexable EN выпускать canonical/hreflang/Schema только на прошедших отдельный release gate страницах.

## 8. Следующий порядок работ и критерий закрытия

1. **P0**: подключить locale к SEO-метаданным, schema-модели, агрегированным названиям и проверке готового HTML. Пока noindex сохраняется.
2. **P1**: отдельная очередь не-Markdown-источников: authority-pages, коммерческие Astro-страницы, команда, отзывы, фирменные тексты, обложки alt. Готовые UI 259 ключей и interest-copy.en переиспользовать.
3. **P2**: caption/hover и редкие поля крупных media JSON; script-generated состояния, aria и технические страницы.
4. После каждого пакета — один адресный commit/receipt, без переписывания source ID, цен или медиа. Применить к EN staging; провести машинную проверку готового HTML, зафиксировать конкретные остатки и только затем отдельно решать публичный EN release.

Документ добавлен как **опись**. Он не содержит подготовленных переводов источников, не меняет src/content, src/data, scripts и действующие переводческие state/claims. Текущее состояние EN Pages и фактический процент локализованных HTML-страниц отдельно не подтверждены.
