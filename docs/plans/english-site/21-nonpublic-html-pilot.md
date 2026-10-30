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
