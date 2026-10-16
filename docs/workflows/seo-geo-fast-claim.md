# Ada Tours — быстрый атомарный резерв трех SEO/GEO-статей

Версия 1.0, 16.10.2026. Дополнение к разделу 8 `docs/workflows/seo-geo-registry.md`, а не самостоятельная очередь.

**Для команды «пиши SEO» выполнить код ниже ОДНИМ вызовом `functions.exec` (Code Mode)**. Он использует подключенный GitHub, а не токены или прямой shell. Вызов включает получение одного SHA staging, параллельное чтение claims и семи фаз на этом SHA, выбор URL внутри инструмента, создание одного Git tree/commit и CAS-обновление staging. Полные JSON не выводятся в чат. Отдельно искать последний коммит, проверять `main`, Google Sheets, Actions, статьи соседних URL или повторно открывать гигантский `05-tours.json` перед захватом нельзя.

Резервирование — отдельная операция от написания статей и публикации. **К работе над статьей приступать только после результата `status: reserved` с `commit`**. При `status: empty` работа закончена; при ошибке нельзя считать URL занятыми. При `previousWork: draft` после резервирования открыть только точный существующий `articlePath` и переиспользовать полный `approved` MD, если он уже готов; это не повод писать его снова.

Реестр остается источником порядка, `claims.json` — блокировок; код не создает дополнительного кеша или индекса, который мог бы устареть. Срок резерва — 60 минут; продление и завершение статьи — по основному §8. При CAS-конфликте внутри этого же вызова автоматически читается новый HEAD, максимум два повтора, без force push. Если `functions.exec` или GitHub Git Data действия недоступны, использовать эквивалентную атомарную процедуру §8.1, а не раздельные незащищенные `update_file`.

```javascript
async function fastClaimSeoTriple({ dryRun = false } = {}) {
  const repo = "alexyakovlev79/adatours.ru";
  const branch = "seo-geo/staging";
  const api = `https://api.github.com/repos/${repo}`;
  const paths = ["01-countries", "02-interests", "03-country-interest", "04-country-interest-vip", "05-tours", "06-places", "07-excursions"].map(name => `data/seo-geo/registry/${name}.json`);
  const ownerId = `seo-fast-${new Date().toISOString().replace(/\W/g, "")}-${Math.random().toString(36).slice(2, 10)}`;
  const batchId = `seo-batch-${ownerId}`;
  const begun = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const getHead = async () => JSON.parse((await tools.mcp__GitHub__fetch({ url: `${api}/git/ref/heads/seo-geo/staging` })).result.content).object.sha;
    const head = await getHead();
    const readJson = async path => {
      const f = (await tools.mcp__GitHub__fetch_file({ repository_full_name: repo, path, ref: head })).result;
      const raw = f.content || (await tools.mcp__GitHub__fetch_blob({ repository_full_name: repo, blob_sha: f.sha })).result.content;
      return JSON.parse(raw);
    };
    const [commitResponse, claimFile, ...registryFiles] = await Promise.all([
      tools.mcp__GitHub__fetch({ url: `${api}/git/commits/${head}` }),
      readJson("data/seo-geo/claims.json"),
      ...paths.map(readJson)
    ]);
    const baseTree = JSON.parse(commitResponse.result.content).tree.sha;
    const now = Date.now();
    const claimMap = claimFile.claims;
    const isAvailable = url => {
      const claim = claimMap[url];
      if (!claim) return true;
      const expiry = Date.parse(claim.expiresAt);
      return Number.isFinite(expiry) && expiry <= now;
    };
    const possible = registryFiles.flatMap((file, phaseIndex) =>
      file.entries.map((record, rowIndex) => ({ record, phaseIndex, rowIndex }))
    ).filter(({ record }) =>
      (record.work === "draft" || record.work === "queued") &&
      isAvailable(record.url) &&
      !["temporarily_unavailable", "missing", "archived"].includes(record.availability)
    );
    possible.sort((a, b) =>
      (a.record.work === "draft" ? 0 : 1) - (b.record.work === "draft" ? 0 : 1) ||
      a.record.order - b.record.order
    );
    const picked = possible.slice(0, 3);
    if (!picked.length) return { status: "empty", head, elapsedMs: Date.now() - begun };
    const selected = picked.map(({ record }) => ({ order: record.order, url: record.url, previousWork: record.work }));
    if (dryRun) return { status: "dry_run", head, selected, elapsedMs: Date.now() - begun };
    const stamp = new Date(now).toISOString();
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    const changed = new Set();
    for (const { record, phaseIndex } of picked) {
      const previousClaim = claimMap[record.url];
      record.work = "draft";
      const log = `SEO/GEO reserved ${batchId} by ${ownerId} until ${expiresAt}.`;
      record.note = [record.note, log].filter(Boolean).join("\n");
      claimMap[record.url] = {
        ownerId, batchId, order: record.order,
        claimedAt: stamp, lastHeartbeatAt: stamp, expiresAt,
        generation: (previousClaim?.generation || 0) + 1
      };
      changed.add(phaseIndex);
    }
    const elements = [...changed].map(i => ({
      path: paths[i], mode: "100644", type: "blob",
      content: JSON.stringify(registryFiles[i], null, 2) + "\n"
    }));
    elements.push({
      path: "data/seo-geo/claims.json", mode: "100644", type: "blob",
      content: JSON.stringify(claimFile, null, 2) + "\n"
    });
    const tree = (await tools.mcp__GitHub__create_tree({
      repository_full_name: repo, base_tree_sha: baseTree, tree_elements: elements
    })).result.sha;
    const newCommit = (await tools.mcp__GitHub__create_commit({
      repository_full_name: repo, message: `seo: reserve batch ${selected.map(x => x.order).join("-")}`,
      tree_sha: tree, parent_sha: head
    })).result.sha;
    try {
      const updated = await tools.mcp__GitHub__update_ref({
        repository_full_name: repo, branch_name: branch, sha: newCommit,
        expected_sha: head, force: false
      });
      if (updated.result.success === false) throw new Error("CAS update rejected");
      return { status: "reserved", commit: newCommit, selected, elapsedMs: Date.now() - begun };
    } catch (err) {
      const observed = await getHead();
      if (observed === newCommit) return { status: "reserved", commit: newCommit, selected, elapsedMs: Date.now() - begun };
      if (observed === head) throw err;
      if (attempt === 2) throw new Error(`CAS contention after 3 attempts: ${String(err)}`);
    }
  }
}

text(JSON.stringify(await fastClaimSeoTriple()));
```

Для диагностики допустим **только без записи** вариант `await fastClaimSeoTriple({dryRun:true})`. Не включать `dryRun` в реальном запросе «пиши SEO». Показатель `elapsedMs` — время инструментального захвата, а не время размышления модели или подготовки статьи.
