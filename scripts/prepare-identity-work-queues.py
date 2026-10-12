#!/usr/bin/env python3
"""Prepare frozen, resumable research queues; never crawl or confirm sameAs."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'external-identity'
OUT = ROOT / 'work-queues-20261012'


def read_table(name):
    data = json.loads((ROOT / name).read_text())
    return [dict(zip(data['columns'], row)) for row in data['rows']]


def encode(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def prepare(source_commit, prepared_at):
    rows = read_table('ru-brasiltours.json')
    vip = read_table('vip-catalogues.json')
    vip_urls = {r['ru_url'] for r in vip}
    assert len(vip_urls) == 133
    assert all(r['sameas_eligible'] == 'НЕТ ПОДТВЕРЖДЁННОЙ ПАРЫ' for r in vip)
    assert all(not r[k] for r in vip for k in (
        'brasiltours_url', 'adatours_com_url', 'vipdeluxetravel_ru_url', 'vipdeluxetravel_com_url'))
    active = [r for r in rows if r['ru_status'] == 'АКТИВНАЯ'
              and r['ru_url'] not in vip_urls and r['ru_url'] != 'https://adatours.ru/404.html']
    types = Counter(r['entity_type'] for r in active)
    objects, by_type = [], {}
    for r in sorted(active, key=lambda r: (r['entity_type'], r['ru_url'])):
        key = r['entity_id'] or r['ru_url']
        item = {'key': key, 'entity_id': r['entity_id'], 'type': r['entity_type'],
                'name': r['name'], 'ru_url': r['ru_url'],
                'registry_row': rows.index(r), 'status': 'pending'}
        objects.append(item)
        by_type.setdefault(r['entity_type'], []).append(key)
    assert len({o['key'] for o in objects}) == len(objects)
    lookup = {o['key']: o for o in objects}
    # Different countries in each object type; prefer established source IDs.
    sample = []
    for kind in ('country', 'destination', 'tour', 'excursion'):
        candidates = [r for r in active if r['entity_type'] == kind and r['snapshot_id']
                      and r['match_status'] == 'ТОЧНАЯ ПАРА В РЕЕСТРЕ']
        chosen, countries = [], set()
        for r in sorted(candidates, key=lambda r: r['ru_url']):
            country = r['ru_url'].split('/')[3]
            if country not in countries:
                chosen.append(r['entity_id'] or r['ru_url'])
                countries.add(country)
            if len(chosen) == 5:
                break
        assert len(chosen) == 5, kind
        sample.extend(chosen)
    exact_sources = []
    for r in active:
        if r['match_status'] == 'ТОЧНАЯ ПАРА В РЕЕСТРЕ' and r['brasiltours_url']:
            exact_sources.append({'key': r['entity_id'] or r['ru_url'],
                                 'historical_source_url': r['brasiltours_url'],
                                 'snapshot_id': r['snapshot_id'],
                                 'status': 'pending_current_identity_check',
                                 'confirmed_sameas_url': ''})
    domains = [
        ('adatours.com', 'primary', 1),
        ('vipdeluxetravel.ru', 'primary', 2),
        ('vipdeluxetravel.com', 'primary', 3),
        ('svadbazagranicey.com', 'additional', 4),
        ('news.brasiltours.ru', 'additional', 5),
        ('hotels.adatours.com', 'additional', 6),
        ('adatoursbrazil.weebly.com', 'historical', 7),
        ('touroperatorbrazil.wordpress.com', 'historical', 8),
        ('2016olympicgame.wordpress.com', 'historical', 9),
        ('adatours.com.br', 'redirect_check', 10),
    ]
    files = {}
    for domain, role, order in domains:
        queue = {'domain': domain, 'role': role, 'order': order, 'status': 'pending_discovery',
                 'entry_url': 'https://' + domain + '/',
                 'url_inventory_status': 'not_prepared', 'discovered_urls': [],
                 'crawl_batches': [], 'crawl_cursor': 0, 'verification_cursor': 0,
                 'retry_urls': [], 'model_sample_keys': sample if role == 'primary' else [],
                 'verification_keys_by_type': by_type if role == 'primary' else {},
                 'results': [], 'confirmed_pairs': [],
                 'discovery_rule': 'Read saved data, homepage/menu/sitemap and actual ID/language links. '
                                   'Do not synthesize external URLs by replacing domains. Freeze discovered '
                                   'URL batches of <=300; reconcile <=50 records separately.',
                 'negative_rule': 'Only confirmed pairs get an external correspondence URL. '
                                  'A retrieval error is not evidence of absence.'}
        files[f'{domain}.json'] = queue
    completed = [{'ru_url': r['ru_url'], 'catalog_id': r['catalog_id'],
                  'status': 'checked_no_confirmed_pair', 'checked_at': r['sameas_checked_at'],
                  'domains': ['brasiltours.ru', 'adatours.com', 'vipdeluxetravel.ru', 'vipdeluxetravel.com'],
                  'evidence': '../vip-sameas-check-20261012.json'} for r in vip]
    files['objects.json'] = {'source_table': '../ru-brasiltours.json', 'source_commit': source_commit,
                             'objects': objects, 'by_type': by_type}
    files['brasiltours.ru.json'] = {
        'domain': 'brasiltours.ru', 'historical_crawl': 'already_saved',
        'historical_inventory': '../brasiltours-snapshots.json',
        'historical_pages': 1426, 'status': 'pending_current_identity_check',
        'tasks': exact_sources, 'verification_cursor': 0, 'confirmed_pairs': [],
        'rule': 'Reuse historical snapshots. These source URLs are migration evidence, not sameAs. '
                'Check current identity in batches of <=50; unresolved objects remain in objects.json.'}
    files['geography.json'] = {'status': 'pending', 'batch_size': 20,
                               'keys': by_type.get('country', []) + by_type.get('destination', []),
                               'cursor': 0, 'confirmed_pairs': [],
                               'rule': 'Exact country/place identity only; same-name places and Iguazu sides remain distinct.'}
    files['completed-vip.json'] = {'scope': '133 VIP pages x 4 domains', 'pages': completed,
                                  'repeat_only_when': 'New evidence of a real identical external catalogue.'}
    source_names = ['ru-brasiltours.json', 'vip-catalogues.json', 'vip-sameas-check-20261012.json',
                    'brasiltours-snapshots.json', 'manifest.json', 'next-steps.json']
    files['plan.json'] = {
        'format_version': 1, 'prepared_at': prepared_at, 'source_commit': source_commit,
        'scope': 'Frozen existing registry; not a claim of a fresh complete live inventory. '
                 'Reconcile target IDs/URLs/archive status before each batch; append later additions separately.',
        'source_sha256': {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in source_names},
        'stats': {'registry_pages': len(rows), 'active_registry_pages': sum(r['ru_status'] == 'АКТИВНАЯ' for r in rows),
                  'archived_excluded': sum(r['ru_status'] == 'АРХИВ' for r in rows),
                  'completed_vip_pages': len(vip), 'completed_vip_domain_checks': 532,
                  'service_pages_excluded': 1, 'pending_ru_objects': len(objects),
                  'pending_by_type': dict(sorted(types.items())), 'model_sample_per_primary_site': len(sample),
                  'historical_exact_sources_needing_current_check': len(exact_sources),
                  'geography_objects': len(files['geography.json']['keys'])},
        'limits': {'crawl_urls': 300, 'identity_checks': 50, 'geography_searches': 20,
                   'step_wall_minutes': 10, 'checkpoint_every_records': 10,
                   'checkpoint_deadline_minutes': 8, 'stop_on_http_429': True,
                   'request_timeout_seconds': 20, 'retries_per_url_in_same_step': 0},
        'first_next_task': {'id': 'step-1-adatours-com-model', 'domain': 'adatours.com',
                            'action': 'Discover actual URL/ID model and check 20 frozen sample objects only.',
                            'sample_keys': sample, 'status': 'pending'},
        'resume': 'Read plan.json and the selected domain queue. Run one batch, persist results/cursor '
                  'and checkpoint commit, report counts, then stop until the user says далее.',
        'completed_step': 0, 'schema_implementation': 'not_authorized_by_this_research_plan',
        'queues': list(files),
    }
    assert all(k in lookup for k in sample)
    assert not vip_urls.intersection(o['ru_url'] for o in objects)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--prepared-at', required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files = prepare(args.source_commit, args.prepared_at)
    OUT.mkdir(exist_ok=True)
    for name, value in files.items():
        path, content = OUT / name, encode(value)
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit(f'Mismatch: {path}')
        else:
            if path.exists():
                raise SystemExit(f'Refusing to overwrite existing progress: {path}')
            path.write_text(content)
    print(encode(files['plan.json']['stats']))


if __name__ == '__main__':
    main()
