/** Ada Tours EN full-text swarm v1. Pure, deterministic state transitions; one job = five full source texts. */
export const FULLTEXT_LEASE_MS=90*60*1000;
export const FULLTEXT_MAX_ATTEMPTS=4;
const ok=(x,msg)=>{if(!x)throw Error("ADAEN fulltext: "+msg);};
const clone=x=>JSON.parse(JSON.stringify(x));
const at=x=>{const n=Date.parse(x);ok(Number.isFinite(n),"invalid time");return n;};
const iso=x=>new Date(x).toISOString();
const valid=x=>typeof x==="string"&&/^[a-zA-Z0-9_.:-]{6,180}$/.test(x);
export function fulltextPacketId(n){ok(Number.isInteger(n)&&n>=1&&n<=1412,"packet number");return "ADAEN-P"+String(n).padStart(5,"0");}
export function fulltextShardId(n){return ((n-1)%16).toString(16).padStart(2,"0");}
export function fulltextDefinitionPath(n){return "definitions/"+String(Math.floor((n-1)/20)).padStart(4,"0")+".json";}
export function fulltextValidateDefinition(def,n,manifest){
 ok(def?.schemaVersion===1&&Array.isArray(def.packets),"definition format");
 const p=def.packets.find(x=>x.number===n);ok(p?.id===fulltextPacketId(n),"packet definition absent");
 ok(p.sourceMainSha===manifest.sourceMainSha&&p.items.length===(n===manifest.packets?((manifest.items-1)%5+1):5),"source version or packet size");
 const nums=p.items.map(x=>x.number);
 ok(nums.every((x,i)=>x===(n-1)*5+i+1),"non-contiguous text numbers");
 ok(p.items.every(x=>x.packet===n&&/^[0-9a-f]{40}$/.test(x.sha)&&x.path.endsWith(".md")),"source identity");
 return p;
}
export function fulltextPick(control,ownerId,token,now){
 ok(valid(ownerId)&&valid(token),"owner/token format");
 const mine=control.activeByOwner?.[ownerId];
 if(mine&&at(mine.expiresAt)>at(now)){
   ok(mine.token===token,"owner has a live lease with different token");
   return {mode:"resumed",number:mine.number};
 }
 if((control.completedByOwner?.[ownerId]||0)>=10)return {mode:"chat_limit"};
 const retry=(control.retryQueue||[]).find(x=>at(x.nextAttemptAt)<=at(now));
 if(retry)return {mode:"retry",number:retry.number};
 const expired=Object.values(control.activeByOwner||{}).find(x=>at(x.expiresAt)<=at(now));
 if(expired)return {mode:"expired",number:expired.number};
 if(control.nextPacket<=control.packets)return {mode:"new",number:control.nextPacket};
 if(Object.keys(control.activeByOwner||{}).length)return {mode:"busy"};
 if((control.retryQueue||[]).length)return {mode:"retry_pending"};
 return {mode:"exhausted"};
}
export function fulltextClaim(control,shard,selection,{ownerId,token,now}){
 const c=clone(control),s=clone(shard),n=selection.number,key=String(n);
 ok(selection.mode!=="resumed"&&Number.isInteger(n),"new selection required");
 const prev=s.packets[key];ok(prev,"packet missing from state shard");
 ok(!c.activeByOwner[ownerId]||at(c.activeByOwner[ownerId].expiresAt)<=at(now),"owner already leased");
 if(selection.mode==="new")ok(n===c.nextPacket&&prev.status==="queued","cursor/state divergence");
 if(selection.mode==="retry")ok(["queued","retryable"].includes(prev.status),"retry state divergence");
 if(selection.mode==="expired")ok(prev.status==="leased"&&at(prev.expiresAt)<=at(now),"expired state divergence");
 if(prev.status==="leased"){
   delete c.activeByOwner[prev.ownerId];c.leased--;
 }else if(prev.status==="retryable"){c.retryable--;}
 else if(prev.status==="queued"){c.queued--;}
 else throw Error("packet is not available");
 if(prev.attempts>=FULLTEXT_MAX_ATTEMPTS){
   prev.status="failed_final";prev.reason="Maximum lease attempts exceeded";c.failed_final=(c.failed_final||0)+1;
   c.retryQueue=c.retryQueue.filter(x=>x.number!==n);if(selection.mode==="new")c.nextPacket++;
   return {control:c,shard:s,skipped:true};
 }
 if(selection.mode==="new")c.nextPacket++;
 c.retryQueue=c.retryQueue.filter(x=>x.number!==n);
 const generation=(prev.generation||0)+1,expiresAt=iso(at(now)+FULLTEXT_LEASE_MS);
 s.packets[key]={status:"leased",generation,attempts:(prev.attempts||0)+1,ownerId,token,claimedAt:now,expiresAt};
 c.activeByOwner[ownerId]={number:n,token,generation,expiresAt};
 c.leased++;
 return {control:c,shard:s,lease:s.packets[key]};
}
function owned(control,shard,n,{ownerId,token,generation,now}){
 const p=shard.packets[String(n)],o=control.activeByOwner?.[ownerId];
 ok(p?.status==="leased"&&p.ownerId===ownerId&&p.token===token&&p.generation===generation,"not lease owner");
 ok(o?.number===n&&o.token===token&&o.generation===generation,"lease index mismatch");
 ok(at(p.expiresAt)>at(now),"lease expired");return p;
}
export function fulltextRenew(control,shard,n,args){
 const c=clone(control),s=clone(shard),p=owned(c,s,n,args);
 const expiresAt=iso(at(args.now)+FULLTEXT_LEASE_MS);
 p.expiresAt=expiresAt;c.activeByOwner[args.ownerId].expiresAt=expiresAt;
 return {control:c,shard:s,expiresAt};
}
export function fulltextValidateResult(packet,result){
 ok(result?.packetId===packet.id&&result.sourceMainSha===packet.sourceMainSha&&result.locale==="en"&&result.status==="review","result envelope");
 ok(Array.isArray(result.texts)&&result.texts.length===packet.items.length,"all five full texts required");
 for(let i=0;i<packet.items.length;i++){
   const src=packet.items[i],got=result.texts[i];
   ok(got?.number===src.number&&got?.path===src.path&&got?.sourceBlobSha===src.sha,"source identity/order");
   ok(typeof got.enMarkdown==="string"&&got.enMarkdown.trim().length>=5,"missing complete English text");
 }
 return true;
}
export function fulltextSubmit(control,shard,n,args){
 const c=clone(control),s=clone(shard);owned(c,s,n,args);
 ok(valid(args.submissionId)&&/^[0-9a-f]{40}$/.test(args.resultBlobSha),"invalid receipt");
 const p=s.packets[String(n)];
 s.packets[String(n)]={status:"saved",generation:p.generation,attempts:p.attempts,
  submissionId:args.submissionId,resultBlobSha:args.resultBlobSha,resultPath:args.resultPath,savedAt:args.now,
  sourceMainSha:args.sourceMainSha};
 delete c.activeByOwner[args.ownerId];c.leased--;c.saved++;
 c.completedByOwner??={};c.completedByOwner[args.ownerId]=(c.completedByOwner[args.ownerId]||0)+1;
 return {control:c,shard:s,result:s.packets[String(n)]};
}
export function fulltextRelease(control,shard,n,args){
 const c=clone(control),s=clone(shard);owned(c,s,n,args);const p=s.packets[String(n)];
 s.packets[String(n)]={status:"queued",generation:p.generation+1,attempts:p.attempts};
 delete c.activeByOwner[args.ownerId];c.leased--;c.queued++;
 if(!c.retryQueue.some(x=>x.number===n))c.retryQueue.unshift({number:n,nextAttemptAt:args.now});
 return {control:c,shard:s};
}
export function fulltextReap(control,shard,n,now){
 const c=clone(control),s=clone(shard),p=s.packets[String(n)];
 ok(p?.status==="leased"&&at(p.expiresAt)<=at(now),"not an expired lease");
 s.packets[String(n)]={status:"queued",generation:p.generation+1,attempts:p.attempts};
 delete c.activeByOwner[p.ownerId];c.leased--;c.queued++;
 if(!c.retryQueue.some(x=>x.number===n))c.retryQueue.unshift({number:n,nextAttemptAt:now});
 return {control:c,shard:s};
}
export function fulltextFail(control,shard,n,args){
 const c=clone(control),s=clone(shard);owned(c,s,n,args);
 ok(["retryable","blocked_external","stale_source"].includes(args.status),"unsupported failure state");
 ok(typeof args.reason==="string"&&args.reason.length>=8,"missing reason");
 const p=s.packets[String(n)],next={status:args.status,generation:p.generation+1,attempts:p.attempts,reason:args.reason,recordedAt:args.now};
 if(args.status==="retryable"){
   const nextAttemptAt=iso(at(args.now)+Math.min(4*3600000,15*60000*2**(p.attempts-1)));
   next.nextAttemptAt=nextAttemptAt;c.retryable++;
   c.retryQueue.push({number:n,nextAttemptAt});
 }else{c[args.status]=(c[args.status]||0)+1;}
 s.packets[String(n)]=next;delete c.activeByOwner[args.ownerId];c.leased--;
 return {control:c,shard:s};
}
