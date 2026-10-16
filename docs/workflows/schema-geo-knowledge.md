# Ada Tours — Schema.org / GEO: сбор данных и публикация

Версия 2.0 · 16.10.2026. Репозиторий `alexyakovlev79/adatours.ru`.
Команды: **«собирай данные»** (один сборщик) и **«публикуй данные»** (единственный мастер).

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
| `data/geo-knowledge/manifest.json` | 90 минут, размер пачки, открытый этап, Sheet IDs, gate пилота |
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
const un = r => { if (r.isError) throw Error(JSON.stringify(r)); return r.structuredContent || r.result || r; };
const head = JSON.parse(un(await tools.mcp__codex_apps__github_fetch({url:`https://api.github.com/repos/${repo}/git/ref/heads/main`})).content).object.sha;
async function code(path) {
  const f=un(await tools.mcp__codex_apps__github_fetch_file({repository_full_name:repo,path,ref:head}));
  return f.content || un(await tools.mcp__codex_apps__github_fetch_blob({repository_full_name:repo,blob_sha:f.sha})).content;
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
const r=await run(tools,core,{action:'claim',ownerId:load('geoOwner'),token:load('geoToken'),limit:5});
store('geoClaim',r);
text(r);
```

Первый пилот можно взять `limit:3`. Сессия берет **одну пачку**, до пяти задач, одного этапа. Успешный ответ: `status: saved`, commit SHA и список `output` с lease. Только после него приступать к исследованию. Сохранять owner/token и возвращенный commit. Если ответ потерян, **повторить тот же owner/token**, не создавать новые. `empty_or_gated` означает отсутствие доступной пачки в открытых этапах; не расширять maxStage самостоятельно.

### 3.2. Исследование

1. Открыть точный contentPath/entryPath в текущем main; сверить stable ID, canonical URL, страну, тип и активность. Старые названия и перенаправления не считаются новой сущностью. Наличие MD в исходном срезе — не гарантия текущего опубликованного HTML; перед READY проверить точный URL и статус.
2. Для Country/Destination искать точные внешние географические идентичности. Для Tour/Excursion проверять порядок посещений и ссылки на существующие места по программе, без поиска «sameAs туристического продукта». Для шаблона проверять один renderer и репрезентативные URL из coverage.json, не исследовать каждый каталог отдельно.
3. Сохранять evidence для **каждого** внешнего поля. Имя, страна и класс объекта должны совпасть. Для координат — источник, назначение точки и независимая сверка. Не усреднять конфликтующие координаты. Неподтвержденное → REVIEW/BLOCKED с объяснением.
4. Составные редакционные места, город и регион, парк и водопад, стороны Игуасу — отдельные случаи. Не назначать составному объекту QID одной части. Не менять существующие stable ID/URL для удобства внешнего соответствия.
5. Результат v2: schemaVersion, jobId, stableId, kind, canonicalPath, sourceFingerprint из claim; status READY/REVIEW/BLOCKED; external, location, relationships по смыслу; evidence, confidence, reviewNote. Полная схема — `result.schema.json`. Schema.org `@id`/`@type` и публичный JSON-LD сборщик не пишет.

Основные источники: Wikidata (QID, P625/P17/P131), точная Wikipedia, OSM (node/way/relation + ID), GeoNames, национальные геослужбы, официальные сайты парков/музеев. UNESCO/WDPA только для точно того же объекта/границ. Официальный туристический портал города может быть источником, но не автоматически sameAs города. Поисковая выдача и страница неоднозначностей — не точная идентичность. Правила въезда, здоровье, цены и графики этой геопрограммой не собираются; при отдельной задаче проверяются актуальные официальные источники.

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

## 4. «Публикуй данные»: единственный мастер

1. `action:'beginPublication', batchId, ownerId, limit:20` атомарно фиксирует точные result hashes. Другая публикация запрещена до разрешения этой. При остановке продолжить **тот же batchId/ownerId**. Старый PUBLISHING/DEPLOYING нельзя просто снять по таймеру: commit мог уже попасть в main.
2. На фиксированном SHA staging прочитать resultPath, проверить hash, активную сущность и свежий contentBlobSHA main. Запустить `node --test tests/schema-geo-knowledge.test.mjs` и `node scripts/check-geo-knowledge.mjs`. REVIEW/BLOCKED/STALE/UNAVAILABLE не включать. Межсущностные проверки: коллизии QID, тип, страна, циклы containedInPlace, существующие targets, itinerary только подтвержденные посещения и правильный порядок.
3. При первой реальной партии создать адаптер `geo-knowledge` в существующий renderer, с fixture/HTML-тестами. Публичный паспорт содержит только проверенные утверждения и provenance; не owner/token. `recordId` остается действующим: `#country`, `#place`, `#tour`, `#excursion`, `#topic`. Antarctica — Place, French Guiana — административная территория Франции, а не самостоятельное государство. Никакого массового расширения sameAs компании или изменения текущего EN-реестра.
4. Дополнения рендерить на подходящем узле существующего `@graph`; не создавать второй Country/Place с другим ID. Schema.org domain/range проверять по официальному словарю. `sameAs` только точная сущность; `identifier` — внешние ID; `hasMap` — карта; `subjectOf` — материал об объекте. Нельзя объявлять любой официальный URL sameAs. Координаты только GeoCoordinates с установленной ролью точки в provenance. Собственные вымышленные поля в JSON-LD не добавлять.
5. На **текущем** main собрать адресный tree/commit только production-паспортов/адаптера/тестов и `releases/<batchId>.json`. В receipt: `{schemaVersion:2,batchId,jobs:[...точный массив state.publication.jobs...]}`. Не merge всей staging-ветки и не переносить state, results и чужие SEO-статьи. Перед commit еще раз проверить hashes/свежесть. CAS main, без force. При конфликте — перечитать main и пересобрать адресный патч.
6. После подтвержденного main SHA вызвать `action:'recordCommit', batchId, ownerId, commit`. Диспетчер проверит release receipt, список hashes и принадлежность SHA main; статус DEPLOYING. В случае потери ответа main-коммита сначала найти release receipt в main, восстановить его SHA, **не делать повторный commit**.
7. Дождаться одного штатного build/deploy. Подтвердить успешный `.github/workflows/deploy.yml` **для этого SHA**. `action:'confirmDeploy', batchId,ownerId,commit,runId` перепроверяет run через GitHub и лишь тогда ставит PUBLISHED. Если CI упал, сохранить DEPLOYING, устранить адресный сбой/согласовать новый receipt, не выдавать данные за опубликованные.
8. Обновить обе строки зеркала (очередь/результат) и журнал публикаций из подтвержденного state. Не публиковать служебные JSON в public/.

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
