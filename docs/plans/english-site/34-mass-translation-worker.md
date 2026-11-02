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
при неопределенном ответе. После каждого полного submit брать
следующий job в пределах 60 пакетов в одном чате. Не останавливаться
из-за достигнутых 3 Tour, но не резервировать будущую цепочку заранее.

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
