# WORK — Ada Tours: финальный релиз 15 интересов и SEO/GEO

**НЕ НАЧИНАТЬ, ПОКА** в `data/migrations/interest-split-20261020/progress.json` не завершена семантическая миграция активных Tour/Excursion/Destination и нет блокирующих `review`. Исходная ветка `feature/split-nature-wildlife-20261020`, репозиторий `alexyakovlev79/adatours.ru`.

Вход: `docs/workflows/interest-split-2026-10-20.md`, `docs/tasks/WORK_interest_split_batch_20261020.md`, текущие `docs/workflows/interests.md`, `docs/workflows/seo-geo-registry.md`, `docs/workflows/multi-country-interests.md`, `docs/workflows/direct-s3-upload.md` и фактический `main`. Не считать исторические Project Sources более актуальными, чем GitHub.

## 1. Подготовка медиа

В `src/content/themes/nature.md` сейчас **временная** существующая обложка Фоз-ду-Игуасу: `/media/destinations/foz-do-iguacu/hero-enhanced-20261001.webp`. Для новой темы нужна собственная выразительная широкая фотографическая иллюстрация реального природного ландшафта Латинской Америки, **без животных, текста, коллажей и выдуманного географического объекта**. Изготовить одну через GPT Image, по одному цельному сюжету, сохранить WebP через действующий S3-процесс `img.adatours.ru`, проверить receipt, корректно обновить `src/data/media/direct-s3-uploads.json`, `src/data/media/photo-enhancements.json`, `Theme.hero`; не сохранять новые бинарные файлы в Git, не маркировать изображение документальной фотографией тура. Результат повторно не генерировать после обрыва, сверять receipt и ID.

Hero старого `theme_wildlife` (ягуар) оставить в теме животных; сохранить `/interests/wildlife/` и `theme_wildlife`, отдельный `/interests/nature/` использует `theme_nature`.

## 2. Опубликованные SEO/GEO материалы

На baseline:
- `data/seo-geo/registry/02-interests.json` содержит 41 запись (в т.ч. 3 с `theme_wildlife`);
- `03-country-interest.json` содержит 119 (22 с `theme_wildlife`);
- `04-country-interest-vip.json` содержит 92 (20 с `theme_wildlife`).
После разделения состав новых страновых сочетаний может измениться: не копировать старые числа и статусы на новые URL.

Проверить:
- существующий `data/seo-geo/articles/interests/index.md`, текущий `wildlife/index.md` и опубликованные `wildlife/tours/<country>/index.md`;
- VIP country + interest, multi-country + interest, country thematic catalogs и связанные рекомендации внутри других активных материалов;
- текст, H1, meta description, OG, JSON-LD, BreadcrumbList, ItemList, sitemap и Pagefind;
- старые ссылки на `/interests/wildlife/` теперь должны вести именно на наблюдение за животными, а предложения про водопады/горы/ледники — на новую `/interests/nature/` при наличии подтвержденного контекста.

**Публикации:** сохранить старые `publishedAt`, `work`, `articlePath`, provenance, history и точные ID. Менять смысл существующих страниц адресно, не удалять старые HTML URL, не выдавать дату подготовки за первую публикацию. Новые URL/сочетания регистрировать `queued` и затем готовить/публиковать по актуальному SEO/GEO staging/workflow, без вмешательства в чужие активные claim и без фиктивного `published`. Исчезнувшие пустые производные URL хранить как `temporarily_unavailable`, с `workBeforeUnavailable` и историей. Если исходный SEO-текст под чужим lease — `REVIEW` с ID/URL и без перезаписи.

## 3. Вся производная структура

Проверить на базе ровно 15 Theme:
- `/interests/`, 15 тематических хабов, `/interests/<slug>/tours/`, `/places/`, `/excursions/`, `/related/`, по странам и пагинации;
- страницы Tour/Destination/Excursion, Country и их InterestLinks, поиск русских названий, меню, фильтры, mobile/desktop;
- VIP `/vip/<country>/interests/<slug>/`, multi-country `/multi-country/interests/<slug>/` и `/multi-country/<countries>/interests/<slug>/`;
- динамические count/веса, отсутствие дублей, архив, 1–2 primary, порядок сортировки, fallback обложек, 1 общая форма, корректные склонения.
Не добавлять вручную страны в Theme и темы в Country — связи вычисляются из программ. Не заводить новый GEO job Country/Destination/Tour ради смены интересов: это редактирование существующего объекта, не создание новой географической сущности.

## 4. Инструкции и тесты

Убрать именно действующие 13/14 hardcodes из `master.md`, `interests.md`, `AGENTS.md`, `urls.md`, `tours.md`, `destinations.md`, `excursions.md`, `countries.md`, `catalog-pagination.md`, `multi-country-interests.md`, `rewrite.md`, `archive.md` и связанных скриптов. Исторические версии/аудиты не переписывать.

Проверка: unit-тесты тем, копирайта и склонений, валидность content schema и MD/source catalogs, `npm run build` (один штатный проход), проверки multi-country, search, sitemap, страниц/SEO/дублирования формы. При сбое исправить точный дефект и не перезапускать всё с нуля.

## 5. Безопасный cutover

1. Заморозить точные результаты рабочего `feature` SHA, убедиться в 100% решенных активных прежних тегах и готовой обложке.
2. Сверить свежий `main` и изменения параллельных чатов. Rebase/merge только затронутые файлы. Никаких force push, стирания media-регистров и удаления исторических URL.
3. Выполнить один согласованный content commit/PR в `main`; штатный GitHub Actions Pages deploy по SHA. Текущий статус отличать от success.
4. По факту success синхронизировать адресно основную Google Sheets `1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc`: листы `Страницы`, `SEO-GEO тексты`, производные multi-country, сохраняя ручные поля, даты, статусы и примечания. Не считать Sheets исходной истиной для Theme разметки.
5. Проверить реальные 15 индексируемых Theme и новые непустые производные URL. Не обещать SEO-эффект — задача про корректный каталог и фактические связи.

**При обрыве:** восстановить из `progress.json`, `decisions.json`, последних commit SHA и S3 receipt; повторить лишь недостающий шаг. Отчет с фактическими MD, новым hero, количеством новых/устаревших каталожных URL, статусами CI/Sheets и конкретными блокерами. Без запроса подтверждения публикации.
