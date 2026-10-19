# Обратная сверка трех старых сайтов (v1)

[Рабочая инструкция](../../../docs/workflows/external-identity-reverse.md). Новый источник задач — **внешний URL**. Команда «сверяй дальше»; 50 URL, аренда 60 минут, checkpoint каждые 10, GitHub CAS, параллельные чаты.

- `inventories/` — frozen-source URL, реальные снимки и кандидаты.
- `state.json` — импорт 327 однозначных EN sameAs, 2 EN-конфликтов; в работе редактируется только на `external-identity/staging`.
- `manifest.json` — параметры и счетчики.
- `results/` — будущие immutable checkpoint reports.

Старые отчеты №001–076 и снимки BrasilTours сохранены; их не повторять и не стирать. VIP RU пока `pending_discovery`: существовавшие 133 проверки — не URL-инвентарь старого сайта.
