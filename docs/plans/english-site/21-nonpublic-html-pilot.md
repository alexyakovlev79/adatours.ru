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
