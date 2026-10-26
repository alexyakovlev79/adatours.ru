// Portable GitHub CAS dispatcher for GEO jobs. Works with current and legacy connector names.
// Status writes touch staging/state.json; dispatch writes must trigger GitHub Actions.
export function geoRemoteCommitMessage(action, ownerId) {
 const trigger=action==='beginPublication'||action==='dispatchPublication';
 return 'geo: '+action+' '+(ownerId||'system')+(trigger?'':' [skip ci]');
}
export async function runSchemaGeo(tools, core, request) {
 const repo='alexyakovlev79/adatours.ru', branch='schema-geo/staging';
 const api='https://api.github.com/repos/'+repo;
 const gh={
  fetch: tools.mcp__GitHub__fetch || tools.mcp__codex_apps__github_fetch,
  file: tools.mcp__GitHub__fetch_file || tools.mcp__codex_apps__github_fetch_file,
  blob: tools.mcp__GitHub__fetch_blob || tools.mcp__codex_apps__github_fetch_blob,
  tree: tools.mcp__GitHub__create_tree || tools.mcp__codex_apps__github_create_tree,
  commit: tools.mcp__GitHub__create_commit || tools.mcp__codex_apps__github_create_commit,
  update: tools.mcp__GitHub__update_ref || tools.mcp__codex_apps__github_update_ref
 };
 if(!gh.fetch||!gh.file||!gh.tree||!gh.commit||!gh.update)throw Error('GitHub connector unavailable');
 const unwrap=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r;};
 const fetch=async url=>JSON.parse(unwrap(await gh.fetch({url})).content);
 const file=async(path,ref)=>{
  const r=unwrap(await gh.file({repository_full_name:repo,path,ref}));
  return r.content || (gh.blob ? unwrap(await gh.blob({repository_full_name:repo,blob_sha:r.sha})).content : '');
 };
 const json=async(path,ref)=>JSON.parse(await file(path,ref));
 for(let attempt=0;attempt<3;attempt++){
  const head=(await fetch(api+'/git/ref/heads/'+branch)).object.sha;
  // Claims need queue/manifest; deploy acknowledgments do not. No repeated giant queue reads.
  const needsQueue=['inspect','claim','complete','beginPublication'].includes(request.action);
  const [gitCommit,state,queue,manifest]=await Promise.all([
   fetch(api+'/git/commits/'+head),
   json('data/geo-knowledge/state.json',head),
   needsQueue?json('data/geo-knowledge/queue.json',head):Promise.resolve(null),
   needsQueue?json('data/geo-knowledge/manifest.json',head):Promise.resolve(null)
  ]);
  const now=Date.now(), args={...request,now};let output,extra=[];
  if(request.action==='inspect')return {
   head,manifest,publication:state.publication&&{
    batchId:state.publication.batchId,status:state.publication.status,
    commit:state.publication.commit,count:state.publication.jobs?.length||0},
   summary:queue.jobs.reduce((m,j)=>{const s=core.statusOf(state,j);m[s]=(m[s]||0)+1;return m;},{}),
   next:queue.jobs.filter(j=>j.stage<=manifest.maxStage&&core.statusOf(state,j)==='QUEUED')
     .slice(0,Math.min(10,Math.max(1,manifest.batchSize||10)))
  };
  if(request.action==='claim')
   output=core.claim(queue,state,{...args,maxStage:manifest.maxStage,batchSize:manifest.batchSize||10,limit:request.limit??manifest.batchSize??10});
  else if(request.action==='renew')output=core.renew(state,args);
  else if(request.action==='release')output=core.release(state,args);
  else if(request.action==='complete'){
   const job=queue.jobs.find(j=>j.jobId===request.result.jobId);
   if(!job)throw Error('Unknown job');
   if(job.contentPath){
    const live=unwrap(await gh.file({repository_full_name:repo,path:job.contentPath,ref:'main'}));
    if(live.sha!==job.sourceBlobSha)throw Error('Current main source changed; sync/revalidate, do not overwrite');
   }
   output=core.complete(queue,state,args);
   if(output.idempotent)return {status:'already_saved',head,...output};
   extra.push({path:output.path,mode:'100644',type:'blob',content:JSON.stringify(request.result,null,2)+'\n'});
  }
  else if(request.action==='beginPublication'){
   const already=state.publication?.status==='PUBLISHING'&&state.publication.batchId===request.batchId
     &&state.publication.ownerId===request.ownerId;
   output=core.beginPublication(queue,state,args);
   if(output&&!already)extra.push({
    path:'data/geo-knowledge/dispatch.json',mode:'100644',type:'blob',
    content:JSON.stringify({schemaVersion:1,batchId:output.batchId,ownerId:output.ownerId,
     count:output.jobs.length,createdAt:new Date(now).toISOString()},null,2)+'\n'
   });
  }
  else if(request.action==='dispatchPublication'){
   const p=state.publication;
   if(!p||p.status!=='PUBLISHING'||p.commit||p.batchId!==request.batchId||p.ownerId!==request.ownerId)
    throw Error('Cannot dispatch a foreign or already committed publication');
   output={batchId:p.batchId,count:p.jobs.length,status:'dispatched'};
   extra.push({path:'data/geo-knowledge/dispatch.json',mode:'100644',type:'blob',
    content:JSON.stringify({schemaVersion:1,batchId:p.batchId,ownerId:p.ownerId,
     count:p.jobs.length,createdAt:new Date(now).toISOString()},null,2)+'\n'});
  }
  else if(request.action==='abortPublication')output=core.abortUncommittedPublication(state,args);
  else if(request.action==='recordCommit'){
   // Reading a 100+ file GitHub REST commit diff is slow and unnecessary: inspect exact receipt instead.
   const c=await fetch(api+'/git/commits/'+request.commit);
   if(!c.tree?.sha)throw Error('Publication commit missing');
   const receipt=await json('data/geo-knowledge/releases/'+request.batchId+'.json',request.commit);
   if(receipt.batchId!==request.batchId||core.stable(receipt.jobs)!==core.stable(state.publication?.jobs))
    throw Error('Release hashes differ from locked results');
   const liveMain=(await fetch(api+'/git/ref/heads/main')).object.sha;
   const ancestry=await fetch(api+'/compare/'+request.commit+'...'+liveMain);
   if(!['ahead','identical'].includes(ancestry.status))throw Error('Release commit is not in main');
   output=core.recordCommit(state,args);
  }
  else if(request.action==='confirmDeploy'||request.action==='resumePublication'){
   let p=state.publication, run;
   if(request.action==='resumePublication'){
    const scope=request.jobIds===undefined&&request.contentCommit===undefined?null:core.geoPublicationScope(request);
    if(scope&&p?.status==='PUBLISHED'&&core.geoPublicationScopeMatches(p,scope))return {
     status:'scope_already_published',head,batchId:p.batchId,commit:p.commit,runUrl:p.runUrl,jobIds:scope.jobIds};
    if(!p||p.status==='PUBLISHED')return {status:'no_pending_deploy',head};
    if(scope&&!core.geoPublicationScopeMatches(p,scope))return {
     status:'scope_blocked_by_publication',head,batchId:p.batchId,phase:p.status,
     note:'Finish the existing publication separately; addressed Word scope cannot dispatch another batch'};
    if(p.status!=='DEPLOYING'||!p.commit)return {status:'publication_requires_recovery',head,batchId:p.batchId,ownerId:p.ownerId,phase:p.status};
    const runs=await fetch(api+'/actions/runs?head_sha='+p.commit+'&per_page=15');
    const candidate=(runs.workflow_runs||[]).find(x=>x.head_sha===p.commit&&x.status==='completed'&&x.conclusion==='success'&&x.path==='.github/workflows/deploy.yml'&&x.head_branch==='main');
    if(!candidate)return {status:'awaiting_deploy',head,batchId:p.batchId,commit:p.commit};
    run=await fetch(api+'/actions/runs/'+candidate.id);
    args.batchId=p.batchId;args.ownerId=p.ownerId;args.commit=p.commit;
   } else {
    if(!Number.isSafeInteger(request.runId))throw Error('runId required');
    run=await fetch(api+'/actions/runs/'+request.runId);
   }
   if(run.head_sha!==args.commit||run.conclusion!=='success'||run.status!=='completed'||
      run.path!=='.github/workflows/deploy.yml'||run.head_branch!=='main')
    throw Error('Successful deploy for exact SHA not confirmed');
   output=core.confirmDeploy(state,{...args,runUrl:run.html_url});
  }
  else throw Error('Unknown GEO action: '+request.action);
  if(output===null||Array.isArray(output)&&!output.length)return {status:'empty_or_gated',head};
  const elements=[{path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',content:JSON.stringify(state,null,2)+'\n'},...extra];
  const tree=unwrap(await gh.tree({repository_full_name:repo,base_tree_sha:gitCommit.tree.sha,tree_elements:elements})).sha;
  const next=unwrap(await gh.commit({repository_full_name:repo,parent_sha:head,tree_sha:tree,message:geoRemoteCommitMessage(request.action,args.ownerId)})).sha;
  try{
   const updated=unwrap(await gh.update({repository_full_name:repo,branch_name:branch,sha:next,expected_sha:head,force:false}));
   if(updated.success===false)throw Error('CAS rejected');
   return {status:'saved',commit:next,output};
  }catch(err){
   const observed=(await fetch(api+'/git/ref/heads/'+branch)).object.sha;
   if(observed===next)return {status:'saved',commit:next,output};
   if(observed!==head){
    const comparison=await fetch(api+'/compare/'+next+'...'+observed);
    if(['ahead','identical'].includes(comparison.status))return {status:'saved',commit:next,output};
   }
   if(observed===head||attempt===2)throw err;
  }
 }
}
