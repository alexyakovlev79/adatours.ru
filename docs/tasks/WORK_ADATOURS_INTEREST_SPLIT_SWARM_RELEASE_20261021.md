# Ada Tours — один релиз результатов SEO-роя

Дата 21.10.2026. Мастер открывает это задание ТОЛЬКО после завершения распределенной редакторской очереди.

## Вход и статус

Основной репозиторий: alexyakovlev79/adatours.ru.
Рабочая ветка роя: feature/split-nature-wildlife-seo-swarm-20261021.
Исходная ветка PR #40: feature/split-nature-wildlife-20261020.
Оригинальный feature SHA роя: f9112a4aea79eda3877c7e827846a16fb0548ab6.
Скрипт: scripts/interest-split-swarm-finalize.mjs.
Манифест: data/migrations/interest-split-20261020/swarm/manifest.json.
Шарды: 16 файлов swarm/shards/00–15.json. 488 новых проверок, 37 уже одобренных проверок оставлены без повтора.
Исходный аудит: data/migrations/interest-split-20261020/release-audit.json.
Канонический журнал редактора: data/migrations/interest-split-20261020/editorial-decisions.json.

## 1. Проверить полный набор

Полный Git checkout рабочей ветки, включая все source/MD/media-pointer файлы (не частичный checkout).
Сначала вывести статус:

~~~bash
node --test tests/interest-split-swarm.test.mjs
node scripts/interest-split-swarm-finalize.mjs
~~~

Если хоть один queued, leased или review, не выполнять финализацию, не объединять PR, не запускать deploy.
Резервы со сроком в прошлом разрешено подхватить новым Work worker. REVIEW решаются адресно по источникам. Координатор использует действие requeue_review через GitHub-диспетчер с точным expectedCompletedAt и письменной причиной, сохраняя reviewHistory. После этого другой worker получает обычный claim и закрывает задачу в done. Не менять статусы вручную без доказательства.

Проверить соответствие 488 уникальных URL/path, неизменность ID, отсутствие повторов articlePath, SHA исходного и итогового Markdown. Никаких удалений старых опубликованных текстов.

## 2. Однократный сбор результатов

~~~bash
node scripts/interest-split-swarm-finalize.mjs --finalize
node scripts/interest-split-swarm-finalize.mjs --finalize --write
node scripts/audit-interest-split-release.mjs --write
~~~

Этот проход:
- добавляет редакторские решения в старый editorial-decisions.json без перезаписи ранних 37 проверок и истории;
- проверяет Git blob SHA каждого результата;
- закрывает swarm manifest;
- пересчитывает структурный/семантический аудит (его семантическая сторона зависит от фактически принятых решений, машинные проверки не подменяют смыслового анализа).

Все результаты фиксируются одним подготовленным коммитом в swarm branch. Worker после закрытия manifest больше не может резервировать или завершать задачи. Если ответ коммита потерян, сначала проверить SHA/наличие завершенной фиксации, не повторять изменения вслепую.

## 3. Подготовить ровно один cutover

Проверить, что после исходного f9112a4 feature PR #40 не получила самостоятельных исправлений тех же файлов. Если получила — выполнить точный 3-way merge, разрешая конфликты **по текущим фактам и сохраненным коммитам**, не затирая завершенную редактуру.

Отдельно проверить новые изменения в main и seo-geo/staging / voice-rewrite-staging: опубликованные SEO статьи и временные ограничения, действующие claims, медиа receipt и уже подготовленный nature hero. Сохранять опубликованную историю, provenance, порядок SEO-реестров, архив, PR #40 и чужие изменения, не делать force.

Запустить синхронизацию тематических реестров по актуальному графу 15 интересов согласно:
- docs/workflows/interests.md;
- docs/workflows/interest-split-2026-10-20.md;
- docs/tasks/WORK_interest_split_release_20261020.md;
- docs/workflows/multi-country-interests.md;
- docs/workflows/seo-geo-registry.md.

Новые nature URL не получают фиктивных publishedAt/publishedCommit. Исчезнувшие пустые wildlife-подборки остаются в истории временно недоступными. Сформировать страницы и dynamic SEO без переизобретения каталогов. Пагинация, sitemap, Schema.org и ссылка на 15 интересов — общие источники.

## 4. CI и единственный production deploy

1. Влить подготовленные результаты роя в feature PR #40 ОДНИМ интеграционным commit/fast-forward с защитой SHA.
2. Один окончательный PR CI/полный build для согласованного feature SHA. Не публиковать наполовину.
3. После успеха перевести PR из draft в ready и объединить в main без force.
4. GitHub Pages deploy штатно запускается при merge main. Контролировать один итоговый successful run, не делать ручных повторных dispatch без фактического сбоя.
5. Только после success перевести фактические URL, статусы/датировки в основную Google Sheets (Страницы, SEO-GEO тексты, multi-country) через existing sync, сохраняя старые даты, notes, articlePath и claims/provenance. Не переписывать человеческие поля редакторов.

Проверить доступность /interests/nature/ и /interests/wildlife/ и согласование тематических ссылок. Никаких дополнительных публикаций для каждой из 488 статей: уже готовый текст входит в один финальный коммит.

## 5. Итоговый отчет

Сколько из 488 проверено/исправлено/оставлено как корректное, сколько было REVIEW и как закрыты; ссылки на ledger/commits; измененные nature/wildlife SEO и каталоги; финальный PR SHA, Pages Actions URL/status, Sheets sync; точные нерешенные ошибки.
Не объявлять готовность до успешного Pages deploy и необходимой синхронизации таблиц.
