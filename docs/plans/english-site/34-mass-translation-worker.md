# ADA Tours EN — массовый переводчик: инструкция работника

Стадия: Word 2027, затем Word 2026, затем AI-only. Репозиторий alexyakovlev79/adatours.ru.
Единственная новая очередь: ветка i18n/translation-mass-staging,
data/i18n/translation-mass/v2. Полный сайт на EN staging остается
noindex; новые тексты не попадают на него до отдельной одобренной
интеграции Astro.

## Чтение состояний через подключенный GitHub

В Code Mode прочитать из одного main SHA:
scripts/i18n/translation-mass-core.mjs и
scripts/i18n/translation-mass-remote.mjs. Возвращаемый чистый
core содержит massShard, massIndexShard, massClaim, massReap,
massRenew, massCheckpoint, massSubmit, massRelease, massFail,
massRebuildIndex, validateMassResult.

```javascript
const repo='alexyakovlev79/adatours.ru';
const un=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r;};
const head=JSON.parse(un(await tools.mcp__GitHub__fetch({url:
 'https://api.github.com/repos/'+repo+'/git/ref/heads/main'})).content).object.sha;
const get=async p=>un(await tools.mcp__GitHub__fetch_file({
 repository_full_name:repo,path:p,ref:head})).content;
const [coreSource,remoteSource]=await Promise.all([
 get('scripts/i18n/translation-mass-core.mjs'),
 get('scripts/i18n/translation-mass-remote.mjs')]);
const core=new Function(coreSource.replace(/^export /gm,'')+';return {massShard,massIndexShard,massReap,massClaim,massRenew,massCheckpoint,massSubmit,massApprove,massRelease,massFail,massRebuildIndex,validateMassResult};')();
const run=new Function(remoteSource.replace(/^export /gm,'')+';return runEnMassTranslation;')();
const status=await run(tools,core,{action:'status'});
text(status);
```

Если gate закрыт, работник не включает его сам и не захватывает
задачи. Ожидаются dispatcherEnabled=true и
translationMassLaunchAllowed=true при publicationEnabled=false.

Перед первым claim один раз назначить текущему чату ownerId и token,
вывести их в рабочем checkpoint; повторять точно те же значения
при неопределенном ответе. Для нового запуска по команде пользователя автоматический лимит —
**10 последовательно сохранённых пакетов в одном чате** (до 8 блоков в пакете).
Предыдущий технический предел maxJobsPerOwner=60 в состоянии очереди —
верхняя защита диспетчера, а не команда выполнять 60 пакетов за этот запуск.
Не останавливаться из-за завершения первого Tour, но и не захватывать
несколько будущих пакетов заранее. После подтверждённого submit CAS
агент получает следующий claim через автоматический worker-cycle.
Готовность независимого QA при этом не требуется для захвата следующего.

## Работа по одному пакету

1. claim с постоянным ownerId/token. source из ответа содержит
   до 8 точных блоков, текущий RU Git blob SHA, stableId, stage,
   sourceFingerprint и при необходимости Word fileId/SHA.
2. Word-first: прочитать точный DOCX по Google Drive connector.
   Проверить sourceSha256, modifiedTime/edition/folder, OOXML
   paragraphs и коммерческие таблицы. Сохранять собственные
   английские формулировки Word, не переписывая их ради красоты.
   Для части, которой реально нет в Word, перевести текущий RU
   без выдуманных фактов; provenance=ai_translation с
   wordAbsenceReason. В AI-only не искать похожий Word заново.
   **Обязательное решение владельца от 03.11.2026:** в RU-derived
   блоках Tour и самостоятельных Excursion язык оказания услуги
   «на русском языке» / «русскоговорящий» / «русский гид» передавать как
   `English` / `English-speaking guide` и соответствующие естественные
   EN-формулировки. Правило не действует на дословный утверждённый
   Word 2027-блок и на гражданство, визы, культуру, личность и названия.
   Точные примеры, обработка Word 2026 и provenance — §4.1
   `docs/plans/english-site/03-translation-editorial.md`.
3. Не изменять цену, валюту, отель, количество дней,
   опубликованный русский Tour MD, общий Hero или медиа.
   Точное изменение Word 2027 тарифа передать отдельным
   structured price amendment мастеру (валюта, occupancy, basis).
4. Каждый EN блок получает точный blockId/field, sourceTextSha256,
   text без кириллицы и provenance (word_exact с фактическими
   paragraphs/hash либо ai_translation с моделью, runId и причиной).
   Итог: {jobId,stableId,locale:'en',status:'review',
   releaseEligible:false,sourceFingerprint,blocks:[]}.
5. Каждые 4 готовых блока сохранять checkpoint. Renew каждые
   20 минут до истечения 90-минутного lease.
6. submit с устойчивым submissionId. При потерянном ответе
   повторять тот же payload, а не создавать новую запись.
   Успех означает saved_for_review, НЕ опубликовано.
7. Нельзя самостоятельно делать QA собственного пакета.
   Независимый reviewer читает точный immutable result
   и сверяет Word, смысл, факты, голос Ada Tours, структуру
   и связи. QA API: scripts/i18n/translation-mass-qa.mjs.
   В смысловую QA входит проверка специального правила языка
   гида/экскурсии: в RU-derived частях `Russian-speaking` не
   сохраняется, в дословных Word 2027-блоках ничего не подменяется;
   `Russian` о гражданстве, России или культуре не считается ошибкой.
8. Если Word или Drive недоступен, помечать blocked_external
   (не фантазировать исходник). При изменении RU — stale_source.
   При 429 уважать Retry-After и не делать горячие повторы.

## Восстановление и границы

GitHub Actions i18n-mass-reaper.yml возвращает истекшие leases
и eligible retries по cron с fencing. Результат ready имеет
immutable receipt и пока только staging-статус. Публикует
отдельный мастер после согласования full-site Astro locale
adapter, Word 2027 цен и QA блоков.

358 matching работ не повторять. 5 устаревших Tour
фиксировать и адресно обновить их block maps. 30 ранее
проверенных пилотных блоков из общего списка исключены.
348 самостоятельных Excursion требуют собственных задач,
повторяющиеся в разных турах refs не переводятся повторно.

## Автоматические 10 циклов одного переводчика (03.11.2026)

Точка запуска — `scripts/i18n/translation-mass-worker-cycle.mjs`.
Она использует **тот же** `runEnMassTranslation` и те же CAS-shards,
не создаёт вторую очередь. `start` читает собственное подтверждённое
число `completedJobIds` из staging и захватывает ровно один пакет.
`finish` сначала делает `submit` и ждёт `saved_for_review` или
`already_saved` с Git receipt. Только после этого проверяет счётчик
и в **том же вызове** захватывает следующий пакет; после 10 сданных
пакетов возвращает `cycle_limit_reached` без нового захвата.

Сам перевод между `start/finish` выполняет агент ChatGPT, используя
доказательства Word или RU, checkpoint через каждые четыре готовых
блока и renew через 20 минут. Скрипт **не** вызывает модель, не пишет
за неё английский текст и не делает независимый QA за автора.

В Code Mode один раз закрепить SHA main и загрузить три файла:
`translation-mass-core.mjs`, `translation-mass-remote.mjs` и
`translation-mass-worker-cycle.mjs`. Использовать один уникальный
`ownerId` и `token` на чат, не создавать новую пару на каждом пакете.
Первая операция: `cycle(tools,core,run,{action:'start',ownerId,token})`.
Получив `next.source`, перевести все его блоки и вызвать
`cycle(tools,core,run,{action:'finish',ownerId,token,jobId,generation,
 submissionId,result})`.
`finish` возвращает `next.source` следующего пакета — сразу
переходить к нему без дополнительной команды пользователя.
На `cycle_limit_reached`, `next_unavailable`, `next_blocked` или
`submit_not_confirmed` остановиться и сообщить статус.

Если GitHub подтвердил `submit`, но следующий `claim` не удался,
`submitted_next_pending` содержит подтверждённый receipt: вызывать
`start` с тем же owner/token, а не делать новый submit. При
неопределённом ответе самого `finish` повторять **исходный**
`submissionId` и тот же неизменный результат. На `already_saved`
повторный claim возобновляет прежний активный lease, не создаёт дубль.
При `rate_limited` уважать ограничения и не запускать горячие повторы.

Отдельная команда для запуска одного работника:

> Рой ADA EN: запусти одного переводчика на 10 последовательных пакетов.
> Прочитай актуальные `docs/plans/english-site/34-mass-translation-worker.md`
> и `docs/plans/english-site/33-mass-translation-queue.md` из `main`
> репозитория `alexyakovlev79/adatours.ru`. Используй
> `scripts/i18n/translation-mass-worker-cycle.mjs`: `start`, затем
> `finish` с автоматическим захватом следующего пакета после каждого
> подтверждённого коммита. Всего до 10 сдач в staging без ожидания
> моего «дальше». Сохраняй ownerId/token и submissionId для восстановления,
> продлевай lease, ставь checkpoints. Не меняй `main`, RU, цены, медиа,
> публикацию и очередь сопоставления; не одобряй сам свои переводы.
> В конце отчитайся о 10 сохранённых пакетах или точной причине остановки.

## Защита от CAS-конфликтов (03.11.2026)

Новые checkpoint записываются атомарным обновлением только точного
`data/i18n/translation-mass/v2/state/<shard>.json` через GitHub Contents
с ожидаемым blob SHA. В состоянии пакета сохраняются полный EN draft,
`checkpointId`, `ownerId`, `token` и `generation`. Повтор того же
контрольного снимка возвращает `already_saved`. Общий `index.json`
при checkpoint не меняется. Прежние checkpoint с отдельным Git blob
остаются действительными. После подтвержденного `submit` полный текст
уже хранится в immutable result, поэтому объемная копия draft в сегменте
удаляется, но ID/время checkpoint сохраняются.

`claim` распределяет работников между доступными сегментами по
`ownerId`; `submit`, `renew` и `release` продолжают использовать
атомарную запись общего индекса и сегмента. CAS теперь имеет до
8 попыток с ограниченной случайной задержкой. Внешний
`worker-cycle` еще раз пробует точно тот же вызов при
`cas_contention`, не меняя `submissionId` или `ownerId/token`.
`rate_limited` не запускает немедленный повтор. При дальнейшей
конкуренции сохраняется `cas_contention` (retryable) — продолжать
только ту же операцию с теми же идентификаторами после паузы.

Повтор подтвержденного `release` возвращает `already_released`,
а `fail` — `already_failed`, без второго перехода или увеличения
числа попыток. Действующие чужие leases не освобождать от имени
другого работника. После обрыва `start` с прежними идентификаторами
возвращает `checkpoint` текущего пакета, если он существует.

### Автоматическое восстановление своего незавершенного пакета

При `start` диспетчер сообщает `resumeCandidateJobId` из подтвержденной
истории `ownerAssignments`. Если прежняя задача была освобождена или ее
lease истек, `worker-cycle` вначале пытается атомарно захватить **тот же**
незавершенный `jobId` с прежними `ownerId/token`, получает новую
`generation` и возвращает прежний `checkpoint` (встроенный `payload`
или ссылку на старый blob). Не переводить сохраненные блоки повторно.
Если пакет уже захватил другой переводчик или RU устарел, разрешено
перейти к обычному следующему пакету, не перезаписывая чужой результат.
