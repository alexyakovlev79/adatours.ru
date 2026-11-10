# Ada Tours EN — новый рой полных текстов (10.11.2026)

## Решения владельца

Один исходный Markdown-файл = один полный текст и постоянный номер. Задача №1 содержит 1–5, №2 — 6–10 и так далее. Всегда одна задача из пяти последовательных текстов, последняя содержит один текст. Не резервировать пять отдельных задач.

В инвентаризации 7 056 текстов и 1 412 пакетов: 407 Excursion, 1 019 Destination, 5 590 SEO/GEO, 21 Country, 15 Theme, 3 Case и 1 Person. Исключены 18 уже переведенных пилотных материалов и 6 архивных. Туры остаются в прежней отдельной очереди. Подготовленные 218 UI-переводов также не переводятся повторно.

Переводчик сначала выполняет один атомарный CAS claim на 90 минут, только после подтверждения получает состав пятерки и точные source path/SHA. Затем переводит все пять полных документов, проверяет смысл и сохранность фактов, делает ровно один submit с неизменяемым receipt. Никаких частичных checkpoint, коммитов по одному тексту, самостоятельной независимой QA или публикации.

Один чат — не более 10 последовательных пакетов (50 текстов). Сохранять один ownerId и token на весь чат, отдельный постоянный submissionId для каждой пятерки. При неопределенном результате повторять идентичный вызов с тем же submissionId и тем же содержимым, не создавать новый резерв и не перезаписывать сохраненный результат.

Обновления допускаются только в i18n/translation-mass-staging. Запрещены изменения RU, цен, дат, маршрутов, исходных ссылок и идентификаторов, медиа, main, DNS, сайта, индексации. Сохраненный статус review означает завершенный перевод, отдельного редактора не требуется (решение 06.11.2026).

## Запуск через GitHub (код из одного SHA staging)

Считать scripts/i18n/fulltext-swarm-core.mjs и scripts/i18n/fulltext-swarm-remote.mjs из ОДНОГО HEAD staging. Загрузить exports pure core (fulltextPacketId, fulltextShardId, fulltextDefinitionPath, fulltextValidateDefinition, fulltextPick, fulltextClaim, fulltextRenew, fulltextRelease, fulltextReap, fulltextFail, fulltextSubmit, fulltextValidateResult) и runEnFulltextSwarm из remote. Перед claim проверить action:status и enabled:true.

В начале чата создать один ownerId и один token (строки латиницей с цифрами, минимум 6 символов) и записать их, чтобы повторить без изменения после потери ответа. Для каждой пятерки:

1. run(tools,core,{action:'claim',ownerId,token}). После reserved/resumed прочитать ровно source[].path из возвращенного sourceMainSha. До удачного claim источники не выдавать.
2. Перевести каждый полный Markdown в enMarkdown. В результирующем YAML locale: en, имена YAML-ключей и технические ID, slug, status, страны/места, image src, цены и даты сохраняются. Переводятся только человекочитаемые строки, body, title, lead, summary, alt, FAQ. У SEO/GEO сохранять Markdown-ссылки и их href, шаблонные {{catalog.*}}/{{page.*}}, таблицы и программные токены.
3. Подготовить result={packetId,sourceMainSha,locale:'en',status:'review',texts:source.map(x=>({number:x.number,path:x.path,sourceBlobSha:x.sha,enMarkdown:'полный английский Markdown'}))}. Каждый enMarkdown — полный текст одного исходного файла, не абстракт, не один блок и не метаданные без текста.
4. Выбрать постоянный submissionId для этой задачи. run(tools,core,{action:'submit',ownerId,token,number,generation:lease.generation,submissionId,result}). Ровно один GitHub CAS commit на пятерку, вместе с immutable JSON receipt и отметкой saved.
5. После saved_for_review/already_saved сразу перейти к следующему claim, максимум 10. При lost-response повторить тот же submit неизмененным. На сообщение stale_source не пытаться публиковать перевод с прежним SHA.

Дополнительно: action:renew с ownerId/token/number/generation продлевает аренду; action:release возвращает только свой пакет; action:fail с reason и status retryable, blocked_external либо stale_source не выдает его за готовый; action:reap возвращает одну истекшую аренду. Claim также подхватывает истекшие leases. Ограничение десять пакетов проверяется диспетчером, а не только инструкцией.

## Прежде чем открывать всем

Манифест enabled:false до пилотной проверки двух параллельных работников, повторного submit при потере ответа, fencing, срока 90 минут и квот GitHub. Автономный reaper/coordinator по универсальному регламенту пока не подключен: claim или отдельный reap восстанавливают истекшее только во время вызова. Нельзя выдавать это за уже непрерывно работающую фоновую службу.

Текстовые строки в Astro/JS и служебные страницы требуют отдельного безопасного извлечения; executable-код не загружается как полный Markdown в переводчик.
