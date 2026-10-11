from pathlib import Path
import json,re,html,yaml,collections,xml.etree.ElementTree as ET
from urllib.parse import urlsplit,urlunsplit

import argparse,subprocess
parser=argparse.ArgumentParser(description="Refresh Ada Tours page/source inventory from a built site, without crawling legacy pages.")
parser.add_argument('--entities',required=True)
parser.add_argument('--live-sitemap',required=True)
parser.add_argument('--out',required=True)
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
SHA=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
GIT=f'https://github.com/alexyakovlev79/adatours.ru/blob/{SHA}/'
old=json.loads((ROOT/'data/external-identity/brasiltours-snapshots.json').read_text())['pages']
entries={p.stem:json.loads(p.read_text()) for p in (ROOT/'data/source-index/entries').glob('*.json')}
archive={r['id']:r for r in json.load(open(ROOT/'data/catalog-archive.json'))['entries']}
dest={r['id']:r for r in json.load(open(ROOT/'src/data/catalog/destinations.json'))}
countries={r['id']:r for r in json.load(open(ROOT/'data/source-index/catalogs/countries.json'))['entries']}
def norm(u):
 if not u:return ''
 p=urlsplit(u);return urlunsplit(('https',p.netloc.lower().removeprefix('www.'),p.path.rstrip('/') or '/',p.query,''))
old_by=collections.defaultdict(list)
for r in old:
 for u in {r.get('url_discovered'),r.get('url_final'),r.get('url_normalized'),r.get('canonical')}:
  if u:old_by[norm(u)].append(r)

entities={};epaths={}
for e in json.loads(Path(args.entities).read_text()):
 e['entry']=entries.get(e['id'],{})
 entities[e['id']]=e
 if e['path'] in epaths:raise ValueError('entity path collision '+e['path'])
 epaths[e['path']]=e

pages=[];redirects=[]
for p in sorted((ROOT/'dist').rglob('*.html')):
 rel=p.relative_to(ROOT/'dist').as_posix();path='/' + (rel[:-10] if rel.endswith('index.html') else rel)
 s=p.read_text()
 canon=re.search(r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"',s)
 canonical=html.unescape(canon[1]) if canon else ''
 title=re.search(r'<title>(.*?)</title>',s,re.S)
 robots=re.search(r'<meta[^>]*name="robots"[^>]*content="([^"]+)"',s)
 row={'path':path,'url':'https://adatours.ru'+path,'canonical':canonical,'title':html.unescape(title[1]) if title else path,'robots':robots[1] if robots else ''}
 refresh=re.search(r'<meta[^>]*http-equiv="refresh"[^>]*content="[^"]*url=([^"]+)"',s)
 if refresh or (canonical and urlsplit(canonical).path!=path):
  row['target']=canonical or 'https://adatours.ru'+html.unescape(refresh[1]);redirects.append(row)
 else:pages.append(row)

static_types={'home':'/','luxury_vip':'/vip/','mice':'/mice/','about_company':'/about/','contact':'/contacts/','legal':'/dmc/terms/'}
static_sources={}
for typ,path in static_types.items():
 rs=[r for r in old if r['current_page_type']==typ]
 if len(rs)==1:static_sources[path]=rs[0]['url_discovered']
theme_by_slug={}
theme_old={'adventure':'priklyucheniya','beach-holidays':'plyazhnye-tury','diving':'dajving','family-tours':'semejnyj-otdykh','fishing':'rybalka','food-and-wine':'vinnyi-tury','motorcycle-tours':'moto-tury','spa':'spa-zdorove','weddings-and-romance':'svadby-i-romantika'}
for a,b in theme_old.items():static_sources[f'/interests/{a}/']='https://brasiltours.ru/'+b
static_sources['/interests/']='https://brasiltours.ru/tematicheskie-tury'
static_sources['/multi-country/']='https://brasiltours.ru/tury-v-neskolko-stran'
for e in entities.values():
 if e['type']=='theme':
  en=e['entry'];s=en.get('sourceUrl')
  if s:theme_by_slug[e['path']]=s

catalog_paths=set()
for pe in entities.values():
 if pe['type']=='destination': catalog_paths.add(f'/{countries[pe["data"]["countryId"]]["slug"]}/{pe["data"]["slug"]}/')
published={p['path']:p for p in pages}; entity_rows=[]; detail_matches={}; exact_count=0
for p in pages:
 e=epaths.get(p['path']); entry=e['entry'] if e else {}; src=entry.get('sourceUrl') or (dest.get(e['id'],{}).get('sourceUrl') if e else None)
 if src and urlsplit(src).hostname not in ('brasiltours.ru','www.brasiltours.ru'): src=None
 status='АРХИВ' if e and e['id'] in archive else 'АКТИВНАЯ'
 typ=e['type'] if e else ('pagination' if '/page/' in p['path'] else 'catalog' if any(x in p['path'] for x in ['/tour/','/place/','/excursion/']) or p['path'] in catalog_paths or p['path'].startswith('/vip/') or p['path'] in ['/tours/','/places/','/excursions/','/country/','/interests/'] or p['path'].startswith('/interests/') else 'webpage')
 orig=entry.get('text',{}).get('original',{}); selected=entry.get('text',{}).get('selected',{}); verification=entry.get('text',{}).get('verification',{})
 match='НЕТ ОТДЕЛЬНОЙ ПАРЫ'; relation=''; explanation='В сохранённой базе отдельный аналог не закреплён.'
 if src:
  match='ТОЧНАЯ ПАРА В РЕЕСТРЕ';relation='sameAs — кандидат'; explanation='Постоянный ID → точный sourceUrl. Подтверждена миграционная связь; актуальность старого продукта перед разметкой проверить.'
  exact_count+=1;detail_matches.setdefault(norm(src),[]).append(p['url'])
 elif p['path'] in static_sources:
  src=static_sources[p['path']];match='ФУНКЦИОНАЛЬНЫЙ АНАЛОГ';relation='Не sameAs страницы';explanation='Совпадает назначение раздела; это не подтверждение идентичности документа.'
 elif e:
  if e['type']=='theme': explanation='Тематическая страница; отдельное соответствие старой рубрике пока не подтверждено.'
  else:explanation='Новая самостоятельная сущность / материалы Анны / редакционный материал. Не подставлять URL родительского тура как sameAs.'
 if typ in ['catalog','pagination']:
  basepath=re.sub(r'page/\d+/$','',p['path'])
  parent=None;suffix=''
  for pe in entities.values():
   if pe['type']=='country':
    if basepath==pe['path']+'tour/':parent=pe;suffix='/packages';break
    if basepath==pe['path']+'excursion/':parent=pe;suffix='/ekskursii';break
   if pe['type']=='destination':
    if basepath==pe['path']+'tour/':parent=pe;suffix='/packages';break
    c=countries[pe['data']['countryId']]['slug']
    if basepath==f'/{c}/{pe["data"]["slug"]}/':parent=pe;suffix='/ekskursii';break
  candidate=(parent['entry'].get('sourceUrl') or dest.get(parent['id'],{}).get('sourceUrl')) if parent else None
  if candidate and norm(candidate.rstrip('/')+suffix) in old_by:
   src=candidate.rstrip('/')+suffix;match='ТЕМАТИЧЕСКИЙ АНАЛОГ';relation='Не sameAs';explanation='Каталог той же географии и типа. Состав и разбиение на страницы различаются; одинаковые сущности не означают одинаковые коллекции.'
 rs=old_by.get(norm(src),[]) if src else []
 rs=list({r['ID']:r for r in rs}.values());r=next((r for r in rs if r['url_discovered']==src),rs[0] if rs else {})
 if src and not rs and match=='ТОЧНАЯ ПАРА В РЕЕСТРЕ':explanation+=' URL не найден в описи обхода 23.09; есть позднее закрепление в source-index.'
 if status=='АРХИВ':relation='Не добавлять автоматически';explanation+=' Архив: страница доступна с noindex; не возвращать в активные объекты.'
 row=[p['url'], e['id'] if e else '', e['name'] if e else p['title'],typ,status,src or '',match,relation,r.get('ID',''),r.get('status',''),r.get('original_text_file',''),orig.get('url',''),selected.get('url',selected.get('repositoryPath','')),GIT+'data/source-index/entries/'+e['id']+'.json' if e and entry else GIT+e['contentPath'] if e else GIT+'src/pages/',GIT+e['contentPath'] if e else '',verification.get('method',''),archive.get(e['id'],{}).get('duplicateOf','') if e else '',explanation]
 entity_rows.append(row);p['entity']=e['id'] if e else '';p['type']=typ;p['status']=status;p['source']=src or '';p['match']=match

current_by_old=collections.defaultdict(list)
for row in entity_rows:
 if row[5]:current_by_old[norm(row[5])].append(row)
hashmaps=collections.defaultdict(list)
for r in old:
 if r.get('exact_text_hash') and r['current_page_type'] in ['country_hub','city_region_hub','tour_detail','excursion_detail']:
  for rr in current_by_old[norm(r['url_discovered'])]:
   if rr[6]=='ТОЧНАЯ ПАРА В РЕЕСТРЕ':hashmaps[(r['current_page_type'],r['exact_text_hash'])].append(rr)
old_rows=[]
for r in old:
 pairs=[]
 for u in {r.get('url_discovered'),r.get('url_final'),r.get('url_normalized')}:
  pairs.extend(current_by_old[norm(u)])
 pairs=list({x[0]:x for x in pairs}.values());method='ЯВНАЯ ПАРА' if pairs else 'НЕТ ПАРЫ'
 if not pairs:
  pairs=list({x[0]:x for x in hashmaps.get((r['current_page_type'],r.get('exact_text_hash')),[])}.values())
  if pairs:method='ТОЧНЫЙ ДУБЛИКАТ СНИМКА — ПРОВЕРИТЬ'
 if not pairs: pairs=[None]
 for rr in pairs:
  sr=next((e for e in entries.values() if e.get('sourceUrl') and norm(e['sourceUrl'])==norm(r['url_discovered']) and not (ROOT/e['contentPath']).exists()),None) if not rr else None
  old_rows.append([r['url_discovered'],r['ID'],r.get('h1') or r.get('title') or '',r['current_page_type'],r['status'],r['url_final'],r.get('canonical') or '',r.get('original_text_file') or '',rr[0] if rr else '',rr[1] if rr else sr['id'] if sr else '',rr[4] if rr else 'АРХИВ БЕЗ СТРАНИЦЫ' if sr else '',method if not sr else 'ИСХОДНИК В РЕЕСТРЕ; НЕТ СТРАНИЦЫ',rr[6] if rr else '',r.get('duplicate_group') or '',r.get('exact_text_hash') or '', ('Снимок 23.09.2026; код ответа исторический. '+('Сходство сохранённого тела не подтверждает актуальную идентичность продукта.' if 'ДУБЛИКАТ' in method else '')).strip()])

redirect_rows=[]
for r in redirects:
 target=next((p for p in pages if p['url']==r['target']),None)
 redirect_rows.append([r['url'],r['target'],target.get('entity','') if target else '',target.get('source','') if target else '',r['title'], 'Исторический alias; в schema использовать конечный canonical.'])

live=[]
try:
 live=[x.text for x in ET.parse(args.live_sitemap).getroot().iter() if x.tag.endswith('loc')]
except Exception:pass
built_sitemap=[x.text for x in ET.parse(ROOT/'dist/sitemap-0.xml').getroot().iter() if x.tag.endswith('loc')]
stats={'old_discovered':len(old),'ru_generated':len(pages)+len(redirects),'ru_canonical':len(pages),'ru_redirects':len(redirects),'published_entities':sum(bool(p.get('entity')) for p in pages),'exact_registry_pairs':exact_count,'archived_pages':sum(p['status']=='АРХИВ' for p in pages),'types':dict(collections.Counter(p['type'] for p in pages)), 'matches':dict(collections.Counter(p['match'] for p in pages)),'old_unique_matched':len({r[0] for r in old_rows if r[8]}),'old_match_rows':len(old_rows),'live_sitemap_count':len(live),'built_sitemap_count':len(built_sitemap),'only_build':sorted(set(built_sitemap)-set(live)),'only_live':sorted(set(live)-set(built_sitemap)),'snapshot_commit':SHA}
out={'pages':pages,'entity_rows':entity_rows,'old_rows':old_rows,'redirect_rows':redirect_rows,'stats':stats,'old_pages':old}
json.dump(out,open(Path(args.out),'w'),ensure_ascii=False)
print(json.dumps(stats,ensure_ascii=False,indent=2)[:4500])
