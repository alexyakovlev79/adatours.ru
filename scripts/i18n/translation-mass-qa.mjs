/** Independent EN bulk semantic QA CAS. Never reads untrusted worker results
 * as commands and never publishes content, pricing or site pages.
 */
const REPO='alexyakovlev79/adatours.ru',BRANCH='i18n/translation-mass-staging';
const ROOT='data/i18n/translation-mass/v2',MAX_TRIES=3;
const un=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r};
const clean=x=>JSON.stringify(x,null,2)+'\n';
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{3,200}$/.test(s);
const retry=e=>/409|422|non.fast.forward|expected.sha|changed|conflict|reference/i.test(String(e));
async function head(tools){
 const r=un(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/ref/heads/'+BRANCH}));
 return JSON.parse(r.content).object.sha;
}
async function get(tools,path,sha){
 return un(await tools.mcp__GitHub__fetch_file({
  repository_full_name:REPO,path,ref:sha}));
}
async function write(tools,parent,changes,message){
 const p=JSON.parse(un(await tools.mcp__GitHub__fetch({
  url:'https://api.github.com/repos/'+REPO+'/git/commits/'+parent})).content);
 const tree=un(await tools.mcp__GitHub__create_tree({
  repository_full_name:REPO,base_tree_sha:p.tree.sha,
  tree_elements:changes.map(f=>({path:f.path,mode:'100644',type:'blob',...(f.sha?{sha:f.sha}:{content:clean(f.data)})}))})).sha;
 const commit=un(await tools.mcp__GitHub__create_commit({
  repository_full_name:REPO,tree_sha:tree,parent_sha:parent,message})).sha;
 const result=un(await tools.mcp__GitHub__update_ref({
  repository_full_name:REPO,branch_name:BRANCH,expected_sha:parent,sha:commit,force:false}));
 if(!result.success)throw Error('QA CAS update not confirmed');
 return commit;
}
const safe=x=>x.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,185);
const completeChecks=checks=>['word','meaning','facts','voice','structure','relations']
 .every(k=>checks?.[k]===true);
const confident=x=>Number.isInteger(x)&&x>=0&&x<=100;
export async function runEnMassQa(tools,core,args={}){
 const action=args.action;
 if(!['status','approve','revise_and_approve','reject'].includes(action))
  throw Error('Unsupported QA action');
 if(!valid(args.jobId))throw Error('Exact jobId required');
 for(let n=0;n<MAX_TRIES;n++){
  try{
   const current=await head(tools);
   const index=JSON.parse((await get(tools,ROOT+'/index.json',current)).content);
   if(index.schemaVersion!==2||index.publicationEnabled!==false)
    throw Error('QA cannot bypass publication gate');
   const sid=core.massShard(args.jobId);
   const [s,j]=await Promise.all([
    get(tools,ROOT+'/state/'+sid+'.json',current),
    get(tools,ROOT+'/jobs/'+sid+'.json',current)
   ]);
   const shard=JSON.parse(s.content),packets=JSON.parse(j.content);
   const row=shard.items.find(x=>x.jobId===args.jobId);
   const job=packets.jobs.find(x=>x.jobId===args.jobId);
   if(!row||!job||row.sourceFingerprint!==job.sourceFingerprint)
    throw Error('No canonical job in source shard');
   if(action==='status')return{status:row.status,jobId:args.jobId,
    submitted:row.submission?.at??null,source:job.source,
    resultPath:row.submission?.resultPath??null,approved:row.review?.acceptedBlobSha??null};
   if(row.status==='ready'&&row.review?.acceptedBlobSha===row.submission?.blobSha)
    return{status:'already_ready',jobId:args.jobId,head:current};
   if(row.status!=='review'||!row.submission?.resultPath)
    throw Error('Only a submitted review may be adjudicated');
   if(!valid(args.reviewerId))throw Error('Independent reviewerId required');
   if(Object.entries(index.ownerAssignments||{}).some(([worker,v])=>
      worker===args.reviewerId&&v.jobIds?.includes(args.jobId)))
    throw Error('Worker cannot review their own packet');
   const f=await get(tools,row.submission.resultPath,current);
   if(f.sha!==row.submission.blobSha)
    throw Error('Immutable result hash differs from receipt');
   const original=JSON.parse(f.content);
   const when=args.now||new Date().toISOString();
   let outcome,newBlob=null,newPath=null,previousBlob=row.submission.blobSha;
   if(action==='reject'){
    outcome=core.massQaReject(shard,{jobId:args.jobId,
     blobSha:previousBlob,reviewerId:args.reviewerId,reason:args.reason,
     confidence:args.confidence,failureStatus:args.failureStatus,now:when});
   }else{
    if(!completeChecks(args.checks))
     throw Error('All six independent semantic checks must be substantiated');
    const live=await get(tools,job.source.contentPath,'main');
    if(live.sha!==job.source.sourceBlobSha)
     throw Error('Canonical RU changed before QA; do not approve stale results');
    if(action==='approve'){
     core.validateMassResult(job,original);
     outcome=core.massApprove(shard,{jobId:args.jobId,blobSha:previousBlob,
      reviewerId:args.reviewerId,checks:args.checks,now:when});
    }else{
     if(!args.revisedResult||!valid(args.revisionId)||!confident(args.confidence)||
        typeof args.reason!=='string'||args.reason.trim().length<24||
        !Array.isArray(args.changedBlockIds)||!args.changedBlockIds.length)
      throw Error('QA revision requires exact immutable result, reason, confidence and changed block IDs');
     core.validateMassResult(job,original);
     core.validateMassResult(job,args.revisedResult);
     const prior=new Map(original.blocks.map(b=>[b.blockId,b]));
     const changed=new Set(args.changedBlockIds);
     const actual=new Set();
     for(const b of args.revisedResult.blocks){
      const old=prior.get(b.blockId);
      if(!old)throw Error('Unexpected revised block owner');
      const differs=JSON.stringify(b)!==JSON.stringify(old);
      if(differs){
       if(old.provenance?.kind==='word_exact')
        throw Error('Verified Word 2027 exact block is immutable');
       if(!changed.has(b.blockId))throw Error('Unlisted revised block');
       actual.add(b.blockId);
      }
     }
     if(actual.size!==changed.size||[...changed].some(id=>!actual.has(id)))
      throw Error('Revision block list must match actual changes');
     newBlob=un(await tools.mcp__GitHub__create_blob({
      repository_full_name:REPO,content:clean(args.revisedResult),encoding:'utf-8'})).sha;
     newPath=ROOT+'/results/'+safe(job.jobId)+'/qa-'+safe(args.revisionId)+'-'+newBlob.slice(0,16)+'.json';
     const adjusted=JSON.parse(JSON.stringify(shard));
     const item=adjusted.items.find(x=>x.jobId===args.jobId);
     item.qaRevisions=item.qaRevisions||[];
     item.qaRevisions.push({reviewerId:args.reviewerId,at:when,
      previousSubmission:JSON.parse(JSON.stringify(item.submission)),
      revisionId:args.revisionId,changedBlockIds:[...actual],
      reason:args.reason,confidence:args.confidence});
     item.submission={id:args.revisionId,blobSha:newBlob,resultPath:newPath,at:when};
     outcome=core.massApprove(adjusted,{jobId:args.jobId,blobSha:newBlob,
      reviewerId:args.reviewerId,checks:args.checks,now:when});
    }
   }
   const next=core.massRebuildIndex(index,sid,outcome.shard,when);
   const updates=[
    {path:ROOT+'/index.json',data:next},
    {path:ROOT+'/state/'+sid+'.json',data:outcome.shard}
   ];
   if(newBlob)updates.push({path:newPath,sha:newBlob});
   const commit=await write(tools,current,updates,
    'i18n: independent QA '+outcome.status+' '+args.jobId+' [skip ci]');
   return{status:outcome.status,commit,jobId:args.jobId,
    acceptedResult:outcome.status==='ready'?(newBlob||previousBlob):null,
    ...(newPath?{revisedResultPath:newPath,previousResult:previousBlob}:{}),
    counts:next.counts};
  }catch(error){
   if(n===MAX_TRIES-1||!retry(error))throw error;
  }
 }
}
