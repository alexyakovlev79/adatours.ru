/**
 * Remote Code Mode gateway for "переписывай seo" and
 * "публикуй исправленное seo". Connector writes are always CAS.
 * Import pure helpers from src/lib/seo-geo-voice-rewrite.mjs in Node;
 * in Code Mode load helpers through the same fixed GitHub SHA.
 */
const REPO = 'alexyakovlev79/adatours.ru';
const REWRITE = 'seo-geo/voice-rewrite-staging';
const CONTROL = 'seo-geo/voice-rewrite-control';
const ROOT = 'data/seo-geo/voice-rewrite/';
const PHASES = ['01-countries','02-interests','03-country-interest','04-country-interest-vip',
  '05-tours','06-places','07-excursions'];
const api = 'https://api.github.com/repos/' + REPO;

function un(x) {
  if (!x || x.isError) throw Error('GitHub connector error: ' + JSON.stringify(x));
  return x.result || x.structuredContent || x;
}
async function branch(tools, name) {
  return JSON.parse(un(await tools.mcp__GitHub__fetch({
    url:api+'/git/ref/heads/'+name
  })).content).object.sha;
}
async function getText(tools, path, ref) {
  const f = un(await tools.mcp__GitHub__fetch_file({
    repository_full_name:REPO,path,ref
  }));
  const text = f.content || un(await tools.mcp__GitHub__fetch_blob({
    repository_full_name:REPO,blob_sha:f.sha
  })).content;
  return {text,sha:f.sha};
}
async function getJson(tools,path,ref) {
  const file = await getText(tools,path,ref);
  return {...file,json:JSON.parse(file.text)};
}
async function treeSha(tools,sha) {
  return JSON.parse(un(await tools.mcp__GitHub__fetch({
    url:api+'/git/commits/'+sha
  })).content).tree.sha;
}
async function casBatch(tools,head,entries,message) {
  const tree = un(await tools.mcp__GitHub__create_tree({
    repository_full_name:REPO,base_tree_sha:await treeSha(tools,head),
    tree_elements:entries.map(([path,content])=>({path,mode:'100644',type:'blob',content}))
  }));
  const commit = un(await tools.mcp__GitHub__create_commit({
    repository_full_name:REPO,parent_sha:head,tree_sha:tree.sha,message
  }));
  un(await tools.mcp__GitHub__update_ref({
    repository_full_name:REPO,branch_name:REWRITE,
    sha:commit.sha,expected_sha:head,force:false
  }));
  return commit.sha;
}
function json(value) { return JSON.stringify(value,null,2)+'\n'; }
function leaseInfo(claim) {
  return {ownerId:claim.ownerId,batchId:claim.batchId,
    cycle:claim.cycle,expiresAt:claim.expiresAt};
}
function owned(claims,ownerId,batchId) {
  return Object.entries(claims).filter(([,v])=>v.ownerId===ownerId&&v.batchId===batchId);
}
async function claim(tools,core,{runId,cycle,limit=10}) {
  const lease=core.newClaim(runId,cycle);
  for(let attempt=0;attempt<3;attempt++){
    const [staging,main]=await Promise.all([branch(tools,REWRITE),branch(tools,'main')]);
    const [c,p]=await Promise.all([
      getJson(tools,ROOT+'claims.json',staging),getJson(tools,ROOT+'prepared.json',staging)
    ]);
    const mine=owned(c.json.claims||{},lease.ownerId,lease.batchId);
    if(mine.length) {
      const expired=mine.some(([,v])=>Date.parse(v.expiresAt)<=Date.now());
      return {status:expired?'expired':'resumed',runId,cycle,head:staging,
        selected:mine.map(([url,l])=>({url,...l})),expiresAt:mine[0][1].expiresAt};
    }
    if(Object.values(c.json.claims||{}).some(v=>v.ownerId===lease.ownerId &&
      Date.parse(v.expiresAt)>Date.now() && v.batchId!==lease.batchId)){
      return {status:'previous_cycle_unfinished',runId,cycle};
    }
    const phases=[];
    let rows=[];
    for(const phase of PHASES) {
      const data=await getJson(tools,'data/seo-geo/registry/'+phase+'.json',main);
      phases.push(data.json);
      rows=core.eligiblePublishedRows(phases,c.json.claims,p.json.entries,Date.now(),limit);
      if(rows.length>=limit) break;
    }
    if(!rows.length) return {status:'empty',runId,cycle,main,staging};
    const next={...c.json,claims:{...c.json.claims}};
    const timestamp=new Date().toISOString();
    const expiresAt=new Date(Date.now()+30*60000).toISOString();
    rows.forEach(row=>{
      next.claims[row.url]={...lease,claimedAt:timestamp,expiresAt,order:row.order,
        phase:row.phase,path:row.path,generation:(next.claims[row.url]?.generation||0)+1};
    });
    try{
      const saved=un(await tools.mcp__GitHub__update_file({
        repository_full_name:REPO,path:ROOT+'claims.json',branch:REWRITE,
        sha:c.sha,content:json(next),
        message:'seo rewrite: claim '+rows.length+' published URLs (CAS)'
      }));
      return {status:'reserved',runId,cycle,selected:rows,main,stagingCommit:saved.commit_sha,
        expiresAt,limit};
    }catch(e){
      const now=await branch(tools,REWRITE);
      if(now===staging||attempt===2)throw e;
    }
  }
}
async function complete(tools,core,{runId,cycle,items}) {
  const lease=core.newClaim(runId,cycle);
  if(!Array.isArray(items)||!items.length||items.length>10)throw Error('Supply 1–10 {url,content} articles');
  if(new Set(items.map(x=>x.url)).size!==items.length)throw Error('Duplicate URL');
  for(let attempt=0;attempt<3;attempt++) {
    const [staging,main]=await Promise.all([branch(tools,REWRITE),branch(tools,'main')]);
    const [c,p]=await Promise.all([
      getJson(tools,ROOT+'claims.json',staging),getJson(tools,ROOT+'prepared.json',staging)
    ]);
    const recorded=items.every(x=>p.json.entries?.[x.url]?.batchId===lease.batchId);
    if(recorded) return {status:'already_saved',runId,cycle,urls:items.map(x=>x.url),head:staging};
    const active=owned(c.json.claims||{},lease.ownerId,lease.batchId);
    const expected=new Set(active.map(([url])=>url));
    if(active.length!==items.length || items.some(x=>!expected.has(x.url)))
      throw Error('The complete operation must contain all current claimed URLs (release blocked URLs first)');
    if(active.some(([,v])=>Date.parse(v.expiresAt)<=Date.now()))
      return {status:'lease_expired',runId,cycle,urls:[...expected]};
    const fetched=await Promise.all(items.map(async row=>{
      const cl=c.json.claims[row.url];
      const file=await getText(tools,cl.path,main);
      const result=core.validateVoiceRewrite(file.text,row.content,row.url);
      return {...result,url:row.url,path:cl.path,oldBlobSha:file.sha,content:row.content,
        order:cl.order,phase:cl.phase};
    }));
    const prepared={...p.json,entries:{...p.json.entries}};
    const claims={...c.json,claims:{...c.json.claims}};
    const files=[];
    for(const row of fetched){
      prepared.entries[row.url]={status:'ready',path:row.path,phase:row.phase,order:row.order,
        sourceBlobSha:row.oldBlobSha,batchId:lease.batchId,runId,
        preparedAt:new Date().toISOString(),changed:row.changed,changedLines:row.changedLines,
        leadChanged:row.leadChanged};
      if(row.changed) files.push([row.path,row.content]);
      delete claims.claims[row.url];
    }
    files.push([ROOT+'prepared.json',json(prepared)],[ROOT+'claims.json',json(claims)]);
    try {
      const sha=await casBatch(tools,staging,files,
        'seo rewrite: prepare '+fetched.length+' voice-only articles (CAS)');
      return {status:'saved',runId,cycle,commit:sha,
        articles:fetched.map(({url,changed,changedLines,leadChanged})=>
          ({url,changed,changedLines,leadChanged}))};
    }catch(e){
      const current=await branch(tools,REWRITE);
      if(current===staging||attempt===2)throw e;
    }
  }
}
async function release(tools,core,{runId,cycle,urls=[]}) {
  const lease=core.newClaim(runId,cycle);
  for(let attempt=0;attempt<3;attempt++) {
    const s=await branch(tools,REWRITE);
    const c=await getJson(tools,ROOT+'claims.json',s);
    const next={...c.json,claims:{...c.json.claims}};
    const targets=owned(next.claims,lease.ownerId,lease.batchId).map(([url])=>url);
    const selected=urls.length?targets.filter(url=>urls.includes(url)):targets;
    if(!selected.length)return {status:'nothing_to_release',runId,cycle};
    selected.forEach(url=>delete next.claims[url]);
    try{
      const result=un(await tools.mcp__GitHub__update_file({
        repository_full_name:REPO,path:ROOT+'claims.json',branch:REWRITE,
        sha:c.sha,content:json(next),message:'seo rewrite: release blocked claims'
      }));
      return {status:'released',urls:selected,commit:result.commit_sha};
    }catch(e){if(await branch(tools,REWRITE)===s||attempt===2)throw e;}
  }
}
async function publish(tools,{requestId}) {
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId||''))throw Error('Stable requestId required for idempotency');
  const [main,staging,control]=await Promise.all([
    branch(tools,'main'),branch(tools,REWRITE),branch(tools,CONTROL)
  ]);
  const p=await getJson(tools,ROOT+'prepared.json',staging);
  const ready=Object.values(p.json.entries||{}).filter(row=>row.status==='ready').length;
  if(!ready)return {status:'empty',requestId,staging};
  const d=await getJson(tools,ROOT+'dispatch.json',control);
  if(d.json.requestId===requestId)return {status:'already_dispatched',requestId,commit:control,ready};
  const payload={version:1,requestId,requestedAt:new Date().toISOString(),
    stagingHead:staging,sourceMainHead:main,mode:'publish-all-ready'};
  const result=un(await tools.mcp__GitHub__update_file({
    repository_full_name:REPO,path:ROOT+'dispatch.json',branch:CONTROL,
    sha:d.sha,content:json(payload),message:'seo rewrite: dispatch '+requestId
  }));
  return {status:'dispatched',requestId,commit:result.commit_sha,ready,
    action:'seo-rewrite-publish workflow on control push'};
}
/** All calls return only concise receipts; never transfer full articles into chat output. */
export async function runVoiceRewrite(tools,core,params={}) {
  switch(params.action){
    case 'claim':return claim(tools,core,params);
    case 'complete':return complete(tools,core,params);
    case 'release':return release(tools,core,params);
    case 'publish':return publish(tools,params);
    default:throw Error('Unknown action. Choose claim / complete / release / publish');
  }
}
