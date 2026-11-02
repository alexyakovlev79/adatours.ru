# Ada Tours EN — три полноценных непубличных JSON locale overlay (пилот)
Дата: 30.10.2026. Статус: `pilot_json_complete`, `public_en=false`.

GitHub Actions: https://github.com/alexyakovlev79/adatours.ru/actions/runs/41056311428 — success.
Исходные работы `i18n/translation-staging`: 5/5 `ready`; 27 `word_exact`, 3 `ai_translation` (всего 30).
Редакционные блоки: 142 EN черновика с источниками, отдельными от `word_exact`.
Контрольное покрытие: Rio 52/52, Easter Island 58/58, Colombia 62/62. Все три `assessment.status=ready`, по 0 issues.

Неизменяемый preview: https://github.com/alexyakovlev79/adatours.ru/tree/i18n/three-tour-preview-20261030/data/i18n/pilot-previews/v1
Commit https://github.com/alexyakovlev79/adatours.ru/commit/ab27248954bb71fe6582bf796d73626ea8502d5f
Файлы: summary.json + 3 `overlays/<id>.json` + 3 `rendered/<id>.json` + 3 `word-sources/<id>.json`.
`main` от EN не менялся. Нет публичных EN URL; HTML роуты не подключены; locale search/schema/forms и полный release QA не пройдены.

Проверки сохраняют общие USD priceFrom: Rio 1255; Easter Island 1492; Colombia 1863. Текст из Word 2027 имеет приоритет над старым RU, но 142 дополнительных полей были программно помечены `approved` на этапе технического пилота; независимая внешняя редакторская приёмка не зафиксирована.

Следующая задача: подключить эти три nonpublic JSON-preview к реальному Astro locale resolver и проверить HTML страницы, абсолютные URL, SEO, hreflang, JSON-LD, формы, Pagefind и RU-регрессию. Массовый перевод разрешать только после сквозного пилота.

Отдельно: Pages deploy `main` https://github.com/alexyakovlev79/adatours.ru/actions/runs/41057093032 завершился failure на проверке новой бинарной фотографии `public/media/people/geovani/geovani-20261030.webp`. Это не вызвано EN, но требует S3 media migration для следующего RU deploy.
