# Ada Tours — быстрый атомарный резерв тройки SEO/GEO-статей

Версия 1.5 · 17.10.2026. Исполняемый код **одного цикла** команды «пиши SEO»; общий процесс — §8 `docs/workflows/seo-geo-registry.md`.

Один авторский чат выполняет **до 10 циклов по максимум 3 статьи**. Перед каждой тройкой вызывается этот код один раз, затем пишутся все статьи и делается **один content-коммит на тройку** (MD + provenance + `prepared` в реестре + удаление своих claims), затем однократная пакетная запись J/K/M в лист «SEO-GEO тексты». **Только после этого** резервируется следующая тройка, без команды «дальше». Этот код выполняет **только резерв**, не пишет статьи, не коммитит готовый контент и не обновляет Sheets.

Новый claim действует **60 минут**; долгие работы продлевают только собственные действующие claims через CAS, не переписывая сроки старых 90-минутных резервов других авторов. Выбираются свободные/истекшие `draft`, затем `queued` по `order` внутри фазы; 01–04 проверяются по известным blob SHA, выбор продолжается 05 → 06 → 07. `prepared`/`published`, архив, временно недоступные URL и чужие действующие claims не участвуют. Резерв затрагивает **только `data/seo-geo/claims.json`**: один `GitHub.update_file` с ожидаемым blob SHA; максимум два CAS-повтора. Не менять фазовые JSON при резервировании и не делать Git tree/commit вручную для claim.

`runId` создается **один раз на авторский чат** (код вернет его после первого вызова), `cycle` меняется от 1 до 10. Для следующих циклов вызвать `fastClaimSeoBatch({runId:"<первый runId>",cycle:2})`, затем 3 и так далее. При неопределенном ответе **повторить тот же runId и cycle**, сначала проверить собственные `ownerId`/`batchId` в удаленных claims. Прежний живой claim этого цикла возвращается как `resumed`, не создавая еще три резерва. После завершенного content-коммита не вызывать снова тот же номер цикла: сначала проверить remote SHA и статус своей тройки. При `empty` остановить работу досрочно; при `lease_expired` не заявлять владение URL. Ни `main`, ни Google Sheets, ни Actions при захвате не читать.

```javascript
function selectSeoRows(file, claims, now, limit) {
  return (file.entries || []).filter(record => {
    if (!["draft", "queued"].includes(record.work) ||
        ["temporarily_unavailable","missing","archived"].includes(record.availability) ||
        typeof record.url !== "string") return false;
    const lock = claims[record.url];
    if (!lock) return true;
    const until = Date.parse(lock.expiresAt);
    return Number.isFinite(until) && until <= now;
  }).sort((a, b) =>
    (a.work === "draft" ? 0 : 1) - (b.work === "draft" ? 0 : 1) ||
    a.order - b.order
  ).slice(0, limit);
}

async function fastClaimSeoBatch({ dryRun = false, runId, cycle = 1 } = {}) {
  const repository = "alexyakovlev79/adatours.ru";
  const branch = "seo-geo/staging";
  const api = `https://api.github.com/repos/${repository}`;
  const phases = ["01-countries","02-interests","03-country-interest","04-country-interest-vip",
    "05-tours","06-places","07-excursions"];
  const publishedShas = {
    "01-countries": "bafbac4f4fdb06261fe8f798f8055fa937332cb5",
    "02-interests": "49447fbe7bebc8268c23b647ba5f3ded3ce2a128",
    "03-country-interest": "78e85e281f7ea9bce57dc3288aefd35bd25555d1",
    "04-country-interest-vip": "ec81400cbfca4168db5f03fdb46730e860cdf028"
  };
  const begun = Date.now();
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > 10)
    throw new Error("SEO/GEO cycle must be an integer from 1 to 10");
  const resolvedRunId = runId || `seo-run-${new Date().toISOString().replace(/\W/g,"")}-${Math.random().toString(36).slice(2,10)}`;
  if (!/^[a-zA-Z0-9_-]{8,95}$/.test(resolvedRunId))
    throw new Error("Invalid SEO/GEO runId");
  const ownerId = `seo-trio-${resolvedRunId}`;
  const batchId = `seo-batch-${resolvedRunId}-c${cycle}`;
  const getHead = async () => JSON.parse((await tools.mcp__GitHub__fetch({
    url: `${api}/git/ref/heads/${branch}`
  })).result.content).object.sha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const head = await getHead();
    const registryPath = name => `data/seo-geo/registry/${name}.json`;
    const readJson = async path => {
      const f = (await tools.mcp__GitHub__fetch_file({
        repository_full_name: repository, path, ref: head
      })).result;
      const parsed = JSON.parse(f.content || (await tools.mcp__GitHub__fetch_blob({
        repository_full_name: repository, blob_sha: f.sha
      })).result.content);
      if (path === "data/seo-geo/claims.json")
        Object.defineProperty(parsed, "__blobSha", {value: f.sha, enumerable: false});
      return parsed;
    };
    const [claimFile, directory, phase05] = await Promise.all([
      readJson("data/seo-geo/claims.json"),
      tools.mcp__GitHub__fetch({ url: `${api}/contents/data/seo-geo/registry?ref=${head}` }),
      readJson(registryPath("05-tours"))
    ]);
    if (claimFile.claimTimeoutMinutes !== 60 || claimFile.writerBatchSize !== 3)
      throw new Error("SEO/GEO staging settings must be 3 articles / 60 minutes");
    const fileShas = new Map(JSON.parse(directory.result.content).map(row => [row.name, row.sha]));
    const now = Date.now();
    const mine = Object.entries(claimFile.claims || {}).filter(([, lease]) =>
      lease.ownerId === ownerId && lease.batchId === batchId);
    if (mine.length) {
      const expired = mine.filter(([, lease]) =>
        !Number.isFinite(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= now);
      if (expired.length) return {status:"lease_expired",runId:resolvedRunId,cycle,
        ownerId,batchId,urls:expired.map(([url])=>url),head};
      return {status:"resumed",runId:resolvedRunId,cycle,ownerId,batchId,head,
        selected:mine.map(([url,lease])=>({url,order:lease.order,
          expiresAt:lease.expiresAt,generation:lease.generation})),
        elapsedMs:Date.now()-begun};
    }
    const unfinished = Object.values(claimFile.claims || {}).some(lease =>
      lease.ownerId === ownerId && lease.batchId !== batchId &&
      Date.parse(lease.expiresAt) > now);
    if (unfinished) return {status:"previous_cycle_incomplete",
      runId:resolvedRunId,cycle,ownerId,head};
    const picked = [];
    const checkedPhases = [];
    const skippedPublished = [];
    const size = 3;
    for (const name of phases) {
      if (picked.length === size) break;
      const sha = fileShas.get(`${name}.json`);
      if (!sha) throw new Error(`Missing SEO phase: ${name}`);
      if (publishedShas[name] === sha) {
        skippedPublished.push(name);
        continue;
      }
      const phase = Number(name.slice(0,2));
      const file = name === "05-tours" ? phase05 : await readJson(registryPath(name));
      checkedPhases.push(phase);
      const candidates = selectSeoRows(file, claimFile.claims, now, size - picked.length);
      if (!candidates.length) continue;
      for (const record of candidates) picked.push({record, phase});
    }
    if (!picked.length) return {
      status:"empty", runId:resolvedRunId, cycle, head, checkedPhases, skippedPublished,
      elapsedMs:Date.now()-begun
    };
    const selected = picked.map(({record,phase})=>({
      phase,order:record.order,url:record.url,previousWork:record.work,
      articlePath:record.articlePath||null
    }));
    if (dryRun) return {
      status:"dry_run",runId:resolvedRunId,cycle,head,selected,checkedPhases,skippedPublished,
      elapsedMs:Date.now()-begun
    };
    const stamp = new Date(now).toISOString();
    const expiresAt = new Date(now + 60*60*1000).toISOString();
    for (const {record} of picked) {
      const old = claimFile.claims[record.url];
      // Ownership is recorded in claims; work stays queued until prepared.
      claimFile.claims[record.url] = {
        ownerId,batchId,order:record.order,claimedAt:stamp,
        lastHeartbeatAt:stamp,expiresAt,generation:(old?.generation||0)+1
      };
    }
    try {
      const written = (await tools.mcp__GitHub__update_file({
        repository_full_name: repository, path: "data/seo-geo/claims.json",
        branch, sha: claimFile.__blobSha,
        content: JSON.stringify(claimFile, null, 2) + "\n",
        message: `seo: reserve ${selected.map(x => x.order).join("-")} (claims CAS)`
      })).result;
      if (!written.commit_sha) throw new Error("No commit SHA returned");
      return {status:"reserved",runId:resolvedRunId,cycle,ownerId,batchId,commit:written.commit_sha,selected,
        checkedPhases,skippedPublished,elapsedMs:Date.now()-begun};
    } catch (error) {
      const observedHead = await getHead();
      const f = (await tools.mcp__GitHub__fetch_file({
        repository_full_name: repository, path:"data/seo-geo/claims.json",ref:observedHead
      })).result;
      const latest = JSON.parse(f.content || (await tools.mcp__GitHub__fetch_blob({
        repository_full_name:repository,blob_sha:f.sha
      })).result.content).claims;
      if (selected.every(x => latest[x.url]?.ownerId === ownerId &&
        latest[x.url]?.batchId === batchId))
        return {status:"reserved",runId:resolvedRunId,cycle,ownerId,batchId,verifiedAtHead:observedHead,selected,
          checkedPhases,skippedPublished,elapsedMs:Date.now()-begun};
      if (/too many requests|rate limit|resource.exhausted/i.test(String(error)))
        throw error;
      if (attempt === 2) throw new Error(`Claim SHA contention: ${String(error)}`);
    }
  }
}

// После первого ответа сохранить runId; для циклов 2–10 указать его и новый cycle.
text(JSON.stringify(await fastClaimSeoBatch({cycle:1})));
```

Для диагностики без записи использовать `fastClaimSeoBatch({dryRun:true,runId,cycle})`. `selected[].phase` и `checkedPhases` показывают этапы, `elapsedMs` — инструментальное время. `status: resumed` означает уже существующий собственный резерв этой тройки; `status: previous_cycle_incomplete` требует завершить прежнюю тройку.
