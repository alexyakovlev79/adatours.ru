# Рой ADA: сопоставление EN — инструкция для двух пилотных чатов
Дата: 29.10.2026. Репозиторий alexyakovlev79/adatours.ru.
Код: feat/english-site-foundation. Очередь: i18n/matching-staging.
Канонический приоритет: docs/workflows/english-site.md v1.1.

## Текущий режим
358 активных Tour, 16 сегментов состояния. В пилоте допускается до пяти
заданий, остальные 353 закрыты. Работают только ДВА чата, максимум 3 Tour
на чат. Перевод контента, массовый запуск, публикация и правка main запрещены.
Исполнитель не редактирует index.json, state/*.json и Tour MD напрямую.

Техническое основание: GitHub Actions #40833361987 (success, Node 24);
изолированная ветка i18n/matching-smoke-20261029 проверила реальную запись
CAS, claim, renew, checkpoint, duplicate checkpoint, release, expiration/reap,
fencing прежнего владельца и complete/duplicate complete. Smoke branch не
является производственной очередью. В pilot matching-staging хранит только
истинные результаты, полученные из фактических Word/действующего Tour.

## Точная команда каждого нового Work-чата
Рой ADA: сопоставление EN, пилот. Прочитай docs/workflows/english-site.md и
docs/plans/english-site/12-matching-pilot.md из feat/english-site-foundation.
Проверь status реального i18n/matching-staging: matchingEnabled=true,
pilotOnly=true, translationEnabled=false. Получи один CAS claim, сохрани
ownerId/token/generation. Для назначенного Tour сначала сравни английские
Word 2027 по маршруту, дням, длительности и услугам; только при отсутствии
подходящего 2027 переходи к 2026. Читай полный DOCX с таблицами и его
modifiedTime/SHA-256. Сохрани результат с доказательствами и dayAlignment.
Для уверенной программы 2027 новые цены записывай как структурированные
priceAmendments для мастера, без review отличий от старого RU.
Если Word нет в обоих годах, обоснуй отрицательное решение, включая
карантинные источники. Не переводи текст. Сдавай неизменный submissionId
через complete и переходи к следующему пилотному заданию до лимита.
Если ответ потерян, повторяй тот же submit; не захватывай новый пакет,
пока предыдущий не подтверждён. При отсутствии прав или данных фиксируй
конкретный блокер, не выдумывай совпадение. Не публикуй в main.

## Code Mode: подготовка и легкий статус
Выполнить один раз в новом чате:

~~~javascript
const repo='alexyakovlev79/adatours.ru';
const ref='feat/english-site-foundation';
const paths=['scripts/i18n/matching-core.mjs','scripts/i18n/matching-remote.mjs'];
const src=await Promise.all(paths.map(async path =>
  (await tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref})).result.content
));
store('adaMatchingCore',src[0]);store('adaMatchingRemote',src[1]);
store('adaMatchingOwner','ada-match-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
store('adaMatchingToken','lease-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
const core=new Function(src[0].replace(/^export /gm,'')+
 ';return {shardFor,pickShard,claimMatch,renewMatch,checkpointMatch,'+
 'completeMatch,failMatch,releaseMatch,rebuildIndex,reclaimExpired};')();
const run=new Function(src[1].replace(/^export /gm,'')+';return runEnMatching;')();
text(await run(tools,core,{action:'status'}));
~~~

Если status явно показал matchingEnabled:true и pilotOnly:true,
в отдельном следующем вызове:

~~~javascript
const core=new Function(load('adaMatchingCore').replace(/^export /gm,'')+
 ';return {shardFor,pickShard,claimMatch,renewMatch,checkpointMatch,'+
 'completeMatch,failMatch,releaseMatch,rebuildIndex,reclaimExpired};')();
const run=new Function(load('adaMatchingRemote').replace(/^export /gm,'')+';return runEnMatching;')();
const r=await run(tools,core,{action:'claim',ownerId:load('adaMatchingOwner'),
 token:load('adaMatchingToken')});
if(r.job)store('adaMatchingClaim',r);
text(r);
~~~

## Контракт submit
Результат: entityId, sourceFingerprint (ТОЧНО из job),
outcome=selected_2027 / selected_2026 / not_found_both, evidence (минимум
две содержательные строки). Для selected нужен selectedSource:
driveFileId, sourceYearFolder, sourceSha256 (64 hex фактического DOCX),
modifiedTime (ISO), dayAlignment [{day,sourceRef}] по XML. При selected_2026
checkedYears включает 2027. При not_found_both checkedYears=[2027,2026],
selectedSource=null, quarantinedCandidatesChecked=true. Новые тарифы Word
2027 находятся в priceAmendments [{amount,currency,priceBasis,sourceLocator,
...actual conditions}]; их применит координирующий мастер к общей цене RU/EN,
сразу по уверенной идентичности, без ручного review.

~~~javascript
const claim=load('adaMatchingClaim');
const core=new Function(load('adaMatchingCore').replace(/^export /gm,'')+
 ';return {shardFor,pickShard,claimMatch,renewMatch,checkpointMatch,'+
 'completeMatch,failMatch,releaseMatch,rebuildIndex,reclaimExpired};')();
const run=new Function(load('adaMatchingRemote').replace(/^export /gm,'')+';return runEnMatching;')();
// result is constructed separately from the REAL DOCX and claimed job.
const submissionId='submission-'+claim.jobId.replace(':','-')+'-'+claim.generation;
const saved=await run(tools,core,{action:'complete',jobId:claim.jobId,
 ownerId:load('adaMatchingOwner'),token:load('adaMatchingToken'),
 generation:claim.generation,submissionId,result});
text(saved);
~~~

saved / already_saved — единственные подтверждения результата.
При технической паузе допустимы renew, checkpoint, release и fail через
этот же run, передав exact jobId, ownerId, token, generation.
Не подставлять образцовые цены, вымышленные Word-анкоры или SHA.

## Границы готовности
Пилотный result означает подтверждение соответствия тура Word, но ещё НЕ
разрешение массового перевода: для него нужны полные sidecar block maps,
QA и отдельная очередь переводчиков. Автоматический GitHub Actions reaper
будет запускаться по расписанию только после merge workflow в default main.
До этого expired lease восстанавливается новым claim/reap; если все чаты
закрыты, исполнение само не возобновится. Это ограничение пилота.
