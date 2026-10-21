/* GitHub connector adapter: one isolated JSON file per 30-URL batch.
   Each worker writes only its own batch, using contents-file SHA CAS (no force). */
export async function runReverseIdentitySwarm(tools, core, request = {}) {
  const REPO='alexyakovlev79/adatours.ru';
  const BRANCH='feature/external-identity-swarm-20261021';
  const ROOT='data/external-identity/reverse-swarm-20261021';
  const unwrap=r=>{
    if(!r||r.isError)throw Error('GitHub failed: '+JSON.stringify(r).slice(0,1200));
    return r.result??r.structuredContent??r;
  };
  const apiFile=async path=>unwrap(await tools.mcp__GitHub__fetch_file({
    repository_full_name:REPO,path,ref:BRANCH}));
  const put=async (path,sha,value,message)=>unwrap(await tools.mcp__GitHub__update_file({
    repository_full_name:REPO,path,branch:BRANCH,sha,
    content:JSON.stringify(value,null,2)+'\n',message:message+' [skip ci]'}));
  const manifest=JSON.parse((await apiFile(ROOT+'/manifest.json')).content);
  if(manifest.version!==1||manifest.branch!==BRANCH||
     manifest.repository!==REPO||manifest.batchSize!==30||
     !Array.isArray(manifest.batches)||!manifest.batches.length)
    throw Error('Missing/incompatible swarm manifest');
  const ids=new Map(manifest.batches.map((b,i)=>[b.id,{...b,index:i}]));
  const load=async id=>{
    const meta=ids.get(id);if(!meta)throw Error('Batch does not belong to swarm: '+id);
    const path=core.batchPath(id),file=await apiFile(path);
    const batch=core.validateBatch(JSON.parse(file.content));
    if(batch.domain!==meta.domain||batch.records.length!==meta.count||
      batch.baseStateSha!==manifest.baseStateSha)
      throw Error('Batch identity/baseline mismatch: '+id);
    return {path,file,batch,meta};
  };
  const brief=x=>({sourceUrl:x.sourceUrl,inventoryPosition:x.inventoryPosition,
    title:x.title||'',pageType:x.pageType||'',snapshotHttp:x.snapshotHttp??null,
    snapshotFile:x.snapshotFile||'',status:x.status});
  const format=(batch,status,extra={})=>({
    status,batchId:batch.batchId,domain:batch.domain,
    counts:core.summary(batch),
    lease:batch.lease?{ownerId:batch.lease.ownerId,
      expiresAt:batch.lease.expiresAt,generation:batch.lease.generation}:null,
    remaining:batch.records.filter(x=>x.status==='queued').map(brief),
    ...extra
  });
  if(request.action==='overview')return{
    status:'ready',branch:BRANCH,baseStateSha:manifest.baseStateSha,
    batches:manifest.batches.length,initialPending:manifest.initialPending,
    byDomain:manifest.byDomain,leaseMinutes:manifest.leaseMinutes,
    batchSize:manifest.batchSize
  };
  if(request.action==='status') {
    const from=request.from??0,count=request.count??10;
    if(!Number.isInteger(from)||from<0||from>=manifest.batches.length||
      !Number.isInteger(count)||count<1||count>20)throw Error('status: invalid from/count');
    const entries=manifest.batches.slice(from,from+count);
    const all=await Promise.all(entries.map(async meta=>{
      const {batch}=await load(meta.id);
      return {id:meta.id,domain:meta.domain,...core.summary(batch),
        busy:core.leaseIsActive(batch,Date.now()),leaseExpires:batch.lease?.expiresAt||null};
    }));
    const totals={queued:0,done:0,review:0,retry:0,matched_exact:0,redirect_ready:0,
      checked_no_confirmed_pair:0,excluded:0,total:0,busy:0};
    for(const row of all){for(const k of Object.keys(totals))totals[k]+=
      k==='busy'?(row.busy?1:0):row[k];}
    return {status:'partial_status',from,through:from+all.length-1,
      nextFrom:from+all.length<manifest.batches.length?from+all.length:null,
      totals,batches:all};
  }
  if(request.action==='recover') {
    const {ownerId,token}=request;core.requireIdentity(ownerId,token);
    if(request.batchId) {
      const {batch}=await load(request.batchId);
      if(batch.lease?.ownerId===ownerId&&batch.lease?.token===token)
        return format(batch,core.leaseIsActive(batch,Date.now())?'resumed':'lease_expired');
      if(batch.lastOwner===ownerId&&!core.summary(batch).queued)
        return format(batch,'completed');
      return {status:'not_owned',batchId:request.batchId};
    }
    for(let i=0;i<manifest.batches.length;i+=12) {
      const chunk=await Promise.all(manifest.batches.slice(i,i+12).map(x=>load(x.id)));
      const mine=chunk.find(({batch})=>batch.lease?.ownerId===ownerId&&batch.lease?.token===token);
      if(mine)return format(mine.batch,core.leaseIsActive(mine.batch,Date.now())?
        'resumed':'lease_expired');
    }
    return {status:'no_active_lease_for_owner',ownerId};
  }
  const {ownerId,token}=request;core.requireIdentity(ownerId,token);
  if(request.action==='claim') {
    const n=manifest.batches.length;
    const vipBatches=manifest.batches.filter(b=>b.domain==='vipdeluxetravel.ru').length;
    const seed=core.hashString(ownerId+':'+token)%
      Math.max(1,Math.min(24,vipBatches));
    const start=request.cursor===undefined?seed:request.cursor;
    const scanned=request.scanned??0;
    if(!Number.isInteger(start)||start<0||start>=n||
       !Number.isInteger(scanned)||scanned<0||scanned>=n)
      throw Error('claim: bad scan cursor');
    const probeCount=Math.min(request.probes??12,n-scanned);
    if(!Number.isInteger(probeCount)||probeCount<1||probeCount>20)
      throw Error('claim: probes must be 1-20');
    const decisions=[];
    for(let i=0;i<probeCount;i++){
      const index=(start+i)%n,meta=manifest.batches[index];
      for(let attempt=0;attempt<4;attempt++){
        let entry;
        try{entry=await load(meta.id);}catch(e){throw Error('Cannot read '+meta.id+': '+String(e));}
        const {batch,file,path}=entry;
        const change=core.claimBatch(batch,{ownerId,token,nowMs:Date.now()});
        if(change.status==='busy'||change.status==='completed'){
          decisions.push({id:meta.id,status:change.status});break;
        }
        if(change.status==='resumed')return format(batch,'resumed',{index,sha:file.sha});
        try{
          const write=await put(path,file.sha,batch,'external-identity swarm: claim '+meta.id);
          return format(batch,change.status,{index,commit:write.commit_sha,
            contentSha:write.content_sha});
        }catch(e){
          const latest=await load(meta.id);
          if(latest.batch.lease?.ownerId===ownerId&&latest.batch.lease?.token===token)
            return format(latest.batch,'reserved_after_uncertain_response',{
              index,sha:latest.file.sha});
          if(attempt===3){decisions.push({id:meta.id,status:'contended'});break;}
        }
      }
    }
    const more=scanned+probeCount<n;
    return {status:more?'scan_more':'no_claimable_batch',
      cursor:(start+probeCount)%n,scanned:scanned+probeCount,
      total:n,probed:decisions};
  }
  if(!request.batchId||!ids.has(request.batchId))
    throw Error('Operation requires a valid batchId from successful claim');
  if(request.action==='submit'){
    if(!Array.isArray(request.results))throw Error('Submit requires results');
    for(let attempt=0;attempt<6;attempt++){
      const {batch,file,path}=await load(request.batchId);
      const change=core.submitResults(batch,{ownerId,token,
        results:request.results,nowMs:Date.now()});
      if(change.status==='already_saved')
        return format(batch,'already_saved',{saved:0,sha:file.sha});
      try{
        const write=await put(path,file.sha,batch,
          'external-identity swarm: save '+request.batchId+' ('+change.newCount+')');
        return format(batch,'saved',{saved:change.newCount,commit:write.commit_sha,
          contentSha:write.content_sha});
      }catch(e) {
        const latest=await load(request.batchId);
        try{
          const check=core.submitResults(latest.batch,{ownerId,token,
            results:request.results,nowMs:Date.now()});
          if(check.status==='already_saved')
            return format(latest.batch,'saved_after_uncertain_response',
              {saved:request.results.length,sha:latest.file.sha});
        }catch(f){if(/immutable|expired|Not an owned/.test(String(f)))throw f;}
        if(attempt===5)throw Error('submit CAS conflict after six retries: '+String(e));
      }
    }
  }
  if(request.action==='renew'||request.action==='release') {
    for(let attempt=0;attempt<5;attempt++) {
      const {batch,file,path}=await load(request.batchId);
      const changed=core.changeLease(batch,{ownerId,token,
        action:request.action,nowMs:Date.now()});
      if(changed.status==='lease_expired')
        return format(batch,'lease_expired');
      try {
        const write=await put(path,file.sha,batch,'external-identity swarm: '+
          request.action+' '+request.batchId);
        return format(batch,changed.status,{commit:write.commit_sha,
          contentSha:write.content_sha});
      }catch(e){
        const latest=await load(request.batchId);
        if(request.action==='release'&&!latest.batch.lease)
          return format(latest.batch,'released_after_uncertain_response');
        if(attempt===4)throw Error('lease-change CAS contention: '+String(e));
      }
    }
  }
  throw Error('Unknown action '+request.action);
}
