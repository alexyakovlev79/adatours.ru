# WORK — Рой SEO-редакторов Ada Tours: 15 интересов

Версия: 1.0, 21.10.2026.

**Команда запуска:** «Рой ADA: проверяй SEO-интересы. Возьми следующую свободную пачку по docs/tasks/WORK_ADATOURS_INTEREST_SPLIT_SWARM_20261021.md в alexyakovlev79/adatours.ru, сохраняй каждую статью и продолжай автоматически».

## 1. Единственная рабочая область

- Репозиторий: **alexyakovlev79/adatours.ru**.
- Ветка всех параллельных редакторов: **feature/split-nature-wildlife-seo-swarm-20261021**.
- Исходная feature-ветка PR #40: **feature/split-nature-wildlife-20261020**. Рой отделен от ее commit f9112a4aea79eda3877c7e827846a16fb0548ab6; исходную ветку во время параллельной работы редакторов больше не изменять.
- Диспетчер: scripts/interest-split-swarm-core.mjs и scripts/interest-split-swarm-remote.mjs.
- Очередь и checkpoint: data/migrations/interest-split-20261020/swarm/manifest.json и 16 файлов shards/00.json — 15.json.
- Начальная очередь: 488 непринятых SEO-статей; 37 уже рассмотренных исключены; перепроверять их нельзя без отдельной причины.
- Запрещены прямые изменения main, PR #40, SEO staging, Google Sheets, deployment, force push, самостоятельные PR работников. Итоговую публикацию выполняет только мастер после полной готовности.

## 2. Что проверять

Смысл ВСЕЙ собственной SEO-статьи, а не только ссылки и таблицы. Исходные 1025 меток Tour/Excursion/Destination уже переведены на:
- **theme_nature, /interests/nature/** — водопады, ледники, вулканы, горы, каньоны, пустыни, озера и другие существенные природные маршруты;
- **theme_wildlife, /interests/wildlife/** — реальные запланированные наблюдения за дикими животными, птицами, морской фауной, сафари, бердвотчинг.

Не приписывать wildlife продукту только за природный парк, фото животного, слово «сафари» в названии аттракциона или необязательную прогулку. Если обе темы существенны, обе допустимы. Для упоминаемого Tour проверять текущие primaryThemes/themes и фактические включенные дни. Сохранять корректные коммерческие факты, тексты, историю публикаций и уникальные свойства статьи.

По каждому зарезервированному articlePath: прочитать полную статью, проверить H1/lead, заголовки, рекомендации, FAQ, CTA, динамические таблицы и смысловые ссылки. Если ошибочно рекомендуются природные ландшафты как safari, исправить ссылку и обещание на реальный nature каталог. Не добавлять выдуманные туры, посещения, гарантии встречи животных, цены, даты или экспертов. Править минимально. При отсутствии ошибок разрешен результат confirmed с подробным основанием; при невозможности проверить — review с конкретным блокером (он помешает финальному cutover).

## 3. Как вызывать диспетчер в Code Mode

В каждом новом Work-чате один раз создай собственный ownerId. Для каждой новой пачки создай новый token. Загрузи две исходные программы из ветки роя, затем получи пачку:

~~~javascript
const repo='alexyakovlev79/adatours.ru';
const ref='feature/split-nature-wildlife-seo-swarm-20261021';
const paths=['scripts/interest-split-swarm-core.mjs','scripts/interest-split-swarm-remote.mjs'];
const [a,b]=await Promise.all(paths.map(path=>
  tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref})));
const core=new Function(a.result.content.replace(/^export /gm,'')+
 ';return {SWARM_ROOT,shardPath,checkIdentity,hashString,take,activeLease,refresh,release,validateSubmitArgs,requireLease,applyEdits,checkArticleInvariant,finish,summarize,reopenReview};')();
const swarm=new Function(b.result.content.replace(/^export /gm,'')+
 ';return runInterestSplitSwarm;')();
const ownerId='isr-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);
const token='lease-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,14);
text({ownerId,token,response:await swarm(tools,core,
 {action:'claim',ownerId,token,limit:3,scan:4})});
~~~

**Сохрани неизмененными ownerId, token, lane и полученные task IDs.** Code Mode изолирован между вызовами: при следующем запуске заново загрузи те же две программы и восстанови core/swarm, после чего передай старые ownerId/token/lane, не создавай их заново для уже занятой пачки. Если ответ потерян, повтори claim с исходными данными. При scan_more делай новый claim от response.nextLane, не объявляй очередь пустой, пока не обойдены все 16 lanes.

## 4. Чтение точной статьи

~~~javascript
const article=await tools.mcp__GitHub__fetch_file({
 repository_full_name:'alexyakovlev79/adatours.ru',
 path:'СКОПИРОВАТЬ selected.path',
 ref:'feature/split-nature-wildlife-seo-swarm-20261021'
});
text({sha:article.result.sha,content:article.result.content});
~~~

Изучи собственный текст, структуру/ссылки и фактические программы, затем подготовь адресный патч (массива точных find/replace достаточно). Полная перезапись статьи не нужна. В одной паре find должен встречаться ровно один раз. Нельзя менять targetPath, kind, status в frontmatter.

## 5. Сохраняй каждую статью немедленно

Сдавай **по одной статье**, не держи 3 готовых правки до конца пачки. В новом Code Mode вызове снова загрузи core и swarm, но используй первоначальные ownerId/token/lane:

~~~javascript
const out=await swarm(tools,core,{
 action:'submit',
 ownerId:'ПРЕЖНИЙ_OWNER',token:'ПРЕЖНИЙ_TOKEN',lane:НОМЕР_LANE,
 items:[{
  id:'seo-XXXX',
  expectedSha:'SHA_ИЗ_FETCH_FILE_40_HEX',
  decision:'edited',
  edits:[{find:'точный старый фрагмент',replace:'точный исправленный фрагмент'}],
  note:'Конкретное проверенное различие природы и животных, измененное обещание и основание в программе.'
 }]
});
text(out);
~~~

Для неизмененной статьи: decision='confirmed', edits=[] и развернутое конкретное основание (от 28 символов). Для блокера: decision='review', edits=[], конкретная причина; такой job не засчитывается завершенным до решения мастера. Допустимо передать 1–4 записи в одной атомарной транзакции, но для защиты от зависаний обычно передавай одну.

Успех: status=saved, saved_after_uncertain_response или already_saved. Это означает commit в **рабочей** ветке, НЕ publication. При неполученном ответе повтори тот же submit с тем же token и патчами: диспетчер проверяет сохраненное состояние. При source_changed свежую статью надо перечитать и пересогласовать, нельзя затирать правку другого агента. Внешние живые SEO claims блокируют submit. Результат article blob + отметка done/review в shard записываются ОДНИМ Git-коммитом через update_ref с expected SHA, без force.

## 6. Продление/возврат и продолжение

Длительность lease: **90 минут**. Если времени мало или предстоит длительное изучение, вызови:

~~~javascript
text(await swarm(tools,core,{action:'renew',
 ownerId:'ПРЕЖНИЙ_OWNER',token:'ПРЕЖНИЙ_TOKEN',
 lane:НОМЕР_LANE,ids:['seo-XXXX']}));
~~~

Если прекращаешь чат с незавершенным резервом:

~~~javascript
text(await swarm(tools,core,{action:'release',
 ownerId:'ПРЕЖНИЙ_OWNER',token:'ПРЕЖНИЙ_TOKEN',
 lane:НОМЕР_LANE,ids:['seo-XXXX']}));
~~~

Если чат оборвался, чужой редактор может забрать его недоделанные задачи после истечения 90 минут. Уже подтвержденные done не возвращаются в очередь. После обработки всех трех задач возьми еще три с прежним ownerId и **новым** token. В одном чате обработай обычно 9–12 статей (3–4 пачки), фиксируя результат после каждой. Затем заверши с отчетом, не продолжай бесконечно.

Промежуточные статусы можно получить по группам:

~~~javascript
text(await swarm(tools,core,{action:'status',from:0,count:4}));
~~~

Повтори from=4,8,12 и суммируй queued/leased/done/review.

## 7. Правила окончательного релиза — только для мастера

Когда все 488 задач имеют done и нет review/leased/queued:

~~~bash
node --test tests/interest-split-swarm.test.mjs
node scripts/interest-split-swarm-finalize.mjs --finalize
node scripts/interest-split-swarm-finalize.mjs --finalize --write
node scripts/audit-interest-split-release.mjs --write
~~~

Финализатор сверит исходные/result Git blob SHA и добавит все подтвержденные решения в исходный editorial-decisions.json, сохранив историю. Затем мастер сравнит готовый рой с текущими feature PR #40, SEO staging и main, аккуратно перенесет все изменения, исправит конфликты, запустит один полный CI, объединит в main ОДИН РАЗ, дождется успешного ОДНОГО Pages deploy и после этого синхронизирует Google Sheets и производные реестры. Если осталось хотя бы одно REVIEW или иное несоответствие, релиз запрещен.

## 8. Отчет рабочего чата

После каждой статьи: ID + URL + edited/confirmed/review + commit SHA.
После каждых трех: закрыто N уникальных заданий, REVIEW M, текущая группа и последний подтвержденный commit. По окончании чата перечислить свои активные незакрытые lease (если они остались). Не утверждать опубликование до общего релиза. **Не запрашивать у пользователя разрешение на очередную пачку — продолжать автоматически.**

## 9. Для координатора: повторно открыть REVIEW

Если конкретный REVIEW разрешен дополнительными фактами, только координирующий чат перечитывает shard и вызывает диспетчер с action='requeue_review', lane, id, expectedCompletedAt (точное completedAt сохраненного REVIEW) и reason не короче 28 символов. Переоткрытие сохраняет старую причину в reviewHistory; затем новый worker получает обычный claim. Самовольное исправление состояния в JSON без CAS запрещено.
