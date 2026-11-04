#!/usr/bin/env node
/* Five-minute GitHub dispatcher; only the existing i18n staging queue is authoritative. */
import fs from 'node:fs';
const repo='alexyakovlev79/adatours.ru';
const branch='i18n/translation-mass-staging';
const root='data/i18n/translation-mass/v2';
const config=JSON.parse(fs.readFileSync('data/i18n/translation-mass-auto-dispatch.json','utf8'));
const now=new Date();
const stop=Date.parse(config.stopAtUtc);
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const log=(status,info={})=>console.log(JSON.stringify({status,at:now.toISOString(),...info}));
const assert=(ok,reason)=>{if(!ok)throw Error(reason);};
assert(config.schemaVersion===1&&Number.isFinite(stop)&&token,'Bad dispatcher configuration/token');
async function api(method,route,body){
 const res=await fetch('https://api.github.com/repos/'+repo+route,{
  method,
  headers:{'Authorization':'Bearer '+token,
   'Accept':'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Error('GitHub '+method+' '+res.status+': '+(await res.text()).slice(0,300));
 return res.status===204?{}:res.json();
}
if(config.enabled!==true){log('paused_config');process.exit(0);}
if(now.getTime()>=stop){
 log('paused_deadline',{stopAtUtc:config.stopAtUtc});
 try{
  await api('PUT','/actions/workflows/i18n-mass-auto-dispatch.yml/disable');
  log('workflow_disabled');
 }catch(e){log('disable_warning',{reason:String(e).slice(0,300)});}
 process.exit(0);
}
const raw=await api('GET','/contents/'+root+'/index.json?ref='+encodeURIComponent(branch));
const index=JSON.parse(Buffer.from(raw.content.replace(/\n/g,''),'base64').toString('utf8'));
const stageCounts=index.stageCounts?.[index.stage]||{};
const free=stageCounts.queued||0;
if(index.schemaVersion!==2||index.dispatcherEnabled!==true||
   index.translationMassLaunchAllowed!==true||index.publicationEnabled!==false||
   index.pilotOnly!==false){
 log('queue_gate_closed',{stage:index.stage});process.exit(0);
}
if(free<=0){
 log('no_free_packets',{stage:index.stage,stageCounts,
  heldLater:index.counts?.held||0});process.exit(0);
}
// A public GitHub API cannot create a ChatGPT UI conversation.
// An autonomous worker workflow can instead use separately configured OpenAI + Drive credentials.
if(!process.env.OPENAI_API_KEY){
 log('worker_preflight_blocked',{cause:'OPENAI_API_KEY missing',stage:index.stage,free});
 process.exit(0);
}
const driveReady=Boolean(process.env.ADA_WORD_DRIVE_ACCESS_TOKEN)||
 Boolean(process.env.ADA_WORD_DRIVE_REFRESH_TOKEN&&process.env.ADA_WORD_DRIVE_CLIENT_ID&&
         process.env.ADA_WORD_DRIVE_CLIENT_SECRET);
if(index.stage!=='ai_only'&&!driveReady){
 log('worker_preflight_blocked',{cause:'Google Drive OAuth credentials missing',stage:index.stage,free});
 process.exit(0);
}
const dispatchId='en'+new Date(Math.floor(now.getTime()/300000)*300000).toISOString()
 .replace(/[-:TZ.]/g,'').slice(0,12);
const workflow=config.workerWorkflow;
const runs=await api('GET','/actions/workflows/'+workflow+'/runs?event=workflow_dispatch&per_page=100');
if((runs.workflow_runs||[]).some(r=>r.display_title==='ADA EN auto worker '+dispatchId)){
 log('already_dispatched',{dispatchId,stage:index.stage,free});process.exit(0);
}
await api('POST','/actions/workflows/'+workflow+'/dispatches',{ref:'main',inputs:{dispatch_id:dispatchId}});
log('worker_requested',{dispatchId,stage:index.stage,free,stopAtUtc:config.stopAtUtc});
