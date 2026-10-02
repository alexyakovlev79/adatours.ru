# Ada Tours: рабочий вход

Выполнять актуальный запрос пользователя. Для типового наполнения читать только выбранный workflow и точную запись `data/source-index/entries/<entityId>.json`.

| Задача | Workflow |
|---|---|
| Страна | `docs/workflows/countries.md` |
| Место | `docs/workflows/destinations.md` |
| Известная экскурсия | `docs/workflows/excursions.md` |
| Тур | `docs/workflows/tours.md` и нужный раздел `tour-excursion-linking.md` |
| Улучшение фото в Work | `docs/workflows/photo-enhancement.md` |
| Явная генерация highlights | `docs/workflows/highlights.md` |
| Отдельная редактура | `docs/workflows/rewrite.md` |

`docs/workflows/master.md` — общий контракт и справочник, не обязательное полное чтение перед каждой сущностью. Исторические handoff и прежние версии workflow не задают действия.

Тексты, raw-фото, ID и URL берутся из записи. Поиск источников, скачивание фотографий при наполнении, экранные проверки и пересчет соседних связей не выполняются. `/image/cache/` запрещен. Один подготовленный commit и один штатный Actions build/deploy завершают content-задачу. Сеть для проверки источников в build не нужна.

Tour заранее указывает все канонические Destination ID маршрута. Каждое место принадлежит одной стране; две стороны Игуасу — разные Destination. Отсутствующие страницы мест не создаются вместе с туром. Недостающие самостоятельные Excursion создаются вместе с туром и сразу используются через `excursionRef`.
