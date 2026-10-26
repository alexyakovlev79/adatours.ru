# Ada Tours — Schema.org / GEO: сбор данных и публикация

Версия 2.6 · 26.10.2026 (адресная ревизия после Word, scoped publication и немедленные GEO-таблицы). Репозиторий `alexyakovlev79/adatours.ru`.
Команды: **«собирай данные»** (один сборщик, целевой объём 50 паспортов за чат) и **«публикуй данные»** (единственный мастер).

**Режим 17.10.2026:** одна команда «собирай данные» запускает **до 50 GEO-паспортов в одном чате**, без ожидания дополнительной команды «дальше». Обрабатывать их последовательно **пятью резервами по максимум 10 задач**, каждый с немедленной фиксацией результатов в staging. `manifest.collectorChatTarget: 50` задаёт цель чата; `manifest.batchSize: 10` ограничивает только одновременный резерв (90 минут), чтобы при зависании не блокировать 50 чужих задач. Сохраняются stage gates, проверка каждого поля по порогу 70%, точные evidence и индивидуальная проверка всех 50 результатов. Если доступных задач меньше, завершить фактическим числом, не выходя за открытый этап.

## 1. Что исправлено относительно стратегии 1.0

1. Google Sheets не является диспетчером блокировок. Источник правды — `schema-geo/staging`, `data/geo-knowledge/queue.json`, `state.json` и отдельные неизменяемые JSON результатов. Sheets — зеркало; ошибка его обновления не отменяет подтвержденный Git-коммит. Не существует разрешенного fallback «записать READY только в Sheets».
2. Резерв работает через настоящий optimistic CAS GitHub: commit имеет единственного родителя — прочитанный HEAD, затем `update_ref(expected_sha=HEAD, force=false)`. При конфликте перечитать состояние и заново применить только свою операцию. Не force push и не слепая перезапись state.
3. 5 231 строка SEO-реестра не равна 5 231 географическому объекту. Начальный GEO-срез — 1 836 задач, 1 796 доступны: 24 страны, 1 003 места, 394 тура (355 доступны), 408 экскурсий (407 доступны), 6 семейств каталогов и 1 проверка редакционных/сервисных связей. 40 архивных/недоступных сохраняются. Полный список производных URL — `coverage.json`. Двадцать дополнительных мест относительно SEO-реестра найдены в текущем source-index.
4. Уже внедренные Article, Table, FAQ, маршруты, about/mentions/subjectOf и подтвержденные EN sameAs не переизобретаем. Новый слой добавляет проверенные географические паспорта; существующий `src/lib/page-schema.ts` → `structured-data.mjs` остается единственным renderer. Работать рядом с текущим `data/external-identity/`, не переносить туда вторую независимую копию статусов.
5. `PUBLISHING`/`DEPLOYING` отделены от `PUBLISHED`. Коммит в main не означает успешного деплоя. Повтор после сбоя восстанавливает существующую публикацию по receipt, commit и точному Actions run, а не создает второй релиз.
6. Порядок GEO отличается от SEO из-за зависимостей: страны → места → туры → экскурсии → шаблоны → редакционные/сервисные связи. Внутри этапа сохраняется sourceOrder SEO-реестра, новые ID из source-index добавляются в конец этапа. Stable ID определяет задачу; перенумерация sourceOrder не создает новую задачу.

## 2. Где лежат рабочие файлы

| Файл | Назначение |
|---|---|
| `data/geo-knowledge/manifest.json` | 90 минут на резерв; `batchSize: 10` на claim; `collectorChatTarget: 50` на чат; открытый этап, Sheet IDs, gate пилота |
| `data/geo-knowledge/queue.json` | определения задач, stable ID, canonical URL, SHA исходного MD, fingerprint |
| `data/geo-knowledge/state.json` | статусы, владельцы, токены, сохраненные результаты и журнал публикаций; **изменять только CAS в staging** |
| `data/geo-knowledge/source-inventory.json` | срез source-index и Git blob SHA существующих content MD |
| `data/geo-knowledge/coverage.json` | все URL, покрываемые задачами общих шаблонов |
| `data/geo-knowledge/results/<jobId>/<token>-<hash>.json` | неизменяемый результат; только staging |
| `data/geo-knowledge/entities/<stableId>.json` | проверенный публичный паспорт после команды мастеру; без lease-токенов |
| `data/geo-knowledge/releases/<batchId>.json` | receipt production-коммита со списком точных hashes |
| `scripts/schema-geo-core.mjs` | общая тестируемая state machine, валидатор, SHA-256 |
| `scripts/schema-geo-remote.mjs` | GitHub connector CAS для claim/renew/complete/publisher |
| `scripts/check-geo-knowledge.mjs` | offline проверка результатов, коллизий QID и циклов географии |
| `scripts/refresh-geo-source-inventory.mjs` | свежий снимок контента из checkout main |
| `scripts/sync-geo-knowledge-queue.mjs` | идемпотентная сверка очереди с сохранением истории |

Три существующих листа основной книги: **GEO очередь** (17 колонок), **GEO результаты** (10), **GEO публикации** (9).
Книга: https://docs.google.com/spreadsheets/d/1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc/edit
Таблица не дает claim, ее ручное редактирование не меняет Git-состояние. JSON payload хранится в Git, в таблице — ссылка, hash и краткие поля. Не помещать большие JSON в ячейки.

## 3. Запуск «собирай данные»

Читать этот регламент, `manifest.json` и точную задачу. Не запускать SEO-очередь и не менять ее claims. Сборщик использует GitHub connector, а не shell-токены.

### 3.1. Загрузка рабочего диспетчера в Code Mode

Один раз в текущем чате выполнить этот код. `store/load` принадлежат Code Mode. Скрипты читаются с одного фиксированного SHA main, поэтому параллельная смена main не смешивает версии кода.

```javascript
const repo = 'alexyakovlev79/adatours.ru';
const un = r => { if (r.isError) throw Error(JSON.stringify(r)); return r.result || r.structuredContent || r; };
const head = JSON.parse(un(await tools.mcp__GitHub__fetch({url:`https://api.github.com/repos/${repo}/git/ref/heads/main`})).content).object.sha;
async function code(path) {
  const f=un(await tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref:head}));
  return f.content || un(await tools.mcp__GitHub__fetch_blob({repository_full_name:repo,blob_sha:f.sha})).content;
}
const [coreSource,remoteSource]=await Promise.all([code('scripts/schema-geo-core.mjs'),code('scripts/schema-geo-remote.mjs')]);
store('geoCoreSource',coreSource);store('geoRemoteSource',remoteSource);
store('geoOwner','geo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14));
store('geoToken','lease-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,16));
text({loadedFrom:head});
```

В следующих вызовах восстановить API (V8-изолят новый на каждый вызов):

```javascript
const core=new Function(load('geoCoreSource').replace(/^export /gm,'')+
 ';return {claim,renew,release,complete,beginPublication,recordCommit,confirmDeploy,statusOf,stable};')();
const run=new Function(load('geoRemoteSource').replace(/^export /gm,'')+';return runSchemaGeo;')();
const r=await run(tools,core,{action:'claim',ownerId:load('geoOwner'),token:load('geoToken'),limit:10});
store('geoClaim',r);
text(r);
```

Первый пилот исторически запускался с `limit:3`. **Новая сессия обрабатывает до 50 разных задач за один чат**, последовательно резервируя до 10 одного открытого этапа на один claim (размер задаёт `manifest.batchSize`). Успешный ответ: `status: saved`, commit SHA и список `output` с lease. Сначала исследовать и сохранить результат **каждой** задачи текущей десятки через `complete` (`saved` или `already_saved`), затем **в этом же чате** повторить `claim` с тем же `ownerId` и `token`; цикл до `manifest.collectorChatTarget` (50) **уникальных сохранённых jobId** либо `empty_or_gated`. Не останавливаться после первой десятки и не требовать «дальше». Если `claim` повторён до сдачи предыдущих работ, он возвращает оставшиеся активные leases того же владельца, а не ещё 10; доисследовать и закрыть их. При потере ответа повторить тот же owner/token, не создавать новый резерв. При приближении 90 минут продлевать оставшиеся активные leases по jobId; просроченные не сдавать чужим токеном. Не расширять `maxStage` самостоятельно. Одна сессия учитывает `READY`, `REVIEW` и `BLOCKED` отдельно; никогда не выдаёт последние два за опубликованные паспорта.

### 3.2. Исследование

1. Открыть точный contentPath/entryPath в текущем main; сверить stable ID, canonical URL, страну, тип и активность. Старые названия и перенаправления не считаются новой сущностью. Наличие MD в исходном срезе — не гарантия текущего опубликованного HTML; перед READY проверить точный URL и статус.
2. Для Country/Destination искать точные внешние географические идентичности. Для Tour/Excursion проверять порядок посещений и ссылки на существующие места по программе, без поиска «sameAs туристического продукта». Для шаблона проверять один renderer и репрезентативные URL из coverage.json, не исследовать каждый каталог отдельно.
3. Сохранять evidence для каждого публикуемого внешнего поля, уточнять неоднозначности поиском дополнительных источников. Для самого объекта и каждого поля действует порог вероятности 70% согласно §3.2.1. При оценке ниже порога пропускать поле, не блокируя подтвержденный паспорт.
4. Составные редакционные места, город и регион, парк и водопад, стороны Игуасу рассматриваются с учетом главного референта страницы: присваивать QID наиболее вероятного соответствующего объекта при оценке от 70%. Не менять stable ID/URL, не усреднять координаты и не объединять самостоятельные стороны границы.
5. Результат v2: schemaVersion, jobId, stableId, kind, canonicalPath, sourceFingerprint из claim; status READY/REVIEW/BLOCKED; external, location, relationships по смыслу; evidence, confidence, reviewNote; для новых работ обязательны decisionPolicy и assessments. Полная схема — `result.schema.json`. Schema.org `@id`/`@type` и публичный JSON-LD сборщик не пишет.

Основные источники: Wikidata (QID, P625/P17/P131), точная Wikipedia, OSM (node/way/relation + ID), GeoNames, национальные геослужбы, официальные сайты парков/музеев. UNESCO/WDPA только для точно того же объекта/границ. Официальный туристический портал города может быть источником, но не автоматически sameAs города. Поисковая выдача и страница неоднозначностей — не точная идентичность. Правила въезда, здоровье, цены и графики этой геопрограммой не собираются; при отдельной задаче проверяются актуальные официальные источники.


### 3.2.1. Решение по вероятности 70% (действует с 16.10.2026)

**Главный принцип:** искать и уточнять данные до принятия решения. Для самого объекта страницы и для каждого внешнего соответствия, включая `sameAs`/Wikidata QID, OSM, GeoNames, координаты и связи, использовать наиболее вероятный вариант, если оценка его соответствия **не ниже 70%**. Абсолютная достоверность (100%) и второй формально идентичный источник для такого решения не требуются. При вероятности ниже 70% не записывать сомнительное поле; при этом паспорт остается `READY`, если идентичность объекта страницы установлена с вероятностью от 70%.

**Порядок сборщика:**
1. Сверить название, географию, тип и фактический смысл страницы с ее MD и источником. Для неоднозначностей адресно искать дополнительные данные в интернете: местные/английские/португальские названия, официальные источники, карты, Wikidata/OSM/GeoNames, географический и туристический контекст. Разобрать конкурирующие варианты.
2. Оценить наиболее вероятное соответствие *самого объекта страницы* (включая его основной референт в описании «город и окрестности») числом от 0 до 100. При **70% и выше** принять идентичность и продолжить `READY`. При меньшем значении исследовать точечно дальше; если преодолеть порог не удалось, оставить `REVIEW`, указав наиболее вероятных кандидатов и что мешает выбрать объект.
3. Независимо оценить каждое добавляемое внешнее поле. При **70% и выше** записать наиболее вероятное значение без снижения статуса или завуалирования связи. В частности, Wikidata QID с вероятностью соответствия от 70% попадает в `external.wikidataQid` и затем в публичный `sameAs`. При вероятности ниже 70% оставить именно поле незаполненным. Не ставить `REVIEW` из-за отсутствия координат, QID, OSM, GeoNames или официального URL.
4. Для составных страниц определять **основной именованный референт** по заголовку, собственному тексту и маршрутам. Например, «город и окрестности» может иметь `sameAs` города, если именно он является основным объектом с вероятностью от 70%. Второстепенные достопримечательности не требуют отдельного `sameAs` всей страницы. Для редакционного маршрута без единого узнаваемого геообъекта `READY` допустим со связями и без QID/координат.
5. Записывать оценки и объяснения в **служебный** `assessments`: `{field, probability, selected?, reason}`; для новой работы устанавливать `decisionPolicy: probability-70-v1`, обязательно включая оценку `field: identity`. Низкооцененных кандидатов сохранять только как служебные пояснения, не превращая их в утверждения JSON-LD. `evidence` для всех опубликованных внешних значений сохраняется. Вероятность является экспертной оценкой по источникам, а не математически калиброванной частотой.
6. Не усреднять конфликтующие координаты и не склеивать разные независимые сущности в одну. Выбирать наиболее вероятную точку с определенной ролью (`entrance`, `feature_point`, `representative` и т. д.), когда связь этой точки с выбранным объектом достигает порога. Если роль/координата менее 70%, опустить `location`.

**Совместимость:** исторические результаты v2 без `decisionPolicy` продолжают валидироваться по прежнему контракту и не переписываются. Новые результаты обязаны включать политику и оценки. Старые `REVIEW` нужно обрабатывать отдельной сохраненной ревизией/повторной задачей без перезаписи immutable result или чужих активных lease; они не повышаются до `READY` автоматически. Мастер публикует только валидный `READY`; на публичной странице вероятность в процентном виде не выводится.

### 3.3. Сохранение и завершение

Подготовить `result`, затем вызвать тот же `run(tools, core, {...})`:

```javascript
const r=await run(tools,core,{
 action:'complete',ownerId:load('geoOwner'),token:load('geoToken'),result
});
text(r);
```

Диспетчер проверит ownership, срок, sourceFingerprint и текущий Git blob SHA MD в main. Payload и переход LEASED → READY/REVIEW/BLOCKED записываются **в одном CAS-коммите**. READY не значит PUBLISHED. Истекший/переуступленный токен отклоняется даже при готовом тексте; черновик сохранить локально и передать на адресную сверку, чужую запись не перезаписывать. Результат имеет SHA-256 по стабильной сериализации без lease-полей; путь включает токен отдельно. Повтор идентичной сдачи возвращает `already_saved` без нового результата.

Для продления: `action:'renew', jobId, ownerId, token`; для добровольного возврата незавершенной задачи: `action:'release'` с теми же полями. Просроченный резерв не продлевается. Все CAS-конфликты — максимум два повтора после первой попытки. Нет force, нет слепого `update_file`.

После Git-коммита обновить строки зеркала по jobId, не по физическому номеру строки. Ошибку Sheets сообщить вместе с успешным SHA, а не повторять сбор/публикацию. Сборщик не запускает build/deploy, не пишет main и не вносит результат в source content MD.

**Переход к следующей десятке:** сохранять набор подтверждённых `jobId → status/resultHash/commit`, а не только счётчик попыток. Сразу после последнего `complete` текущей пачки вызвать тот же `run(tools,core,{action:'claim',ownerId,token,limit:10})` и продолжить исследование. Считать по одному разу `saved`/`already_saved` каждого уникального jobId; блокированные, истекшие и только зарезервированные не считать обработанными. После завершения до 50 позиций привести отдельные количества `READY`/`REVIEW`/`BLOCKED` и незавершённые leases. Не переносить недостаточно исследованные записи в `READY` ради выполнения плана.

### 3.4. Новый объект сайта: «собирай данные» в том же рабочем цикле

**Обязательное исключение из массовой очереди.** При первоначальном создании полноценной активной страницы Country, Destination, Tour или Excursion чат-создатель **сам** выполняет весь GEO-сбор для этого объекта. Не ждать отдельной команды «собирай данные» и тем более «публикуй данные». Это касается и новых самостоятельных Excursion/Destination внутри импортируемого тура. Пустой резерв Destination без MD, архивная/черновая запись, производный каталог, фотография и редактура уже существующего объекта не являются новым GEO-объектом.

**Порядок одной операции создания:**
1. Создать MD, закрепить stable ID, точный canonical URL, source-index entry и компактный каталог **одним content commit в main**. Сохранить SHA именно этого коммита. Запустить только штатный Pages build/deploy. Если MD уже существовал до коммита, использовать обычное обновление/адресную ревизию GEO, а не выдавать его за новый объект.
2. Пока идет штатный deploy, открыть §3.2 и провести адресное интернет-исследование **ровно этого объекта**: страна/место — внешние идентичности, \`sameAs\`/Wikidata при оценке от 70%, координаты, география и связи; тур/экскурсия — реальный порядок посещений и отношения к уже закрепленным местам, **без** выдуманного внешнего QID турпродукта. Оценить идентичность и поля раздельно; спорное поле ниже 70% опустить. Правила текстового импорта «без нового исследования источника» не запрещают это отдельное проверочное GEO-исследование.
3. Через \`scripts/schema-geo-new-object.mjs\` подтвердить новый MD по **его original creation commit** (существует в main, отсутствовал в родителе, совпадает с текущим MD, зарегистрирован в entry и каталоге), получить канонический GEO job и его \`sourceFingerprint\`. Этот путь не ограничен \`manifest.maxStage\`: индивидуальный новый Tour/Excursion обслуживается немедленно, даже когда их **массовый** этап закрыт. Существующий/чужой lease или ранее сохраненный конфликтующий результат менять запрещено.
4. Заполнить валидный v2 result из \`result.schema.json\`: \`schemaVersion\`, \`jobId\`, \`stableId\`, \`kind\`, \`canonicalPath\`, \`sourceFingerprint\`, \`status\`, \`confidence\`, \`decisionPolicy: probability-70-v1\`, \`assessments\`, \`evidence\`, применимые \`external\`/\`location\`/\`relationships\`. Применять §3.2.1. \`REVIEW\` только при действительно неустановленной идентичности после уточнения; отсутствие отдельного QID/координат не делает подтвержденный объект \`REVIEW\`.
5. В том **же** чате вызвать \`collectNewGeoObject\`: единый CAS в \`schema-geo/staging\` добавит/обновит ровно один job в \`queue.json\`, исходник в \`source-inventory.json\`, статус и hash в \`state.json\` и immutable \`results/<jobId>/inline-<creationSHA>-<hash>.json\`. Служебный статус \`geoSheetSync: PENDING\` сохраняется до подтверждения таблиц. Затем **одним Google Sheets \`batch_update_spreadsheet\`** добавить/обновить по точному \`jobId\` обе строки: \`GEO очередь\` (17 колонок) и \`GEO результаты\` (10 колонок); duplicate-check перед записью. Успешное подтверждение ставит \`geoSheetSync: SYNCED\` в staging. **Не откладывать эти две записи до будущего мастера.**
6. При сбое Google Sheets immutable результат **сохраняется**, \`geoSheetSync\` остается \`PENDING\`. В том же рабочем проходе повторить с неизмененными \`result\`, \`stableId\` и \`creationCommit\`; не собирать факты, не создавать job и не запрашивать новый lease повторно. Если связка Google Sheets недоступна, отразить явный незакрытый этап, а не сообщать «готово». При нескольких новых сущностях из одной Word-программы пройти каждый **новый активный MD** один раз по собственному stable ID.
7. \`READY\` — **факты собраны, не опубликованы на сайте в JSON-LD**. Лист \`GEO публикации\` **не заполнять при создании объекта** и не писать \`PUBLISHED\` без отдельного мастер-прохода и подтвержденного Pages deploy. Мастер позже опубликует все накопившиеся READY обычной пачкой; новых объектов он повторно не исследует. Строки обычных листов \`Страницы\`/\`Фото\` и очереди Анны заполняются по исходным content-workflows.

**Рабочий Code Mode — точное выполнение по одному объекту:**

~~~javascript
const repo='alexyakovlev79/adatours.ru';
const stableId='ВЗЯТЬ_ТОЧНЫЙ_STABLE_ID_ИЗ_ENTRY';
const creationCommit='40_HEX_SHA_CONTENT_COMMIT';
const ownerId='geo-inline-'+Date.now().toString(36);
const unwrap=r=>r.result||r.structuredContent||r;
const head=JSON.parse(unwrap(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+repo+'/git/ref/heads/main'
})).content).object.sha;
async function load(path){
 const f=unwrap(await tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref:head}));
 return f.content||unwrap(await tools.mcp__GitHub__fetch_blob({
   repository_full_name:repo,blob_sha:f.sha
 })).content;
}
const [coreSrc,inlineSrc]=await Promise.all([
 load('scripts/schema-geo-core.mjs'),load('scripts/schema-geo-new-object.mjs')
]);
const core=new Function(coreSrc.replace(/^export /gm,'')+
 ';return {digest,validateResult};')();
const inline=new Function(inlineSrc.replace(/^export /gm,'')+
 ';return {inspectNewGeoObject,collectNewGeoObject};')();
const inspected=await inline.inspectNewGeoObject(tools,core,{stableId,creationCommit});
text(inspected.job); // Research this exact job according to §3.2, then compose 'result'.
// const result={schemaVersion:2,jobId:inspected.job.jobId,...};
const saved=await inline.collectNewGeoObject(tools,core,{
 stableId,creationCommit,ownerId,result
});
text({status:saved.status,jobId:stableId,
 hash:saved.saved.resultHash,sheet:saved.sheet?.status});
~~~

Для нового объекта **не вызывать** общий \`claim(limit:10)\`, \`beginPublication\` или \`dispatchPublication\`; не брать соседние задания и не менять \`manifest.maxStage\`. \`collectNewGeoObject\` делает адресную фиксацию и запись обеих таблиц после исследования. Встроенный результат имеет токен \`inline-<creationSHA>\` вместо lease; активные чужие leases сохраняются. Два независимых хранилища (GitHub и Sheets) не могут образовывать одну техническую транзакцию; точное состояние \`PENDING\`/\`SYNCED\` и идемпотентный повтор обеспечивают **одну логическую операцию с одним объектом**.

### 3.5. Существенное изменение существующей страницы по Word

Ежедневное задание 2027 имеет постоянное прямое поручение довести подтверждённое изменение до публикации и таблиц. Для существующего MD используется `scripts/schema-geo-word-revision.mjs`, а не исключение «новый объект». Scope задаётся точным stable ID и фактическим `contentCommit`, в котором изменён этот MD; произвольный старый backlog этим путём не обновляется. Ревизия поддерживает активные Country/Destination/Tour/Excursion, действительно изменённые данным Word-проходом. Пустой резерв места не получает ни MD, ни отдельный GEO-паспорт.

1. После content commit вызвать `inspectWordGeoRevision`. Он проверяет принадлежность коммита текущему main, наличие того же stable ID в родительском MD, изменение его blob в указанном коммите и совпадение с текущим main. Точная source-index entry не должна измениться после этого коммита; точная строка компактного каталога тоже сравнивается с версией в коммите. ID, slug, география, основные/дополнительные интересы, маршрутные ID и классификация места сверяются с актуальным MD. Неподдерживаемая запись YAML в служебных ID-полях останавливает проверку, а не угадывается.
2. Исследовать обновлённую программу по §3.2 и составить новый результат с `decisionPolicy: probability-70-v1` и **полученным** `sourceFingerprint`. Для Trip поле `relationships.visits` покрывает гарантированный маршрут из MD; очередность подтверждается программой, а не порядком добавления ID в общий массив связей. Уже закреплённые ID резервов допустимы как внутренние отношения, без выдуманного URL опубликованной страницы или внешнего sameAs. Дополнительные опции не выдавать за включённые посещения.
3. `collectWordGeoRevision` сохраняет результат в канонический job `geo-<kind>-<stableId>` и immutable `results/<jobId>/word-<contentCommit>-<hash>.json`, обновляет только его queue/inventory/state через CAS staging. Старый immutable JSON остаётся на месте; прежняя запись, исходный fingerprint, истёкший lease и публикационные сведения сохраняются в `revisionHistory`, общий журнал `publications` не меняется. Новый READY не наследует `publishedCommit` старой ревизии.
4. Активный lease, `PUBLISHING`/`DEPLOYING` этого объекта или конфликтующий результат той же Word-редакции останавливают запись. Чужой claim не перехватывать. При гонке CAS повторно читается staging и current main; изменения соседних сборщиков сохраняются. Если current source уже имеет другой собранный результат, переиспользовать/согласовать его, не заменять молча.
5. Тем же существующим `syncNewGeoSheets` адресно записать две строки по jobId и подтвердить `geoSheetSync: SYNCED`. При ошибке `PENDING` повторить **тот же** result/contentCommit без нового сбора. Проверки редакционного содержания и media не заменяются этим helper.
6. Для полностью подготовленного адресного Word-пакета вызвать мастер из §4.1 с **явными** `jobIds` и `contentCommit`. Он принимает только READY с SYNCED, созданные/пересобранные этим content commit, и использует общий lock, immutable hash/source проверки, Actions publisher и Pages finalize. Остальные READY остаются нетронутыми. Незавершённая чужая публикация возвращает `scope_blocked_by_publication`; её не запускать под видом текущего Word-задания. `PUBLISHED` и зеркалирование `GEO публикации` подтверждаются по §4.2–4.3.

**Граница schema renderer.** `Tour`/`Excursion` паспорта — опубликованный проверенный реестр семантических связей. Сейчас `mergeGeoPassport` подключает внешние факты только Country/Destination; Trip/itinerary строит единственный `structured-data.mjs` из canonical MD и живых объектов. Публикация Trip-паспорта сама по себе не включает второй renderer и не заставляет JSON-LD читать `relationships`. Резерв без MD не становится публичным узлом с выдуманным `@id`; в видимой программе допускается обычная подпись Place. Материалы незаполненных мест и самостоятельных экскурсий остаются отдельными незавершёнными стадиями Word-прохода.

**Исполняемый Code Mode после реального content commit:**

~~~javascript
const repo='alexyakovlev79/adatours.ru';
const stableId='ТОЧНЫЙ_STABLE_ID';
const contentCommit='40_HEX_SHA_COMMIT_ИЗМЕНИВШЕГО_MD';
const un=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r;};
const ghFetch=tools.mcp__GitHub__fetch||tools.mcp__codex_apps__github_fetch;
const ghFile=tools.mcp__GitHub__fetch_file||tools.mcp__codex_apps__github_fetch_file;
const ghBlob=tools.mcp__GitHub__fetch_blob||tools.mcp__codex_apps__github_fetch_blob;
const head=JSON.parse(un(await ghFetch({
 url:'https://api.github.com/repos/'+repo+'/git/ref/heads/main'
})).content).object.sha;
async function load(path){
 const f=un(await ghFile({repository_full_name:repo,path,ref:head}));
 return f.content||un(await ghBlob({repository_full_name:repo,blob_sha:f.sha})).content;
}
const paths=['schema-geo-core','schema-geo-new-object','schema-geo-word-revision','schema-geo-remote','schema-geo-publisher'];
const src=await Promise.all(paths.map(name=>load('scripts/'+name+'.mjs')));
const evaluate=(source,names)=>new Function(source.replace(/^export /gm,'')+';return {'+names+'};')();
const core=evaluate(src[0],'statusOf,digest,validateResult,claim,renew,release,complete,beginPublication,abortUncommittedPublication,recordCommit,confirmDeploy,stable,geoPublicationScope,geoPublicationScopeMatches');
const inline=evaluate(src[1],'buildNewObjectJob,syncNewGeoSheets');
const revision=evaluate(src[2],'inspectWordGeoRevision,collectWordGeoRevision');
const remote=evaluate(src[3],'runSchemaGeo').runSchemaGeo;
const publish=evaluate(src[4],'publishSchemaGeoAll').publishSchemaGeoAll;
const inspected=await revision.inspectWordGeoRevision(tools,core,inline,{stableId,contentCommit});
text(inspected); // Read-only: inspect first, then research/verify the exact source.
// Preserve the inspected sourceFingerprint and fully verified result between Code Mode calls.
// const result = ...; // Complete v2 passport, checked by validateResult and the route coverage gate.
// const saved=await revision.collectWordGeoRevision(tools,core,inline,{
//  stableId,contentCommit,ownerId:'geo-word-PROGRAM-REVISION',result
// });
// text({status:saved.status,resultHash:saved.saved.resultHash,sheet:saved.sheet?.status});
// When this addressed Word scope is READY and SYNCED, use the same master:
// text(await publish(tools,core,remote,{
//  ownerId:'geo-word-master-PROGRAM',batchId:'geo-word-PROGRAM-REVISION',
//  jobIds:[inspected.job.jobId],contentCommit
// }));
~~~

Новый объект того же Word-пакета по-прежнему собирается через §3.4 с `creationCommit`. В адресный мастер можно передать несколько точных jobIds с одинаковым `contentCommit`: у новых записей проверяется `inlineCreationCommit`, у ревизий — последний `wordRevisionCommit`. Ни helper, ни явный список публикации не меняют массовый `manifest.maxStage`.

## 4. «Публикуй данные»: все READY, один логический пакет

**Мастер не переносит JSON через ChatGPT.** В Code Mode есть ограничение на количество GitHub-вызовов в одном действии, поэтому даже параллельное чтение 80 результатов может оборваться после CAS-захвата. Тяжелая работа перенесена в GitHub Actions. **Нет искусственного ограничения числа паспортов, 20 и 10 к мастеру не относятся.** `manifest.batchSize:10` ограничивает **одновременный резерв**, а `manifest.collectorChatTarget:50` задаёт цель **одного чата-сборщика** (до пяти последовательных десяток); к мастеру оба ограничения не относятся.

### 4.1. Единственный быстрый вызов мастера

Взять `scripts/schema-geo-core.mjs`, `scripts/schema-geo-remote.mjs` и `scripts/schema-geo-publisher.mjs` из **одного текущего `main` SHA**, вызвать один раз в Code Mode. Текущие Github tools: `mcp__GitHub__fetch`, `fetch_file`, `create_tree`, `create_commit`, `update_ref`. Remote поддерживает и старые имена `mcp__codex_apps__github_*`.

~~~javascript
const repo='alexyakovlev79/adatours.ru';
const un=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r;};
const head=JSON.parse(un(await tools.mcp__GitHub__fetch({
 url:'https://api.github.com/repos/'+repo+'/git/ref/heads/main'
})).content).object.sha;
const paths=['scripts/schema-geo-core.mjs','scripts/schema-geo-remote.mjs','scripts/schema-geo-publisher.mjs'];
const src=await Promise.all(paths.map(async path=>un(await tools.mcp__GitHub__fetch_file({
 repository_full_name:repo,path,ref:head
})).content));
const core=new Function(src[0].replace(/^export /gm,'')+
 ';return {statusOf,digest,validateResult,claim,renew,release,complete,beginPublication,abortUncommittedPublication,recordCommit,confirmDeploy,stable,geoPublicationScope,geoPublicationScopeMatches};')();
const remote=new Function(src[1].replace(/^export /gm,'')+';return runSchemaGeo;')();
const publish=new Function(src[2].replace(/^export /gm,'')+';return publishSchemaGeoAll;')();
text(await publish(tools,core,remote));
~~~

`publishSchemaGeoAll` выполняет только быстрые шаги: попытка восстановить ранее успешный `DEPLOYING` → единый атомарный `beginPublication`, захватывающий **все** `READY` на фиксированном SHA → запись `data/geo-knowledge/dispatch.json` в **том же** CAS-коммите staging. Это несколько служебных GitHub-запросов, независимо от числа готовых паспортов. Никакого цикла по паспортам в ChatGPT, локальных сборок, ожидания Actions или таблиц Sheets до запуска.

Это поведение по умолчанию сохранено. Только для конкретного уже проверенного Word content commit аргументы `{jobIds:[...],contentCommit}` из §3.5 ограничивают замороженную партию указанными каноническими заданиями. Пустой список, неизвестный ID, чужой commit, STALE/REVIEW/BLOCKED или неподтверждённые GEO Sheets дают ошибку **до** изменения состояний; автоматически расширять такой запрос до всех READY запрещено.

Если `PUBLISHING` уже зарезервирован прежним мастер-чатом, не захватывать READY повторно. `resumePublication` возвращает первоначальные `batchId` и `ownerId`, и новый мастер автоматически делает `dispatchPublication` именно для этой партии без второго claim. Перед возобновлением проверять сохраненный main release receipt. **Важно:** коммиты `beginPublication` и `dispatchPublication` с измененным `dispatch.json` НЕ содержат `[skip ci]` и действительно запускают GitHub Actions; для worker-claims и status-commits `[skip ci]` остается.

### 4.2. Что делает Actions без участия чата

1. `.github/workflows/geo-publish.yml` запускается на push в `schema-geo/staging` **только если изменен маркер** `dispatch.json`; обычные worker-claims и результаты не вызывают тяжелую сборку.
2. `scripts/schema-geo-ci-publisher.mjs` читает **всю** замороженную партию и `queue.json` из локального checkout staging, без сотен GitHub API-вызовов. Проверяет immutable hash, `validateResult`, source fingerprint, Git blob SHA текущего `main`, идентичность и коллизии QID. `REVIEW`/`BLOCKED`/`STALE` не входят. Если есть ранее созданный receipt с теми же hashes, переиспользует публикацию без второго содержательного коммита.
3. Создает **один** `main` content-коммит: актуальные `entities/<stableId>.json` и один `releases/<batchId>.json`, без переносов `state.json`/`claims`/SEO. При гонке `main` безопасно перестраивает тот же пакет на свежем HEAD, максимум 3 попытки, без force. Только после подтвержденной записи фиксирует `recordCommit` в staging.
4. **Важно:** push от `github.token` сам по себе не запускает другой GitHub Actions workflow. Поэтому publisher явно вызывает `workflow_dispatch` существующего `.github/workflows/deploy.yml` на `main` с правом `actions:write`. Ровно один штатный `npm run build`/Pages deploy; отдельного local build и повторных тестовых релизов нет.
5. После завершения **всего** Pages workflow с `conclusion: success` (событие `push` или `workflow_dispatch`) `.github/workflows/geo-finalize.yml` проверяет SHA, batchId, exact release receipt и hashes и выполняет `PUBLISHING`/`DEPLOYING` → `PUBLISHED` одним CAS staging. Если мастер потерял ответ `recordCommit`, успешный Pages deploy позволяет восстановить его автоматически. Ошибочный/чужой SHA никогда не подтверждать. Никакого второго Pages deploy ради изменения статуса.

Мастер **не ждет** 10–20 минут GitHub Pages и не опрашивает работу циклом. Ответ `queued_for_github_actions` означает только созданный dispatch. `DEPLOYING` — готовый main-коммит, но не подтвержденная публикация. Независимый `geo-finalize.yml` после успешного Pages deploy устанавливает `PUBLISHED`, даже если чат мастера закрыт. Неуспешный или отмененный деплой не дает `PUBLISHED`; успешный последующий деплой потомка GEO-коммита может закрыть пакет, только если не изменялись GEO entities и release receipt. При технической ошибке CI исправлять конкретный сбой, а не собирать все данные заново. Для ручного восстановления точного успешного Actions run: `remote(tools,core,{action:'resumePublication'})`. Если `github.token` не может создать `workflow_dispatch`, не заявлять `PUBLISHED` и сообщить точную ошибку; понадобится адресный запуск Pages с сохраненным SHA.

### 4.3. Google Sheets — зеркало, не диспетчер

После подтверждения `PUBLISHED` один раз **пакетно** обновить соответствующие `jobId` в листах `GEO очередь` и `GEO результаты` и одну запись `batchId` в `GEO публикации`. Сохранять все URIs, hash, даты и историю. Если Sheets недоступен, откладывается только зеркалирование: не повторять Git-коммит или deploy. Следующий мастер может синхронизировать накопленные подтвержденные публикации одним пакетным запросом.

Отчет: число уникальных паспортов и отдельных amendment-заданий, один main SHA, один Pages run, текущий `PUBLISHING`/`DEPLOYING`/`PUBLISHED` и реальные блокеры. Новые `READY`, подготовленные после фиксации снимка, публикуются следующим общим пакетом без изменения лимитов.

## 5. Этапы и gates

| Этап | Работа | Условие открытия |
|---|---|---|
| 1 | 24 страны/территории | Открыт; начать пилотом 3–5 |
| 2 | Опубликованные места | После успешного пилотного deploy и HTML-проверки |
| 3 | Активные туры | После проверки 10 мест разных типов и трансграничных случаев |
| 4 | Активные экскурсии | После корректных маршрутов пилотных туров |
| 5 | 6 семейств шаблонов | Паспорта/маршруты прошли QA |
| 6 | Article и Service связи | Проверка конкретных опубликованных страниц |

Мастер открывает следующий maxStage в staging CAS-коммитом с ссылкой на доказательства gate. Это не новая команда подтверждения пользователю. Сборщики не обязаны ждать деплоя каждого соседа внутри уже открытого этапа.

## 6. Обновление очереди и история

После изменения стран, мест, туров, архива, source-index или структуры каталогов мастер берет свежий main и текущее staging-состояние. В полном checkout с обычными зависимостями:

```bash
node scripts/refresh-geo-source-inventory.mjs
node scripts/sync-geo-knowledge-queue.mjs --write
node scripts/check-geo-knowledge.mjs
```

Снимок читает актуальный MD (stable ID/status) и вычисляет Git blob SHA, каталог дает закрепленный canonical URL. Обычный контракт проекта требует синхронного обновления MD и source-index. Несовпадение ID — ошибка, не повод придумывать адрес. Перед записью сверить текущий routes.ts для затронутых URL.
Скрипт очереди объединяет новые определения по jobId и сохраняет историю исчезнувших. Измененный sourceFingerprint переводит имеющуюся работу в STALE и снимает ее lease; payload остается. STALE возвращать в QUEUED только адресной CAS-операцией после проверки нового источника; PUBLISHING/DEPLOYING сначала согласовать с релизом, не сбрасывать. Копировать в staging только обновленные определения/состояние с CAS; не заменять main/ветку целиком.

## 7. Схема таблицы

GEO очередь: Job ID · Этап · Порядок · Тип · Stable ID · URL · Название · Статус · Worker ID · Claim token · Начало UTC · До UTC · Попытка · Result hash · Result URI · Завершено UTC · Комментарий.

GEO результаты: Job ID · Claim token · Статус · Payload URI · SHA-256 · Sources count · Verified UTC · Worker ID · Review note · Source fingerprint.

GEO публикации: Batch ID · Job IDs · Commit SHA · CI URL · Состояние · Начало UTC · Опубликовано UTC · Мастер · Примечание.

Пустой лист результатов после развертывания — честное состояние: факты еще не собраны. Инфраструктурная запись в журнале имеет INFRASTRUCTURE_READY, а не PUBLISHED и не свидетельствует о deploy сайта.

## 8. Измерение результата

До первой production-партии снять baseline фактического HTML: доля Country/Place с подтвержденным QID/geo/map, ошибки и полнота разрешения ссылок, число REVIEW, маршрутные ссылки. После пилота сравнить тот же набор URL и производительность. BMR — отдельный эксперимент; данная работа не доказывает причинное улучшение ответов нейросетей. Для BrandFound действует `gaeo-ru/brandfound-runner` и его актуальный README; сбор географии сам по себе платные замеры не запускает.


## 9. Дополнения к уже подготовленным/публикуемым паспортам

Явное поручение дополнить поле уже собранного паспорта оформляется отдельной задачей с тем же stableId/kind/canonical URL и суффиксом области работы, например `geo-country-country_brazil-coordinates`. Поля определения: `amendmentOf` (исходный jobId), `reworkScope: coordinates`, `baseResultHash`. Результат — полный новый валидный паспорт, не фрагмент; первоначальный неизменяемый JSON сохраняется. У дополнения собственный резерв и статус, свежий sourceFingerprint наследуется от исходного объекта. Идемпотентная сверка очереди сохраняет такие задачи; смена исходного MD переводит старый результат дополнения в STALE.

Если исходная задача уже PUBLISHING/DEPLOYING, не менять закрепленный publication.jobs/resultHash. Дополнение становится READY отдельной строкой и попадает в следующий проход мастера после завершения текущего batch. Публичный паспорт по-прежнему один на stableId: мастер переносит новую полную версию в существующий `entities/<stableId>.json`, не создает дублирующий Place/Country. Сборщик не меняет main entities или чужой publication lock.

Для площадных объектов допускается `pointRole: representative`: точка точной карточки GeoNames в WGS84 с доказательством принадлежности нужной территории из независимого источника. Это осознанно выбранная опорная точка, без утверждения о единственном географическом центре. Расхождения с P625/центроидами записываются в историю и не усредняются. Проверка попадания в полигон Natural Earth на масштабе 1:110m подтверждает только принадлежность территории; она не доказывает точность координат, административный статус или туристическую доступность.
