// Ada Tours: reverse external identity queue. GitHub-hosted CAS, no background execution.
// Source-first only: adatours.com / brasiltours.ru / vipdeluxetravel.ru.
export async function runReverseIdentity(tools, args = {}) {
  const repo = 'alexyakovlev79/adatours.ru';
  const branch = 'external-identity/staging';
  const root = 'data/external-identity/reverse-v1';
  const base = 'https://api.github.com/repos/' + repo;
  const validDomains = ['vipdeluxetravel.ru', 'adatours.com', 'brasiltours.ru'];
  const finalStatuses = new Set(['matched_exact', 'redirect_ready', 'checked_no_confirmed_pair', 'review', 'retry', 'excluded']);
  const unwrap = value => {
    if (!value || value.isError) throw new Error('GitHub operation failed: ' + JSON.stringify(value).slice(0, 900));
    return value.result || value.structuredContent || value;
  };
  const now = () => Date.now();
  const iso = ms => new Date(ms).toISOString();
  const validName = s => typeof s === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(s);
  const domainOf = url => typeof url === 'string' ? (url.match(/^https?:\/\/([^/?#]+)/i)?.[1]?.toLowerCase() || '') : '';
  const norm = s => {
    if (typeof s !== 'string' || !/^https?:\/\//i.test(s.trim())) return '';
    const m = s.trim().replace(/#.*$/, '').match(/^(https?:\/\/[^\/?#]+)(\/[^?#]*)?(\?[^#]*)?/i);
    return m ? m[1].toLowerCase() + ((m[2] || '/').replace(/\/+$/, '') || '/') + (m[3] || '') : '';
  };
  const fetchApi = async url => JSON.parse(unwrap(await tools.mcp__GitHub__fetch({url})).content);
  const getHead = async () => (await fetchApi(base + '/git/ref/heads/' + branch)).object.sha;
  async function readJson(path, ref) {
    const f = unwrap(await tools.mcp__GitHub__fetch_file({repository_full_name:repo,path,ref}));
    const raw = f.content || unwrap(await tools.mcp__GitHub__fetch_blob({repository_full_name:repo,blob_sha:f.sha})).content;
    if (!raw) throw new Error('Unreadable JSON: ' + path);
    return {data:JSON.parse(raw),sha:f.sha};
  }
  const statePath = root + '/state.json';
  const manifestPath = root + '/manifest.json';
  const loadState = async head => readJson(statePath,head);
  const loadInventory = async (domain,head) => (await readJson(root+'/inventories/'+domain+'.json',head)).data;
  const saveClaim = async (state,sha,message) => {
    const res = unwrap(await tools.mcp__GitHub__update_file({
      repository_full_name:repo,path:statePath,branch,sha,
      content:JSON.stringify(state,null,2)+'\n',message:message+' [skip ci]'
    }));
    if (!res.commit_sha) throw new Error('Missing commit SHA after claim CAS');
    return res.commit_sha;
  };
  function rowStats(rows,state,currentTime) {
    const counts={pending:0,leased:0,expired:0,matched_exact:0,redirect_ready:0,
      checked_no_confirmed_pair:0,review:0,retry:0,excluded:0};
    for (const row of rows) {
      const st = state.records[row.sourceUrl];
      if (!st) {counts.pending++;continue;}
      if (st.status === 'leased' && Date.parse(st.expiresAt) <= currentTime) counts.expired++;
      else counts[st.status] = (counts[st.status] || 0)+1;
    }
    return counts;
  }
  function activeOwn(state,ownerId,token) {
    return Object.entries(state.records).filter(([,r])=>r.status === 'leased' &&
      r.ownerId === ownerId && r.token === token);
  }
  const action = args.action || 'status';
  if (!['claim','renew','release','complete','status'].includes(action)) throw new Error('Unknown action: '+action);
  const manifest = (await readJson(manifestPath,'main')).data;
  const leaseMs = 60*60*1000, batchSize=50, checkpointEvery=10;
  if (manifest.leaseMinutes !== 60 || manifest.batchSize !== 50 || manifest.checkpointEvery !== 10)
    throw new Error('Unexpected manifest reservation parameters');
  if (action === 'status') {
    const head=await getHead();
    const state=(await loadState(head)).data;
    const domains={};
    for (const domain of validDomains) {
      const inv=await loadInventory(domain,head);
      domains[domain]={inventory:inv.rows.length,discoveryStatus:inv.discoveryStatus,
        ...rowStats(inv.rows,state,now())};
    }
    return {status:'ok',branch,head,domains};
  }
  const {ownerId,token}=args;
  if (!validName(ownerId) || !validName(token)) throw new Error('Need a stable ownerId and token of 8–100 safe characters');
  if (action === 'claim') {
    const lane=args.lane||'pending';
    if (!['pending','review','retry'].includes(lane)) throw new Error('Invalid lane');
    const limit=args.limit===undefined?50:args.limit;
    if (!Number.isInteger(limit) || limit<1 || limit>50) throw new Error('Limit must be 1–50');
    for (let attempt=0;attempt<3;attempt++) {
      const head=await getHead(), f=await loadState(head), st=f.data, tick=now();
      const own=activeOwn(st,ownerId,token);
      if (own.length) {
        const expired=own.filter(([,r])=>Date.parse(r.expiresAt)<=tick);
        if (expired.length) return {status:'lease_expired',ownerId,urls:expired.map(([url])=>url),head};
        const ids=own.map(([url])=>url),domain=own[0][1].sourceDomain;
        const inv=await loadInventory(domain,head);
        const details=new Map(inv.rows.map(r=>[r.sourceUrl,r]));
        return {status:'resumed',ownerId,batchId:own[0][1].batchId,domain,
          selected:ids.map(url=>details.get(url)||{sourceUrl:url}),expiresAt:own[0][1].expiresAt,head};
      }
      const domainOrder=args.domain ? [args.domain] : manifest.priority;
      if(domainOrder.some(d=>!validDomains.includes(d)))throw new Error('Unknown domain');
      let selected=[],domain='';
      for(const d of domainOrder){
        const inv=await loadInventory(d,head);
        if(inv.discoveryStatus==='pending_discovery'||!inv.rows.length)continue;
        selected=inv.rows.filter(r=>{
          const rec=st.records[r.sourceUrl];
          if (lane==='pending') return !rec||(rec.status==='leased'&&Date.parse(rec.expiresAt)<=tick);
          return rec?.status===lane;
        }).slice(0,limit);
        if(selected.length){domain=d;break;}
      }
      if(!selected.length)return {status:'empty',lane,domain:args.domain||'all',head};
      if(args.dryRun===true) return {status:'dry_run',lane,domain,count:selected.length,selected,head};
      const batchId='reverse-'+domain.replace(/[^a-z0-9]/gi,'-')+'-'+tick.toString(36)+'-'+Math.random().toString(36).slice(2,10);
      const claimedAt=iso(tick),expiresAt=iso(tick+leaseMs);
      for(const row of selected) {
        const previous=st.records[row.sourceUrl];
        st.records[row.sourceUrl]={status:'leased',sourceDomain:domain,
          ownerId,token,batchId,claimedAt,expiresAt,
          generation:(previous?.generation||0)+1,
          ...(previous&&previous.status!=='leased'?{priorReview:previous}:{})};
      }
      st.updatedAt=claimedAt;st.lastBatch=batchId;
      try{
        const commit=await saveClaim(st,f.sha,'external-identity: claim '+selected.length+' from '+domain);
        return {status:'reserved',batchId,ownerId,domain,lane,count:selected.length,
          selected,claimedAt,expiresAt,commit,headBefore:head};
      }catch(e){
        if(attempt===2)throw new Error('Claim CAS failed 3 times: '+String(e));
      }
    }
  }
  if (action === 'renew') {
    if(!validName(args.batchId))throw new Error('Need batchId');
    for(let attempt=0;attempt<3;attempt++) {
      const head=await getHead(),f=await loadState(head),st=f.data,tick=now();
      const own=activeOwn(st,ownerId,token).filter(([,r])=>r.batchId===args.batchId);
      if(!own.length)return {status:'nothing_to_renew',batchId:args.batchId,head};
      if(own.some(([,r])=>Date.parse(r.expiresAt)<=tick))
        return {status:'lease_expired',batchId:args.batchId,expired:own.filter(([,r])=>Date.parse(r.expiresAt)<=tick).map(([url])=>url)};
      const expiresAt=iso(tick+leaseMs);
      for(const [,r] of own){r.expiresAt=expiresAt;r.lastHeartbeatAt=iso(tick);}
      st.updatedAt=iso(tick);
      try{
        const commit=await saveClaim(st,f.sha,'external-identity: renew '+args.batchId);
        return {status:'renewed',batchId:args.batchId,count:own.length,expiresAt,commit};
      }catch(e){if(attempt===2)throw new Error('Renew CAS failed 3 times: '+String(e));}
    }
  }
  if (action === 'release') {
    if(!validName(args.batchId))throw new Error('Need batchId');
    for(let attempt=0;attempt<3;attempt++){
      const head=await getHead(),f=await loadState(head),st=f.data,tick=now();
      const own=activeOwn(st,ownerId,token).filter(([,r])=>r.batchId===args.batchId);
      if(!own.length)return {status:'nothing_to_release',batchId:args.batchId,head};
      if(own.some(([,r])=>Date.parse(r.expiresAt)<=tick))
        return {status:'lease_expired',batchId:args.batchId};
      for(const [url,r] of own){
        if(r.priorReview)st.records[url]=r.priorReview;
        else delete st.records[url];
      }
      st.updatedAt=iso(tick);
      try{
        const commit=await saveClaim(st,f.sha,'external-identity: release '+args.batchId);
        return {status:'released',batchId:args.batchId,count:own.length,commit};
      }catch(e){if(attempt===2)throw new Error('Release CAS failed 3 times: '+String(e));}
    }
  }
  if (action === 'complete') {
    const {batchId,part,results}=args;
    if(!validName(batchId)||!Number.isInteger(part)||part<1||part>5)
      throw new Error('Complete requires batchId and part 1–5');
    if(!Array.isArray(results)||results.length<1||results.length>checkpointEvery)
      throw new Error('Complete requires 1–10 result rows per part');
    const unique=new Set(),normalized=[];
    for(const r of results){
      const u=norm(r.sourceUrl);
      if(!u||!validDomains.includes(domainOf(u))||unique.has(u))throw new Error('Invalid or duplicate sourceUrl');
      unique.add(u);
      if(!finalStatuses.has(r.status))throw new Error('Invalid result status: '+r.status);
      if((r.status==='matched_exact'||r.status==='redirect_ready')&&
         (!/^https:\/\/adatours\.ru\//.test(r.ruUrl||'')||
          !Array.isArray(r.evidence)||!r.evidence.length))
          throw new Error('Exact match / 301 target requires RU canonical and evidence: '+u);
      if(!['matched_exact','redirect_ready'].includes(r.status)&&!String(r.note||'').trim())
        throw new Error('Non-matched result needs explicit note: '+u);
      if(r.status==='matched_exact'&&domainOf(u)==='vipdeluxetravel.ru')throw new Error('VIP results use redirect_ready, not matched_exact');
      if(r.status==='redirect_ready'&&domainOf(u)!=='vipdeluxetravel.ru')throw new Error('301 allowed only for VIP domain');
      normalized.push({...r,sourceUrl:u,relation:r.status==='matched_exact'?'sameAs':r.status==='redirect_ready'?'redirect_301':(r.relation||null)});
    }
    const path=root+'/results/'+batchId+'-part-'+String(part).padStart(2,'0')+'.json';
    for(let attempt=0;attempt<3;attempt++){
      const head=await getHead(),f=await loadState(head),st=f.data,tick=now();
      const already=normalized.filter(r=>st.records[r.sourceUrl]?.receipt===path);
      if(already.length===normalized.length)return {status:'already_saved',batchId,part,count:normalized.length,head,receipt:path};
      if(already.length)throw new Error('Mixed already-completed and uncommitted rows in same part; recover existing receipt');
      for(const r of normalized){
        const item=st.records[r.sourceUrl];
        if(!item||item.status!=='leased'||item.ownerId!==ownerId||item.token!==token||
           item.batchId!==batchId)throw new Error('Not an owned active claim: '+r.sourceUrl);
        if(Date.parse(item.expiresAt)<=tick)throw new Error('Lease expired for '+r.sourceUrl);
      }
      const checkedAt=iso(tick);
      const output=normalized.map(r=>({...r,checkedAt,sourceDomain:domainOf(r.sourceUrl)}));
      const report={version:1,batchId,part,ownerId,checkedAt,results:output};
      for(const r of output){
        const old=st.records[r.sourceUrl];
        st.records[r.sourceUrl]={status:r.status,sourceDomain:r.sourceDomain,
          ruUrl:r.ruUrl||'',relation:r.relation||null,
          checkedAt,evidence:r.evidence||[],note:r.note||'',
          receipt:path,batchId,ownerId,generation:old.generation,
          ...(old.priorReview?{priorReview:old.priorReview}:{})};
      }
      st.updatedAt=checkedAt;
      const commitData=await fetchApi(base+'/git/commits/'+head);
      const tree=unwrap(await tools.mcp__GitHub__create_tree({
        repository_full_name:repo,base_tree_sha:commitData.tree.sha,
        tree_elements:[
          {path:statePath,mode:'100644',type:'blob',content:JSON.stringify(st,null,2)+'\n'},
          {path,mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}
        ]}));
      const created=unwrap(await tools.mcp__GitHub__create_commit({
        repository_full_name:repo,tree_sha:tree.sha,parent_sha:head,
        message:'external-identity: save '+batchId+' part '+part+' ('+normalized.length+') [skip ci]'
      }));
      try{
        const res=unwrap(await tools.mcp__GitHub__update_ref({
          repository_full_name:repo,branch_name:branch,sha:created.sha,expected_sha:head,force:false
        }));
        if(!res.success)throw new Error('No success in update_ref');
        const remain=Object.entries(st.records).filter(([,r])=>r.status==='leased'&&r.batchId===batchId&&r.ownerId===ownerId).length;
        return {status:'saved',batchId,part,count:normalized.length,remainingOwned:remain,
          commit:created.sha,receipt:path};
      }catch(e){
        if(attempt===2)throw new Error('Complete CAS failed after 3 attempts: '+String(e));
      }
    }
  }
  throw new Error('Unexpected worker path');
}
