# Независимая проверка RU/EN foundation

Дата: 28.10.2026. Проверены `locale-site.mjs`, `messages.mjs`, `sites.json`, `ui-copy.json`, `interest-copy.en.json`, соответствующие тесты и повторно content-overlay.

## Исправленные дефекты

1. **Переход на чужой origin через URL normalization.** В `localeUrl` строка вида `/\t/foreign.example/` могла после удаления управляющих символов интерпретироваться как `//foreign.example/`. Добавлены запрет пробелов/управляющих символов/encoded путей, одиночных dot-segments и повторных разделителей, плюс финальная проверка совпадения origin. Непринятые `%`-encoding и double encoding не используются для существующих английских canonical routes; legacy-редиректы обрабатываются отдельным контуром.
2. **Новый host наследовал indexability RU.** Переопределение origin/base теперь автоматически означает preview. Принудительное `preview:false` для такого адреса запрещено: публичный адрес надо утверждать централизованно в `sites.json`. Изменение домена по-прежнему требует только центральной конфигурации, а не перелопачивания контента.
3. **`indexable:true` обходил planned-состояние.** `languageAlternates` дополнительно требует `releaseState:published`, `preview:false`, точное соответствие locale и непустой строковый receipt. Пустые строки/boolean receipts не принимаются. Публичный gate требует все явные условия; эти API пока не подключены к production.
4. **Schema translation relations могли включать будущую страницу или приписывать ей неподтверждённое происхождение.** `translationRelations` теперь работает только с опубликованными counterpart records с receipts, проверяет одну explicit entity, уникальность языков и HTTPS WebPage IDs. Для каждой переводной связи дополнительно требуется явное `approvedTranslationOfWorkId`, точно равное исходному `webPageId`. Самостоятельно написанный EN Word или простая эквивалентность scope не доказывают, что EN CreativeWork является переводом RU CreativeWork: без такого решения helper возвращает `{}`. Hreflang при доказанной эквивалентности страниц рассматривается отдельно. Получать эти записи должен доверенный publication ledger; наличие строки receipt само по себе не делает внешний деплой реальным.
5. **Неполная UI-валидация.** Пустой каталог и неверные типы RU/EN строк теперь возвращают ошибки; `uiText` отвергает NaN/Infinity. Параметры не теряются, отсутствующий перевод не подставляется из русского.
6. **Неявная грамматическая ошибка plural.** `countInEnglish` требует обе явные формы. Больше нет fallback через `singular + s`, который давал `countrys` и ломал многословные фразы. Число должно быть безопасным неотрицательным целым.
7. **Заголовок длительности.** По подтверждённому root решению EN-строка изменена на `Your journey: {days}`. С переданным `12 days` не получается неграмматичное `Your 12 days journey`.
8. **Сохранение Word authority.** Обычный patch больше не может переименовать `word_exact` в `ai_translation`/`editorial` и заменить текст. Обновлённый Word exact проходит с новым evidence. Отдельный контролируемый мастерский override для минимальной адаптации/подтверждённой правки ещё предстоит реализовать; исходные Word file/locator/hash и authorityRecord должны сохраниться.
9. **QA привязана к проверенному результату.** Добавлен `approvedContentHash` для точного текста/поля/source evidence/dependencies/provenance. Правка не может перенести прежнее approval без новой проверки.

## Проверка

- `node tests/i18n/locale-site.test.mjs`: **13/13**.
- `node tests/i18n/content-overlay.test.mjs`: **22/22**.
- Полная Astro-сборка не запускалась: foundational API не подключены к runtime.
- JSON Schema синтаксически проверены. Формальную внешнюю валидацию схем отдельно не заявляем.

## Содержательные наблюдения по английскому

Меню, CTA, ошибки форм, поиск, каталог и названия интересов в целом естественны, без отстранённого рассказчика. `Enquire about this tour` правильно не обещает завершённое онлайн-бронирование; `Guide language` не смешивает язык сайта с языком услуги. English interest forms имеют две формы; их нельзя направлять в русский helper с тремя окончаниями.

Две адресные редакторские правки приняты и внесены координатором:

- `map.dataError`: убрать из посетительского текста технический суффикс `(GEO_DATA)`, оставив `The map could not be loaded.`; код ошибки можно сохранить в диагностике.
- `archive.notice`: естественнее `We have kept this page for reference. This programme is no longer in our current catalogue, and its previous dates and prices no longer apply.` вместо `dates and prices are no longer available to book`.

Остальной текст UI/interest copy не переписывался. Архитектурная граница сохраняется: переведённый словарь и тестированные helpers пока не равны переведённому/опубликованному сайту.
