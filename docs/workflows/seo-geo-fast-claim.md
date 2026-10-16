# Ada Tours — быстрый атомарный резерв пяти SEO/GEO-статей

Версия 1.4 · 16.10.2026. Рабочий код для команды **«пиши SEO»**. Запускать одним вызовом `functions.exec`.

Вначале на одном SHA staging читаются `claims.json`, компактный каталог blob SHA и этап 05. Этапы 01–04 пропускаются при неизмененных подтвержденных SHA; при изменении читаются и вновь участвуют в очереди. Если на этапе 05 осталось меньше пяти свободных задач, сразу добрать их из 06, затем 07. **Не ждать чужих резервов.** Внутри этапа `draft` без чужой действующей аренды имеет приоритет перед `queued`. Каждый новый запуск снова начинает с ранней доступной фазы.

**Быстрое резервирование:** одна запись **только `data/seo-geo/claims.json`** через `GitHub.update_file` с ожидаемым blob SHA этого файла. Не переписывать мегабайтный `05-tours.json`, не делать отдельные `create_tree`/`create_commit`/`update_ref`: обычные коммиты других авторов не должны конфликтовать с самим резервом. При изменении `claims.json` повторить чтение и выбор не более двух раз. Для неопределенного ответа проверить собственные токены на удаленной ветке, не резервировать вслепую.

`work: queued` с **собственным действующим claim** уже означает «Пишется». При резерве менять статус в фазовом JSON не нужно; при готовой статье одним CAS content-коммитом записать `approved` MD, `work: prepared`, `articlePath` и снять **только свой claim**. Старые чаты с одновременным переводом `draft` и записью claim остаются совместимыми. Claims другого владельца не изменять; отдельную ветку или новую систему резервов не создавать.

Пакет: **до пяти статей**. Аренда каждого URL: **90 минут**, с продлением во время длительного написания; общего ограничения на время подготовки пяти статей нет. После подтвержденного `reserved` немедленно писать первую статью. Проверка Google Sheets, `main`, Actions, исторических коммитов и соседних статей в захват не входит. При `Too many requests` не считать резерв успешным, а повторить только быстрый вызов после восстановления доступа.

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

async function fastClaimSeoBatch({ dryRun = false } = {}) {
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
  const ownerId = `seo-fast-${new Date().toISOString().replace(/\W/g,"")}-${Math.random().toString(36).slice(2,10)}`;
  const batchId = `seo-batch-${ownerId}`;
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
    if (claimFile.claimTimeoutMinutes !== 90 || claimFile.writerBatchSize !== 5)
      throw new Error("SEO/GEO staging settings must be 5 articles / 90 minutes");
    const fileShas = new Map(JSON.parse(directory.result.content).map(row => [row.name, row.sha]));
    const now = Date.now();
    const picked = [];
    const checkedPhases = [];
    const skippedPublished = [];
    const size = 5;
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
      status:"empty", head, checkedPhases, skippedPublished,
      elapsedMs:Date.now()-begun
    };
    const selected = picked.map(({record,phase})=>({
      phase,order:record.order,url:record.url,previousWork:record.work,
      articlePath:record.articlePath||null
    }));
    if (dryRun) return {
      status:"dry_run",head,selected,checkedPhases,skippedPublished,
      elapsedMs:Date.now()-begun
    };
    const stamp = new Date(now).toISOString();
    const expiresAt = new Date(now + 90*60*1000).toISOString();
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
      return {status:"reserved",commit:written.commit_sha,selected,
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
        return {status:"reserved",verifiedAtHead:observedHead,selected,
          checkedPhases,skippedPublished,elapsedMs:Date.now()-begun};
      if (/too many requests|rate limit|resource.exhausted/i.test(String(error)))
        throw error;
      if (attempt === 2) throw new Error(`Claim SHA contention: ${String(error)}`);
    }
  }
}

text(JSON.stringify(await fastClaimSeoBatch()));
```

Для диагностики без записи использовать `fastClaimSeoBatch({dryRun:true})` вместо обычного вызова. `selected[].phase` и `checkedPhases` показывают этапы, `elapsedMs` — только инструментальное время.
