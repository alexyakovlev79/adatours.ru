// One-object GEO collection for newly published Country/Destination/Tour/Excursion.
// Content remains on main; immutable results + queue/state are committed only to staging.
// ChatGPT researches the object before invoking this module; no invented enrichment.
export const NEW_GEO_STAGES={country:1,destination:2,tour:3,excursion:4};
const GEO_REPO='alexyakovlev79/adatours.ru';
const GEO_API='https://api.github.com/repos/'+GEO_REPO;
const GEO_STAGING='schema-geo/staging';
const GEO_SHEET_ID='1ZPptMdEcIDA3ZFMOQcFuc5jU88LJlFw9R4URCQSBmmc';
const unwrap=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r;};
const validSha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
function toolsFor(t){
 const gh={fetch:t.mcp__GitHub__fetch||t.mcp__codex_apps__github_fetch,
  file:t.mcp__GitHub__fetch_file||t.mcp__codex_apps__github_fetch_file,
  blob:t.mcp__GitHub__fetch_blob||t.mcp__codex_apps__github_fetch_blob,
  tree:t.mcp__GitHub__create_tree||t.mcp__codex_apps__github_create_tree,
  commit:t.mcp__GitHub__create_commit||t.mcp__codex_apps__github_create_commit,
  update:t.mcp__GitHub__update_ref||t.mcp__codex_apps__github_update_ref};
 if(Object.values(gh).some(x=>typeof x!=='function'))throw Error('All GitHub CAS connectors required');
 return gh;
}
async function api(gh,url){return JSON.parse(unwrap(await gh.fetch({url})).content);}
async function file(gh,path,ref){
 const x=unwrap(await gh.file({repository_full_name:GEO_REPO,path,ref}));
 const content=x.content||(gh.blob?unwrap(await gh.blob({repository_full_name:GEO_REPO,blob_sha:x.sha})).content:'');
 if(!content)throw Error('GitHub file content unavailable: '+path);
 return {sha:x.sha,content};
}
async function json(gh,path,ref){return JSON.parse((await file(gh,path,ref)).content);}
export function buildNewObjectJob(entry,sourceBlobSha,sourceOrder,core){
 const kind=entry?.type,stage=NEW_GEO_STAGES[kind];
 if(!stage||!entry.id||!entry.contentPath||!entry.url||!sourceBlobSha)
  throw Error('Incomplete new GEO source-index entry');
 const plural={country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'}[kind];
 if(!/^[a-z0-9_]+$/.test(entry.id)||!entry.contentPath.startsWith('src/content/'+plural+'/')
  ||!entry.contentPath.endsWith('.md')||!/^\/[^?#]*\/$/.test(entry.url)
  ||!/^[0-9a-f]{40}$/.test(sourceBlobSha))throw Error('Unsafe GEO new object paths/identity');
 const countryIds=entry.countryIds||[],destinationIds=entry.destinationIds||[];
 if(!Array.isArray(countryIds)||!Array.isArray(destinationIds))throw Error('Invalid linked IDs');
 const source={stableId:entry.id,kind,url:entry.url,sourceBlobSha,countryIds,destinationIds};
 return {jobId:'geo-'+kind+'-'+entry.id,stage,sourceOrder,kind,stableId:entry.id,
  url:entry.url,name:entry.name||entry.id,available:true,reason:'',
  contentPath:entry.contentPath,entryPath:'data/source-index/entries/'+entry.id+'.json',
  countryIds,destinationIds,sourceBlobSha,sourceFingerprint:core.digest(source),
  registryPath:null,origin:'inline_new_object'};
}
export function newGeoSheetRows(job,record,result){
 const link='https://github.com/'+GEO_REPO+'/blob/'+GEO_STAGING+'/'+record.resultPath;
 const token=record.completedToken||'inline';
 const stamp=record.completedAt||'';
 const verified=(result.evidence||[]).map(x=>x.checkedAt).filter(Boolean).sort().at(-1)||stamp;
 const commentary=result.reviewNote||'Паспорт собран при создании объекта; ожидание мастер-публикации';
 const queue=[job.jobId,job.stage,job.sourceOrder,job.kind,job.stableId,
   'https://adatours.ru'+job.url,job.name,record.status,record.completedBy||'',
   token,stamp,'',record.attempt||1,record.resultHash,link,stamp,commentary];
 const outcomes=[job.jobId,token,record.status,link,record.resultHash,
   (result.evidence||[]).length,verified,record.completedBy||'',result.reviewNote||'',
   job.sourceFingerprint];
 if(queue.length!==17||outcomes.length!==10)throw Error('GEO sheet column contract mismatch');
 return {queue,results:outcomes};
}
export function findGeoSheetRow(values,jobId){
 const found=[];
 for(let i=1;i<(values||[]).length;i++)if(String(values[i]?.[0]||'')===jobId)found.push(i);
 if(found.length>1)throw Error('Duplicate GEO sheet rows for '+jobId+': '+found.join(','));
 return found.length?found[0]:null; // Zero-based rowIndex, 1 means sheet row 2.
}
export function geoSheetWriteRequest(sheetId,rowIndex,values){
 const row={values:values.map(v=>({userEnteredValue:{stringValue:String(v??'')}}))};
 if(rowIndex===null)return {appendCells:{sheetId,rows:[row],fields:'userEnteredValue'}};
 return {updateCells:{start:{sheetId,rowIndex,columnIndex:0},rows:[row],fields:'userEnteredValue'}};
}
// A content commit containing an added MD is mandatory. Existing backlogs cannot bypass gates.
export async function inspectNewGeoObject(tools,core,{stableId,creationCommit}){
 if(!/^[a-z0-9_]{4,180}$/.test(stableId||'')||!validSha(creationCommit))
  throw Error('New GEO object requires stableId and original content commit SHA');
 const gh=toolsFor(tools);
 const main=(await api(gh,GEO_API+'/git/ref/heads/main')).object.sha;
 const compare=await api(gh,GEO_API+'/compare/'+creationCommit+'...'+main);
 if(!['ahead','identical'].includes(compare.status))throw Error('Creation commit not in current main');
 const entry=await json(gh,'data/source-index/entries/'+stableId+'.json',main);
 if(entry.id!==stableId||!NEW_GEO_STAGES[entry.type]||!entry.contentPath)
  throw Error('GEO source-index entry does not identify requested active object');
 const kind=entry.type,plural={country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'}[kind];
 const catalog=await json(gh,'data/source-index/catalogs/'+plural+'.json',main);
 const listed=(catalog.entries||[]).find(x=>x.id===stableId);
 if(!listed||listed.url!==entry.url||listed.contentPath!==entry.contentPath)
  throw Error('New object is not synchronized into its compact source-index catalog');
 const content=await file(gh,entry.contentPath,main);
 const created=await file(gh,entry.contentPath,creationCommit);
 if(created.sha!==content.sha)throw Error('New object MD changed after its creation; recheck facts before GEO collection');
 const begin=content.content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!begin||!begin[1].split(/\r?\n/).some(l=>/^id:\s*['"]?([a-z0-9_]+)['"]?\s*$/.test(l)&&l.match(/^id:\s*['"]?([a-z0-9_]+)['"]?\s*$/)[1]===stableId))
  throw Error('Missing matching content frontmatter id');
 if(/^\s*status:\s*['"]?(?:archived|draft|paused|disabled)['"]?\s*$/mi.test(begin[1])||
   ['archived','draft','paused'].includes(entry.status)||['archived','draft','paused'].includes(listed.status))
  throw Error('Archived/draft/reserved objects do not receive new active GEO collection');
 const creation=await api(gh,GEO_API+'/git/commits/'+creationCommit);
 if(creation.parents?.length!==1)throw Error('Creation must be traceable to one parent commit');
 try{
  await file(gh,entry.contentPath,creation.parents[0].sha);
  throw Error('MD already existed before creation commit; do not bypass GEO queue for an existing object');
 }catch(e){
  if(!/NOT_FOUND|404|Not Found/i.test(String(e)))throw e;
 }
 const job=buildNewObjectJob(entry,content.sha,0,core);
 return {job,mainCommit:main,creationCommit,sourceBlobSha:content.sha};
}
export async function saveNewGeoObject(tools,core,{stableId,creationCommit,ownerId,result}){
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId||''))
  throw Error('New GEO collector requires a stable worker ownerId');
 const inspected=await inspectNewGeoObject(tools,core,{stableId,creationCommit});
 const sourceJob=inspected.job;
 if(!result||result.decisionPolicy!=='probability-70-v1')
  throw Error('Research the object with the 70% GEO policy before completing it');
 const gh=toolsFor(tools),hash=core.digest(result),token='inline-'+creationCommit.slice(0,12);
 const resultPath='data/geo-knowledge/results/'+sourceJob.jobId+'/'+token+'-'+hash+'.json';
 for(let attempt=1;attempt<=4;attempt++){
  const head=(await api(gh,GEO_API+'/git/ref/heads/'+GEO_STAGING)).object.sha;
  const [state,queue,inventory,base]=await Promise.all([
   json(gh,'data/geo-knowledge/state.json',head),
   json(gh,'data/geo-knowledge/queue.json',head),
   json(gh,'data/geo-knowledge/source-inventory.json',head),
   api(gh,GEO_API+'/git/commits/'+head)]);
  const prior=state.jobs[sourceJob.jobId];
  if(prior?.resultHash){
   if(prior.resultHash!==hash||prior.inlineCreationCommit!==creationCommit)
    throw Error('GEO already collected or publishing with a different result; do not overwrite');
   const existing=queue.jobs.find(j=>j.jobId===sourceJob.jobId);
   if(!existing||existing.sourceFingerprint!==result.sourceFingerprint)throw Error('Collected job source drift');
   return {status:'already_saved',job:existing,resultHash:hash,resultPath:prior.resultPath,
    record:prior,stagingCommit:head,needsSheetSync:prior.geoSheetSync?.status!=='SYNCED'};
  }
  if(prior?.status&&!['QUEUED','UNAVAILABLE','STALE'].includes(prior.status)
   ||state.leases?.[sourceJob.jobId])
   throw Error('Existing active GEO claim/state; never steal an existing worker lease');
  const oldJob=queue.jobs.find(j=>j.jobId===sourceJob.jobId);
  if(oldJob&&oldJob.stableId!==sourceJob.stableId)throw Error('GEO job ID collision');
  const highest=queue.jobs.filter(j=>j.stage===sourceJob.stage)
   .reduce((n,j)=>Math.max(n,Number(j.sourceOrder)||0),0);
  const job={...sourceJob,sourceOrder:oldJob?.sourceOrder||highest+1,
   registryPath:oldJob?.registryPath||null};
  const errors=core.validateResult(result,job);
  if(errors.length)throw Error('Invalid GEO result: '+errors.join('; '));
  if(oldJob)queue.jobs[queue.jobs.indexOf(oldJob)]=job;else queue.jobs.push(job);
  queue.jobs.sort((a,b)=>a.stage-b.stage||a.sourceOrder-b.sourceOrder||a.jobId.localeCompare(b.jobId));
  queue.incrementalUpdatedAt=new Date().toISOString();
  const inv={id:job.stableId,type:job.kind,name:job.name,url:job.url,
   contentPath:job.contentPath,entryPath:job.entryPath,countryIds:job.countryIds,
   destinationIds:job.destinationIds,status:'approved',sourceBlobSha:job.sourceBlobSha,
   inlineCreationCommit:creationCommit};
  const oldInv=inventory.entities.find(x=>x.id===job.stableId);
  if(oldInv)inventory.entities[inventory.entities.indexOf(oldInv)]={...oldInv,...inv};
  else inventory.entities.push(inv);
  const now=new Date().toISOString();
  state.jobs[job.jobId]={...prior,status:result.status,attempt:Math.max(1,prior?.attempt||0),
   resultHash:hash,resultPath,completedToken:token,completedBy:ownerId,
   completedAt:now,inlineCreationCommit:creationCommit,
   geoSheetSync:{status:'PENDING',requestedAt:now}};
  const parts=[
   {path:'data/geo-knowledge/queue.json',mode:'100644',type:'blob',content:JSON.stringify(queue,null,2)+'\n'},
   {path:'data/geo-knowledge/source-inventory.json',mode:'100644',type:'blob',content:JSON.stringify(inventory,null,2)+'\n'},
   {path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',content:JSON.stringify(state,null,2)+'\n'},
   {path:resultPath,mode:'100644',type:'blob',content:JSON.stringify(result,null,2)+'\n'}];
  const tree=unwrap(await gh.tree({repository_full_name:GEO_REPO,base_tree_sha:base.tree.sha,tree_elements:parts})).sha;
  const commit=unwrap(await gh.commit({repository_full_name:GEO_REPO,parent_sha:head,tree_sha:tree,
   message:'geo: inline collect new '+job.kind+' '+job.stableId+' [skip ci]'})).sha;
  try{
   const ref=unwrap(await gh.update({repository_full_name:GEO_REPO,branch_name:GEO_STAGING,sha:commit,
    expected_sha:head,force:false}));
   if(ref.success===false)throw Error('GEO staging CAS rejected');
   return {status:'saved',job,resultHash:hash,resultPath,record:state.jobs[job.jobId],
    stagingCommit:commit,needsSheetSync:true};
  }catch(e){
   const seen=(await api(gh,GEO_API+'/git/ref/heads/'+GEO_STAGING)).object.sha;
   if(seen===commit)return {status:'saved',job,resultHash:hash,resultPath,
    record:state.jobs[job.jobId],stagingCommit:commit,needsSheetSync:true};
   if(attempt===4||seen===head)throw e;
  }
 }
 throw Error('GEO queue CAS exhausted');
}
async function confirmGeoSheetSync(tools,jobId,hash){
 const gh=toolsFor(tools);
 for(let i=0;i<4;i++){
  const head=(await api(gh,GEO_API+'/git/ref/heads/'+GEO_STAGING)).object.sha;
  const [state,base]=await Promise.all([
   json(gh,'data/geo-knowledge/state.json',head),api(gh,GEO_API+'/git/commits/'+head)]);
  const row=state.jobs[jobId];
  if(!row||row.resultHash!==hash)throw Error('GEO state advanced before sheet acknowledgment');
  if(row.geoSheetSync?.status==='SYNCED')return {status:'already_synced',stagingCommit:head};
  row.geoSheetSync={status:'SYNCED',syncedAt:new Date().toISOString(),sheetId:GEO_SHEET_ID};
  const tree=unwrap(await gh.tree({repository_full_name:GEO_REPO,base_tree_sha:base.tree.sha,
   tree_elements:[{path:'data/geo-knowledge/state.json',mode:'100644',type:'blob',
    content:JSON.stringify(state,null,2)+'\n'}]})).sha;
  const commit=unwrap(await gh.commit({repository_full_name:GEO_REPO,parent_sha:head,tree_sha:tree,
   message:'geo: confirm inline Sheets '+jobId+' [skip ci]'})).sha;
  try{
   const ref=unwrap(await gh.update({repository_full_name:GEO_REPO,branch_name:GEO_STAGING,
    sha:commit,expected_sha:head,force:false}));
   if(ref.success===false)throw Error('GEO sheet CAS rejected');
   return {status:'synced',stagingCommit:commit};
  }catch(e){
   const observed=(await api(gh,GEO_API+'/git/ref/heads/'+GEO_STAGING)).object.sha;
   if(observed===commit)return {status:'synced',stagingCommit:commit};
   if(i===3||observed===head)throw e;
  }
 }
}
export async function syncNewGeoSheets(tools,core,saved,result){
 if(!saved?.job||!saved.resultHash||!saved.resultPath)
  throw Error('A committed GEO result is required before Sheets');
 const sheetRead=tools.mcp__Google_Drive__get_spreadsheet_range
  ||tools.mcp__codex_apps__google_drive_get_spreadsheet_range;
 const sheetBatch=tools.mcp__Google_Drive__batch_update_spreadsheet
  ||tools.mcp__codex_apps__google_drive_batch_update_spreadsheet;
 if(typeof sheetRead!=='function'||typeof sheetBatch!=='function')
  throw Error('GEO Sheet mirror PENDING: connect Google Drive/Sheets before finishing object creation');
 if(core.digest(result)!==saved.resultHash)throw Error('GEO result hash changed before Sheets');
 const gh=toolsFor(tools);
 const state=await json(gh,'data/geo-knowledge/state.json',GEO_STAGING);
 const record=state.jobs[saved.job.jobId];
 if(record?.resultHash!==saved.resultHash)throw Error('GEO result changed after commit');
 if(record.geoSheetSync?.status==='SYNCED')return {status:'already_synced',jobId:saved.job.jobId};
 const rows=newGeoSheetRows(saved.job,record,result);
 const existing=await Promise.all([
  sheetRead({spreadsheet_id:GEO_SHEET_ID,sheet_name:'GEO очередь',range:'A1:A7000'}),
  sheetRead({spreadsheet_id:GEO_SHEET_ID,sheet_name:'GEO результаты',range:'A1:A7000'})
 ]);
 const ranges=existing.map(unwrap);
 if(ranges.some(range=>!Array.isArray(range?.values)))
  throw Error('GEO Sheet range response is not a values array; no rows were appended');
 const queueIndex=findGeoSheetRow(ranges[0].values,saved.job.jobId);
 const resultsIndex=findGeoSheetRow(ranges[1].values,saved.job.jobId);
 const requests=[
  geoSheetWriteRequest(16001610,queueIndex,rows.queue),
  geoSheetWriteRequest(16001611,resultsIndex,rows.results)
 ];
 const reply=unwrap(await sheetBatch({spreadsheet_id:GEO_SHEET_ID,requests}));
 if(reply.spreadsheetId!==GEO_SHEET_ID||!Array.isArray(reply.replies)||reply.replies.length!==2)
  throw Error('GEO Sheet batch response not confirmed; retry same job without re-collecting');
 const confirmed=await confirmGeoSheetSync(tools,saved.job.jobId,saved.resultHash);
 return {status:'synced',jobId:saved.job.jobId,queueRow:queueIndex===null?'appended':queueIndex+1,
  resultRow:resultsIndex===null?'appended':resultsIndex+1,confirmation:confirmed};
}
// This is the one-object completion used by the creation chat, not by the master.
// One GitHub CAS commit -> one atomic two-sheet batch -> one mirror acknowledgment.
export async function collectNewGeoObject(tools,core,request){
 const saved=await saveNewGeoObject(tools,core,request);
 if(!saved.needsSheetSync)return {status:'already_collected_and_synced',saved};
 try{
  const sheet=await syncNewGeoSheets(tools,core,saved,request.result);
  return {status:'collected_and_synced',saved,sheet};
 }catch(error){
  // Immutable result remains safe and sheetSync stays PENDING for exact retry.
  throw Error('GEO passport saved, Sheets PENDING for '+request.stableId+
   '. Reuse exactly the same result and creationCommit. Cause: '+String(error));
 }
}
