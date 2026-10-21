# Ada Tours — параллельный рой внешних URL (21.10.2026)

**Рабочая инструкция:** [WORK_ADATOURS_EXTERNAL_IDENTITY_SWARM_20261021.md](../../../docs/tasks/WORK_ADATOURS_EXTERNAL_IDENTITY_SWARM_20261021.md).

- Репозиторий: `alexyakovlev79/adatours.ru`
- Изолированная ветка: `feature/external-identity-swarm-20261021`.
- Frozen baseline: `external-identity/staging` commit `48e10cbb4d1e27c60e83b0b4322df5b7b255d891`.
- Очередь: 2 961 URL, 100 отдельных batch-файлов, максимум 30 URL в каждом. `vip-001` — VIP URL 401–430.
- В старом state уже закрыты 400 VIP и 330 EN URL; они не входят в batch-файлы и не сбрасываются.
- Все агенты используют один `manifest.json`, но **каждый записывает только свой** `batches/<batchId>.json`; GitHub contents-CAS использует точный предыдущий blob SHA файла.
- Внутри партии хранится единственный lease на 90 минут, результаты отдельных URL неизменяемы после успешного `submit`, устаревший владелец не может сохранять новый результат. Подтвержденные записи переживают истечение и повторный захват аренды.
- Результат первого прохода с `review`/`retry` считается сохраненным, но **не готовым к 301 или sameAs**.
- Только отдельный мастер сопоставляет эти результаты со свежим `external-identity/staging` и публикует проверенные соответствия. Worker-claim и worker-submit **не включают** HTTP 301, JSON-LD, Google Sheets или deploy.

## Диспетчер

`scripts/reverse-identity-swarm-core.mjs` — правила переходов, валидация и идемпотентность.  
`scripts/reverse-identity-swarm-remote.mjs` — GitHub CAS: `overview`, `claim`, `recover`, `submit`, `renew`, `release`, `status`.  
`tests/reverse-identity-swarm.test.mjs` — регрессионные тесты блокировок, проверок и возобновления.

Видимый статус на старом `reverse-v1/state.json` не показывает новые записи роя до мастер-интеграции; смотреть надо batch-файлы либо action `status` диспетчера.
