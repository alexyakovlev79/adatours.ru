#!/usr/bin/env python3
"""One bounded 20-object URL/ID model pass; no broad crawl or guessed SEO URLs."""
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'external-identity'
OUT = ROOT / 'work-queues-20261012'
CACHE = Path('/workspace/scratch/93064afff3a1')


class HTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.title = []; self.h1 = []; self.text = []; self.links = []
        self.canonical = ''; self.product_ids = []; self.lang = ''; self.inside = ''; self.skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html': self.lang = a.get('lang', '')
        if tag in ('title', 'h1'): self.inside = tag
        if tag in ('script', 'style'): self.skip += 1
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href', '')
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag == 'input' and a.get('name') == 'product_id': self.product_ids.append(a.get('value', ''))

    def handle_endtag(self, tag):
        if tag in ('title', 'h1'): self.inside = ''
        if tag in ('script', 'style') and self.skip: self.skip -= 1

    def handle_data(self, data):
        value = data.strip()
        if not value: return
        if self.inside == 'title': self.title.append(value)
        if self.inside == 'h1': self.h1.append(value)
        if not self.skip: self.text.append(value)


def fetch(url, cached=None):
    observed = datetime.now(timezone.utc).isoformat()
    try:
        if cached and cached.exists():
            body = cached.read_text(); status = 200; final = url; method = 'saved_http_html'
        else:
            req = urllib.request.Request(url, headers={'User-Agent': 'AdaTours identity model research'})
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read().decode('utf-8', errors='replace')
                status, final = response.status, response.url
            method = 'live_http'
        p = HTML(); p.feed(body)
        categories = sorted(set(re.findall(r'category_id=(\d+)', body)))
        result = {'requested_url': url, 'final_url': final, 'http_status': status,
                  'checked_at': observed, 'method': method,
                  'sha256': hashlib.sha256(body.encode()).hexdigest(),
                  'canonical': p.canonical, 'h1': ' '.join(p.h1), 'title': ' '.join(p.title),
                  'lang': p.lang, 'product_ids': sorted(set(p.product_ids)), 'category_ids': categories}
        return result, p, body
    except urllib.error.HTTPError as exc:
        return {'requested_url': url, 'http_status': exc.code, 'checked_at': observed,
                'error': str(exc)}, None, ''
    except Exception as exc:
        return {'requested_url': url, 'http_status': None, 'checked_at': observed,
                'error': type(exc).__name__ + ': ' + str(exc)}, None, ''


def save(value, path):
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def main():
    started = time.monotonic()
    queue_path = OUT / 'adatours.com.json'; queue = json.loads(queue_path.read_text())
    table = json.loads((ROOT / 'ru-brasiltours.json').read_text())
    records = [dict(zip(table['columns'], r)) for r in table['rows']]
    lookup = {r['entity_id']: r for r in records}
    home, hp, _ = fetch('https://adatours.com/', CACHE / 'en-home.html')
    sitemap, sp, _ = fetch('https://adatours.com/sitemap', CACHE / 'en-probe-0.html')
    report = {'step': 'step-1-adatours-com-model', 'started_at': datetime.now(timezone.utc).isoformat(),
              'scope': '20 frozen sample objects; model check only, not complete program comparison',
              'entry_evidence': [home, sitemap], 'results': [], 'confirmed_pairs': [],
              'lookup_rule': 'category route is observed in EN sitemap. Product resolver uses source hidden '
                             'product_id and tests an OpenCart route hypothesis. Canonical correspondence '
                             'is accepted only from an actual response; no domain replacement of SEO URLs.'}
    report_path = ROOT / 'adatours-com-model-check-20261012.json'
    if report_path.exists():
        report = json.loads(report_path.read_text())
    done = {r['key'] for r in report['results']}
    labels = {'country_antarctica': ('antarctica',), 'country_argentina': ('argentina',),
              'country_belize': ('belize',), 'country_bolivia': ('bolivia',), 'country_brazil': ('brazil',),
              'destination_argentina_bariloche': ('bariloche', 'argentina'),
              'destination_belize_ambergris_kaje': ('ambergris', 'belize'),
              'destination_bolivia_kochabamba': ('cochabamba', 'bolivia'),
              'destination_brazil_angra_dos_reis': ('angra', 'brazil'),
              'destination_chile_ostrov_pashi': ('easter', 'chile')}
    country_slugs = {'country_antarctica': 'antarctica-en', 'country_argentina': 'argentina-en',
                     'country_belize': 'belize-en', 'country_bolivia': 'bolivia-en', 'country_brazil': 'brazil'}
    cached_sources = {'country_antarctica': 'source-sample-0.html',
                      'destination_argentina_bariloche': 'source-sample-1.html',
                      'tour_source_antarktida_programma_na_ves_den': 'source-sample-2.html',
                      'excursion_source_buenos_ajres_sochetanie_istorii_i_iskusstva': 'source-sample-3.html'}
    for key in queue['model_sample_keys']:
        if key in done: continue
        if time.monotonic() - started > 240: break
        r = lookup[key]; item = {'key': key, 'type': r['entity_type'], 'ru_url': r['ru_url'],
                                'status': 'retry', 'confirmed_sameas_url': ''}
        source, _, _ = fetch(r['brasiltours_url'], CACHE / cached_sources[key] if key in cached_sources else None)
        item['source'] = source
        if source['http_status'] == 429:
            report['stopped_on_rate_limit'] = True; report['results'].append(item); break
        ids = source.get('category_ids' if r['entity_type'] in ('country', 'destination') else 'product_ids', [])
        if source.get('http_status') != 200 or len(ids) != 1:
            item['reason'] = 'Source ID could not be unambiguously extracted.'
        else:
            ident = ids[0]; item['source_numeric_id'] = ident
            if key in country_slugs:
                target = 'https://adatours.com/' + country_slugs[key]
                assert target in hp.links, target
                item['discovery'] = 'actual homepage country link'
            elif r['entity_type'] == 'destination':
                target = 'https://adatours.com/?route=product/category&path=' + ident
                item['discovery'] = 'observed sitemap category resolver + extracted numeric ID'
            else:
                target = 'https://adatours.com/?route=product/product&product_id=' + ident
                item['discovery'] = 'test of product resolver hypothesis + extracted numeric ID'
            en, ep, _ = fetch(target)
            item['en'] = en
            en_ids = en.get('category_ids' if r['entity_type'] in ('country', 'destination') else 'product_ids', [])
            item['shared_id_confirmed'] = en.get('http_status') == 200 and ident in en_ids
            if en.get('http_status') == 200 and item['shared_id_confirmed'] and en.get('canonical'):
                item['status'] = 'fetched'
                if key in labels and labels[key][0] in (en['h1'] + ' ' + en['title']).lower() and all(word in (' '.join(ep.text)).lower() for word in labels[key]):
                    item['status'] = 'confirmed'; item['confirmed_sameas_url'] = en['canonical']
                    item['identity_evidence'] = {'same_numeric_id': ident,
                         'english_place_country_terms': list(labels[key]),
                         'source_h1': source['h1'], 'en_h1': en['h1'],
                         'qualification': 'Exact geographic entity, not equivalence of catalogue filters.'}
                    report['confirmed_pairs'].append({'key': key, 'ru_url': r['ru_url'],
                          'external_url': en['canonical'], 'evidence_file': 'adatours-com-model-check-20261012.json'})
                else:
                    item['reason'] = 'Shared ID and canonical found. Full program, duration, format and guide-language comparison remains pending; no sameAs saved.'
            elif en.get('http_status') == 404:
                item['status'] = 'checked_no_confirmed_pair'
                item['reason'] = 'Shared-ID resolver returns 404. This rejects this direct lookup; it does not establish absence of an English programme elsewhere.'
            else:
                item['reason'] = 'HTTP/canonical/ID identity not confirmed; retain for bounded follow-up.'
            if en.get('http_status') == 429: report['stopped_on_rate_limit'] = True
        report['results'].append(item)
        save(report, ROOT / 'adatours-com-model-check-20261012.json')
        print(json.dumps({'processed': len(report['results']), 'key': key, 'status': item['status'],
                          'en_h1': item.get('en', {}).get('h1', ''),
                          'id': item.get('source_numeric_id'),
                          'http': item.get('en', {}).get('http_status')}, ensure_ascii=False), flush=True)
        if report.get('stopped_on_rate_limit'): break
    report['completed_at'] = datetime.now(timezone.utc).isoformat()
    report['processed'] = len(report['results'])
    report['summary'] = {s: sum(r['status'] == s for r in report['results']) for s in
                         ('confirmed', 'fetched', 'checked_no_confirmed_pair', 'retry')}
    report['model_conclusion'] = 'Evaluate category and product models separately; do not generalize category success to all products.'
    queue.update(status='model_checked' if len(report['results']) == 20 else 'model_partial',
                 results=report['results'], confirmed_pairs=report['confirmed_pairs'],
                 model_report='../adatours-com-model-check-20261012.json',
                 model_checked_at=report['completed_at'], model_processed=report['processed'])
    queue['retry_urls'] = [r.get('en', r.get('source'))['requested_url'] for r in report['results'] if r['status'] == 'retry']
    save(report, ROOT / 'adatours-com-model-check-20261012.json'); save(queue, queue_path)
    print(json.dumps(report['summary'], ensure_ascii=False), flush=True)


if __name__ == '__main__': main()
