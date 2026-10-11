#!/usr/bin/env python3
"""Regenerate CSV views/index of the external identity research; --check is read-only."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'external-identity'

def encoded_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    manifest_path = ROOT / 'manifest.json'
    original_manifest = manifest_path.read_bytes()
    manifest = json.loads(original_manifest)
    outputs = {}
    tables = {}
    for resource in manifest['tables']:
        path = ROOT / resource['json']
        json_bytes = path.read_bytes()
        data = json.loads(json_bytes)
        columns, headers, rows = data['columns'], data['headers'], data['rows']
        if len(columns) != len(headers) or len(set(columns)) != len(columns):
            raise ValueError(f'{path.name}: invalid columns/headers')
        if any(len(row) != len(columns) or any(not isinstance(v, str) for v in row) for row in rows):
            raise ValueError(f'{path.name}: invalid row shape/cell type')
        if data['table'] != resource['table']:
            raise ValueError(f'{path.name}: table identity mismatch')
        stream = io.StringIO(newline='')
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(headers)
        writer.writerows(rows)
        csv_bytes = stream.getvalue().encode('utf-8')
        outputs[ROOT / resource['csv']] = csv_bytes
        resource.update(row_count=len(rows), columns=columns,
                        sha256={'json': sha(json_bytes), 'csv': sha(csv_bytes)})
        tables[resource['table']] = data
    table = tables['ru-brasiltours']
    id_col, url_col = map(table['columns'].index, ('entity_id', 'ru_url'))
    entity_index, url_index = {}, {}
    for number, row in enumerate(table['rows']):
        entity, url = row[id_col], row[url_col]
        if not url or url in url_index or (entity and entity in entity_index):
            raise ValueError(f'duplicate/missing canonical URL or stable ID at row {number}')
        url_index[url] = number
        if entity:
            entity_index[entity] = number
    index = {'format_version': 1, 'table': 'ru-brasiltours.json',
             'row_numbering': 'zero_based_data_rows',
             'by_entity_id': entity_index, 'by_canonical_url': url_index}
    index_bytes = encoded_json(index)
    outputs[ROOT / manifest['index']['file']] = index_bytes
    manifest['index']['sha256'] = sha(index_bytes)
    outputs[manifest_path] = encoded_json(manifest)
    changed = [path for path, data in outputs.items() if not path.exists() or path.read_bytes() != data]
    if args.check:
        if changed:
            raise SystemExit('Out of sync: ' + ', '.join(p.name for p in changed))
    else:
        for path in changed:
            path.write_bytes(outputs[path])
    print(json.dumps({'mode': 'check' if args.check else 'export',
                      'tables': {k: len(v['rows']) for k, v in tables.items()},
                      'entity_ids': len(entity_index), 'canonical_urls': len(url_index),
                      'changed_files': len(changed)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
