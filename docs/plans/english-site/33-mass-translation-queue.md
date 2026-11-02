# ADA Tours EN — массовая очередь перевода

Дата: 02.11.2026. Единственный репозиторий исходников: alexyakovlev79/adatours.ru.
Отдельный тестовый EN GitHub Pages содержит весь русский каталог, включая Hero и медиа.

## Контракт без повторного сопоставления

Точные решения Tour↔Word берутся ТОЛЬКО из 358 готовых CAS-результатов
ветки i18n/matching-staging. Прежний tour-word-matches.json является списком
кандидатов и не может заменять подтвержденные результаты.
Карты 358 Tour содержат 31 330 текстовых блоков, постоянные blockId и поля.
Для измененного исходного Tour фиксируется stale_source; его прежние
тексты и блоки нельзя без проверки переносить в английскую версию.

Для каждого свежего Tour создаются пакеты максимум из 8 блоков.
Пакет получает постоянный jobId, исходный RU текст и sha256, блоки
Word-first 2027/2026 или подтвержденный режим AI-only. Английский
Word на Drive не копируется в Git и читается исполнителем по точному
fileId и SHA только во время работы. Готовые 5 пилотных пакетов (30
блоков) повторно сверяются по подписанным QA и Git blob receipts;
совпавшие с текущим источником блоки исключаются из новых заданий.
Черновики 142 непроверенных полей в READY не переводятся.

Этап 1: 221 Tour с выбранным источником каталога Word 2027.
Этап 2: 44 Tour по Word 2026 после проверки непокрытия 2027.
Этап 3: 93 Tour без совпадений, с точным AI-переводом актуального RU.
348 канонических Excursion с отдельными владельцами — следующий
тип заданий, а не 348 копий в разных турах.

Один рабочий чат может последовательно выполнить до 60 пакетов;
три тура не являются ограничением массового процесса. Период
резерва 90 минут, renew/checkpoint каждые 20 минут.

## Безопасная публикация очереди

GitHub Actions i18n-mass-seed.yml сперва проверяет полную очередь
offline на зафиксированных SHA main, matching-staging и старого
translation-staging. На PR он ничего не публикует. После merge
в main и успешного preflight один раз создается новая ветка
i18n/translation-mass-staging с 32 CAS shards и immutable jobs.
Повторный запуск откажется перезаписывать существующие задания,
активные leases и сохраненные результаты.

Статус этой первой очереди — PREPARED_DISABLED: нельзя делать
worker claim до отдельного успешного live CAS smoke, проверки
первого checkpoint, concurrent submit, fencing и восстановления.
Только после этого открываем очередь WORD 2027; остальные стадии
и публикация сайта открываются отдельно.

Ни создание очереди, ни ее запуск не изменяют цены, русский
production, медиа, DNS, индексацию или реальные формы EN.
Переводчик не имеет права писать main. Word 2027 ценовые
поправки передаются мастеру с валютой и основой тарифа.

## Следующий шаг

Проверить фактические counts и список stale Tour из GitHub Actions.
Затем выполнить пилот CAS нового массового диспетчера минимум
двумя работниками без дублей, открыть word_2027 и перейти
к реальным English translation results в отдельной staging.

## Worker interface

The new bulk core and remote are independent of the original pilot.
Worker actions are status, claim, renew, checkpoint, submit, release,
fail and reap; approve/publish are intentionally unavailable to workers.
GitHub ref updates use expected_SHA CAS, no force. Immutable v2 results
require exact Word source provenance or an explicit, evidenced AI gap.
All source checks compare the current main Git blob with its frozen
packet before any delivery; changed files are held for remapping.

Independent QA is in scripts/i18n/translation-mass-qa.mjs. It verifies
immutable review blobs, the matching source and all QA checks, and rejects
self-approval by the worker. No public publish action exists in that API.
The reaper runs every 30 minutes on main after merge and only updates expired
leases and eligible retries in the staging branch with a non-force push.
