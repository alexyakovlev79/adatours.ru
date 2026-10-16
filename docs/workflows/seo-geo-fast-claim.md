# Ada Tours — быстрый атомарный резерв пяти SEO/GEO-статей

Версия 1.3 · 16.10.2026. Рабочий код для команды **«пиши SEO»**. Использовать **один вызов `functions.exec`** вместо последовательных ручных проверок.

1. Фазы 01–04 (277 уже опубликованных страниц) в обычном случае вообще не загружаются: сравниваются только четыре закрепленных blob SHA с метаданными каталога на текущем SHA `seo-geo/staging`. Если содержимое фазы изменилось, она автоматически вернется в отбор, чтобы новые страницы не потерялись.
2. Затем просматривается только `05-tours.json`. При менее чем пяти свободных `draft`/`queued` заданиях остаток добирается из `06-places.json` и `07-excursions.json` по очереди. Каждая новая пятерка снова начинает с первого доступного этапа. Внутри фазы свободные/просроченные `draft` приоритетнее `queued`; `prepared` и `published` не перехватываются.
3. Ровно одно атомарное резервирование: общий Git tree, один commit и CAS-обновление staging. Пишущий чат не проверяет `main`, Sheets, Actions и другие чаты до захвата. Не перезаписывать чужие резервы, не делать force. Срок — 90 минут, пакет — до 5 URL. При сбое максимум два повтора; если GitHub успел принять запись до ошибки ответа, собственные токены подтверждаются по свежему `claims.json`.
4. Предыдущие редакторские заметки сохраняются, но длинные служебные отметки о каждом резервировании больше не дописываются в `record.note`: информация уже есть в `claims.json` и истории Git. Это предотвращает постепенное разрастание фазовых JSON. После `status: reserved` немедленно писать статью 1/5; для восстановленного `draft` переиспользовать готовый `approved` MD при наличии.
5. При публикации `main` меняет только мастер-чат. Полные массивы JSON не выводятся в разговор. Пример ниже запускается без `dryRun`; для диагностики поменять только последнюю строку на `text(JSON.stringify(await fastClaimSeoBatch({dryRun:true})))`.

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
      return JSON.parse(f.content || (await tools.mcp__GitHub__fetch_blob({
        repository_full_name: repository, blob_sha: f.sha
      })).result.content);
    };
    const [commitResponse, claimFile, directory, phase05] = await Promise.all([
      tools.mcp__GitHub__fetch({ url: `${api}/git/commits/${head}` }),
      readJson("data/seo-geo/claims.json"),
      tools.mcp__GitHub__fetch({ url: `${api}/contents/data/seo-geo/registry?ref=${head}` }),
      readJson(registryPath("05-tours"))
    ]);
    const baseTree = JSON.parse(commitResponse.result.content).tree.sha;
    const fileShas = new Map(JSON.parse(directory.result.content).map(row => [row.name, row.sha]));
    const now = Date.now();
    const picked = [];
    const altered = new Map();
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
      altered.set(name, file);
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
      record.work = "draft";
      // Existing editor notes remain untouched; reservation audit lives in
      // claims.json and the atomic Git commit, not in repeated note appends.
      claimFile.claims[record.url] = {
        ownerId,batchId,order:record.order,claimedAt:stamp,
        lastHeartbeatAt:stamp,expiresAt,generation:(old?.generation||0)+1
      };
    }
    const elements = [...altered].map(([name,file]) => ({
      path:registryPath(name),mode:"100644",type:"blob",
      content:JSON.stringify(file,null,2)+"\n"
    }));
    elements.push({
      path:"data/seo-geo/claims.json",mode:"100644",type:"blob",
      content:JSON.stringify(claimFile,null,2)+"\n"
    });
    const tree=(await tools.mcp__GitHub__create_tree({
      repository_full_name:repository,base_tree_sha:baseTree,tree_elements:elements
    })).result.sha;
    const commit=(await tools.mcp__GitHub__create_commit({
      repository_full_name:repository,tree_sha:tree,parent_sha:head,
      message:`seo: reserve batch ${selected.map(x=>x.order).join("-")}`
    })).result.sha;
    try {
      const updated=await tools.mcp__GitHub__update_ref({
        repository_full_name:repository,branch_name:branch,sha:commit,
        expected_sha:head,force:false
      });
      if(updated.result.success===false) throw new Error("CAS update rejected");
      return {status:"reserved",commit,selected,checkedPhases,elapsedMs:Date.now()-begun};
    } catch (error) {
      const observed = await getHead();
      if (observed === commit) return {
        status:"reserved",commit,selected,checkedPhases,elapsedMs:Date.now()-begun
      };
      if (observed !== head) {
        const f=(await tools.mcp__GitHub__fetch_file({
          repository_full_name:repository,path:"data/seo-geo/claims.json",ref:observed
        })).result;
        const observedClaims=JSON.parse(f.content||(await tools.mcp__GitHub__fetch_blob({
          repository_full_name:repository,blob_sha:f.sha
        })).result.content).claims;
        if (selected.every(s=>observedClaims[s.url]?.ownerId === ownerId))
          return {status:"reserved",commit,selected,verifiedAtHead:observed,
            checkedPhases,elapsedMs:Date.now()-begun};
      }
      if (attempt===2) throw new Error(`CAS conflict after 3 attempts: ${String(error)}`);
    }
  }
}

text(JSON.stringify(await fastClaimSeoBatch()));
```

При выводе `elapsedMs` показывает только фактическое время инструментального резервирования. GitHub может отвечать дольше нескольких секунд при активной конкуренции; обещанного жесткого лимита на 2 секунды здесь нет.
