# Ada Tours — рой полной классификации Destination (26.10.2026)

## КОМАНДА ЗАПУСКА КАЖДОГО WORK-ЧАТА

Рой ADA: типы и роли мест. Репозиторий alexyakovlev79/adatours.ru, рабочая ветка feature/destination-taxonomy-swarm-20261026. Прочитай docs/tasks/WORK_ADATOURS_DESTINATION_TAXONOMY_SWARM_20261026.md. Через готовый диспетчер возьми один пакет из очереди, классифицируй все места, сохрани результат и автоматически бери следующий. Максимум четыре пакета за чат. Не меняй main и страницы сайта.

## Источники и состояние

Основание: AGENTS.md и универсальный регламент роев от 23.10.2026. Замороженный снимок 1018 мест из main SHA a0b7277ec5758c0443e32f9d81d3acd9e43475ea. Корень данных: data/migrations/destination-taxonomy-20261026/swarm/. В manifest.json список 51 пакета. В jobs/p001.json–p051.json содержатся неизменяемые списки до 20 мест, sourceFingerprint, ID, страны, URL, имена, существующие типы и точные contentPath/entryPath. Состояние 16 независимых сегментов находится в shards/00.json–15.json. Результаты — results/pNNN/gN.json. Самостоятельно составлять новую очередь или возвращаться к обработанным пакетам нельзя.

Работники пишут только состояние зарезервированного сегмента и файл результата в рабочую ветку. Они не изменяют MD, URL, main, Google Sheets, текст, изображения, цены, SEO или связи.

## Как классифицировать

Для каждого ID указать две независимые характеристики:
- destinationType — один из ровно 36 типов, перечисленных в scripts/destination-taxonomy-swarm-core.mjs и src/lib/destination-taxonomy.mjs. Прежние семь типов подлежат проверке, потому что некоторые горы, озера и археологические памятники ошибочно обозначены как natural_area / region / route_cluster. Выбирай точный референт страницы; не записывай другие сущности по знакомому названию.
- navigationRole — hub либо sight. Hub: географический узел, город, крупный туристический район или самодостаточное направление, от которого выбирают несколько экскурсионных программ и мест. Sight: конкретный посещаемый объект (водопад, гора, площадь, смотровая, музей, ледник и т.п.). Это НЕ автоматическая функция destinationType: остров/парк/археологический комплекс могут быть и hub, и sight.

Примеры: Рио = city+hub; Сахарная Голова = mountain+sight; Мачу-Пикчу = archaeological_site и при обоснованной самостоятельной роли может быть hub; конкретный ледник = glacier+sight; Амазония = natural_area+hub. Не меняй общий объект на его часть или наоборот. Названия территорий, состоящих из города и окрестностей, классифицируй по основному смыслу самостоятельной страницы. other_landmark — редкий обоснованный тип, не автоматическая замена неопределенности.

Сначала используй название, страну, slug, aliases, existingType из immutable job. Для неоднозначных случаев прочитай только точный source entry и Destination MD из contentPath, существующие в main; не надо читать все MD подряд и делать общее внешнее исследование, если информации достаточно. При существенной неоднозначности допускается адресное уточнение по надежным внешним источникам. Не выдумывай изученный источник или признаки объекта. При отсутствии уверенности >=70 отмечай review и конкретный вопрос; готовые записи не теряй.

Каждый объект возвращается в records один раз, в том же порядке, что immutable job. Ready-объект: id, status=ready, destinationType, navigationRole, confidence (целое 70–100), evidence (конкретное объяснение >=18 символов). Review: id, status=review, destinationType=null (если неизвестен), navigationRole=null (если неизвестна), confidence 0–69, evidence, reason (конкретный неразрешенный вопрос >=18 символов). Готовность всего роя возможна только при нуле review.

## Вызов диспетчера через functions.exec

1. Прочитай из фиксированной рабочей ветки файлы scripts/destination-taxonomy-swarm-core.mjs и scripts/destination-taxonomy-swarm-remote.mjs через подключенный GitHub fetch_file. Получи исходники из result.content.
2. Создай pure core через new Function(coreSource.replace(/^export /gm,'') + ';return {ROOT,BRANCH,REPOSITORY,DESTINATION_TYPES,NAVIGATION_ROLES,shardPath,jobPath,resultPath,hash,sourceFingerprint,checkIdentity,validateJob,validateShard,active,take,requireLease,renew,release,validateResults,recordChecksum,finish,requeueReview,summarize};')(). Создай адаптер через new Function(remoteSource.replace(/^export /gm,'') + ';return runDestinationTaxonomySwarm;')().
3. Сформируй устойчивый ownerId на весь Work-чат и уникальный token для ОДНОГО пакета. Сохрани строковые значения, packetId и generation в контексте чата и контрольной локальной записи, не пересоздавай при обрыве. Пример вызова: await run(tools,core,{action:'claim',ownerId,token,scan:2}).
4. При status=reserved/resumed вернется packet и полное immutable job. При scan_more продолжай поиск с параметром shard=nextShard, с теми же ownerId и token, пока не проверишь все 16 сегментов. Два пустых сегмента не означают конец очереди. Для восстановления старого lease используй claim c packetId, ownerId и token.
5. До истечения аренды в 90 минут выполняй renew ({action:'renew',packetId,ownerId,token,generation}) приблизительно раз в 20–25 минут при длительной работе. Просроченную аренду нельзя сдавать: ее безопасно заберет новый claim с увеличением generation.
6. Проверив все records, предварительно вызови core.validateResults(job,records). Запиши неизменяемый submissionId по схеме taxonomy-submit-pNNN-gGEN. Вызови run(tools,core,{action:'submit',packetId,ownerId,token,generation,submissionId,records}). saved/already_saved/saved_after_uncertain_response означает сохранение в staging, НЕ production. При неясном ответе повтори строго тот же payload, не создавай новое задание/отчет.
7. При технической невозможности продолжать верни ТОЛЬКО свой lease действием release. После каждого успешного submit автоматически бери следующий пакет с новым token. Лимит — до четырех пакетов за чат; не занимай будущие заранее.

## Мониторинг и защита

Команда status принимает from=0,4,8,12 и count=4. Сложи результат шестнадцати сегментов. Считай уникальные ID, не попытки. Review-решения координатор при необходимости возвращает через requeue_review с expectedGeneration и обоснованием; прежняя ревизия сохраняется. Запрещены force push, ручное изменение чужого lease, повторная обработка completed ради загрузки, горячий polling GitHub. При 403/429 — остановка и ожидание reset согласно ответу API.

Диспетчер является готовым механизмом очереди, но GitHub сам не запускает ChatGPT Work-агентов. Для параллельности создай несколько Work-чатов с командой выше. Финальный мастер описан в docs/tasks/WORK_ADATOURS_DESTINATION_TAXONOMY_RELEASE_20261026.md. Перед массовым использованием проверь тесты и один реальный claim→release без изменения данных.
