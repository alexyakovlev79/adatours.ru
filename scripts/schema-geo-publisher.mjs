// Fast ChatGPT entrypoint. Default: entire READY snapshot; explicit Word jobIds: only that scope.
// GitHub Actions then reads all immutable JSON locally, commits once, and dispatches Pages.
// No individual result downloads through connector tools.
export async function publishSchemaGeoAll(tools,core,remote,options={}){
 const ownerId=options.ownerId||'geo-fast-master';
 const batchId=options.batchId||('geo-all-'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14));
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId)||!/^[a-zA-Z0-9_-]{8,120}$/.test(batchId))
  throw Error('Invalid GEO publication identity');
 const scope=options.jobIds===undefined&&options.contentCommit===undefined?null:core.geoPublicationScope(options);
 const scopeArgs=scope?{jobIds:scope.jobIds,contentCommit:scope.contentCommit}:{};
 // Finish an already successful deployment; never repeat its main commit.
 const previous=await remote(tools,core,{action:'resumePublication',...scopeArgs});
 if(['scope_blocked_by_publication','scope_already_published'].includes(previous.status))return previous;
 if(previous.status==='awaiting_deploy')
  return {status:'awaiting_existing_deploy',batchId:previous.batchId,commit:previous.commit};
 if(previous.status==='publication_requires_recovery'){
  // Recover the exact existing publication, even if another chat owns the frozen batch.
  // No new claim, no second content publication and no attempt to steal a worker lease.
  if(previous.phase==='PUBLISHING'&&previous.batchId&&previous.ownerId){
   const fired=await remote(tools,core,{
    action:'dispatchPublication',batchId:previous.batchId,ownerId:previous.ownerId
   });
   if(fired.status!=='saved')return {status:'recovery_not_dispatched',detail:fired};
   return {status:'queued_for_github_actions',batchId:previous.batchId,
    ownerId:previous.ownerId,jobs:fired.output?.count,
    stagingCommit:fired.commit,recoveredPriorClaim:true};
  }
  return {status:'existing_uncommitted_publication',batchId:previous.batchId,
   phase:previous.phase,note:'Unknown original batch or owner; do not take another claim'};
 }
 const locked=await remote(tools,core,{action:'beginPublication',batchId,ownerId,...scopeArgs});
 if(locked.status==='empty_or_gated')return {status:'nothing_ready'};
 if(locked.status!=='saved'||!locked.output?.jobs?.length)
  return {status:'publication_not_started',detail:locked};
 return {status:'queued_for_github_actions',batchId,ownerId,
  jobs:locked.output.jobs.length,stagingCommit:locked.commit,
  ...(scope?{jobIds:scope.jobIds,contentCommit:scope.contentCommit}:{}),
  note:'GitHub Actions publishes all locked results in one main commit and dispatches one Pages deploy'};
}
