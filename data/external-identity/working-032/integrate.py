import copy
import csv
import hashlib
import io
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

INPUT = Path(sys.argv[1])
ROOT = Path('data/external-identity')
BATCH = 'adatours-com-identity-032'
REPORT = ROOT / (BATCH + '.json')

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def serialize(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

selection = load(INPUT / 'selection.json')
decisions = load(INPUT / 'decisions.json')
selected = selection['selected']
keys = [r['key'] for r in selected]
assert len(keys) == len(set(keys)) == 50
assert [r['n'] for r in decisions['decisions']] == list(range(1, 51))
assert decisions['batch_id'] == BATCH
if REPORT.exists():
    old = load(REPORT)
    assert old['frozen_keys'] == keys, 'Existing report has another frozen selection'
    assert old['summary']['verification_cursor_after'] == 1600
    print('ALREADY_INTEGRATED', serialize(old['summary']))
    sys.exit(0)

queue_path = ROOT / 'work-queues-20261012/adatours.com.json'
plan_path = ROOT / 'work-queues-20261012/plan.json'
corr_path = ROOT / 'adatours-com-correspondences.json'
csv_path = ROOT / 'adatours-com-correspondences.csv'
manifest_path = ROOT / 'manifest.json'
readme_path = ROOT / 'README.md'
q, p, c, m = map(load, [queue_path, plan_path, corr_path, manifest_path])
assert q['verification_cursor'] == 1550 and q['last_completed_batch'] == 'adatours-com-identity-031', 'Another worker advanced the queue'
assert p['first_next_task']['id'] == BATCH
assert p['last_checkpoint']['batch_id'] == 'adatours-com-identity-031'
assert m['adatours_com_identity_latest']['batch_id'] == 'adatours-com-identity-031'
completed = {k for b in q['verification_batches'] if b['status'] == 'completed' for k in b['keys']}
assert len(completed) == 1550 and not completed.intersection(keys)
order = ['country','destination','tour','excursion','theme','webpage','case','catalog','pagination','person']
ordered = [k for t in order for k in q['verification_keys_by_type'].get(t, [])]
last = q['verification_batches'][-1]['keys'][-1]
archive = {x['id'] for x in load(Path('data/catalog-archive.json'))['entries']}
future = [k for k in ordered[ordered.index(last)+1:] if k not in completed and k not in archive]
assert future[:50] == keys, 'Current selection differs; no overwrite'
next_key = future[50]
assert next_key == selection['next_key']
assert next_key == 'excursion_mexico_teotihuacan_tulpetlac_tlatelolco_pilgrimage'
assert not archive.intersection(keys)
for item in selected:
    content_path = Path(item['source_path'])
    entry_path = Path('data/source-index/entries') / (item['key'] + '.json')
    assert sha(content_path.read_bytes()) == item['source_sha256'], 'RU source changed: ' + item['key']
    assert sha(entry_path.read_bytes()) == item['source_entry_sha256'], 'RU source entry changed: ' + item['key']
    entry = load(entry_path)
    assert entry.get('status') not in ['archived', 'draft']
    current_url = entry['url']
    if current_url.startswith('/'):
        current_url = 'https://adatours.ru' + current_url
    assert current_url == item['ru_url']
    assert entry['contentPath'] == item['source_path']
assert len(c['rows']) == 1560
assert len({r[0] for r in c['rows']}) == 1560
assert not {r[0] for r in c['rows']}.intersection(keys), 'A selected record is already in correspondence registry'
assert Counter(r[5] for r in c['rows']) == {'confirmed':317, 'checked_no_confirmed_pair':1243}
old_rows = copy.deepcopy(c['rows'])
old_csv = list(csv.reader(io.StringIO(csv_path.read_text(encoding='utf-8-sig'))))
assert old_csv[0] == c['headers']
assert old_csv[1:] == [[str(x) if x is not None else '' for x in row] for row in old_rows], 'Existing CSV and JSON disagree'
now = datetime.now(timezone.utc).isoformat()
main_before = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
evidence_commit = os.environ['IDENTITY_EVIDENCE_COMMIT']
evidence_base = 'https://github.com/alexyakovlev79/adatours.ru/blob/' + evidence_commit + '/data/external-identity/working-032/'
inventory_path = ROOT / 'adatours-com-url-inventory-20261012.json'
inventory = load(inventory_path)
inventory_rows = inventory['rows']
assert len(inventory_rows) == 647
scope = ('Bounded verification of exact current RU source files, saved EN URL/title inventory and grouped public searches performed 2026-10-16. Candidate EN pages were read through indexed content or explicitly recorded direct HTTP retrieval. Not a complete live crawl. Unconfirmed means no exact independently established counterpart, not absence of an English page.')
results = []
for source, decision in zip(selected, decisions['decisions']):
    state = decision['status']
    assert state in ['confirmed', 'checked_no_confirmed_pair']
    ext = decision.get('confirmed_sameas_url', '')
    assert bool(ext) == (state == 'confirmed')
    observations = [decisions['english_observations'][key] for key in decision['observations']]
    if ext:
        assert ext in [x['url'] for x in observations]
    tokens = [s.lower() for s in decision['inventory_terms']]
    candidates = []
    for row in inventory_rows:
        text = ' '.join(str(row.get(k, '')) for k in ['url','title','h1']).lower()
        if any(token in text for token in tokens):
            candidates.append(row['url'])
    result = {k: source[k] for k in ['key','type','name','ru_url','source_path','source_sha256','source_entry_sha256']}
    result.update({'position':1550 + decision['n'], 'checked_at':now, 'status':state,
        'confirmed_sameas_url':ext, 'reason_code':decision['reason_code'], 'reason':decision['reason'],
        'search_terms':decisions['search_groups'][decision['group']], 'search_scope':scope,
        'candidate_urls':[x['url'] for x in observations if x['url'] != ext],
        'english_evidence':observations, 'inventory_screen':{'terms':tokens,'matched_urls':candidates,
        'note':'Lexical candidate screening only; categories and itinerary pages do not prove identity.'}})
    results.append(result)

counts = Counter(r['status'] for r in results)
assert counts == {'confirmed':2, 'checked_no_confirmed_pair':48}
for r in results:
    basis = r['reason'] if r['status'] == 'confirmed' else 'Exact independent English product identity is not established; see recorded candidate differences.'
    c['rows'].append([r['key'],r['type'],r['name'],r['ru_url'],r['confirmed_sameas_url'],r['status'],now,
        BATCH+'.json',basis,scope,r['reason']])
assert c['rows'][:len(old_rows)] == old_rows
assert len(c['rows']) == 1610
assert len({r[0] for r in c['rows']}) == 1610
q['results'].extend(results)
for r in results:
    if r['status'] == 'confirmed':
        assert not any(pair['key'] == r['key'] for pair in q['confirmed_pairs'])
        q['confirmed_pairs'].append({'key':r['key'],'ru_url':r['ru_url'],'external_url':r['confirmed_sameas_url'],'evidence_file':BATCH+'.json'})
q['verification_batches'].append({'id':BATCH,'keys':keys,'status':'completed','processed':50,'remaining':0,'cursor':50,'report':'../'+BATCH+'.json'})
q['verification_cursor'] = 1600
q['last_completed_batch'] = BATCH
q['updated_at'] = now
summary = {'processed':50,'confirmed':2,'checked_no_confirmed_pair':48,'retry':0,'excluded_archived':len(selection.get('skipped_archived',[])),
    'verification_cursor_before':1550,'verification_cursor_after':1600,'first_key':keys[0],'last_key':keys[-1],
    'next_batch':'adatours-com-identity-033','next_first_key':next_key,'correspondences_total_before':1560,
    'correspondences_total_after':1610,'confirmed_total_after':319,'unconfirmed_total_after':1291,
    'notes':'Two confirmed independent products. Candidates with unresolved duration/language/service differences retained explicitly; no claim that English counterparts do not exist. JSON-LD/schema.org unchanged.'}
direct_index = load(INPUT/'direct-evidence-index.json')
for record in direct_index:
    if 'text_file' in record:
        record['saved_text_url'] = evidence_base + record['text_file']
report = {'format_version':1,'batch_id':BATCH,'domain':'adatours.com','step':3,'checked_at':now,
    'scope':'50 distinct RU excursions, verification positions 1551–1600: Ecuador 21, El Salvador 1, Guatemala 14, Honduras 1, Mexico 13.',
    'verification_rule':decisions['method'],'source_coverage':{'source_commit':main_before,'prepared_input_commit':selection['source_commit'],
    'evidence_commit':evidence_commit,'inventory_url_count':647,'inventory_sha256':sha(inventory_path.read_bytes()),
    'complete_live_crawl':False,'targeted_public_search_date':'2026-10-16','direct_retrievals':direct_index,
    'source_texts':evidence_base+'selection.json'},'frozen_keys':keys,'results':results,'summary':summary}
p['first_next_task'] = {'id':'adatours-com-identity-033','step':3,'domain':'adatours.com','action':'Next 50 distinct stage-3 objects after cursor 1600, starting '+next_key+'; preserve batches 001–032.',
    'status':'pending','object_limit':50,'queue':'adatours.com.json','inventory':'adatours-com-url-inventory-20261012.json'}
p['last_checkpoint'] = {'step':3,'domain':'adatours.com','batch_id':BATCH,'processed_in_batch':50,'confirmed_in_batch':2,
    'checked_no_confirmed_pair':48,'verification_cursor':1600,'report':BATCH+'.json','saved_at':now}
p['updated_at'] = now
m['adatours_com_identity_latest'] = {'batch_id':BATCH,'checked_at':now,'step3_checked':1600,'step1_confirmed_geography':10,
    'coffee_related_checked':50,'coffee_confirmed_programmes':8,'record_count':1610,'confirmed_exact':319,'unconfirmed_exact':1291,
    'next':'adatours-com-identity-033','report':BATCH+'.json','note':'Two exact standalone products confirmed: Santa Cruz Island and Mashpi Lodge 2 days/1 night. Four Galapagos duration conflicts and other guide/service variants retained as unconfirmed candidates. Current correspondence projection hashes refreshed; unrelated historical tables preserved. No JSON-LD changes.'}
corr_text = serialize(c)
out_csv = io.StringIO(newline='')
writer = csv.writer(out_csv, lineterminator='\n')
writer.writerow(c['headers'])
writer.writerows(c['rows'])
csv_text = out_csv.getvalue()
assert list(csv.reader(io.StringIO(csv_text)))[1:] == c['rows']
for table in m['tables']:
    if table.get('table') == 'adatours-com-correspondences':
        table['row_count'] = 1610
        table['sha256'] = {'json':sha(corr_text.encode()),'csv':sha(csv_text.encode())}
        table['updated_at'] = now
header = ('## Актуальный статус: партия 032 завершена (16.10.2026)\n\n'
    'Проверены **1600 объектов** шага 3 (партии 001–032). Партия 032: **50 самостоятельных экскурсий**: 21 Эквадор, 1 Сальвадор, 14 Гватемала, 1 Гондурас и 13 Мексика. '
    '**2 точные отдельные EN-пары подтверждены**: Santa Cruz Island и Mashpi Lodge (2 дня / 1 ночь). **48 пар пока не подтверждены**. '
    'У Исабелы, Северного Сеймура, Южной Пласы и Тортуга-Бей найдены самостоятельные EN-страницы, но сохранены расхождения длительности 6/8 часов и условий. '
    'Версии с иным языком гида/тарифами и эпизоды многодневных туров не объявлены точными sameAs.\n\n'
    'Общий реестр: **1610 записей, 319 подтвержденных, 1291 без подтвержденной пары**. '
    '[Отчет 032](adatours-com-identity-032.json) · [JSON](adatours-com-correspondences.json) · [CSV](adatours-com-correspondences.csv). '
    'Следующая партия **033**, курсор **1600**, первый ID `'+next_key+'`. '
    'Проверка ограничена закрепленными RU-источниками, известной EN-описью, адресным поиском и чтением найденных кандидатов. '
    'Отсутствие EN-страниц не доказано. JSON-LD / schema.org не менялись.\n\n')
old_readme = readme_path.read_text()
assert not old_readme.startswith('## Актуальный статус: партия 032')
files = {REPORT:serialize(report),queue_path:serialize(q),plan_path:serialize(p),corr_path:corr_text,
         csv_path:csv_text,manifest_path:serialize(m),readme_path:header+old_readme}
for path, text in files.items():
    path.write_text(text,encoding='utf-8')
for path in files:
    if path.suffix == '.json':load(path)
changed = set(subprocess.check_output(['git','diff','--name-only'],text=True).splitlines())
allowed = {str(path) for path in files}
assert changed <= allowed, 'Unrelated tracked changes: '+str(changed-allowed)
subprocess.run(['git','add','--',*sorted(allowed)],check=True)
staged = set(subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines())
assert staged == allowed, 'Incomplete or unrelated staged change'
subprocess.run(['git','commit','-m','audit(identity): verify 50 excursions in batch 032; 2 confirmed, 48 candidates [skip ci]'],check=True)
print('PREPARED_SUMMARY', serialize(summary))
print('PREPARED_COMMIT',subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip())
