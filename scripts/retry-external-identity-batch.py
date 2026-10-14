#!/usr/bin/env python3
"""One bounded retry batch. Preserve initial crawl evidence; do not decide sameAs."""
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

ROOT=Path(__file__).resolve().parents[1]/'data/external-identity'
UA='AdaTours identity research'
def now(): return datetime.now(timezone.utc).isoformat()
def save(path,v):
    tmp=path.with_suffix('.tmp')
    tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
    tmp.replace(path)
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(file))
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def main():
    started=time.monotonic()
    crawl=module('identity_crawl','crawl-external-identity-batch.py')
    html=module('identity_html','check-adatours-com-model.py')
    qp=ROOT/'work-queues-20261012/adatours.com.json'
    ip=ROOT/'adatours-com-url-inventory-20261012.json'
    pp=ROOT/'work-queues-20261012/plan.json'
    q=json.loads(qp.read_text()); inv=json.loads(ip.read_text()); plan=json.loads(pp.read_text())
    bid=plan['first_next_task']['id']
    batch=next(b for b in q['retry_batches'] if b['id']==bid)
    rp=ROOT/(bid+'.json')
    report=json.loads(rp.read_text()) if rp.exists() else {'format_version':1,'batch_id':bid,'domain':'adatours.com','scope':'One separate retry request per saved failed URL. Initial reports unchanged. No sameAs confirmations.','frozen_inventory_rows':batch['inventory_row_indexes'],'results':[],'passes':[]}
    assert report['frozen_inventory_rows']==batch['inventory_row_indexes']
    pass_record={'started_at':now(),'requested_budget_seconds':360,'processed_before':len(report['results'])}
    report['passes'].append(pass_record)
    opener=urllib.request.build_opener(crawl.SameSiteRedirect())
    def apply_result(n,res):
        row=inv['rows'][res['inventory_row']]
        row.setdefault('crawl_history',[])
        previous=res['previous_observation']
        if previous not in row['crawl_history']: row['crawl_history'].append(previous)
        row.update(status=res['status'],crawl_report=rp.name,crawl_result_index=n)
        if res['status']=='fetched':
            row.update({k:res[k] for k in ('http_status','canonical','h1','title','product_ids','category_ids','page_type')})
    for n,res in enumerate(report['results']): apply_result(n,res)
    def checkpoint(reason):
        report['stop_reason']=reason
        done={r['inventory_row'] for r in report['results']}
        remaining=[n for n in batch['inventory_row_indexes'] if n not in done]
        counts=Counter(r['status'] for r in report['results'])
        report['summary']={'processed':len(done),**dict(counts),'page_types':dict(Counter(r.get('page_type','unknown') for r in report['results'] if r['status']=='fetched'))}
        pass_record.update(finished_at=now(),elapsed_seconds=round(time.monotonic()-started,1),processed_this_pass=len(done)-pass_record['processed_before'])
        batch.update(status='partial' if remaining else 'completed',processed=len(done),remaining=len(remaining),cursor=len(done),report='../'+rp.name)
        q['retry_urls']=[r['url'] for r in inv['rows'] if r['status']=='retry']
        stats=Counter(r['status'] for r in inv['rows'])
        inv['stats'].update(already_fetched=stats['fetched'],pending=stats['pending'],retry=stats['retry'],excluded_robots=stats['excluded_robots'])
        q['status']='crawl_pending_retries' if remaining else ('crawl_completed_with_unresolved_errors' if stats['retry'] else 'crawl_completed')
        plan['last_checkpoint']={'step':2,'domain':'adatours.com','batch_id':bid,'processed_in_batch':len(done),'remaining_in_batch':len(remaining),'unresolved_retry_urls':stats['retry'],'report':rp.name,'saved_at':now()}
        if remaining:
            plan['first_next_task'].update(status='partial',url_count=len(remaining))
        else:
            plan.update(completed_step=2,active_step=None)
            plan['first_next_task']={'id':'adatours-com-identity-001','step':3,'domain':'adatours.com','action':'Compare up to 50 current RU objects with saved fetched pages and IDs. Confirm exact identities only. Unresolved retrieval errors are not negative matches. Reconcile target ID, canonical URL and archive status before this batch.','status':'pending','object_limit':50,'queue':'adatours.com.json','inventory':'adatours-com-url-inventory-20261012.json'}
        save(rp,report);save(ip,inv);save(qp,q);save(pp,plan)
    try:
        with opener.open(urllib.request.Request('https://adatours.com/',method='HEAD',headers={'User-Agent':UA}),timeout=20) as response:
            report['preflight']={'url':'https://adatours.com/','method':'HEAD','checked_at':now(),'http_status':response.status,'final_url':response.url,'content_type':response.headers.get('Content-Type',''),'status':'access_confirmed_this_pass'}
        robots_url='https://adatours.com/robots.txt'
        with opener.open(urllib.request.Request(robots_url,headers={'User-Agent':UA}),timeout=20) as response:
            raw=response.read(1024*1024)
            text=raw.decode('utf-8',errors='replace')
            report['robots']={'url':robots_url,'http_status':response.status,'checked_at':now(),'sha256':hashlib.sha256(raw).hexdigest(),'text':text}
        robots=urllib.robotparser.RobotFileParser(robots_url);robots.parse(text.splitlines())
        delay=robots.crawl_delay(UA) or robots.crawl_delay('*') or 0
        rate=robots.request_rate(UA) or robots.request_rate('*')
        if rate: delay=max(delay,rate.seconds/rate.requests)
    except Exception as exc:
        report['access_error']=type(exc).__name__+': '+str(exc)
        checkpoint('access_check_failed')
        print(json.dumps({'stopped':'access_check_failed','error':str(exc)}),flush=True)
        return
    done={r['inventory_row'] for r in report['results']}
    reason='batch_completed'
    try:
        for index in batch['inventory_row_indexes']:
            if index in done: continue
            if time.monotonic()-started>=360:
                reason='time_budget';break
            row=inv['rows'][index];url=row['url']
            assert row['status']=='retry'
            previous={k:v for k,v in row.items() if k!='crawl_history'}
            res={'inventory_row':index,'requested_url':url,'checked_at':now(),'status':'retry','previous_observation':previous}
            suffix=urllib.parse.urlsplit(url).path.rstrip('/').rsplit('/',1)[-1]
            res['collection_suffix']=suffix if suffix in ('packages','excursions') else ''
            if not robots.can_fetch(UA,url) or not crawl.wildcard_robots_allowed(text,url):
                res.update(status='excluded_robots',reason='robots.txt disallows this path')
            else:
                try:
                    with opener.open(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=20) as response:
                        raw=response.read(5*1024*1024+1)
                        if len(raw)>5*1024*1024: raise ValueError('Response exceeds bounded HTML extraction size')
                        content_type=response.headers.get('Content-Type','')
                        res.update(http_status=response.status,final_url=response.url,content_type=content_type,sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
                        if 'html' not in content_type.lower():raise ValueError('Non-HTML response')
                        body=raw.decode(response.headers.get_content_charset() or 'utf-8',errors='replace')
                    parser=html.HTML();parser.feed(body)
                    cats=sorted(set(re.findall(r'category_id=(\d+)',body)));products=sorted(set(parser.product_ids))
                    res.update(status='fetched',canonical=parser.canonical,h1=' '.join(parser.h1),title=' '.join(parser.title),lang=parser.lang,product_ids=products,category_ids=cats,template_markers=sorted(set(re.findall(r'page=(is[A-Za-z]+)',body))),page_type='product' if products else 'category' if cats else 'other')
                    if not res['h1']:res['extraction_note']='No H1; entity identity unconfirmed.'
                    if not parser.canonical:res['canonical_note']='No canonical; do not infer a counterpart.'
                    if parser.canonical and urllib.parse.urlsplit(parser.canonical).hostname!='adatours.com':res['canonical_note']='Canonical outside selected domain; requires separate review.'
                except urllib.error.HTTPError as exc:
                    res.update(http_status=exc.code,error=str(exc))
                    if exc.code==404:res.update(status='not_found',reason='Discovered URL returns 404; not counterpart absence.')
                except Exception as exc:res['error']=type(exc).__name__+': '+str(exc)
            report['results'].append(res);done.add(index);apply_result(len(report['results'])-1,res)
            if len(done)%10==0:checkpoint('checkpoint')
            print(json.dumps({'processed':len(done),'status':res['status'],'http':res.get('http_status'),'url':url}),flush=True)
            if res.get('http_status')==429:reason='http_429';break
            if 'Tunnel connection failed: 403 Forbidden' in res.get('error',''):reason='proxy_connect_403';break
            if delay:
                if time.monotonic()-started+delay>=360:reason='time_budget';break
                time.sleep(delay)
    except KeyboardInterrupt:reason='time_checkpoint_interrupt'
    finally:checkpoint(reason)
    print(json.dumps({'batch':bid,'summary':report['summary'],'remaining':batch['remaining'],'stop_reason':reason}),flush=True)

if __name__=='__main__':main()
