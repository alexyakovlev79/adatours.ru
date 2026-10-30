# ADA EN — переводческий диспетчер: подготовленный офлайн-пилот

Дата: 30.10.2026. Рабочая ветка: feat/english-site-foundation.

Код: scripts/i18n/translation-core.mjs; тесты: tests/i18n/translation-core.test.mjs.
Генератор пилотного состояния: scripts/i18n/seed-translation-pilot.mjs.

Из трех проверенных Word→block sidecars детерминированно создаются 5 заданий (30 привязанных блоков), по максимум 8 блоков на пакет. Источник Word-2027 подтвержден SHA-256 и immutable matching result, исходный RU — текущими block maps. Один общий экскурсионный текст переводится своим владельцем; в пилоте используются только принадлежащие Tour текстовые блоки.

**Это только чистый автомат состояний и локальная подготовка.** Диспетчер по умолчанию заблокирован (\`dispatcherEnabled=false\`), массовый перевод и публикация заблокированы. Он не подключен к live GitHub CAS и не является отчетом о двух настоящих работниках. Нельзя трактовать 5 \`queued\` как опубликованные тексты.

Проверяются: \`claim\`, \`renew\` (90 минут, heartbeat каждые 20), \`checkpoint\`, идемпотентная повторная сдача, \`reap\` с fencing, ограниченные retry, запрет двойного назначения блока, переход worker submit только в \`review\`, независимая QA перед \`ready\`. Публикация — отдельное внешнее подтверждение.

Следующий gate: адаптер \`translation-remote.mjs\` с атомарным GitHub CAS для shard+index+immutable result, затем испытания на отдельной smoke-ветке с двумя конкурентными worker identity и потерянным ответом. Только после этого можно создать настоящую \`i18n/translation-staging\` и открыть пилотный доступ с разрешенными блоками. Не включать перевод через существующую matching-очередь.

Новые коммерческие цены Word-2027 продолжают отдельную работу; переводчик не имеет права менять \`main\` и общие коммерческие данные напрямую.


## Реальный CAS smoke, 30.10.2026

GitHub Actions [#41043098162](https://github.com/alexyakovlev79/adatours.ru/actions/runs/41043098162) проверил создание **отдельной** закрытой ветки `i18n/translation-smoke-20261030`: 5 заданий / 3 Tour / 30 source-anchored blocks, 16 шардов, публикация запрещена.

На этой ветке проверены фактические GitHub CAS транзакции двумя worker identities:

- Worker A получил `en:tour:tour_colombia_essential_5_days:p1` в коммите [fcf7adbf](https://github.com/alexyakovlev79/adatours.ru/commit/fcf7adbf2af1d5d2e5bb74d2e976e224a8f3fab3).
- Worker B после временной ошибки GitHub повторил запрос **тем же owner/token** и получил другой Tour, `en:tour:tour_chile_easter_island_3_days_2027:p1`, в [3c324f16](https://github.com/alexyakovlev79/adatours.ru/commit/3c324f1651b98af053f5b1772ddfea5a5a1eb0a4). Потери результата первого claim и захвата чужой задачи не было.
- [b31089f2](https://github.com/alexyakovlev79/adatours.ru/commit/b31089f2a143) сохранил контрольную точку; повтор с тем же payload подтвердил `already_saved`, без второй записи.
- [af39d6ec](https://github.com/alexyakovlev79/adatours.ru/commit/af39d6ecb6d35e4046ad025b99f7065e0ef04b7d) подтвердил продление 90-минутного lease.
- [fc712f34](https://github.com/alexyakovlev79/adatours.ru/commit/fc712f34827bfcd8f540f1493347ac1b99336c88) и [4fa9708c](https://github.com/alexyakovlev79/adatours.ru/commit/4fa9708c1b59ff4be4246c03bc9e24f6a38a57b6) освободили оба задания.
- [bf701000](https://github.com/alexyakovlev79/adatours.ru/commit/bf70100083134e7da7703248ac8cd318b33262d9) закрыл тестовую очередь. Подтверждено `queued=5, leased=0, review=0, ready=0, activeOwners=0`. `dispatcherEnabled=false`, `publicationEnabled=false` и `translationMassLaunchAllowed=false`.

**Граница доказанного:** это реальный smoke атомарной выдачи, heartbeat, checkpoint, replay и освобождения, но еще **не пилот двух настоящих текстовых переводов** и не проверка GitHub CAS при concurrent submit/approval. В обычной EN-очереди ни одного `approved` или `published` результата нет. `main`, текст RU, цены и домен не менялись.

Следующий шаг: закончить mapping остальных полей пилотных Tour, обработать два подлинных Word-first пакета с полным EN-текстом, получить сохраненные `review`, независимую semantic/Word QA и receipts; проверить повтор submission, конфликт, отказ и восстановление. После этого и интеграционного пилота locale adapter можно обсуждать открытие массового роя.
