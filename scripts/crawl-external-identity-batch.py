#!/usr/bin/env python3
"""Fetch one frozen actual-URL batch, checkpoint, and stop. No sameAs decisions."""
import argparse
import hashlib
import importlib.util
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'external-identity'
QUEUES = ROOT / 'work-queues-20261012'
UA = 'AdaTours identity research'


def now():
    return datetime.now(timezone.utc).isoformat()


def save(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def wildcard_robots_allowed(text, url):
    """Complement stdlib robotparser, whose path rules do not handle glob stars."""
    groups = []; agents = []; rules = []
    for raw in text.splitlines() + ['User-agent: sentinel-end']:
        line = raw.split('#', 1)[0].strip()
        if ':' not in line: continue
        field, value = (x.strip() for x in line.split(':', 1))
        if field.lower() == 'user-agent':
            if rules:
                groups.append((agents, rules)); agents = []; rules = []
            agents.append(value.lower())
        elif field.lower() in ('allow', 'disallow') and agents and value:
            rules.append((field.lower() == 'allow', value))
    if rules: groups.append((agents, rules))
    choices = [(max((0 if a == '*' else len(a)) for a in agents if a == '*' or a in UA.lower()), rules)
               for agents, rules in groups if any(a == '*' or a in UA.lower() for a in agents)]
    if not choices: return True
    specificity = max(score for score, _ in choices)
    v = urllib.parse.urlsplit(url); target = v.path + ('?' + v.query if v.query else '')
    matches = []
    for score, rules in choices:
        if score != specificity: continue
        for allow, pattern in rules:
            expression = '^' + re.escape(pattern.rstrip('$')).replace(r'\*', '.*') + ('$' if pattern.endswith('$') else '')
            if re.match(expression, target): matches.append((len(pattern.replace('*', '').rstrip('$')), allow))
    return max(matches)[1] if matches else True


class SameSiteRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).hostname != 'adatours.com':
            raise ValueError('Redirect outside selected domain: ' + newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--batch-id')
    ap.add_argument('--seconds', type=int, default=330)
    args = ap.parse_args()
    if not 1 <= args.seconds <= 480: raise SystemExit('Budget must be 1..480 seconds.')
    started = time.monotonic()
    qp = QUEUES / 'adatours.com.json'; queue = json.loads(qp.read_text())
    ip = ROOT / 'adatours-com-url-inventory-20261012.json'; inventory = json.loads(ip.read_text())
    pp = QUEUES / 'plan.json'; plan = json.loads(pp.read_text())
    batch_id = args.batch_id or plan['first_next_task']['id']
    batch = next(b for b in queue['crawl_batches'] if b['id'] == batch_id)
    report_path = ROOT / (batch_id + '.json')
    report = json.loads(report_path.read_text()) if report_path.exists() else {
        'format_version': 1, 'batch_id': batch_id, 'domain': 'adatours.com',
        'scope': 'Compact page/ID extraction only. No sameAs confirmations or inferred counterparts.',
        'frozen_inventory_rows': batch['inventory_row_indexes'], 'results': [], 'passes': []}
    # Recover if a previous interruption happened between atomic file writes.
    assert report['frozen_inventory_rows'] == batch['inventory_row_indexes']
    for position, result in enumerate(report['results']):
        assert result['inventory_row'] in batch['inventory_row_indexes']
        row = inventory['rows'][result['inventory_row']]
        row.update(status=result['status'], crawl_report=report_path.name, crawl_result_index=position)
        if result['status'] == 'fetched':
            row.update({k: result[k] for k in ('http_status', 'canonical', 'h1', 'title', 'product_ids', 'category_ids', 'page_type')})
    pass_record = {'started_at': now(), 'requested_budget_seconds': args.seconds,
                   'processed_before': len(report['results']), 'processed_this_pass': 0}
    report['passes'].append(pass_record)
    spec = importlib.util.spec_from_file_location('identity_html', Path(__file__).with_name('check-adatours-com-model.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    opener = urllib.request.build_opener(SameSiteRedirect())
    robots_url = 'https://adatours.com/robots.txt'; robots = urllib.robotparser.RobotFileParser(robots_url)
    delay = 0
    try:
        with opener.open(urllib.request.Request(robots_url, headers={'User-Agent': UA}), timeout=20) as response:
            rb = response.read().decode('utf-8', errors='replace')
            robots.parse(rb.splitlines())
            report['robots'] = {'url': robots_url, 'http_status': response.status, 'checked_at': now(),
                                'sha256': hashlib.sha256(rb.encode()).hexdigest(), 'text': rb}
            delay = robots.crawl_delay(UA) or robots.crawl_delay('*') or 0
            rate = robots.request_rate(UA) or robots.request_rate('*')
            if rate: delay = max(delay, rate.seconds / rate.requests)
    except urllib.error.HTTPError as exc:
        report['robots'] = {'url': robots_url, 'http_status': exc.code, 'checked_at': now()}
        if exc.code == 404: robots.parse([])
        else:
            report['stop_reason'] = 'robots_access_error'
            save(report_path, report)
            print(json.dumps({'stopped': report['stop_reason'], 'http': exc.code}), flush=True)
            return
    except Exception as exc:
        report['stop_reason'] = 'robots_access_error'; report['robots_error'] = str(exc)
        save(report_path, report); print(json.dumps({'stopped': report['stop_reason']}), flush=True); return

    def checkpoint(reason=None):
        if reason: report['stop_reason'] = reason
        statuses = Counter(x['status'] for x in report['results'])
        report['summary'] = {'processed': len(report['results']), **dict(statuses)}
        pass_record.update(finished_at=now(), elapsed_seconds=round(time.monotonic() - started, 1),
                           processed_this_pass=len(report['results']) - pass_record['processed_before'])
        done = {x['inventory_row'] for x in report['results']}
        remaining = [i for i in batch['inventory_row_indexes'] if i not in done]
        batch.update(status='partial' if remaining else 'completed', processed=len(done),
                     remaining=len(remaining), cursor=len(done), report='../' + report_path.name)
        queue.update(status='crawl_partial', crawl_cursor=sum(b.get('processed', 0) for b in queue['crawl_batches']))
        queue['retry_urls'] = list(dict.fromkeys(queue.get('retry_urls', []) + [x['requested_url'] for x in report['results'] if x['status'] == 'retry']))
        inventory['stats'].update(already_fetched=sum(x['status'] == 'fetched' for x in inventory['rows']),
                                  pending=sum(x['status'] == 'pending' for x in inventory['rows']),
                                  retry=sum(x['status'] == 'retry' for x in inventory['rows']),
                                  excluded_robots=sum(x['status'] == 'excluded_robots' for x in inventory['rows']))
        plan['active_step'] = 2
        plan['last_checkpoint'] = {'step': 2, 'domain': 'adatours.com', 'batch_id': batch_id,
                                  'processed_in_batch': len(done), 'remaining_in_batch': len(remaining),
                                  'report': report_path.name, 'saved_at': now()}
        next_batch = batch if remaining else next((b for b in queue['crawl_batches'] if b['status'] != 'completed'), None)
        if next_batch:
            plan['first_next_task'].update(id=next_batch['id'], status='partial' if remaining else 'pending',
                                          url_count=len(remaining) if remaining else len(next_batch['inventory_row_indexes']),
                                          action='Continue only this frozen actual-URL batch; skip processed rows. Maximum 300 URLs and 10 minutes; checkpoint and stop. No programme sameAs comparison.')
        else:
            queue['status'] = 'crawl_completed'; plan['completed_step'] = 2; plan['active_step'] = None
            plan['first_next_task'] = {'id': 'adatours-com-identity-001', 'step': 3, 'domain': 'adatours.com',
                                      'action': 'Compare up to 50 objects using saved IDs/pages. Confirm only exact identities.', 'status': 'pending'}
        save(report_path, report); save(ip, inventory); save(qp, queue); save(pp, plan)

    done = {x['inventory_row'] for x in report['results']}
    try:
        for index in batch['inventory_row_indexes']:
            if index in done: continue
            if time.monotonic() - started >= args.seconds:
                checkpoint('time_budget'); break
            row = inventory['rows'][index]; url = row['url']
            if row['status'] != 'pending':
                raise ValueError('Unaccounted non-pending row: ' + url)
            result = {'inventory_row': index, 'requested_url': url, 'checked_at': now(), 'status': 'retry'}
            suffix = urllib.parse.urlsplit(url).path.rstrip('/').rsplit('/', 1)[-1]
            result['collection_suffix'] = suffix if suffix in ('packages', 'excursions') else ''
            if not robots.can_fetch(UA, url) or not wildcard_robots_allowed(report['robots'].get('text', ''), url):
                result.update(status='excluded_robots', reason='robots.txt disallows this path')
            else:
                try:
                    with opener.open(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=20) as response:
                        raw = response.read(5 * 1024 * 1024 + 1)
                        if len(raw) > 5 * 1024 * 1024: raise ValueError('Response exceeds bounded HTML extraction size')
                        content_type = response.headers.get('Content-Type', '')
                        result.update(http_status=response.status, final_url=response.url, content_type=content_type,
                                      sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
                        if 'html' not in content_type.lower(): raise ValueError('Non-HTML response')
                        body = raw.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
                    p = module.HTML(); p.feed(body)
                    categories = sorted(set(re.findall(r'category_id=(\d+)', body)))
                    products = sorted(set(p.product_ids))
                    page_kinds = sorted(set(re.findall(r'page=(is[A-Za-z]+)', body)))
                    result.update(status='fetched', canonical=p.canonical, h1=' '.join(p.h1), title=' '.join(p.title),
                                  lang=p.lang, product_ids=products, category_ids=categories, template_markers=page_kinds,
                                  page_type='product' if products else 'category' if categories else 'other')
                    if not result['h1']: result['extraction_note'] = 'No H1; HTML fetched, entity identity unconfirmed.'
                    if not p.canonical: result['canonical_note'] = 'No canonical; do not infer a counterpart.'
                    if p.canonical and urllib.parse.urlsplit(p.canonical).hostname != 'adatours.com':
                        result['canonical_note'] = 'Canonical is outside selected domain; requires separate review.'
                except urllib.error.HTTPError as exc:
                    result.update(http_status=exc.code, error=str(exc))
                    if exc.code == 404: result.update(status='not_found', reason='Actual discovered URL returns 404; not a statement about counterpart absence.')
                except Exception as exc:
                    result['error'] = type(exc).__name__ + ': ' + str(exc)
            report['results'].append(result); done.add(index)
            row.update(status=result['status'], crawl_report=report_path.name, crawl_result_index=len(report['results']) - 1)
            if result['status'] == 'fetched':
                row.update({k: result[k] for k in ('http_status', 'canonical', 'h1', 'title', 'product_ids', 'category_ids', 'page_type')})
            if len(report['results']) % 10 == 0: checkpoint()
            print(json.dumps({'processed': len(report['results']), 'http': result.get('http_status'),
                              'status': result['status'], 'url': url, 'type': result.get('page_type')}, ensure_ascii=False), flush=True)
            if result.get('http_status') == 429:
                checkpoint('http_429'); break
            if delay:
                if time.monotonic() - started + delay >= args.seconds:
                    checkpoint('time_budget'); break
                time.sleep(delay)
        else:
            checkpoint('batch_completed')
    except KeyboardInterrupt:
        checkpoint('time_checkpoint_interrupt')
    finally:
        checkpoint(report.get('stop_reason', 'checkpoint'))
    print(json.dumps({'batch': batch_id, 'summary': report['summary'], 'remaining': batch['remaining'],
                      'stop_reason': report['stop_reason']}, ensure_ascii=False), flush=True)


if __name__ == '__main__': main()
