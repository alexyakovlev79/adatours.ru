#!/usr/bin/env python3
"""Reproduce NAME-BASED CANDIDATE proposals from a safe manifest and local Git.

This does NOT perform semantic matching or authorize translation/publication.
Inputs contain no private working snapshots or downloaded DOCX. The default
revision is the exact baseline recorded by programme-sources.json. All reads
use that Git revision, not a possibly changing working tree. Requires PyYAML.

Example:
python3 build-candidate-matches.py --repo /path/to/adatours.ru \
  --sources /path/to/programme-sources.json --pilot /path/to/word-pilot-review.json \
  --output /path/to/rebuilt-tour-word-matches.json

For a new snapshot, refresh the safe source manifest and pass an explicit full
commit SHA with --revision. Read existing semantic decisions separately; only
unchanged pilot hashes are carried forward by this initial implementation.
"""
import argparse, collections, difflib, functools, hashlib, json, re, subprocess, sys, unicodedata
from pathlib import Path
try:
    import yaml
except ImportError:
    raise SystemExit('PyYAML is required; install it in the task environment before running this script.')

GENERATOR_VERSION='word-candidate-matches-v1'
POLICY=('Candidate evidence only. Filename similarity and prior RU source mapping cannot authorize block reuse; '
        'compare full itinerary, optional services, inclusions and commercial version. '
        '2026 is considered only after a recorded 2027 decision. AI-only is forbidden until both '
        'searches, alternate names and quarantined programme candidates are substantively exhausted. '
        'nameSimilarity is a string similarity, never an identity confidence score.')

def sha(raw): return hashlib.sha256(raw).hexdigest()
def git(repo,*args,input=None):
    return subprocess.run(['git','-C',str(repo),*args],input=input,stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE,check=True).stdout
def read_files(repo,revision,paths):
    specs=[revision+':'+p for p in paths]
    raw=git(repo,'cat-file','--batch',input=('\n'.join(specs)+'\n').encode())
    out={};pos=0
    for path in paths:
        end=raw.index(b'\n',pos);header=raw[pos:end].decode();pos=end+1
        if header.endswith(' missing'):
            out[path]=None;continue
        _,kind,size=header.split();size=int(size)
        if kind!='blob': raise ValueError('Expected file blob: '+path)
        out[path]=raw[pos:pos+size];pos+=size+1
    return out
def frontmatter(raw,path):
    text=raw.decode('utf-8');parts=re.split(r'^---\s*$',text,maxsplit=2,flags=re.M)
    if len(parts)!=3:raise ValueError('Missing YAML frontmatter: '+path)
    value=yaml.safe_load(parts[1])
    if not isinstance(value,dict):raise ValueError('Invalid frontmatter: '+path)
    return value
def norm(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    s=re.sub(r'\.(docx?|pdf|md)$','',s);s=re.sub(r'\(\d+\)',' ',s)
    s=s.replace('_',' ').replace('&',' and ');s=re.sub(r'20(?:26|27|28)',' ',s)
    s=re.sub(r'\b(?:rus|ru|eng|en|english|russian|net|com|comm|usd|ada tours|docx|to complete)\b',' ',s)
    s=re.sub(r'\b(?:com|comm)\s*\d+\s*%?',' ',s)
    s=re.sub(r'\b(?:10|20|500)\s*%?\b',' ',s)
    s=re.sub(r'(\d+)\s*d\s*(\d+)\s*n',r' \1d\2n ',s)
    return ' '.join(re.sub(r'[^a-z0-9]+',' ',s).split())
def filename_days(s):
    m=re.search(r'(\d+)\s*[dD]\s*(\d+)\s*[nN]',s)
    return int(m.group(1)) if m else None
@functools.lru_cache(maxsize=500000)
def similarity(a,b):return difflib.SequenceMatcher(None,a,b).ratio()

def build(args):
    source_bytes=args.sources.read_bytes();sources=json.loads(source_bytes)
    revision=args.revision or sources['repositoryCommit']
    if not re.fullmatch(r'[0-9a-fA-F]{40}',revision):raise ValueError('Use an exact 40-character commit SHA.')
    revision=git(args.repo,'rev-parse','--verify',revision+'^{commit}').decode().strip()
    paths=git(args.repo,'ls-tree','-r','--name-only',revision,'--','src/content/tours/').decode().splitlines()
    paths=sorted(p for p in paths if p.endswith('.md'))
    blobs=read_files(args.repo,revision,paths);tours=[]
    for path in paths:
        d=frontmatter(blobs[path],path)
        tours.append({'entityId':d['id'],'path':path,'raw':blobs[path],'data':d})
    ids=[t['entityId'] for t in tours]
    if len(set(ids))!=len(ids):raise ValueError('Duplicate Tour IDs at source revision.')
    entry_paths=['data/source-index/entries/'+t['entityId']+'.json' for t in tours]
    mapping_path='data/audits/tour-inventory-drive-20261009.json'
    inputs=read_files(args.repo,revision,entry_paths+[mapping_path])
    if inputs[mapping_path] is None:raise ValueError('The documented RU programme mapping is missing at the revision.')
    mapping=json.loads(inputs[mapping_path])['programs'];extra=collections.defaultdict(list)
    for p in mapping:
        for eid in p.get('entityIds',[]):extra[eid].append({'name':p['name'],'evidence':'existing_ru_programme_mapping:'+p['key']})
    documents=sources['documents'];source_ids=[d['driveFileId'] for d in documents]
    if len(set(source_ids))!=len(source_ids):raise ValueError('Duplicate source file IDs in manifest.')
    source_by_id={d['driveFileId']:d for d in documents};files=[]
    for d in documents:
        if int(d['sourceYearFolder']) not in {2027,2026}:continue
        years=re.findall(r'\b20(?:26|27|28)\b',d['name'])
        files.append((d,norm(d['name']),filename_days(d['name']),bool(years and str(d['sourceYearFolder']) not in years)))
    out=[]
    for t in sorted(tours,key=lambda t:t['entityId']):
        d=t['data'];entry_path='data/source-index/entries/'+t['entityId']+'.json'
        entry=json.loads(inputs[entry_path]) if inputs[entry_path] else {};names=[]
        for field,label in [('selected','sourceSelected'),('original','sourceOriginal')]:
            value=entry.get('text',{}).get(field) or {};name=value.get('name','') if isinstance(value,dict) else ''
            if name.lower().endswith(('.doc','.docx','.pdf')):names.append({'name':name,'evidence':label})
        names+=extra[t['entityId']];keys=[(norm(n['name']),n['evidence']) for n in names];slugkey=norm(str(d['slug']).replace('-',' '));candidates={}
        for year in [2027,2026]:
            ranked=[]
            for src,namekey,fd,edition_conflict in files:
                if int(src['sourceYearFolder'])!=year:continue
                best=0;reason='english_slug_similarity';exact=False
                for k,evidence in keys:
                    score=similarity(k,namekey)
                    if score>best:best=score;reason=evidence;exact=k==namekey
                score=similarity(slugkey,namekey)
                if not keys or score>best:best=score;reason='english_slug_similarity';exact=False
                td=d.get('durationDays');duration=None if fd is None or td is None else fd==td
                ranking=best+(0.06 if duration is True else (-0.22 if duration is False else 0))-(0.12 if edition_conflict else 0)
                if best<0.48 or ranking<0.5:continue
                ranked.append((ranking,{'driveFileId':src['driveFileId'],'candidateReason':reason,'nameSimilarity':round(best,4),'filenameDurationDays':fd,'durationAgrees':duration,'editionYearConflict':edition_conflict,'exactNormalizedSourceStem':exact}))
            candidates[str(year)]=[c for _,c in sorted(ranked,key=lambda x:(-round(x[0],4),x[1]['driveFileId']))[:4]]
        archived=d.get('status')=='archived'
        out.append({'entityId':t['entityId'],'ruContentPath':t['path'],'ruTitle':d.get('title'),'ruStatus':d.get('status'),'durationDays':d.get('durationDays'),'status':'excluded_archived' if archived else 'needs_semantic_matching','selectedSource':None,'aiOnlyEligible':False,'candidates':candidates})
    pilot_skipped=[];accepted=0
    if args.pilot:
        pilot=json.loads(args.pilot.read_bytes());by_id={t['entityId']:t for t in tours};out_by_id={t['entityId']:t for t in out}
        for r in pilot['reviews']:
            eid=r['entityId'];fid=r['source']['driveFileId'];t=by_id.get(eid);src=source_by_id.get(fid)
            valid=(t and src and t['data'].get('status')!='archived' and sha(t['raw'])==r['ruBlobSHA256']
                   and src.get('modifiedTime')==r['source'].get('modifiedTime')
                   and src.get('name')==r['source'].get('name') and r.get('matchDecision')=='confirmed_entity_identity')
            if not valid:pilot_skipped.append({'entityId':eid,'reason':'source_or_RU_baseline_changed_or_missing'});continue
            row=out_by_id[eid];row['status']='identity_confirmed_block_alignment_pending'
            row['selectedSource']={'driveFileId':fid,'sourceYearFolder':src['sourceYearFolder'],'sourceSha256':r['source']['sourceSha256'],'purpose':'text_reference','reviewPath':args.pilot.name,'publicationAllowed':False};accepted+=1
    counts={'totalTours':len(out),'activeTours':sum(t['ruStatus']!='archived' for t in out),'archivedTours':sum(t['ruStatus']=='archived' for t in out),'activeWith2027Candidates':sum(t['ruStatus']!='archived' and bool(t['candidates']['2027']) for t in out),'activeWith2026Candidates':sum(t['ruStatus']!='archived' and bool(t['candidates']['2026']) for t in out),'activeWithExact2027SourceStem':sum(t['ruStatus']!='archived' and any(c['exactNormalizedSourceStem'] for c in t['candidates']['2027']) for t in out),'verifiedEntityPairs':accepted}
    return {'schemaVersion':1,'repositoryCommit':revision,'observedAt':sources['observedAt'],'policy':POLICY,'generation':{'generatorVersion':GENERATOR_VERSION,'sourceManifestSha256':sha(source_bytes),'ruMappingPath':mapping_path,'ruMappingSha256':sha(inputs[mapping_path]),'pilotReviewSha256':sha(args.pilot.read_bytes()) if args.pilot else None,'pilotDecisionsNotCarriedForward':pilot_skipped,'completeSemanticMatching':False},'counts':counts,'matches':out}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,required=True);p.add_argument('--sources',type=Path,required=True);p.add_argument('--pilot',type=Path);p.add_argument('--revision');p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    result=build(args);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['counts']))
if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,subprocess.CalledProcessError) as e:
        print('Candidate generation failed: '+str(e),file=sys.stderr);raise SystemExit(1)
