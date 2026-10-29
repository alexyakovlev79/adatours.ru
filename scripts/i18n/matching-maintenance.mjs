#!/usr/bin/env node
/** Recovery sweeper for the GitHub EN matching staging branch.
 * Intentionally does not run AI work, translate, publish or touch main content.
 * Git REST uses normal fast-forward ref update; stale parents are rejected.
 */
import { reclaimExpired, rebuildIndex } from './matching-core.mjs';
const TOKEN=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
const REPO=process.env.GITHUB_REPOSITORY||'alexyakovlev79/adatours.ru';
const BRANCH='i18n/matching-staging';
const ROOT='data/i18n/matching/v1';
const apply=process.argv.includes('--apply');
const at=process.env.I18N_MATCH_SWEEP_AT||new Date().toISOString();
const API='https://api.github.com/repos/'+REPO;
async function api(path,method='GET',data){
 if(!TOKEN)throw new Error('Missing GitHub token');
 const r=await fetch(API+path,{method,headers:{'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{})});
 if(!r.ok)throw new Error('GitHub '+method+' '+path+' status '+r.status+': '+(await r.text()).slice(0,300));
 return r.json();
}
const read=async(path,sha)=>{
 const x=await api('/contents/'+path+'?ref='+sha);
 if(x.encoding!=='base64')throw new Error('Unexpected encoding');
 return JSON.parse(Buffer.from(x.content.replace(/\s/g,''),'base64').toString('utf8'));
};
const content=x=>JSON.stringify(x,null,2)+'\n';
async function scanOnce(){
 const ref=await api('/git/ref/heads/'+BRANCH);
 const sha=ref.object.sha;
 const idx=await read(ROOT+'/index.json',sha);
 if(!idx.matchingEnabled)return {status:'gate_closed',head:sha};
 const ms=Date.parse(at);if(!Number.isFinite(ms))throw new Error('Invalid sweep time');
 const due=Object.entries(idx.shards).filter(([,s])=>
  (s.earliestExpiryAt&&Date.parse(s.earliestExpiryAt)<=ms)||
  (s.earliestRetryAt&&Date.parse(s.earliestRetryAt)<=ms)).map(([id])=>id);
 if(!due.length)return {status:'nothing_due',head:sha,counts:idx.counts};
 let next=idx,reclaimed=0,files=[];
 for(const id of due) {
  const shard=await read(ROOT+'/state/'+id+'.json',sha);
  const r=reclaimExpired(shard,at);
  if(!r.reclaimed)continue;
  reclaimed+=r.reclaimed;
  next=rebuildIndex(next,id,r.shard,at);
  files.push({path:ROOT+'/state/'+id+'.json',type:'blob',mode:'100644',content:content(r.shard)});
  for(const [owner,lease] of Object.entries(next.activeOwners||{})){
   const job=r.shard.items.find(j=>j.jobId===lease.jobId);
   if(job&&job.status!=='leased')delete next.activeOwners[owner];
  }
 }
 if(!files.length)return {status:'no_changes_after_scan',head:sha,counts:idx.counts};
 if(!apply)return {status:'dry_run',head:sha,reclaimed,shards:files.length,counts:next.counts};
 const current=await api('/git/commits/'+sha);
 files.push({path:ROOT+'/index.json',type:'blob',mode:'100644',content:content(next)});
 const tree=await api('/git/trees','POST',{base_tree:current.tree.sha,tree:files});
 const commit=await api('/git/commits','POST',{message:'[skip ci] i18n-match sweep expired/retryable leases',tree:tree.sha,parents:[sha]});
 await api('/git/refs/heads/'+BRANCH,'PATCH',{sha:commit.sha,force:false});
 return {status:'reclaimed',head:commit.sha,reclaimed,shards:due.length,counts:next.counts};
}
for(let i=0;i<3;i++) {
 try {const r=await scanOnce();console.log(JSON.stringify(r));process.exit(0);}
 catch(e){
  if(i===2||!/status (409|422)|non.fast.forward/i.test(String(e))) {
   console.error(String(e));process.exit(1);
  }
 }
}
