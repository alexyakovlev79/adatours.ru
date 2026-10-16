// Fast ChatGPT entrypoint. An entire READY snapshot is locked in one CAS operation.
// GitHub Actions then reads all immutable JSON locally, commits once, and dispatches Pages.
// No individual result downloads through connector tools.
export async function publishSchemaGeoAll(tools,core,remote,options={}){
 const ownerId=options.ownerId||'geo-fast-master';
 const batchId=options.batchId||('geo-all-'+new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14));
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId)||!/^[a-zA-Z0-9_-]{8,120}$/.test(batchId))
  throw Error('Invalid GEO publication identity');
 // Finish an already successful deployment; never repeat its main commit.
 const previous=await remote(tools,core,{action:'resumePublication'});
 if(previous.status==='awaiting_deploy')
  return {status:'awaiting_existing_deploy',batchId:previous.batchId,commit:previous.commit};
 if(previous.status==='publication_requires_recovery'){
  // A legacy publisher may have reserved everything but been interrupted before main commit.
  if(previous.phase==='PUBLISHING'&&previous.batchId===batchId){
   const fired=await remote(tools,core,{action:'dispatchPublication',batchId,ownerId});
   return {status:'queued_for_github_actions',batchId,jobs:fired.output?.count,
    stagingCommit:fired.commit,recoveredPriorClaim:true};
  }
  return {status:'existing_uncommitted_publication',batchId:previous.batchId,
   phase:previous.phase,note:'Resume using the original batchId and ownerId; do not take another claim'};
 }
 const locked=await remote(tools,core,{action:'beginPublication',batchId,ownerId});
 if(locked.status==='empty_or_gated')return {status:'nothing_ready'};
 if(locked.status!=='saved'||!locked.output?.jobs?.length)
  return {status:'publication_not_started',detail:locked};
 return {status:'queued_for_github_actions',batchId,ownerId,
  jobs:locked.output.jobs.length,stagingCommit:locked.commit,
  note:'GitHub Actions publishes all locked results in one main commit and dispatches one Pages deploy'};
}
