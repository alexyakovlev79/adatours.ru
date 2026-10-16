// One logical GEO publication = all READY passports, one main commit, one Pages deployment.
// Read and verify immutable results from one staging SHA. Only the metadata receipt enters main.
export async function publishSchemaGeoAll(tools, core, remote, options={}) {
 const repo='alexyakovlev79/adatours.ru', api='https://api.github.com/repos/'+repo;
 const gh={
  fetch:tools.mcp__GitHub__fetch||tools.mcp__codex_apps__github_fetch,
  file:tools.mcp__GitHub__fetch_file||tools.mcp__codex_apps__github_fetch_file,
  tree:tools.mcp__GitHub__create_tree||tools.mcp__codex_apps__github_create_tree,
  commit:tools.mcp__GitHub__create_commit||tools.mcp__codex_apps__github_create_commit,
  update:tools.mcp__GitHub__update_ref||tools.mcp__codex_apps__github_update_ref
 };
 if(Object.values(gh).some(x=>!x))throw Error('Connected GitHub read/write tools required');
 const unwrap=r=>{if(r.isError)throw Error(JSON.stringify(r));return r.result||r.structuredContent||r;};
 const fetch=async url=>JSON.parse(unwrap(await gh.fetch({url})).content);
 const read=async(path,ref)=>unwrap(await gh.file({repository_full_name:repo,path,ref})).content;
 const json=async(path,ref)=>JSON.parse(await read(path,ref));
 const ownerId=options.ownerId||'geo-all-publisher';
 const batchId=options.batchId||('geo-all-'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14));
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId)||!/^[a-zA-Z0-9_-]{8,120}$/.test(batchId))
  throw Error('Invalid batchId or ownerId');
 const recovery=await remote(tools,core,{action:'resumePublication'});
 if(recovery.status==='awaiting_deploy')return {status:'awaiting_previous_deploy',...recovery};
 if(recovery.status==='publication_requires_recovery')return {status:'previous_publication_requires_recovery',...recovery};
 // If an older batch just completed, recover it first. New claims arriving later wait for the next invocation.
 const active=(await json('data/geo-knowledge/state.json','schema-geo/staging')).publication;
 if(active&&active.status==='PUBLISHING'){
  // Reconcile a main receipt from a previous, interrupted attempt before committing again.
  const commits=await fetch(api+'/commits?path='+encodeURIComponent('data/geo-knowledge/releases/'+active.batchId+'.json')+'&per_page=5');
  for(const c of commits){
   const receipt=await json('data/geo-knowledge/releases/'+active.batchId+'.json',c.sha);
   if(receipt.batchId===active.batchId&&core.stable(receipt.jobs)===core.stable(active.jobs)){
    const recovered=await remote(tools,core,{action:'recordCommit',batchId:active.batchId,ownerId:active.ownerId,commit:c.sha});
    return {status:'recovered_existing_main_release',batchId:active.batchId,commit:c.sha,stagingCommit:recovered.commit};
   }
  }
  if(active.batchId!==batchId||active.ownerId!==ownerId)
   return {status:'existing_uncommitted_publication',batchId:active.batchId,ownerId:active.ownerId};
 }
 let begin;
 try{begin=await remote(tools,core,{action:'beginPublication',batchId,ownerId});}
 catch(e){return {status:'publication_locked',reason:String(e)};}
 if(begin.status==='empty_or_gated')return {status:'nothing_ready'};
 if(begin.status!=='saved'||!begin.output?.jobs?.length)throw Error('Unable to lock READY publication');
 const p=begin.output, stagingSha=begin.commit, unique=new Map();
 let pushedCommit=null,unknownMainCAS=false;
 try {
  // Use an immutable staging commit. Bounded parallelism avoids 100 sequential network calls.
  const queue=await json('data/geo-knowledge/queue.json',stagingSha);
  const byId=new Map(queue.jobs.map(j=>[j.jobId,j]));
  const values=new Array(p.jobs.length);
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(12,p.jobs.length)},async()=>{
   for(;;){
    const i=cursor++;if(i>=p.jobs.length)return;
    const locked=p.jobs[i],job=byId.get(locked.jobId);
    if(!job||!job.available||job.sourceFingerprint!==locked.sourceFingerprint)
     throw Error('Missing/unavailable or stale source: '+locked.jobId);
    const r=await json(locked.resultPath,stagingSha);
    if(r.status!=='READY'||core.digest(r)!==locked.resultHash)
     throw Error('Immutable result hash/status mismatch: '+locked.jobId);
    const errors=core.validateResult(r,job);
    if(errors.length)throw Error('Invalid '+locked.jobId+': '+errors.join('; '));
    values[i]={job,result:r};
   }
  }));
  // Two jobs for the same stable ID may coexist only as a documented full amendment.
  for(const v of values){
   const old=unique.get(v.job.stableId);
   if(old&&!v.job.amendmentOf&&!old.job.amendmentOf)
    throw Error('Multiple unrelated READY results for '+v.job.stableId);
   if(!old||v.job.amendmentOf===old.job.jobId||old.job.amendmentOf!==v.job.jobId)
    unique.set(v.job.stableId,v);
  }
  const entries=[...unique].map(([stableId,v])=>({
   path:'data/geo-knowledge/entities/'+stableId+'.json',
   mode:'100644',type:'blob',content:JSON.stringify(v.result,null,2)+'\n'
  }));
  entries.push({path:'data/geo-knowledge/releases/'+batchId+'.json',
   mode:'100644',type:'blob',content:JSON.stringify({schemaVersion:2,batchId,jobs:p.jobs},null,2)+'\n'});
  // Trees are a transport detail, not additional releases. One final commit/ref update.
  function pieces(list){
   const result=[];let part=[],size=0;
   for(const x of list){
    const bytes=x.path.length+x.content.length;
    if(part.length&&(size+bytes>160000||part.length>=80)){result.push(part);part=[];size=0;}
    part.push(x);size+=bytes;
   }
   if(part.length)result.push(part);
   return result;
  }
  const parts=pieces(entries);
  // Source snapshots are hashes of current content MD: read directory Git trees, not one MD per job.
  for(let tries=0;tries<3;tries++){
   const mainSha=(await fetch(api+'/git/ref/heads/main')).object.sha;
   const mainGit=await fetch(api+'/git/commits/'+mainSha);
   const memo=new Map();
   async function treeAt(sha){
    if(!memo.has(sha))memo.set(sha,fetch(api+'/git/trees/'+sha));
    return memo.get(sha);
   }
   async function blobAt(path){
    const segments=path.split('/'),last=segments.pop();let sha=mainGit.tree.sha;
    for(const part of segments){
     const t=await treeAt(sha),e=t.tree?.find(e=>e.path===part&&e.type==='tree');
     if(!e)throw Error('Missing source directory '+path);sha=e.sha;
    }
    const t=await treeAt(sha),e=t.tree?.find(e=>e.path===last&&e.type==='blob');
    return e?.sha||null;
   }
   const sourceChecks=await Promise.all(values.map(async ({job})=>{
    if(!job.contentPath||!job.sourceBlobSha)return null;
    const actual=await blobAt(job.contentPath);
    return actual===job.sourceBlobSha?null:job.jobId;
   }));
   const stale=sourceChecks.filter(Boolean);
   if(stale.length)throw Error('Changed main source blobs; revalidate before publication: '+stale.slice(0,12).join(', ')+(stale.length>12?' …':''));
   let nextTree=mainGit.tree.sha;
   for(const piece of parts)
    nextTree=unwrap(await gh.tree({repository_full_name:repo,base_tree_sha:nextTree,tree_elements:piece})).sha;
   const created=unwrap(await gh.commit({
    repository_full_name:repo,parent_sha:mainSha,tree_sha:nextTree,
    message:'geo: publish '+p.jobs.length+' READY results ('+unique.size+' passports) [batch '+batchId+']'
   })).sha;
   try {
    const update=unwrap(await gh.update({repository_full_name:repo,branch_name:'main',sha:created,expected_sha:mainSha,force:false}));
    if(update.success===false)throw Error('main CAS refused');
    pushedCommit=created;break;
   }catch(e){
    const observed=(await fetch(api+'/git/ref/heads/main')).object.sha;
    if(observed===created){pushedCommit=created;break;}
    // A lost CAS response may precede another author's later commits.
    let walker=observed,found=false,reachedOldHead=false;
    for(let k=0;k<30&&walker;k++){
     if(walker===created){found=true;break;}
     if(walker===mainSha){reachedOldHead=true;break;}
     const parent=await fetch(api+'/git/commits/'+walker);
     walker=parent.parents?.[0]?.sha;
    }
    if(found){pushedCommit=created;break;}
    if(!reachedOldHead){unknownMainCAS=true;throw Error('Cannot prove whether main contains '+created);}
    if(tries===2)throw Error('main raced three times; locked results preserved: '+String(e));
   }
  }
  if(!pushedCommit)throw Error('No main commit');
  const record=await remote(tools,core,{action:'recordCommit',batchId,ownerId,commit:pushedCommit});
  if(record.status!=='saved')throw Error('Commit was published but staging recordCommit is incomplete');
  return {status:'deployed_pending',batchId,commit:pushedCommit,stagingCommit:record.commit,
   results:p.jobs.length,uniquePassports:unique.size,treeChunks:parts.length,
   note:'One main commit; automatic workflow_run confirmation after successful deploy'};
 }catch(e){
  if(unknownMainCAS)return {status:'unknown_main_CAS_keep_locked',batchId,error:String(e),
   note:'Do not republish before checking existing main release'};
  if(pushedCommit)return {status:'main_commit_exists_reconcile',batchId,commit:pushedCommit,
   error:String(e),note:'Do not publish again; recover recordCommit on the existing receipt'};
  try{await remote(tools,core,{action:'abortPublication',batchId,ownerId});}
  catch(abortErr){return {status:'aborted_or_conflicted',batchId,error:String(e),recoveryError:String(abortErr)};}
  return {status:'not_published_unlocked',batchId,error:String(e)};
 }
}
