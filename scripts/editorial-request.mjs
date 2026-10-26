import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

// Only published content fields may be updated. Architecture and identity are immutable.
const collections={tour:'tours',excursion:'excursions',country:'countries',destination:'destinations',theme:'themes'};
const common={body:'markdown','hero.alt':'text','hero.caption':'text'};
const fields={
 tour:{title:'text',lead:'text',format:'text',priceFrom:'price',priceNote:'text',priceBasis:'text',dates:'list',included:'list',notIncluded:'list',notes:'list',...common},
 excursion:{title:'text',lead:'text',duration:'text',format:'text',priceFrom:'price',priceNote:'text',included:'list',notIncluded:'list',notes:'list',...common},
 destination:{name:'text',summary:'text',...common},
 country:{name:'text',summary:'text',bestTime:'text',entryNotes:'text',...common},
 theme:{name:'text',summary:'text',...common}
};
const nested={
 tour:{itinerary:['title','text','label'],highlights:['title','text'],faq:['question','answer']},
 country:{featureBands:['eyebrow','title','text']},
 destination:{featureBands:['eyebrow','title','text'],facts:['value','label']}
};
const fail=message=>{throw new Error('ADA_EDITOR_REJECTED: '+message);};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function exactKeys(o,allow){for(const key of Object.keys(o))if(!allow.includes(key))fail('Unexpected key: '+key);}
function cleanText(v,max=12000){
 if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v))fail('Invalid text type or length');
 if(/<\s*\/?\s*[A-Za-z!][^>]*>/u.test(v)||/\b(?:javascript|data|vbscript)\s*:/iu.test(v)||
   /\bon(?:error|load|click)\s*=/iu.test(v)||/\{\{|\}\}|\{%|%\}/u.test(v))fail('Unsafe HTML, executable URL or template directive');
 return v;
}
function allowedField(type,field){
 if(Object.hasOwn(fields[type],field))return{kind:fields[type][field],root:field.split('.')[0]};
 const m=/^(itinerary|highlights|faq|featureBands|facts)\[(0|[1-9][0-9]{0,2})\]\.([A-Za-z]+)$/.exec(field);
 if(m&&nested[type]&&(nested[type][m[1]]||[]).includes(m[3]))
   return{kind:'text',root:m[1],index:Number(m[2]),child:m[3]};
 fail('Field outside editorial permissions: '+field);
}
function validated(kind,v){
 if(kind==='price'){
   if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9)fail('Price must be a nonnegative number');
   return v;
 }
 if(kind==='list'){
   if(!Array.isArray(v)||v.length>90)fail('Invalid list');
   return v.map(s=>cleanText(s,2500));
 }
 return cleanText(v,kind==='markdown'?36000:12000);
}
export function gitBlobSha(text){
 const b=Buffer.from(text,'utf8');
 return crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
}
export function parseEditorRequest(body){
 if(typeof body!=='string'||body.length>58000)fail('Invalid issue size');
 let r;
 try{r=JSON.parse(body.trim());}catch{fail('Body must be pure JSON, no Markdown fences');}
 if(!isObject(r))fail('Expected JSON object');
 exactKeys(r,['version','entityType','entityId','expectedBlobSha','changes']);
 if(r.version!==1||!Object.hasOwn(collections,r.entityType)||
    typeof r.entityId!=='string'||!/^[a-z][a-z0-9_]{5,140}$/.test(r.entityId)||
    typeof r.expectedBlobSha!=='string'||!/^[0-9a-f]{40}$/.test(r.expectedBlobSha))
   fail('Invalid version, type, entity ID or SHA');
 if(!Array.isArray(r.changes)||r.changes.length<1||r.changes.length>12)fail('Supply 1-12 changes');
 const seen=new Set();
 for(const c of r.changes){
   if(!isObject(c))fail('Each change must be an object');
   exactKeys(c,['field','value']);
   if(typeof c.field!=='string'||seen.has(c.field))fail('Duplicate or invalid field');
   seen.add(c.field);
   validated(allowedField(r.entityType,c.field).kind,c.value);
 }
 return r;
}
function splitContent(src){
 const m=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(src);
 if(!m)fail('Invalid frontmatter');
 return{fm:m[1]+'\n',body:src.slice(m[0].length)};
}
function replaceRoot(fm,key,v){
 const m=new RegExp('^'+key+':.*(?:\\r?\\n|$)','m').exec(fm);
 if(!m)fail('No existing field: '+key);
 const after=fm.slice(m.index+m[0].length);
 const next=/^[A-Za-z][A-Za-z0-9_]*:/m.exec(after);
 const end=m.index+m[0].length+(next?next.index:after.length);
 const fieldYaml=yaml.dump({[key]:v},{lineWidth:-1,noRefs:true,quotingType:"'",sortKeys:false});
 return fm.slice(0,m.index)+fieldYaml+fm.slice(end);
}
function resolveContent(root,type,entry){
 const prefix='src/content/'+collections[type]+'/';
 const p=entry.contentPath;
 if(typeof p!=='string'||!p.startsWith(prefix)||p.includes('..')||
    !/^src\/content\/[a-z]+\/[A-Za-z0-9_./-]+\.md$/.test(p))fail('Unsafe contentPath');
 const file=path.resolve(root,p);
 if(!file.startsWith(path.resolve(root,prefix)+path.sep)||!fs.existsSync(file)||
    fs.lstatSync(file).isSymbolicLink())fail('Invalid or missing content file');
 return file;
}
// Existing source entries are authoritative. Themes are additionally registered
// by stable ID in interest-registry.json and may lack source-index entries.
function resolveEditorialEntry(root,type,id){
 const entryPath=path.join(root,'data/source-index/entries',id+'.json');
 if(fs.existsSync(entryPath)){
   const entry=JSON.parse(fs.readFileSync(entryPath,'utf8'));
   if(entry.id!==id||entry.type!==type)fail('Source-index identity mismatch');
   return entry;
 }
 if(type!=='theme')fail('Unknown canonical entity ID');
 const registryPath=path.join(root,'src/data/interest-registry.json');
 if(!fs.existsSync(registryPath))fail('Missing canonical interest registry');
 const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
 const matches=Array.isArray(registry)?registry.filter(row=>isObject(row)&&row.id===id):[];
 if(matches.length!==1||typeof matches[0].slug!=='string')
   fail('Theme ID is not unique in canonical interest registry');
 const dir=path.join(root,'src/content/themes');
 const found=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
   if(!item.isFile()||!/^[A-Za-z0-9_.-]+\\.md$/u.test(item.name))continue;
   const raw=fs.readFileSync(path.join(dir,item.name),'utf8');
   let frontmatter;
   try{frontmatter=yaml.load(splitContent(raw).fm,{json:false});}catch{continue;}
   if(isObject(frontmatter)&&frontmatter.id===id&&frontmatter.slug===matches[0].slug)
     found.push({id,type,contentPath:'src/content/themes/'+item.name});
 }
 if(found.length!==1)fail('Theme is not uniquely mapped to canonical Markdown');
 return found[0];
}
export function applyEditorialRequest(root,actor,r,{write=false}={}){
 const access=JSON.parse(fs.readFileSync(path.join(root,'data/editorial/authorized-users.json'),'utf8'));
 if(!Array.isArray(access.allowedGithubLogins)||!access.allowedGithubLogins.includes(actor))
   fail('GitHub issue author not authorized: '+String(actor));
 const entry=resolveEditorialEntry(root,r.entityType,r.entityId);
 const file=resolveContent(root,r.entityType,entry);
 const original=fs.readFileSync(file,'utf8');
 if(gitBlobSha(original)!==r.expectedBlobSha)fail('Stale content SHA; read latest file before resubmitting');
 const {fm,body}=splitContent(original);
 const current=yaml.load(fm,{json:false});
 if(!isObject(current)||current.id!==r.entityId||!['approved','published'].includes(current.status))
   fail('Content identity or published status mismatch');
 const update=structuredClone(current);
 let nextBody=body;
 const changedRoots=new Set();
 for(const c of r.changes){
   const p=allowedField(r.entityType,c.field),value=validated(p.kind,c.value);
   if(c.field==='body'){nextBody=value.replace(/\s*$/u,'')+'\n';continue;}
   if(p.index!==undefined){
     const array=update[p.root];
     if(!Array.isArray(array)||!isObject(array[p.index])||!Object.hasOwn(array[p.index],p.child))fail('Indexed field missing: '+c.field);
     array[p.index][p.child]=value;
   }else if(c.field.includes('.')){
     const [key,child]=c.field.split('.');
     if(!isObject(update[key])||!Object.hasOwn(update[key],child))fail('Nested field missing: '+c.field);
     update[key][child]=value;
   }else{
     if(!Object.hasOwn(update,c.field))fail('Cannot create new field: '+c.field);
     update[c.field]=value;
   }
   changedRoots.add(p.root);
 }
 let nextFm=fm;
 for(const key of changedRoots)if(!isDeepStrictEqual(current[key],update[key]))
   nextFm=replaceRoot(nextFm,key,update[key]);
 assert.deepStrictEqual(yaml.load(nextFm,{json:false}),update,'Unrelated YAML fields changed');
 const output='---\n'+nextFm.trimEnd()+'\n---\n'+nextBody;
 const changed=output!==original;
 if(changed&&write)fs.writeFileSync(file,output,'utf8');
 return{changed,path:entry.contentPath,fields:r.changes.map(x=>x.field),shaBefore:r.expectedBlobSha,shaAfter:gitBlobSha(output)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const r=parseEditorRequest(process.env.EDITOR_ISSUE_BODY||'');
 const out=applyEditorialRequest(process.cwd(),process.env.EDITOR_ISSUE_AUTHOR||'',r,{write:true});
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed='+out.changed+'\npath='+out.path+'\n');
 console.log(JSON.stringify(out));
}
