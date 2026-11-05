/** Atomic independent QA approval for up to 10 already semantically verified packets.
 * Reviewers must read Word, canonical RU, and the immutable EN result BEFORE
 * supplying six distinct evidence notes. This adapter does not infer QA itself.
 * A single CAS write avoids one global index commit per reviewed packet.
 */
const REPO='alexyakovlev79/adatours.ru';
const BRANCH='i18n/translation-mass-staging';
const ROOT='data/i18n/translation-mass/v2';
const CHECKS=['word','meaning','facts','voice','structure','relations'];
const MAX_RETRIES=4;
export const MAX_APPROVAL_BATCH=10;
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{3,200}$/.test(s);
const un=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r};
const clean=data=>JSON.stringify(data,null,2)+'\n';
const retryable=error=>/cas_|409|422|expected.sha|non.fast.forward|conflict|reference|mismatch|branch advanced|GithubGraphQLAPIError|Something went wrong|Server disconnected|Transport closed|remote protocol|gateway timeout|ETIMEDOUT/i.test(String(error));
const rateLimited=error=>/rate.?limit|429|retry.?after|too many requests|resource.exhausted/i.test(String(error));
const jitter=()=>3000+Math.floor(Math.random()*27001);
async function head(tools){
 const x=un(await tools.mcp__GitHub__fetch({url:'https://api.github.com/repos/'+REPO+'/git/ref/heads/'+BRANCH}));
 return JSON.parse(x.content).object.sha;
}
async function read(tools,path,ref){
 return un(await tools.mcp__GitHub__fetch_file({repository_full_name:REPO,path,ref}));
}
async function commitBatch(tools,parent,files){
 const p=JSON.parse(un(await tools.mcp__GitHub__fetch({url:'https://api.github.com/repos/'+REPO+'/git/commits/'+parent})).content);
 const tree=un(await tools.mcp__GitHub__create_tree({repository_full_name:REPO,
  base_tree_sha:p.tree.sha,tree_elements:files.map(f=>({
   path:f.path,mode:'100644',type:'blob',content:clean(f.data)
  }))})).sha;
 const sha=un(await tools.mcp__GitHub__create_commit({repository_full_name:REPO,
  parent_sha:parent,tree_sha:tree,message:'i18n: independent QA batch ready ('+(files.length-1)+' shards) [skip ci]'})).sha;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const r=un(await tools.mcp__GitHub__update_ref({repository_full_name:REPO,
    branch_name:BRANCH,expected_sha:parent,sha,force:false}));
   if(!r.success)throw Error('Unconfirmed CAS update');
   return sha;
  }catch(error){
   if(!retryable(error))throw error;
   const observed=await head(tools);
   if(observed===sha)return sha; // GitHub accepted the commit, response was lost.
   if(observed!==parent)throw Error('cas_branch_advanced');
   if(attempt===1)throw error;
  }
 }
 throw Error('Unconfirmed QA batch');
}
function checkDecisions(args){
 if(args.action!=='approve_batch')throw Error('Unsupported batch QA action');
 if(!valid(args.reviewerId))throw Error('Independent reviewerId required');
 if(!Array.isArray(args.decisions)||args.decisions.length<1||args.decisions.length>MAX_APPROVAL_BATCH)
  throw Error('1–10 complete QA decisions required');
 const seen=new Set();
 for(const d of args.decisions){
  if(!valid(d?.jobId)||seen.has(d.jobId)||!/^[a-f0-9]{40}$/.test(d.expectedBlobSha||''))
   throw Error('Unique jobId and expected immutable blob SHA required');
  seen.add(d.jobId);
  if(!CHECKS.every(k=>d.checks?.[k]===true&&
    typeof d.evidence?.[k]==='string'&&d.evidence[k].trim().length>=16))
   throw Error('Six independently substantiated QA checks required');
 }
}
export async function runEnMassQaBatch(tools,core,args={}){
 checkDecisions(args); // fail before touching GitHub for malformed/incomplete reviews
 const pause=typeof args.wait==='function'?args.wait:
  ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const now=args.now||new Date().toISOString();
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  try{
   const base=await head(tools);
   const idx=JSON.parse((await read(tools,ROOT+'/index.json',base)).content);
   if(idx.schemaVersion!==2||idx.publicationEnabled!==false)
    throw Error('QA cannot change publication gate');
   const groups=new Map();
   for(const decision of args.decisions){
    const sid=core.massShard(decision.jobId);
    if(!groups.has(sid))groups.set(sid,{sid,decisions:[]});
    groups.get(sid).decisions.push(decision);
   }
   await Promise.all([...groups.values()].map(async group=>{
    const [s,j]=await Promise.all([
     read(tools,ROOT+'/state/'+group.sid+'.json',base),
     read(tools,ROOT+'/jobs/'+group.sid+'.json',base)
    ]);
    group.shard=JSON.parse(s.content);
    group.jobs=new Map(JSON.parse(j.content).jobs.map(x=>[x.jobId,x]));
   }));
   const approved=[],alreadyReady=[],changedByOther=[];
   const ruCache=new Map();
   for(const group of groups.values())for(const d of group.decisions){
    const row=group.shard.items.find(x=>x.jobId===d.jobId);
    const job=group.jobs.get(d.jobId);
    if(!row||!job||row.sourceFingerprint!==job.sourceFingerprint)
     throw Error('Source identity changed for '+d.jobId);
    if(row.status==='ready'&&row.review?.acceptedBlobSha===row.submission?.blobSha){
     if(row.submission.blobSha===d.expectedBlobSha)alreadyReady.push(d.jobId);
     else changedByOther.push(d.jobId);
     continue;
    }
    if(row.status!=='review'||!row.submission?.resultPath)
     throw Error('Not a submitted review: '+d.jobId);
    if(row.submission.blobSha!==d.expectedBlobSha)
     throw Error('Review has changed since independent verification: '+d.jobId);
    if(Object.entries(idx.ownerAssignments||{}).some(([owner,a])=>
      owner===args.reviewerId&&a.jobIds?.includes(d.jobId)))
     throw Error('Worker cannot approve their own job: '+d.jobId);
    const original=await read(tools,row.submission.resultPath,base);
    if(original.sha!==d.expectedBlobSha)
     throw Error('Stored immutable blob differs from reviewed receipt: '+d.jobId);
    core.validateMassResult(job,JSON.parse(original.content));
    const source=job.source.contentPath;
    let live=ruCache.get(source);
    if(!live){live=await read(tools,source,'main');ruCache.set(source,live)}
    if(live.sha!==job.source.sourceBlobSha)
     throw Error('Canonical RU changed: '+d.jobId);
    const approvedShard=core.massApprove(group.shard,{
     jobId:d.jobId,blobSha:d.expectedBlobSha,reviewerId:args.reviewerId,
     checks:d.checks,now
    });
    group.shard=approvedShard.shard;
    const item=group.shard.items.find(x=>x.jobId===d.jobId);
    item.review={...item.review,reviewedOriginalBlobSha:d.expectedBlobSha,
      evidence:Object.fromEntries(CHECKS.map(k=>[k,d.evidence[k]]))};
    approved.push(d.jobId);
    group.changed=true;
   }
   if(!approved.length)return{status:'already_ready',approved,alreadyReady,changedByOther,head:base};
   let newIndex=idx;
   const files=[];
   for(const group of groups.values())if(group.changed){
    newIndex=core.massRebuildIndex(newIndex,group.sid,group.shard,now);
    files.push({path:ROOT+'/state/'+group.sid+'.json',data:group.shard});
   }
   files.unshift({path:ROOT+'/index.json',data:newIndex});
   const commit=await commitBatch(tools,base,files);
   return{status:'batch_ready',approved,alreadyReady,changedByOther,commit,
     counts:newIndex.counts,shards:files.length-1};
  }catch(error){
   if(rateLimited(error))return{status:'rate_limited',retryAfterMs:3600000,
     reason:String(error).slice(0,250)};
   if(!retryable(error))throw error;
   if(attempt===MAX_RETRIES-1)return{status:'retry_pending',
     retryAfterMs:jitter(),reason:String(error).slice(0,250)};
   await pause(jitter());
  }
 }
}
