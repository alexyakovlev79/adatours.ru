// Finalizes only a matching successful Pages run. Does not republish content.
import {recordCommit,confirmDeploy,stable} from './schema-geo-core.mjs';
export function receiptMatchesPublication(p,r,sha){
 return !!p&&!!r&&p.batchId===r.batchId&&
 ['PUBLISHING','DEPLOYING','PUBLISHED'].includes(p.status)&&
 (!p.commit||p.commit===sha)&&stable(p.jobs)===stable(r.jobs);
}
export async function autoConfirmGeoRelease({token,repository,runId,runSha,log=console.log}){
 if(!token||!repository||!Number.isSafeInteger(runId)||!/^[a-f0-9]{40}$/.test(runSha))throw Error('Invalid workflow_run arguments');
 const base='https://api.github.com/repos/'+repository;
 async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{Accept:'application/vnd.github+json',
   Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',
   'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();
  if(!response.ok)throw Error(method+' '+path+' HTTP '+response.status+' '+raw.slice(0,300));
  return raw?JSON.parse(raw):null;
 }
 async function jsonFile(path,ref){
  const x=await request('/contents/'+path+'?ref='+encodeURIComponent(ref));
  if(x.encoding!=='base64')throw Error('Unexpected contents encoding');
  return JSON.parse(Buffer.from(x.content,'base64').toString('utf8'));
 }
 const run=await request('/actions/runs/'+runId);
 if(run.head_sha!==runSha||run.status!=='completed'||run.conclusion!=='success'||
  run.head_branch!=='main'||run.path!=='.github/workflows/deploy.yml'||run.event!=='push')
  return {status:'not_eligible_workflow_run'};
 const branch='schema-geo/staging',path='data/geo-knowledge/state.json';
 for(let tries=0;tries<5;tries++){
  const head=(await request('/git/ref/heads/'+branch)).object.sha;
  const state=await jsonFile(path,head),p=state.publication;
  if(!p||!['PUBLISHING','DEPLOYING','PUBLISHED'].includes(p.status))return {status:'no_pending'};
  if(p.status==='PUBLISHED'&&p.commit===runSha)return {status:'already_confirmed'};
  if(p.commit&&p.commit!==runSha)return {status:'different_release'};
  let receipt;
  try{receipt=await jsonFile('data/geo-knowledge/releases/'+p.batchId+'.json',runSha);}
  catch(e){if(String(e).includes('HTTP 404'))return {status:'no_matching_receipt'};throw e;}
  if(!receiptMatchesPublication(p,receipt,runSha))throw Error('Immutable receipt does not match locked results');
  const now=Date.now();
  if(p.status==='PUBLISHING')recordCommit(state,{batchId:p.batchId,ownerId:p.ownerId,commit:runSha,now});
  confirmDeploy(state,{batchId:p.batchId,ownerId:p.ownerId,commit:runSha,runUrl:run.html_url,now});
  const blob=await request('/git/blobs','POST',{content:JSON.stringify(state,null,2)+'\n',encoding:'utf-8'});
  const parent=await request('/git/commits/'+head);
  const tree=await request('/git/trees','POST',{base_tree:parent.tree.sha,
   tree:[{path,mode:'100644',type:'blob',sha:blob.sha}]});
  const commit=await request('/git/commits','POST',{message:'geo: confirm Pages '+runSha.slice(0,12)+' [skip ci]',
   parents:[head],tree:tree.sha});
  try{
   await request('/git/refs/heads/'+branch,'PATCH',{sha:commit.sha,force:false});
   log('GEO '+receipt.jobs.length+' jobs finalized');
   return {status:'confirmed',count:receipt.jobs.length,batchId:p.batchId,commit:commit.sha};
  }catch(e){
   const observed=(await request('/git/ref/heads/'+branch)).object.sha;
   if(observed===commit.sha)return {status:'confirmed_after_lost_response',batchId:p.batchId};
   if(tries===4)throw e;
  }
 }
}
if(process.argv[1]&&import.meta.url.endsWith('/'+process.argv[1].split('/').pop())){
 autoConfirmGeoRelease({token:process.env.GH_TOKEN||process.env.GITHUB_TOKEN,
  repository:process.env.GITHUB_REPOSITORY,runId:Number(process.env.GEO_RUN_ID),
  runSha:process.env.GEO_RUN_SHA}).then(x=>console.log(JSON.stringify(x)))
 .catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
}
