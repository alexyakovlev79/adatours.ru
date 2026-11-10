/** CAS worker adapter for frozen five-document EN packets. Writes staging only. */
const REPO="alexyakovlev79/adatours.ru",BRANCH="i18n/translation-mass-staging",ROOT="data/i18n/fulltext-swarm/v1";
const API="https://api.github.com/repos/"+REPO;
const un=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result??r?.structuredContent??r};
const fetchJ=async(t,u)=>JSON.parse(un(await t.mcp__GitHub__fetch({url:u})).content);
const get=async(t,p,ref)=>un(await t.mcp__GitHub__fetch_file({repository_full_name:REPO,path:p,ref}));
const readJ=async(t,p,ref)=>JSON.parse((await get(t,p,ref)).content);
const addr=p=>ROOT+"/"+p;
const clean=x=>JSON.stringify(x,null,2)+"\n";
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_.:-]{6,180}$/.test(x);
const limited=/429|rate.?limit|too many requests|retry.?after|resource.exhausted/i;
const getHead=async t=>(await fetchJ(t,API+"/git/ref/heads/"+BRANCH)).object.sha;
const stateFile=(core,n)=>addr("state/"+core.fulltextShardId(n)+".json");
async function snapshot(t,h){
 const [m,c]=await Promise.all([readJ(t,addr("manifest.json"),h),readJ(t,addr("control.json"),h)]);
 if(m.packets!==c.packets||m.sourceMainSha!==c.sourceMainSha)throw Error("Manifest/state source mismatch");
 return {m,c};
}
async function def(t,core,h,n,m){
 return core.fulltextValidateDefinition(await readJ(t,addr(core.fulltextDefinitionPath(n)),h),n,m);
}
async function writeCAS(t,h,files,message){
 const parent=await fetchJ(t,API+"/git/commits/"+h);
 const tree=un(await t.mcp__GitHub__create_tree({repository_full_name:REPO,base_tree_sha:parent.tree.sha,
  tree_elements:Object.entries(files).map(([path,content])=>({
   path,mode:"100644",type:"blob",...(typeof content==="string"?{content}:{sha:content.sha})}))}));
 const commit=un(await t.mcp__GitHub__create_commit({repository_full_name:REPO,tree_sha:tree.sha,
  parent_sha:h,message}));
 const updated=un(await t.mcp__GitHub__update_ref({repository_full_name:REPO,branch_name:BRANCH,
  sha:commit.sha,expected_sha:h,force:false}));
 if(updated.success!==true)throw Error("CAS update_ref did not confirm success");
 return commit.sha;
}
function answer(status,p,lease,sha){
 return {status,packetId:p.id,number:p.number,sourceMainSha:p.sourceMainSha,
  source:p.items,lease,commit:sha};
}
export async function runEnFulltextSwarm(tools,core,a={}){
 const action=a.action||"status",now=new Date().toISOString(); // trusted dispatcher clock, never worker-provided
 if(!["status","claim","renew","submit","release","fail","reap"].includes(action))throw Error("Unknown action");
 if(!["status","reap"].includes(action)&&!valid(a.ownerId))throw Error("Missing ownerId");
 if(["claim","renew","submit","release","fail"].includes(action)&&!valid(a.token))throw Error("Missing token");
 let resultSha=null;
 for(let i=0;i<3;i++){
  const h=await getHead(tools),{m,c}=await snapshot(tools,h);
  if(action==="status"){
   return {status:"ok",enabled:m.enabled,reason:m.reason||null,head:h,sourceMainSha:m.sourceMainSha,
    packets:m.packets,items:m.items,leaseMinutes:m.leaseMinutes,maxPacketsPerChat:m.maxPacketsPerChat,
    counts:{queued:c.queued,leased:c.leased,saved:c.saved,retryable:c.retryable,
     blocked_external:c.blocked_external,stale_source:c.stale_source,failed_final:c.failed_final},
    nextPacket:c.nextPacket,active:c.activeByOwner,
    expired:Object.values(c.activeByOwner||{}).filter(x=>Date.parse(x.expiresAt)<=Date.parse(now)).map(x=>x.number)};
  }
  const pilotAllowed=m.pilotEnabled===true&&Array.isArray(m.pilotOwnerIds)&&m.pilotOwnerIds.includes(a.ownerId);
  if(!m.enabled&&!pilotAllowed&&action!=="reap")return {status:"disabled",reason:m.reason,head:h};
  const choice=action==="claim"?core.fulltextPick(c,a.ownerId,a.token,now):null;
  const n=action==="claim"?choice.number:
   action==="reap"?Object.values(c.activeByOwner||{}).find(x=>Date.parse(x.expiresAt)<=Date.parse(now))?.number:
   (a.number||c.activeByOwner?.[a.ownerId]?.number);
  if(choice&&["exhausted","busy","retry_pending","chat_limit"].includes(choice.mode))
   return {status:choice.mode,head:h};
  if(action==="reap"&&!n)return {status:"nothing_expired",head:h};
  if(!Number.isInteger(n)||n<1||n>m.packets)throw Error("Invalid packet number");
  const sp=stateFile(core,n),s=await readJ(tools,sp,h),before=s.packets[String(n)];
  if(!before)throw Error("Missing state record");
  if(action==="claim"&&choice.mode==="resumed"){
   if(before.status!=="leased"||before.ownerId!==a.ownerId||before.token!==a.token)
    throw Error("Resumption state mismatch");
   return answer("resumed",await def(tools,core,h,n,m),before,h);
  }
  if(action==="submit"){
   if(!valid(a.submissionId))throw Error("Missing stable submissionId");
   const packet=await def(tools,core,h,n,m);
   core.fulltextValidateResult(packet,a.result);
   if(!resultSha){
    const content=clean({schemaVersion:1,submissionId:a.submissionId,result:a.result});
    resultSha=un(await tools.mcp__GitHub__create_blob({repository_full_name:REPO,
      content,encoding:"utf-8"})).sha;
   }
   const rp=addr("results/"+String(n).padStart(5,"0")+"/"+a.submissionId+".json");
   if(before.status==="saved"){
    if(before.submissionId===a.submissionId&&before.resultBlobSha===resultSha)
     return {status:"already_saved",packetId:packet.id,resultPath:rp,resultBlobSha:resultSha,head:h};
    throw Error("Packet saved under another receipt or payload");
   }
   const drift=[];
   for(const item of packet.items){
    try{const f=await get(tools,item.path,"main");
     if(f.sha!==item.sha)drift.push({path:item.path,expected:item.sha,found:f.sha});
    }catch(e){drift.push({path:item.path,error:String(e)})}
   }
   if(drift.length){
    const moved=core.fulltextFail(c,s,n,{ownerId:a.ownerId,token:a.token,
      generation:a.generation,now,status:"stale_source",
      reason:"Source Git blob changed: "+drift.map(x=>x.path).join(", ")});
    try{const commit=await writeCAS(tools,h,{[addr("control.json")]:clean(moved.control),
      [sp]:clean(moved.shard)},"i18n fulltext: stale "+packet.id+" [skip ci]");
     return {status:"stale_source",packetId:packet.id,drift,commit};
    }catch(e){if(i===2||limited.test(String(e)))throw e;continue}
   }
   const moved=core.fulltextSubmit(c,s,n,{ownerId:a.ownerId,token:a.token,
     generation:a.generation,now,submissionId:a.submissionId,
     resultBlobSha:resultSha,resultPath:rp,sourceMainSha:packet.sourceMainSha});
   try{
    const commit=await writeCAS(tools,h,{[addr("control.json")]:clean(moved.control),
     [sp]:clean(moved.shard),[rp]:{sha:resultSha}},
     "i18n fulltext: submit "+packet.id+" (CAS) [skip ci]");
    return {status:"saved_for_review",packetId:packet.id,texts:packet.items.length,commit,
     resultPath:rp,resultBlobSha:resultSha};
   }catch(e){if(i===2||limited.test(String(e)))throw e;continue}
  }
  let moved,p=null;
  if(action==="claim"){
   p=await def(tools,core,h,n,m);
   moved=core.fulltextClaim(c,s,choice,{ownerId:a.ownerId,token:a.token,now});
  }else if(action==="renew")moved=core.fulltextRenew(c,s,n,{...a,now});
  else if(action==="release")moved=core.fulltextRelease(c,s,n,{...a,now});
  else if(action==="fail")moved=core.fulltextFail(c,s,n,{...a,now});
  else moved=core.fulltextReap(c,s,n,now);
  try{
   const commit=await writeCAS(tools,h,{[addr("control.json")]:clean(moved.control),
     [sp]:clean(moved.shard)},"i18n fulltext: "+action+" "+core.fulltextPacketId(n)+" (CAS) [skip ci]");
   if(action==="claim"){
    if(moved.skipped)return {status:"failed_final",number:n,commit};
    return answer("reserved",p,moved.lease,commit);
   }
   return {status:action==="renew"?"renewed":action==="reap"?"requeued":
     action==="release"?"released":"recorded",number:n,commit,expiresAt:moved.expiresAt||null};
  }catch(e){if(i===2||limited.test(String(e)))throw e;}
 }
 throw Error("CAS retries exhausted");
}
