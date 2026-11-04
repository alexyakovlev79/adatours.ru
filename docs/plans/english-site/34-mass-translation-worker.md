# Ada Tours EN — массовый переводчик: простой цикл SEO/GEO

**Версия 04.11.2026.** Репозиторий `alexyakovlev79/adatours.ru`.
Действующая очередь: `i18n/translation-mass-staging`, каталог
`data/i18n/translation-mass/v2`. Эту очередь не пересоздавать.

## 1. Один переводчик = один последовательный цикл

Это тот же принцип, что у «пиши SEO» и «переписывай SEO»:

`claim → подготовить максимум 8 EN-блоков → submit одним атомарным коммитом → следующий claim`.

Один чат выполняет **до 10 подтвержденных пакетов** подряд без команды «дальше».
Ограничения на **количество одновременно работающих переводчиков НЕТ**:
число параллельных чатов определяет Алексей. Один чат держит не больше
одного пакета. Следующий пакет захватывается **только после**
`saved_for_review` или `already_saved` с подтвержденным Git-результатом.

`ownerId` и `token` неизменны в течение чата и при восстановлении.
`submissionId` для одной сдачи неизменен даже после потери ответа.
`generation` всегда берется из последнего подтвержденного claim.

Диспетчер — три файла текущего `main` на **одном SHA**:

- `scripts/i18n/translation-mass-core.mjs` — существующий автомат состояний;
- `scripts/i18n/translation-mass-remote.mjs` — CAS-адаптер GitHub;
- `scripts/i18n/translation-mass-worker-cycle.mjs` — `start` и `finish`.

Загрузка в Code Mode:

```javascript
const repo='alexyakovlev79/adatours.ru';
const un=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r};
const head=JSON.parse(un(await tools.mcp__GitHub__fetch({
 url:'https://api.github.com/repos/'+repo+'/git/ref/heads/main'
})).content).object.sha;
const get=async path=>un(await tools.mcp__GitHub__fetch_file({
 repository_full_name:repo,path,ref:head})).content;
const [a,b,c]=await Promise.all([
 get('scripts/i18n/translation-mass-core.mjs'),
 get('scripts/i18n/translation-mass-remote.mjs'),
 get('scripts/i18n/translation-mass-worker-cycle.mjs')
]);
const core=new Function(a.replace(/^export /gm,'')+
 ';return {massShard,massIndexShard,massReap,massClaim,massRenew,massCheckpoint,massSubmit,massRelease,massFail,massRebuildIndex,validateMassResult};')();
const remote=new Function(b.replace(/^export /gm,'')+
 ';return runEnMassTranslation;')();
const cycle=new Function(c.replace(/^export /gm,'')+
 ';return runEnMassWorkerCycle;')();
// ownerId/token присвоить один раз и сохранить в контексте текущего чата.
const first=await cycle(tools,core,remote,{action:'start',ownerId,token});
text(first);
```

Не вызывать `status` перед каждой пачкой: `start` уже читает единственный
нужный индекс и выдает ровно один подтвержденный пакет. После перевода:

```javascript
const next=await cycle(tools,core,remote,{
 action:'finish',ownerId,token,jobId,generation,submissionId,result
});
text(next);
```

`next.next.source` — исходники следующего пакета; продолжать сразу.
`cycle_limit_reached` — 10 пакетов завершены; `stage_drained` — в текущем
этапе больше нет ожидающих заданий. `next_unavailable` — нет доступного
задания в выбранном состоянии, **не доказательство**, что весь рой готов.

## 2. Предметная работа и достоверность

Приоритет этапов: точный английский **Word 2027**, затем **Word 2026**,
затем подтвержденный **AI-only**. Источники, соответствия Tour↔Word,
SHA и blockId уже закреплены в immutable job. Заново искать программы,
проверять все 358 совпадений и создавать вторую очередь нельзя.

Для Word-first взять точный Drive fileId, проверить версию/SHA и
коммерческие таблицы, сохранить утвержденные английские формулировки.
Фрагмент, действительно отсутствующий в Word, перевести с текущего RU
с `provenance: ai_translation` и конкретным `wordAbsenceReason`.
Для AI-only переводить закрепленные RU-блоки без выдумывания фактов.

У каждого EN-блока — те же `blockId`, `field`, `sourceTextSha256`,
проверяемое `provenance` и английский `text` без кириллицы.
Итог имеет `{jobId, stableId, locale:'en', status:'review',
releaseEligible:false, sourceFingerprint, blocks:[...]}`.
Проверка формата выполняется существующим `validateMassResult`.

В RU-derived Tour/Excursion описание языка обслуживания «русский гид» /
«на русском языке» передавать как `English-speaking guide` / `English`.
**Не заменять** дословный Word 2027 и упоминания гражданства, России,
культуры или названий. Подробности: `03-translation-editorial.md`, §4.1.

Цены, валюту, тарифную основу, отели, даты, длительность, маршрут,
RU-контент и медиа не менять. Изменение цен Word 2027 — отдельное
структурированное поручение мастеру.

## 3. Только один коммит с переводами на пакет, сбои и QA

**Перевести все назначенные блоки пакета (максимум 8) в памяти чата,**
затем вызвать единственный `finish/submit` с полным EN-результатом.
Отдельные абзацы и блоки в GitHub не сохранять. Промежуточная запись
после четвертого блока **отменена**: действие `checkpoint` больше не
допускается API переводчика. При обрыве чата незакоммиченные блоки можно
перевести заново; старые уже созданные checkpoint остаются читаемыми.

Обычный пакет дает **два Git-коммита**:
1. `claim` — один служебный резерв задания.
2. `submit` — весь перевод пакета, immutable result и освобождение резерва.

`renew` при действительно долгой работе продлевает аренду (90 минут)
отдельным служебным коммитом, но не сохраняет переводы. При CAS-конфликте
возможны ограниченные технические повторы, не дополнительные коммиты
с очередными абзацами. Никаких контрольных точек на 4-м блоке.

При `cas_contention`, `transport_retryable`, `rate_limited` не вызывать
`fail` и не освобождать перевод. Сохранить текущие `ownerId`, `token`,
`jobId`, `generation`, `submissionId`, `result` и точную операцию повтора.
**Нет** вложенных циклов из 8×12 запросов, фонового ожидания 30 минут
или постоянного опроса GitHub. `retry_pending` означает остановиться
до указанного `retryAfterMs`; повторить ту же операцию только после
паузы, не создавать новое задание. При истекшем lease пользоваться
штатным восстановлением `start`, не записывать под старой generation.

`submit` сохраняет EN-результат **только в staging** со статусом
`saved_for_review`. Работник сам себя не проверяет и не одобряет.
Независимый reviewer использует `translation-mass-qa.mjs`.
Публикует отдельный мастер после согласованной интеграции с EN Astro;
`publicationEnabled` остается `false`. GitHub Pages, основную ветку,
цены, русскую версию и matching не менять.

**Важное при обновлении кода:** ранее запущенные чаты со старой версией
скриптов не обновляются автоматически. Новые чаты читают все три
файла из одного нового SHA `main`.
