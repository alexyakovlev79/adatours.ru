// Run through connected GitHub tools. No credentials, Node APIs, or direct HTTP.
export async function runSchemaGeo(tools, core, request) {
 const repo='alexyakovlev79/adatours.ru',branch='schema-geo/staging',api=`https://api.github.com/repos/${repo}`;
 const unwrap=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.structuredContent||r.result||r;};
 const fetch=async url=>JSON.parse(unwrap(await tools.mcp__codex_apps__github_fetch({url})).content);
 const file=async(path,ref)=>{const r=unwrap(await tools.mcp__codex_apps__github_fetch_file({repository_full_name:repo,path,ref}));return r.content||unwrap(await tools.mcp__codex_apps__github_fetch_blob({repository_full_name:repo,blob_sha:r.sha})).content;};
 const json=async(p,ref)=>JSON.parse(await file(p,ref));
 for(let attempt=0;attempt<3;attempt++){
  const head=(await fetch(`${api}/git/ref/heads/${branch}`)).object.sha;
  const [commit,queue,state,manifest]=await Promise.all([fetch(`${api}/git/commits/${head}`),json('data/geo-knowledge/queue.json',head),json('data/geo-knowledge/state.json',head),json('data/geo-knowledge/manifest.json',head)]);
  const now=Date.now(),args={...request,now};let output,extra=[];
  if(request.action==='inspect')return {head,manifest,summary:queue.jobs.reduce((m,j)=>{const s=core.statusOf(state,j);m[s]=(m[s]||0)+1;return m;},{}),next:queue.jobs.filter(j=>j.stage<=manifest.maxStage&&core.statusOf(state,j)==='QUEUED').slice(0,5)};
  if(request.action==='claim')output=core.claim(queue,state,{...args,maxStage:manifest.maxStage});
  else if(request.action==='renew')output=core.renew(state,args);
  else if(request.action==='release')output=core.release(state,args);
  else if(request.action==='complete'){
   const job=queue.jobs.find(j=>j.jobId===request.result.jobId);if(!job)throw Error('Unknown job');
   // Fence changes to the actual source after reservation, including draft/archive edits.
   if(job.contentPath){const live=unwrap(await tools.mcp__codex_apps__github_fetch_file({repository_full_name:repo,path:job.contentPath,ref:'main'}));if(live.sha!==job.sourceBlobSha)throw Error('Current main source changed; sync/revalidate, do not overwrite');}
   output=core.complete(queue,state,args);
   if(output.idempotent)return {status:'already_saved',head,...output};
   extra.push({path:output.path,mode:'100644',type:'blob',content:JSON.stringify(request.result,null,2)+'\n'});
  }
  else if(request.action==='beginPublication')output=core.beginPublication(queue,state,args);
  else if(request.action==='recordCommit'){
   const c=await fetch(`${api}/commits/${request.commit}`);
   if(!c.files.some(f=>f.filename===`data/geo-knowledge/releases/${request.batchId}.json`))throw Error('Commit lacks the publication release receipt');
   const receipt=await json(`data/geo-knowledge/releases/${request.batchId}.json`,request.commit);
   if(receipt.batchId!==request.batchId||core.stable(receipt.jobs)!==core.stable(state.publication?.jobs))throw Error('Release hashes differ from locked results');
   const liveMain=(await fetch(`${api}/git/ref/heads/main`)).object.sha;
   const ancestry=await fetch(`${api}/compare/${request.commit}...${liveMain}`);
   if(!['ahead','identical'].includes(ancestry.status))throw Error('Release commit is not in main');
   output=core.recordCommit(state,args);
  }
  else if(request.action==='confirmDeploy'){
   if(!Number.isSafeInteger(request.runId))throw Error('runId required');
   const run=await fetch(`${api}/actions/runs/${request.runId}`);
   if(run.head_sha!==request.commit||run.conclusion!=='success'||run.status!=='completed'||run.path!=='.github/workflows/deploy.yml'||run.head_branch!=='main')throw Error('Successful deploy for exact SHA not confirmed');
   output=core.confirmDeploy(state,{...args,runUrl:run.html_url});
  }else throw Error('Unknown action');
  if(output===null||Array.isArray(output)&&!output.length)return {status:'empty_or_gated',head};
  const elements=[{path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',content:JSON.stringify(state,null,2)+'\n'},...extra];
  const tree=unwrap(await tools.mcp__codex_apps__github_create_tree({repository_full_name:repo,base_tree_sha:commit.tree.sha,tree_elements:elements})).sha;
  const next=unwrap(await tools.mcp__codex_apps__github_create_commit({repository_full_name:repo,parent_sha:head,tree_sha:tree,message:`geo: ${request.action} ${request.ownerId} [skip ci]`})).sha;
  try{
   const updated=unwrap(await tools.mcp__codex_apps__github_update_ref({repository_full_name:repo,branch_name:branch,sha:next,expected_sha:head,force:false}));
   if(updated.success===false)throw Error('CAS rejected');
   return {status:'saved',commit:next,output};
  }catch(err){
   const observed=(await fetch(`${api}/git/ref/heads/${branch}`)).object.sha;
   if(observed===next)return {status:'saved',commit:next,output};
   if(observed!==head){const comparison=await fetch(`${api}/compare/${next}...${observed}`);if(['ahead','identical'].includes(comparison.status))return {status:'saved',commit:next,output};}
   if(observed===head||attempt===2)throw err;
   // Re-read and recompute only our state transition on the current head.
  }
 }
}
