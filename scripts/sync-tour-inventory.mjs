import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const ledgerPath = 'data/audits/tour-inventory-drive-20261009.json';
export const reportPath = 'docs/audits/tour-inventory.md';
const allowedWork = new Set(['not_started', 'in_progress', 'needs_update', 'reviewed', 'done']);

// Only these two scalar identity/lifecycle fields are read, not arbitrary YAML.
export function identityFromMarkdown(text) {
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!front) throw new Error('Missing frontmatter');
  const scalar = (key) => {
    const raw = front.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
    if (!raw) throw new Error(`Missing ${key}`);
    if (raw.startsWith('"')) return JSON.parse(raw);
    if (raw.startsWith("'")) return raw.slice(1, -1).replaceAll("''", "'");
    return raw.replace(/\s+#.*$/, '').trim();
  };
  return { id: scalar('id'), status: scalar('status') };
}

export function computeInventory(ledger, catalog, archives, pages) {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const archiveById = new Map(archives.filter((e) => e.type === 'tour').map((e) => [e.id, e]));
  const warnings = [];
  const entities = catalog.map((entry) => {
    const page = pages.get(entry.id);
    const archived = archiveById.has(entry.id) || page?.status === 'archived';
    return { ...entry, page: Boolean(page), archived, active: Boolean(page) && page.status !== 'draft' && !archived,
      draft: Boolean(page) && page.status === 'draft' && !archived, archiveInfo: archiveById.get(entry.id) };
  });
  const entitiesById = new Map(entities.map((e) => [e.id, e]));
  const programIds = new Set();
  const fileIds = new Set();
  const programs = ledger.programs.map((program) => {
    if (programIds.has(program.id)) throw new Error(`Duplicate program: ${program.id}`);
    programIds.add(program.id);
    if (!allowedWork.has(program.work?.state)) throw new Error(`Invalid work state: ${program.id}`);
    if (!program.files?.length) throw new Error(`No Drive files: ${program.id}`);
    for (const file of program.files) {
      if (fileIds.has(file.driveId)) throw new Error(`Drive file assigned twice: ${file.driveId}`);
      fileIds.add(file.driveId);
    }
    const ids = new Set(program.entityIds);
    // An archived duplicate's confirmed replacement is a valid active counterpart.
    for (const id of ids) {
      const replacement = archiveById.get(id)?.duplicateOf;
      if (replacement && byId.has(replacement)) ids.add(replacement);
    }
    const matches = [...ids].flatMap((id) => {
      const entry = entitiesById.get(id);
      if (!entry) warnings.push(`${program.id}: неизвестный entityId ${id}`);
      return entry ? [entry] : [];
    });
    const active = matches.filter((e) => e.active);
    const archived = matches.filter((e) => e.archived);
    const unpublished = matches.filter((e) => !e.page && !e.archived);
    const drafts = matches.filter((e) => e.draft);
    const state = active.length ? 'active' : archived.length ? 'archive_only' : unpublished.length ? 'known_unpublished' : drafts.length ? 'draft' : 'new_program';
    if (program.work.state === 'done' && state !== 'active') warnings.push(`${program.id}: work=done, но активной страницы нет`);
    return { ...program, matches, active, archived, unpublished, drafts, state };
  });
  const linkedIds = new Set(programs.flatMap((p) => p.matches.map((e) => e.id)));
  const missing = programs.filter((p) => !p.active.length && !p.archived.length);
  const withoutDrive = entities.filter((e) => e.page && !linkedIds.has(e.id));
  return { programs, entities, warnings, missing, withoutDrive, summary: {
    programs: programs.length, files: fileIds.size,
    activePages: entities.filter((e) => e.active).length,
    archivePages: entities.filter((e) => e.page && e.archived).length,
    archiveRecords: entities.filter((e) => e.archived).length,
    withoutDriveActive: withoutDrive.filter((e) => e.active).length,
    withoutDriveArchive: withoutDrive.filter((e) => e.archived).length,
    withArchive: programs.filter((p) => p.archived.length).length,
    archiveOnly: programs.filter((p) => p.state === 'archive_only').length,
    activeWithArchive: programs.filter((p) => p.active.length && p.archived.length).length,
    missing: missing.length,
    knownUnpublished: programs.filter((p) => p.state === 'known_unpublished').length,
    activePrograms: programs.filter((p) => p.state === 'active').length,
  } };
}

const labels = { active: 'Активная страница есть', archive_only: 'Только архив', known_unpublished: 'Источник известен, страницы нет', draft: 'Черновик', new_program: 'Нужна новая программа/вариант' };
const workLabels = { not_started: 'Не начато', in_progress: 'В работе', needs_update: 'Нужно обновить содержание', reviewed: 'Содержание сверено', done: 'Работа завершена' };
const cell = (value) => String(value ?? '').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
const link = (label, url) => `[${cell(label).replaceAll('[', '\\[').replaceAll(']', '\\]')}](${url})`;
const tourLink = (e) => e.page ? link(e.name, `https://adatours.ru${e.url}`) : `${cell(e.name)} (страницы нет; ${link('запись источника', `../../${e.entryPath ?? `data/source-index/entries/${e.id}.json`}`)})`;

export function renderInventory(ledger, result) {
  const s = result.summary;
  const out = ['# Опись туров: Drive → adatours.ru', '',
    `Снимок Drive: **${ledger.driveSnapshotAt}**. ${link('Исходная папка', ledger.driveRoot.url)}.`, '',
    'Статусы страниц пересчитываются из текущих файлов репозитория и архивного реестра. Опись не обращается к Drive при сборке сайта. Новые/изменённые файлы Drive нужно добавлять отдельной сверкой папки.', '',
    ledger.counting, '',
    '**Наличие активной страницы не означает, что текст, цены, даты, услуги и фото сверены с Word.** Столбец «Работа с содержанием» меняется отдельно после проверки. Страница в исходниках считается опубликованной только после успешного штатного deploy.', '',
    '| № | Показатель | Сейчас |', '|---|---|---:|',
    `| 1 | Программы Drive без повторных копий файлов | ${s.programs} программ / ${s.files} файлов |`,
    `| 2 | Неархивные страницы туров | ${s.activePages} |`,
    `| 3 | Архивные страницы туров | ${s.archivePages} |`,
    `| 4 | Страницы без соответствия в снимке Drive | ${s.withoutDriveActive} активных + ${s.withoutDriveArchive} архивных |`,
    `| 5 | Программы Drive с архивным соответствием | ${s.withArchive}: ${s.archiveOnly} только в архиве, ${s.activeWithArchive} также с активной страницей |`,
    `| 6 | Программы Drive без активной страницы и без архива | ${s.missing}; из них ${s.knownUnpublished} уже имеют запись источников |`, '',
    `**Очередь наличия страниц: ${s.archiveOnly + s.missing} программ** — ${s.archiveOnly} из архива и ${s.missing} без страниц. Архивные дубли с активной заменой эту очередь не увеличивают.`, '',
    'Рабочая инструкция: [обновление описи](../workflows/tour-inventory.md). Редактируемый реестр: [JSON](../../data/audits/tour-inventory-drive-20261009.json). Этот Markdown генерируется, ручные пометки в нём будут перезаписаны.', ''];
  const programTable = (title, list) => {
    out.push(`## ${title}`, '', '| ID программы | Программа / разделы Drive | Все файлы Drive | Соответствия сайта / реестра | Наличие | Работа с содержанием |', '|---|---|---|---|---|---|');
    for (const p of list) {
      const matches = p.matches.map((e) => `${tourLink(e)} — ${e.archived ? 'архив' : e.active ? 'активный' : e.draft ? 'черновик' : 'только источник'}; \`${e.id}\``).join('; ') || '—';
      out.push(`| \`${p.key ?? p.id}\` | ${cell(p.name)}; ${p.durationDays ?? 'уточнить'} дн.; ${cell(p.folders.join(', '))} | ${p.files.map((f) => link(f.name, f.url)).join('; ')} | ${matches} | ${labels[p.state]} | ${workLabels[p.work.state]}${p.work.note ? '; ' + cell(p.work.note) : ''} |`);
    }
    out.push('');
  };
  programTable('1. Требуется создание страниц', result.missing);
  programTable('2. Программы представлены только в архиве', result.programs.filter((p) => p.state === 'archive_only'));
  out.push('Новая версия на 2027 год не снимает архив автоматически. Перед восстановлением проверить программу и даты; действующий архивный workflow сохраняет stable ID, URL и историю. Эта опись сама ничего не восстанавливает.', '');
  programTable('3. Активная страница уже есть', result.programs.filter((p) => p.state === 'active'));
  out.push('## 4. Похожие программы: сопоставление не подтверждено', '', 'Следующие ссылки служат подсказкой при разборе вариантов. Кандидат не закрывает задачу создания и не становится подтверждённым соответствием автоматически.', '', '| Программа Drive | Кандидаты в реестре |', '|---|---|');
  const byId = new Map(result.entities.map((e) => [e.id, e]));
  for (const p of result.missing.filter((p) => p.candidateEntityIds.length)) {
    out.push(`| \`${p.key ?? p.id}\`: ${cell(p.name)} | ${p.candidateEntityIds.map((id) => { const e = byId.get(id); return e ? `${tourLink(e)}; \`${id}\`` : `\`${id}\` (не найден)`; }).join('; ')} |`);
  }
  out.push('', '## 5. Полная опись сайта и источников', '',
    `В архивном реестре ${s.archiveRecords} туров; ${s.archiveRecords - s.archivePages} без страниц. «Нет на Drive» относится только к указанной папке и её снимку, а не ко всему Google Drive. Этот факт не является причиной архивирования или удаления.`, '',
    '| Tour ID | Тур / страница | Статус | Соответствующие программы Drive |', '|---|---|---|---|');
  for (const e of result.entities) {
    const programs = result.programs.filter((p) => p.matches.some((m) => m.id === e.id));
    out.push(`| \`${e.id}\` | ${tourLink(e)} | ${e.archived ? (e.page ? 'Архивная страница' : 'Архив без страницы') : e.active ? 'Активная страница' : e.draft ? 'Черновик' : 'Источник без страницы'} | ${programs.length ? programs.map((p) => `\`${p.key ?? p.id}\``).join('; ') : 'Нет подтверждённого соответствия в снимке Drive'} |`);
  }
  out.push('', '## 6. Исключённые файлы', '', '| Файл | Причина |', '|---|---|');
  for (const f of ledger.excludedFiles) out.push(`| ${link(f.name, f.url)} | ${cell(f.reason)} |`);
  out.push('', '## 7. Предупреждения целостности', '');
  out.push(...(result.warnings.length ? result.warnings.map((w) => `- ${cell(w)}`) : ['Нет.']));
  return out.join('\n') + '\n';
}

export function readRepository(repoRoot = root) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
  const ledger = read(ledgerPath);
  const catalog = read('data/source-index/catalogs/tours.json').entries;
  const archives = read('data/catalog-archive.json').entries;
  const pages = new Map();
  const catalogIds = new Set(catalog.map((e) => e.id));
  for (const file of fs.readdirSync(path.join(repoRoot, 'src/content/tours')).filter((name) => name.endsWith('.md'))) {
    const entry = identityFromMarkdown(fs.readFileSync(path.join(repoRoot, 'src/content/tours', file), 'utf8'));
    if (!catalogIds.has(entry.id)) throw new Error(`Tour absent from source catalog: ${entry.id}; синхронизируй source-index`);
    if (pages.has(entry.id)) throw new Error(`Duplicate Tour ID: ${entry.id}`);
    pages.set(entry.id, entry);
  }
  const result = computeInventory(ledger, catalog, archives, pages);
  return { ledger, result, markdown: renderInventory(ledger, result) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { result, markdown } = readRepository();
  const output = path.join(root, reportPath);
  const differs = !fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== markdown;
  if (process.argv.includes('--apply')) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (differs) fs.writeFileSync(output, markdown);
  } else if (differs) {
    console.error('Опись устарела: node scripts/sync-tour-inventory.mjs --apply');
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ ...result.summary, changed: differs, warnings: result.warnings }, null, 2));
  if (result.warnings.length) process.exitCode = 1;
}
