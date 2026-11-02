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
  tree_elements:changes.map(f=>({path:f.path,content:clean(f.data),mode:'100644',type:'blob'}))})).sha;
 const commit=un(await tools.mcp__GitHub__create_commit({
  repository_full_name:REPO,tree_sha:tree,parent_sha:parent,message})).sha;
 const result=un(await tools.mcp__GitHub__update_ref({
  repository_full_name:REPO,branch_name:BRANCH,expected_sha:parent,sha:commit,force:false}));
 if(!result.success)throw Error('QA CAS update not confirmed');
 return commit;
}
export async function runEnMassQa(tools,core,args={}){
 if(!['status','approve'].includes(args.action))throw Error('Unsupported QA action');
 if(!valid(args.jobId))throw Error('Exact jobId required');
 for(let n=0;n<MAX_TRIES;n++){
  try{
   const main=await head(tools),i=await get(tools,ROOT+'/index.json',main);
   const index=JSON.parse(i.content);
   if(index.schemaVersion!==2||index.publicationEnabled!==false)
    throw Error('QA cannot bypass publication gate');
   const sid=core.massShard(args.jobId);
   const [stateFile,jobsFile]=await Promise.all([
    get(tools,ROOT+'/state/'+sid+'.json',main),
    get(tools,ROOT+'/jobs/'+sid+'.json',main)
   ]);
   const shard=JSON.parse(stateFile.content),packets=JSON.parse(jobsFile.content);
   const row=shard.items.find(x=>x.jobId===args.jobId);
   const job=packets.jobs.find(x=>x.jobId===args.jobId);
   if(!row||!job||row.sourceFingerprint!==job.sourceFingerprint)
    throw Error('No canonical job in source shard');
   if(args.action==='status')return{status:row.status,jobId:args.jobId,
    submitted:row.submission?.at??null,source:job.source,
    resultPath:row.submission?.resultPath??null,
    approved:row.review?.acceptedBlobSha??null};
   if(row.status==='ready'&&row.review?.acceptedBlobSha===row.submission?.blobSha)
    return{status:'already_ready',jobId:args.jobId,head:main};
   if(row.status!=='review'||!row.submission?.resultPath)
    throw Error('Only independently submitted review may be approved');
   if(!valid(args.reviewerId)||!args.checks)throw Error('QA reviewer and checks required');
   if(Object.entries(index.ownerAssignments||{}).some(([worker,v])=>
      worker===args.reviewerId&&v.jobIds?.includes(args.jobId)))
    throw Error('Worker cannot approve their own packet');
   const resultFile=await get(tools,row.submission.resultPath,main);
   if(resultFile.sha!==row.submission.blobSha)
    throw Error('Immutable result hash differs from receipt');
   const result=JSON.parse(resultFile.content);
   core.validateMassResult(job,result);
   const live=await get(tools,job.source.contentPath,'main');
   if(live.sha!==job.source.sourceBlobSha)
    throw Error('Canonical RU changed before QA; do not approve stale results');
   const value=core.massApprove(shard,{jobId:args.jobId,
    blobSha:row.submission.blobSha,reviewerId:args.reviewerId,
    checks:args.checks,now:args.now||new Date().toISOString()});
   const next=core.massRebuildIndex(index,sid,value.shard,args.now||new Date().toISOString());
   const commit=await write(tools,main,[
    {path:ROOT+'/index.json',data:next},
    {path:ROOT+'/state/'+sid+'.json',data:value.shard}
   ],'i18n: approve exact EN bulk review '+args.jobId+' [skip ci]');
   return{status:'ready',commit,jobId:args.jobId,acceptedResult:row.submission.blobSha};
  }catch(error){
   if(n===MAX_TRIES-1||!retry(error))throw error;
  }
 }
}
