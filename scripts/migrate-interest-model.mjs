import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import yaml from 'js-yaml';
import { isActiveEntity } from '../src/lib/archive.mjs';

// One-time, reviewed entity decisions, not a keyword classifier or build-time inference.
const decisions = {"tours":{"count":285,"idsSha":"72fbdae6f19481c0a548ddb9b5651d3699ecd72af51c9c1832c298360574ca32","textSha":"7aeed106b592fa878a207d1c344811133c3a80daaf1c26ae32bb7f1b5a53fa4d","codes":"CN NB CN CN NB AN|B AN AN|C AN|C XN XN N|C XN XN XN NC|G NC A|N NC NB|C N|C NG|C NC N|C G|C CN NG|C AN|CB B|N N|CB C AN|CB CN GC|N NB|C CB|N B|NC CB|N CN NC CN N|CB EC|N CB|N YB|NC B|NC NC CB|N NC|G C|N NC NC NC N|C NC N|C C|NG AC|N CB|NA C|B NC|B N|B N CN BC AN|BFD AN|C NC N NC NC E|NC E|NC EB|CN CA|NBG CB|N XN C|N CB|N CN|B R CG|N N|C AN|CB CB|N E|CN E|CN XN N|G C C G|CN C|N C|B CB|GN CG|N GC|N CN|GB C NC|G C C C NC NX|CS N NB ND NB|A N N|G N|AG CN NB|A N|A AN|B NC N CB NC|G AC|BN AC|BN AC|BN BN|C BN|C NC CN|A N|BA NB|CGA C|B C|B C CN|B GC NB BN|C N EB|CN E|NC NC NB|A NB|CG NC|XA N CB CG C|N CN C|N NC E|CN E|CN CN EC CB|N C CB C|N C C M|AC M|AC NC BC|N EB|CN EB|CN EB|CN E|C XN|A NC|B XB|C CN|B C NB|CG NC|B NC|B CN N N|C NA N E|C XN C|N C|N C|N EC|N CG C NC|XA NC NB|C CB NC CN EN|C A|N NC|B NC NC|AG NC N|C F BN|C NB|C R NC F|N CN RB|C N|CG F|N FG NC N CN CN NC|G NB|CA CN CN BC CN N BC EB|C EB|C EB|C CN|GB NC NC NC N E|CN NC|B NB|AC CN GC|N NA|GC NC|B YB|NC CB|N NG|C NB|C CB|GN CB|GN CN|GB CB|N CB|N N N|AC NG|C GC|B GC NC NC N|CB NB|CA AN NC|S NC NC|A C|N CN CB|N C|N GC N|C NC|G CG NC|XG CN EN|BC EN|BC NC CN|G CB|N C|GN NC NC NC|AG CN R AC|NB N|ABG"},"excursions":{"count":188,"idsSha":"0c4d2e537128d2d22cfa401ff78f394aa73effc7bcf20b3135393b55110f19e7","textSha":"74de402c363ea3a88ec41d273815c4112514c162cc60e435d9c5a8dd2baf51d2","codes":"AND N C N NC N N N C B CG N B C G N B NBC NC N C N NG N CG A NA C AN C CY C C N NC C CA CG CG CG C G NG C NC FN N N C C C B GNC - N - NC C N C AN N C C G C NC N C C C AN N C C AN NC G G C N G C CG N B C C N CN C C C C C C C CN F NB N N B N N NC C AN SN N N AN CN N C NC A A C N N A C N N N C C C G C N C CB C CG C C C F NC C CN C C C C C C C C C C C N N N NB - AN AN AN AN B BN NC C C CN A N NA N AN A N N NC N N N AN AN N C G N C"},"destinations":{"count":216,"idsSha":"f97ccf566dc5d4f2c6e96c8eefd67cdce65986df055d8a8078d1921bc2f16d6c","textSha":"e14234223147212ce64fb92cb39ea953a95c3ee0aae8205777a7f7e76c23be23","codes":"BC BDN BN C CN BCDF CG SN CNB ANG C C C BN GN AN C C BDA C C BS CN C C NC C NA NA CE C DBN BANC BAD NA ND C C CN C C N BAF AN NAC NC BG BDAN BN BAN DANF CS BD C NA C C CN N BC C CBD CS CN GN C BN C C C NG C D CN C N CN NC C BD NA C CNB C CN C N NDB CA C NFC BA B BN NGC CN C CN GC CN BF CA BN N C C BN N NC BN CG CB CE CN CE BDCN BA NA CNB BNF C C N CN C NF N C CBN GNC CN CN GN B BC BD BAF BN NB C BAN BC C C BAN BCN BA N CBEADF N NA BCN BNDA C C B CN BY CB NA CBE C BDA CN CB NB BD C CGN BAF CN C NC AN C CGN N C CN BD C CG CE C CGE N BC C C C C - C CE C C C CN N C CA CBN BN CEGN CGN NA D N NAC CB BD CEG C CA BDF C"}};
const codes = {A:'theme_adventure',N:'theme_wildlife',C:'theme_culture',X:'theme_cruises',E:'theme_events',B:'theme_beach',G:'theme_gastronomy_wine',F:'theme_fishing',D:'theme_diving',M:'theme_motorcycle',Y:'theme_family',S:'theme_spa',R:'theme_weddings_romance'};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const writeJson = (p,d) => fs.writeFileSync(p, JSON.stringify(d,null,2)+'\n');
const readJson = p => JSON.parse(fs.readFileSync(p,'utf8'));
const parse = raw => {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(m,'Missing frontmatter');
  return {data:yaml.load(m[1]), fm:m[1], body:raw.slice(m[0].length)};
};
const readCollection = collection => fs.readdirSync(`src/content/${collection}`).filter(p=>p.endsWith('.md')).sort().map(name=>{
  const p=`src/content/${collection}/${name}`;
  return {path:p,...parse(fs.readFileSync(p,'utf8'))};
});
const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([key])=>!['image','images','hero','gallery','alt','caption','updatedAt','src','intendedSlot'].includes(key)).map(([k,v])=>[k,clean(v)])) : value;
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])) : value;
const snapshot = {};
for (const [collection, config] of Object.entries(decisions)) {
  const rows=readCollection(collection).filter(r=>r.data.locale==='ru' && isActiveEntity(r.data));
  assert.equal(rows.length,config.count,`${collection}: entity count changed; review required`);
  assert.equal(sha(rows.map(r=>r.data.id).join('\n')),config.idsSha,`${collection}: identity sequence changed`);
  const substantive=rows.map(({data:d,body})=>({id:d.id,title:d.title??d.name??'',lead:d.lead??d.summary??'',body,itinerary:clean(d.itinerary??[])}));
  assert.equal(sha(JSON.stringify(stable(substantive))),config.textSha,`${collection}: substantive content changed; review required`);
  snapshot[collection]=rows;
}
if (fs.existsSync('data/interest-annotations.json')) {
  console.log('Interest migration already applied; no annotations overwritten.');
  process.exit(0);
}
const compressed=Buffer.concat([0,1,2,3,4].map(i=>fs.readFileSync(`scripts/.interest-migration-parts/${i}`)));
const patch=execFileSync('bzip2',['-dc'],{input:compressed,maxBuffer:8*1024*1024});
assert.equal(sha(patch),'125aaf3011e094c40fafa1163e889e538672f6b25bb974e445486c09b479263c');
execFileSync('git',['apply','--check','-'],{input:patch});
execFileSync('git',['apply','-'],{input:patch});
function patchMd(p, fields, remove=[]) {
  const raw=fs.readFileSync(p,'utf8');
  const before=parse(raw);
  let fm=before.fm;
  for(const key of [...Object.keys(fields),...remove]) {
    const found=new RegExp(`^${key}:`,'m').exec(fm);
    if(!found) continue;
    const from=found.index+found[0].length;
    const next=/^[A-Za-z_][A-Za-z0-9_-]*:/m.exec(fm.slice(from));
    fm=fm.slice(0,found.index)+fm.slice(next?from+next.index:fm.length);
  }
  fm=fm.trimEnd()+'\n';
  for(const [key,value] of Object.entries(fields)) fm+=`${key}: ${JSON.stringify(value)}\n`;
  const result=`---\n${fm}---${before.body}`;
  const after=parse(result), omit=d=>Object.fromEntries(Object.entries(d).filter(([key])=>!Object.hasOwn(fields,key)&&!remove.includes(key)));
  assert.deepEqual(omit(after.data),omit(before.data),`${p}: non-theme fields changed`);
  assert.equal(after.body,before.body,`${p}: body changed`);
  fs.writeFileSync(p,result);
}
const audit={version:1,reviewedAt:'2026-10-05',sourceCommit:'aae9590dd76d71c40c6ec5440d54f1211d447ce3',method:'Finite editorial pass over titles, leads, own descriptions and programme content. No runtime keyword inference or theme inheritance.',entities:{}};
for(const [collection, rows] of Object.entries(snapshot)) {
  const map=decisions[collection].codes.split(/\s+/);
  assert.equal(map.length,rows.length);
  rows.forEach((row,index)=>{
    const [primary,secondary='']=map[index].split('|');
    const ids=s=>s==='-'?[]:[...s].map(c=>{assert(codes[c],`Unknown code ${c}`);return codes[c];});
    const fields=collection==='tours'?{primaryThemes:ids(primary),themes:ids(secondary)}:{themes:ids(primary)};
    if(collection==='tours') assert(fields.primaryThemes.length>=1 && fields.primaryThemes.length<=2);
    const annotation={sourcePath:row.path,sourceTitle:row.data.title??row.data.name,...fields,basis:collection==='tours'?'Title, lead and actual included programme; optional services and incidental references are not themes.':'Own title and description, independently of the themes of linked tours.'};
    if(!fields.themes.length && collection!=='tours') annotation.notes='No sufficiently supported theme in the current own description; intentionally untagged.';
    audit.entities[row.data.id]=annotation;
    patchMd(row.path,fields);
    const p=`data/source-index/entries/${row.data.id}.json`;
    assert(fs.existsSync(p),`Missing source entry ${p}`);
    const entry=readJson(p);Object.assign(entry,fields);writeJson(p,entry);
  });
}
for(const collection of ['countries','themes']) {
  const remove=collection==='countries'?['themes','relatedThemes']:['featuredCountries','featuredDestinations','featuredTours','relatedThemes'];
  for(const row of readCollection(collection)) patchMd(row.path,{},remove);
}
for(const p of fs.readdirSync('data/source-index/entries').filter(p=>p.startsWith('country_')&&p.endsWith('.json'))) {
  const file=`data/source-index/entries/${p}`, obj=readJson(file);
  if('themes' in obj || 'relatedThemes' in obj) {delete obj.themes;delete obj.relatedThemes;writeJson(file,obj);}
}
for(const p of fs.readdirSync('data/source-index/catalogs').filter(p=>p.endsWith('.json'))) {
  const file=`data/source-index/catalogs/${p}`,obj=readJson(file);let changed=false;
  const visit=v=>{
    if(Array.isArray(v)) return v.forEach(visit);
    if(!v||typeof v!=='object')return;
    const ann=audit.entities[v.id];
    if(ann) {for(const k of ['primaryThemes','themes'])if(k in ann)v[k]=ann[k];changed=true;}
    if(typeof v.id==='string'&&v.id.startsWith('country_'))for(const k of ['themes','relatedThemes'])if(k in v){delete v[k];changed=true;}
    Object.values(v).forEach(visit);
  };
  visit(obj);if(changed)writeJson(file,obj);
}
writeJson('data/interest-annotations.json',audit);
console.log(`Applied explicit annotations to ${Object.keys(audit.entities).length} active entities and synchronized source records.`);
