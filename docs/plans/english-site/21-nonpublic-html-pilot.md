# Ada Tours EN — четыре непубличные HTML-страницы Astro

Дата: 30.10.2026. Статус: `private_html_pilot_success`, публичная публикация `false`.

## Проверенный результат

- [GitHub Actions #41063022947](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41063022947) — **success**, source SHA `e306205e0642a89e889b75ceb62d2a86cf1a911e`.
- HTML: `/en-pilot-private/tours/`, `/en-pilot-private/tour/rio-de-janeiro-four-days/`, `/en-pilot-private/tour/easter-island-3-days/`, `/en-pilot-private/tour/colombia-essential-5-days/`.
- Страницы включают реальный английский маршрут, фотографии с CDN, фирменную CSS-палитру, таблицы цен (USD 1,255 / 1,492 / 1,863), условия, перекрестные ссылки.
- Источник неподвижен: GitHub preview snapshot `ab27248954bb71fe6582bf796d73626ea8502d5f`, 172/172 EN блоков; source hash актуальных RU Tour MD сверен непосредственно с `main` в Actions. Никаких двойных текстовых каталогов и изменений цен.
- Безопасность: generator флаг `EN_PILOT_PREVIEW=1`, `SITE_LOCALE=ru`, `PUBLIC_EN_RELEASE=0`. Без флага страницы не генерируются; `SITE_LOCALE=en` и публичные релизы заблокированы. HTML `lang=en`, `noindex/nofollow`, без canonical/hreflang, без Pagefind регистрации тестовых URLs и живых POST/аналитики.
- GitHub Actions artifact `ada-en-three-tour-private-html`, ID `12982446139`, retention 14 дней. Доступен уполномоченным пользователям приватного репозитория. Содержит четыре HTML, CSS/логотип/favicon и README.
- После скачивания: распаковать, из корня запустить `python3 -m http.server 8123` и открыть `http://localhost:8123/en-pilot-private/tours/`. Пользовательская копия ZIP содержит `START_PREVIEW_WINDOWS.bat`; изображения CDN требуют интернет.
- **Не было** EN-деплоя на домен и новых webhook/PR/автоматических переводов. `main` не менялся нашей EN-сборкой.

## Что НЕ закрыто

Рецензирование 142 редакционных фрагментов остается отдельной процедурой; эти тексты были автоматически утверждены только для технического пилота. Отдельный шаблон не тождественен финальному RU/EN `TourLayout`; предстоят интеграция общих Excursion, форм, навигации, SEO/JSON-LD, Pagefind, hreflang, сквозная публикационная проверка и доменное решение. Не открывать массовый перевод, пока эти условия не выполнены.

## Продолжение: общие Astro-компоненты (30.10.2026)

- Коммит [`e748206c`](https://github.com/alexyakovlev79/adatours.ru/commit/e748206c063dcee0b4163a1045e11d10b7791363): закрытый EN-маршрут переведен на `src/layouts/BaseLayout.astro` с `privatePreview`, при котором запрещены обычные RU header/search/footer/форма, аналитика, canonical/hreflang, Open Graph и публичный JSON-LD. Условия выпуска проверяют `EN_PILOT_PREVIEW=1`, `SITE_LOCALE=ru`, отсутствие `PUBLIC_EN_RELEASE=1` и префикс `/en-pilot-private/`. Обычный RU путь в `BaseLayout` сохранен.
- [Actions #41067546273](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41067546273) и foundation tests #41067546312: `success`, 4 закрытые HTML-страницы, обычный Astro build и проверки приватности.
- Коммит [`4fb996bc`](https://github.com/alexyakovlev79/adatours.ru/commit/4fb996bc9f39be97cb7dc9a5e667dd33e049305e): EN-пилот использует общие `TripStats.astro` и `IncludedExcluded.astro`; последний получает RU/EN-подписи из существующего `ui-copy.json` через `uiText`, RU — значение по умолчанию. Адресная проверка подтверждает EN-компонент и отсутствие живой формы/аналитики/JSON-LD.
- [Actions #41068342619](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41068342619) и foundation tests #41068342651: `success`. Результат: закрытый artifact `ada-en-three-tour-private-html`, ID `12984666377`, retention 14 дней. Дополнительно подготовлена локальная Windows-копия со скорректированными относительными путями и проверкой всех локальных ссылок.
- Публичный EN-домен, `main` и переводческий mass gate этой операцией не менялись. **Не считать полным подключением `TourLayout`**: EN-страницы пока используют отдельные секции hero/программы/таблицы, хотя общие shell, stats и услуги уже используются. Незакрытые работы: общий `TourLayout`/Excursion и география, реальные формы, Pagefind, SEO/Schema/hreflang, редакционная проверка 142 новых блоков, полноценный EN release.

## Продолжение: общая обложка, цены и программа по дням (30.10.2026)

- `734ac307`: английские HTML-страницы теперь используют общие `Hero.astro` и `TourPricing.astro`; у Hero добавлена необязательная осмысленная подпись ALT, а RU поведение декоративной обложки по умолчанию не меняется. Цена, валюта, тарифное основание, исходная таблица Word и письмо менеджеру сохранены. `#enquiry` остается только переходом к безопасной почтовой ссылке, не POST.
- `b3fcfac0`: общая `Itinerary.astro` показывает только утвержденные английские номерные дни (4 Рио, 3 остров Пасхи, 5 Колумбия), используя готовые EN alt/hover и S3-пути. В закрытом EN режиме запрещена автоматическая загрузка русской Excursion. Все самостоятельные `excursionRef` отдельно подсчитаны и сохранены в исходном `itinerary`: 4+3+4 = **11**, каждый ID подтвержден реестром shared-excursion owners. Пилот явно показывает их незавершенный статус.
- Первый unit/HTML запуск `b3fcfac0` выявил неполный **синтетический тестовый fixture** (0 референсов при новом ожидаемом числе). Исправление `6003af7f` добавило ожидаемые референсы в fixture; реальные исходные Word/Tour модели не менялись. [Actions #41071602979](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41071602979) и [#41071603229](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41071603229) — `success`.
- Непубличный GitHub Actions artifact ID `12986280845`: четыре HTML, необходимые стили/ассеты; подготовлена рабочая Windows ZIP-копия со всеми локальными ссылками и контролем 4/3/5 `data-pilot-day` и 4/3/4 незавершенных модулей. Срок artifact — 14 дней.
- **Не считать полной интеграцией `TourLayout`.** Осталось предоставить отдельные EN overlays для этих 11 Excursion, локализовать связанные Country/Destination, подключить полный общий `TourLayout`, форму и release-aware SEO/Search/Schema/hreflang. Редакционная оценка 142 дополнительных блоков и публичный релиз остаются закрыты. `main` и домены не затрагивались.

## Private preview expanded to 15 pages (30.10.2026)

All 11 canonical shared Excursion translations are now stored as nonpublishing, source-verified EN overlays and linked from the three Tour itineraries. The same private Astro build emits 11 separate Excursion pages with the existing shared Hero, TripStats, TourPricing and IncludedExcluded components. Total: 15 HTML routes (catalogue + 3 Tours + 11 Excursions).

Proof: [private HTML #41075627323](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41075627323) and [foundation #41075627376](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41075627376), both `success`; exact artifact ID `12987936006`. The original matching and translation data snapshots remain unchanged. New source-bound EN text is in `data/i18n/pilot-excursions/v1/`. Complete report and specific gallery-photo QA exception are in [22-shared-excursions-private-preview.md](22-shared-excursions-private-preview.md). Public `main`, domains, forms, SEO and mass release gates remain unchanged.
