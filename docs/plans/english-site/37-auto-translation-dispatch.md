# ADA EN — автоматический диспетчер перевода

Дата решения: 04.11.2026 по Москве (точное время не установлено).

Рабочий репозиторий: alexyakovlev79/adatours.ru. Единственная очередь: i18n/translation-mass-staging, без миграции, сброса или повторного перевода сохраненного.

Поручение: до 05.11.2026 09:00 МСК (2026-11-05T06:00:00Z) каждые 5 минут проверять текущий индекс и при наличии свободных queued запускать ровно одного нового независимого переводчика. Один переводчик — до 10 последовательных пакетов, максимум 8 блоков каждый; атомарный submit полного пакета. В 09:00 новый запуск и новые claims запрещены, уже взятый пакет разрешено сохранить. GitHub schedule best-effort, возможны задержки. Контроль времени проверяется внутри кода независимо от cron.

Существенное ограничение: GitHub Actions не создает новые пользовательские чаты ChatGPT. Исполнитель здесь — отдельный запуск GitHub Actions с OpenAI API. Требуются Secrets OPENAI_API_KEY и доступ к исходным Word через Google Drive: ADA_WORD_DRIVE_ACCESS_TOKEN либо три секрета ADA_WORD_DRIVE_CLIENT_ID, ADA_WORD_DRIVE_CLIENT_SECRET, ADA_WORD_DRIVE_REFRESH_TOKEN. Без них диспетчер только проверяет очередь, не захватывает задания и не объявляет переводы сделанными. OpenAI API оплачивается отдельно от подписки ChatGPT.

Независимые QA и публикация не входят в этот процесс; RU, тарифы, медиа, matching и publicationEnabled=false не меняются. Достоверный результат перевода — только сохраненный GitHub receipt saved_for_review/commit. На cutoff расписание пытается самостоятельно отключить свою задачу GitHub Actions.

Реализация: data/i18n/translation-mass-auto-dispatch.json; scripts/i18n/translation-mass-auto-dispatcher.mjs; scripts/i18n/translation-mass-api-worker.mjs; workflows i18n-mass-auto-dispatch.yml и i18n-mass-auto-worker.yml.

## Решение от 04.11.2026: отключение платного API-маршрута

Алексей отверг использование платного OpenAI API. Для GitHub-диспетчера `enabled=false`, пяти-минутный cron удален; автономный GitHub Actions worker явно отключен. Программа и история остаются для справки, но **не запускают перевод и не списывают деньги**. Существующая очередь, RU/EN-переводы и состояние independent QA не изменяются. Альтернативный маршрут использует только доступный интерфейс ChatGPT/подключенные приложения, без ключей внешнего API, с фактическим ограничением частоты автоматических запусков.

## Реально включенная альтернатива без OpenAI API — 04.11.2026

**Принято и настроено:** ChatGPT Automations (не GitHub API-инференс). Один конечный сеанс переводчика раз в час, 05.11.2026 00:00–08:00 МСК включительно (RRULE hourly, STOP после последнего запуска); deadline 09:00 МСК на новые claims дополнительно зашит в prompt. Каждый сеанс использует подключенные GitHub и Google Drive, максимум 10 последовательных пакетов по 8 блоков, теми же start/submit и CAS, без самостоятельной QA и публикации. Частота 5 минут внутри ChatGPT недоступна. У ChatGPT-задачи есть собственное расписание; создавать второй GitHub cron запрещено.

**Подтверждено немедленным запуском 04.11.2026:**
- Belize Inland / Island, `en:bulk:tour:tour_source_beliz_priklyuchenie_materik_ostrov:b009`, 8 блоков, status `review`, сохраненный receipt `sub-chat-mw2l56so-beliz-b009-v1`, result blob `9c074c953f71e8b484a02ef11428357c2c33b84e`).
- Big Mexican Holidays 2027, `en:bulk:tour:tour_source_bolshie_meksikanskie_kanikuly:b003`, 8 блоков, status `review`, staging commit `5c3dd38a4a700ffa1dfd74a019ca6d193320ef07`.

Для обеих Word-программ проверены точные SHA-256 скачанных DOCX; подтвержденный суммарный результат 2 пакета / 16 блоков. Оба результата staging — не `ready` от независимого QA и не `published`.
