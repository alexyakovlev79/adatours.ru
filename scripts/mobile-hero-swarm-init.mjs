#!/usr/bin/env node
/** Freeze an inventory into immutable jobs and independent, tiny lease records. */
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SWARM_ROOT='data/media/hero-mobile-swarm-20261023';
export const SWARM_BRANCH='feature/mobile-hero-swarm-20261023';
const json=value=>JSON.stringify(value)+'\n';
const gitBlob=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
function slimUsage(u){return {
  id:u.id,pagePath:u.pagePath,source:u.source,profile:u.profile,objectPosition:u.objectPosition,
  geometry:u.geometry,context:{title:u.context?.title??'',manualObjectPosition:u.context?.manualObjectPosition??null,
    preparedCrop:u.context?.preparedCrop??null,sectionIndex:u.context?.sectionIndex??0},
};}

export function freezeHeroSwarm(inventory,{batchSize=10,maxPasses=12,createdAt=new Date().toISOString()}={}){
  if(inventory?.schemaVersion!==1||!Array.isArray(inventory.assets)||!/^[a-f0-9]{40}$/.test(inventory.sourceCommit))throw Error('Invalid commit-pinned inventory');
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>10)throw Error('Batch size must be 1..10');
  if(!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>20)throw Error('Invalid per-chat pass limit');
  const ids=new Set(),sources=new Set();
  for(const a of inventory.assets){
    if(ids.has(a.id)||sources.has(a.source))throw Error('Duplicate asset or source');
    if(!Array.isArray(a.usages)||!a.usages.length)throw Error('Asset without actual hero usage');
    ids.add(a.id);sources.add(a.source);
  }
  const pending=inventory.assets.filter(a=>a.status==='PENDING').sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const files={},packets=[];
  for(let i=0;i<pending.length;i+=batchSize){
    const id='b'+String(packets.length+1).padStart(3,'0');
    const jobs=pending.slice(i,i+batchSize).map(a=>{
      const retained=a.usages.filter(u=>u.context?.preparedCrop&&(a.existingCrops??[]).some(c=>c.pagePath===u.pagePath&&c.source===a.source));
      const retainedIds=new Set(retained.map(u=>u.id));
      return {...a,allUsageCount:a.usages.length,retainedUsageIds:[...retainedIds],usages:a.usages.filter(u=>!retainedIds.has(u.id)).map(slimUsage)};
    });
    const jobsPath=SWARM_ROOT+'/jobs/'+id+'.json',path=SWARM_ROOT+'/packets/'+id+'.json';
    const content=json({schemaVersion:1,id,sourceCommit:inventory.sourceCommit,jobs});
    const jobsBlobSha=gitBlob(content),assetIds=jobs.map(a=>a.id);
    files[jobsPath]=content;
    files[path]=JSON.stringify({schemaVersion:1,id,assetIds,jobsPath,jobsBlobSha,status:'queued',generation:0,lease:null},null,2)+'\n';
    packets.push({id,path,jobsPath,jobsBlobSha,assetIds});
  }
  files[SWARM_ROOT+'/retained.json']=JSON.stringify({schemaVersion:1,assets:inventory.assets.filter(a=>a.status!=='PENDING')},null,2)+'\n';
  files[SWARM_ROOT+'/excluded.json']=JSON.stringify({schemaVersion:1,excluded:inventory.excluded,videoPosters:inventory.videoPosters},null,2)+'\n';
  const manifest={schemaVersion:1,repository:'alexyakovlev79/adatours.ru',branch:SWARM_BRANCH,root:SWARM_ROOT,
    status:'active',sourceCommit:inventory.sourceCommit,createdAt,leaseMinutes:60,heartbeatMinutes:20,batchSize,maxPasses,
    counts:{...inventory.counts,queuedAssets:pending.length,packetCount:packets.length},provenance:inventory.provenance,
    inventoryPath:SWARM_ROOT+'/inventory.json',packets};
  files[manifest.inventoryPath]=JSON.stringify({schemaVersion:1,sourceCommit:inventory.sourceCommit,provenance:inventory.provenance,counts:manifest.counts,
    assets:inventory.assets.map(a=>({id:a.id,source:a.source,status:a.status,profiles:a.profiles,usageCount:a.usages.length,
      packetId:packets.find(p=>p.assetIds.includes(a.id))?.id??null}))},null,2)+'\n';
  files[SWARM_ROOT+'/manifest.json']=JSON.stringify(manifest,null,2)+'\n';
  return {manifest,files};
}

async function main(){
  const f={};for(let i=2;i<process.argv.length;i+=2)f[process.argv[i]]=process.argv[i+1];
  if(!f['--inventory']||!f['--out'])throw Error('Use --inventory <commit-pinned rendered inventory.json> --out <new output directory>');
  const out=resolve(f['--out']);
  if(await access(resolve(out,SWARM_ROOT,'manifest.json')).then(()=>true,()=>false))throw Error('Queue already exists. Never reset live leases; create a new queue version instead.');
  const {manifest,files}=freezeHeroSwarm(JSON.parse(await readFile(f['--inventory'],'utf8')));
  for(const [path,content]of Object.entries(files)){const target=resolve(out,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,content,{flag:'wx'});}
  console.log(JSON.stringify({branch:manifest.branch,...manifest.counts,files:Object.keys(files).length},null,2));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
