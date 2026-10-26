// Portable, addressed GEO revision after an existing MD was changed by a Word import.
// Pass the existing new-object module as `inline` (buildNewObjectJob/syncNewGeoSheets).
// No collection, publication, or source discovery happens implicitly in inspect.
const WORD_GEO_REPO='alexyakovlev79/adatours.ru';
const WORD_GEO_API='https://api.github.com/repos/'+WORD_GEO_REPO;
const WORD_GEO_BRANCH='schema-geo/staging';
const wordSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const wordUnwrap=r=>{if(r?.isError)throw Error(JSON.stringify(r));return r?.result||r?.structuredContent||r;};
const wordClone=value=>JSON.parse(JSON.stringify(value));
function wordGithub(tools){
 const gh={fetch:tools.mcp__GitHub__fetch||tools.mcp__codex_apps__github_fetch,
  file:tools.mcp__GitHub__fetch_file||tools.mcp__codex_apps__github_fetch_file,
  blob:tools.mcp__GitHub__fetch_blob||tools.mcp__codex_apps__github_fetch_blob,
  tree:tools.mcp__GitHub__create_tree||tools.mcp__codex_apps__github_create_tree,
  commit:tools.mcp__GitHub__create_commit||tools.mcp__codex_apps__github_create_commit,
  update:tools.mcp__GitHub__update_ref||tools.mcp__codex_apps__github_update_ref};
 if(Object.values(gh).some(fn=>typeof fn!=='function'))throw Error('GitHub CAS connectors required');
 return gh;
}
async function wordApi(gh,url){return JSON.parse(wordUnwrap(await gh.fetch({url})).content);}
async function wordFile(gh,path,ref){
 const f=wordUnwrap(await gh.file({repository_full_name:WORD_GEO_REPO,path,ref}));
 const content=f.content||wordUnwrap(await gh.blob({repository_full_name:WORD_GEO_REPO,blob_sha:f.sha})).content;
 if(!content||!wordSha(f.sha))throw Error('Missing GEO source content/blob SHA: '+path);
 return {sha:f.sha,content};
}
async function wordJson(gh,path,ref){return JSON.parse((await wordFile(gh,path,ref)).content);}

// Only root identity fields and lists of stable IDs are read here. Fail closed for
// YAML aliases, multiline scalars, or another representation; never interpret code.
export function wordGeoContentProjection(content,kind){
 const fm=content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(!fm)throw Error('Content frontmatter missing');
 const lines=fm[1].split(/\r?\n/);
 function raw(key){
  const indexes=[];
  for(let i=0;i<lines.length;i++)if(lines[i].startsWith(key+':'))indexes.push(i);
  if(indexes.length>1)throw Error('Duplicate content field: '+key);
  if(!indexes.length)return undefined;
  const index=indexes[0];let end=index+1;
  while(end<lines.length&&!/^[a-zA-Z][a-zA-Z0-9_]*:/.test(lines[end]))end++;
  return {head:lines[index].slice(key.length+1).trim(),tail:lines.slice(index+1,end)};
 }
 function atom(text,key){
  const value=text.trim().replace(/\s+#.*$/,'').trim();
  const match=value.match(/^(?:([a-z0-9_-]+)|'([a-z0-9_-]+)'|"([a-z0-9_-]+)")$/);
  if(!match)throw Error('Unsupported identity value: '+key);
  return match[1]||match[2]||match[3];
 }
 function scalar(key,required=false){
  const value=raw(key);
  if(!value){if(required)throw Error('Missing content field: '+key);return undefined;}
  if(value.tail.some(line=>line.trim()&&!line.trim().startsWith('#')))
   throw Error('Unsupported multiline identity: '+key);
  return atom(value.head,key);
 }
 function ids(key,required=false){
  const value=raw(key);
  if(!value){if(required)throw Error('Missing content list: '+key);return undefined;}
  let values;
  if(value.head){
   const inline=value.head.replace(/\s+#.*$/,'').trim();
   if(!/^\[.*\]$/.test(inline))throw Error('Unsupported identity list: '+key);
   const inner=inline.slice(1,-1).trim();
   values=inner?inner.split(',').map(x=>atom(x,key)):[];
   if(value.tail.some(line=>line.trim()&&!line.trim().startsWith('#')))
    throw Error('Unexpected list continuation: '+key);
  }else values=value.tail.filter(line=>line.trim()&&!line.trim().startsWith('#')).map(line=>{
   const match=line.match(/^\s*-\s+(.+?)\s*$/);
   if(!match)throw Error('Unsupported identity list item: '+key);
   return atom(match[1],key);
  });
  if(new Set(values).size!==values.length)throw Error('Duplicate linked ID: '+key);
  return values;
 }
 const id=scalar('id',true),slug=scalar('slug',true),status=scalar('status',true);
 if(!['approved','published'].includes(status))throw Error('Only active published content can receive a Word GEO revision');
 let countryIds,destinationIds,visitDestinationIds;
 if(kind==='tour'){
  countryIds=ids('countries',true);destinationIds=ids('destinations',true);
  visitDestinationIds=ids('routeDestinations')||destinationIds;
 }else if(kind==='excursion'){
  countryIds=[scalar('country',true)];
  destinationIds=[scalar('destination',true)];
  visitDestinationIds=[...destinationIds,...(ids('relatedDestinations')||[])];
 }else if(kind==='destination'){
  countryIds=[scalar('countryId',true)];destinationIds=[id];
 }else if(kind==='country'){countryIds=[id];destinationIds=[];}
 else throw Error('Unsupported Word GEO entity kind');
 if(visitDestinationIds&&new Set(visitDestinationIds).size!==visitDestinationIds.length)throw Error('Duplicate excursion destination');
 const projection={id,slug,countryIds,destinationIds};
 if(kind==='excursion')projection.relatedDestinationIds=ids('relatedDestinations')||[];
 if(kind==='tour'){
  projection.routeCountryIds=ids('routeCountries')||countryIds;
  projection.routeDestinationIds=visitDestinationIds;
  projection.primaryThemes=ids('primaryThemes',true);
  if(projection.routeCountryIds.some(x=>!countryIds.includes(x))||visitDestinationIds.some(x=>!destinationIds.includes(x)))
   throw Error('Guaranteed route is outside full geography');
 }
 if(kind!=='country')projection.themes=ids('themes')||[];
 if(kind==='destination'){
  projection.destinationType=scalar('destinationType',true);
  projection.navigationRole=scalar('navigationRole',true);
 }
 return {projection,status,visitDestinationIds:visitDestinationIds||[]};
}
function wordListed(catalog,stableId){
 const rows=(catalog.entries||[]).filter(row=>row.id===stableId);
 if(rows.length!==1)throw Error('Exactly one compact source-index row required: '+stableId);
 return rows[0];
}
function verifyWordProjection(core,entry,listed,parsed){
 for(const [label,row] of [['entry',entry],['compact catalog',listed]]){
  if(row.type!==entry.type||row.contentPath!==entry.contentPath||row.url!==entry.url)
   throw Error('Content identity differs in '+label);
  if(row.status&&!['approved','published'].includes(row.status))throw Error('Inactive '+label);
  for(const [field,expected] of Object.entries(parsed.projection)){
   // Historical Destination rows can have [] instead of their own ID. Both denote
   // the same identity; this field never represents relatedDestinations for places.
   const legacySelf=entry.type==='destination'&&field==='destinationIds'&&Array.isArray(row[field])&&!row[field].length;
   const actual=field==='relatedDestinationIds'?(row[field]||[]):row[field];
   if(!legacySelf&&core.digest(actual)!==core.digest(expected))
    throw Error('Current MD '+field+' differs in '+label);
  }
 }
 if(core.digest(entry.countryIds)!==core.digest(listed.countryIds)||core.digest(entry.destinationIds)!==core.digest(listed.destinationIds))
  throw Error('Entry/compact source geography differs');
}
export async function inspectWordGeoRevision(tools,core,inline,{stableId,contentCommit}){
 if(!/^[a-z0-9_]{4,180}$/.test(stableId||'')||!wordSha(contentCommit))
  throw Error('Word GEO revision requires a stableId and actual contentCommit SHA');
 if(typeof inline?.buildNewObjectJob!=='function')throw Error('Current new-object helpers required');
 const gh=wordGithub(tools);
 const main=(await wordApi(gh,WORD_GEO_API+'/git/ref/heads/main')).object.sha;
 const [ancestry,commit]=await Promise.all([
  wordApi(gh,WORD_GEO_API+'/compare/'+contentCommit+'...'+main),
  wordApi(gh,WORD_GEO_API+'/git/commits/'+contentCommit)]);
 if(!['ahead','identical'].includes(ancestry.status))throw Error('Word content commit is not in current main');
 if(commit.parents?.length!==1)throw Error('Use the single-parent commit that actually changed this MD');
 const entryPath='data/source-index/entries/'+stableId+'.json';
 const [entryFile,committedEntry]=await Promise.all([wordFile(gh,entryPath,main),wordFile(gh,entryPath,contentCommit)]);
 if(entryFile.sha!==committedEntry.sha)throw Error('Exact source entry changed after Word content commit; recheck source');
 const entry=JSON.parse(entryFile.content);
 if(entry.id!==stableId)throw Error('Source entry does not identify the requested entity');
 const plural={country:'countries',destination:'destinations',tour:'tours',excursion:'excursions'}[entry.type];
 // The existing builder validates safe content path, canonical URL and stable ID.
 inline.buildNewObjectJob(entry,'0'.repeat(40),0,core);
 const catalogPath='data/source-index/catalogs/'+plural+'.json';
 const [content,committedContent,previous,catalog,committedCatalog]=await Promise.all([
  wordFile(gh,entry.contentPath,main),wordFile(gh,entry.contentPath,contentCommit),
  wordFile(gh,entry.contentPath,commit.parents[0].sha),
  wordJson(gh,catalogPath,main),wordJson(gh,catalogPath,contentCommit)]);
 if(content.sha!==committedContent.sha)throw Error('MD changed after Word content commit; recheck facts');
 if(previous.sha===content.sha)throw Error('MD was not modified by contentCommit; this cannot refresh a backlog item');
 const parsed=wordGeoContentProjection(content.content,entry.type);
 if(parsed.projection.id!==stableId)throw Error('Requested identity differs from MD');
 const oldId=previous.content.match(/^id:\s*['"]?([a-z0-9_]+)['"]?\s*$/m)?.[1];
 if(oldId!==stableId)throw Error('Existing stable ID changed; do not reassign GEO identities');
 const listed=wordListed(catalog,stableId),atCommit=wordListed(committedCatalog,stableId);
 if(core.digest(listed)!==core.digest(atCommit))throw Error('Exact compact row changed after Word content commit');
 verifyWordProjection(core,entry,listed,parsed);
 const job={...inline.buildNewObjectJob(entry,content.sha,0,core),origin:'word_revision',wordRevisionCommit:contentCommit};
 return {job,mainCommit:main,contentCommit,parentCommit:commit.parents[0].sha,
  sourceBlobSha:content.sha,previousSourceBlobSha:previous.sha,entryBlobSha:entryFile.sha,
  compactRowHash:core.digest(listed),visitDestinationIds:parsed.visitDestinationIds,
  relatedDestinationIds:parsed.projection.relatedDestinationIds||[]};
}
function verifyWordRelationships(result,inspected){
 if(!['tour','excursion'].includes(inspected.job.kind)||result.status!=='READY')return;
 const visits=(result.relationships||[]).filter(row=>row.type==='visits').map(row=>row.targetId);
 if(inspected.visitDestinationIds.some(id=>!visits.includes(id))||visits.some(id=>!inspected.visitDestinationIds.includes(id)))
  throw Error('GEO visits must cover the exact guaranteed route of the current MD');
 const known=new Set([...inspected.job.destinationIds,...inspected.relatedDestinationIds,...inspected.job.countryIds]);
 if((result.relationships||[]).some(row=>!known.has(row.targetId)))throw Error('GEO relationship is outside current source geography');
}
export async function saveWordGeoRevision(tools,core,inline,{stableId,contentCommit,ownerId,result}){
 if(!/^[a-zA-Z0-9_-]{8,120}$/.test(ownerId||''))throw Error('A stable GEO revision ownerId is required');
 if(!wordSha(contentCommit))throw Error('Actual Word contentCommit SHA required');
 if(result?.decisionPolicy!=='probability-70-v1')throw Error('Research the revised object using the 70% GEO policy');
 const gh=wordGithub(tools),hash=core.digest(result),token='word-'+contentCommit.slice(0,12);
 for(let attempt=1;attempt<=4;attempt++){
  // Recheck current main on every CAS retry. CI rechecks the same source blob at publication.
  const inspected=await inspectWordGeoRevision(tools,core,inline,{stableId,contentCommit});
  const sourceJob=inspected.job;
  const errors=core.validateResult(result,sourceJob);
  if(errors.length)throw Error('Invalid revised GEO result: '+errors.join('; '));
  verifyWordRelationships(result,inspected);
  const head=(await wordApi(gh,WORD_GEO_API+'/git/ref/heads/'+WORD_GEO_BRANCH)).object.sha;
  const [state,queue,inventory,base]=await Promise.all([
   wordJson(gh,'data/geo-knowledge/state.json',head),wordJson(gh,'data/geo-knowledge/queue.json',head),
   wordJson(gh,'data/geo-knowledge/source-inventory.json',head),wordApi(gh,WORD_GEO_API+'/git/commits/'+head)]);
  const oldJobs=queue.jobs.filter(row=>row.jobId===sourceJob.jobId);
  if(oldJobs.length>1)throw Error('Duplicate canonical GEO job');
  const oldJob=oldJobs[0],prior=state.jobs[sourceJob.jobId],lease=state.leases?.[sourceJob.jobId];
  if(oldJob&&(oldJob.stableId!==stableId||oldJob.kind!==sourceJob.kind))throw Error('Canonical GEO job ID collision');
  if(prior?.wordRevisionCommit===contentCommit){
   if(prior.resultHash!==hash||oldJob?.sourceFingerprint!==sourceJob.sourceFingerprint)
    throw Error('Conflicting result already saved for this Word revision');
   return {status:'already_saved',job:oldJob,resultHash:hash,resultPath:prior.resultPath,
    record:prior,stagingCommit:head,needsSheetSync:prior.geoSheetSync?.status!=='SYNCED'};
  }
  const active=state.publication;
  if(['PUBLISHING','DEPLOYING'].includes(prior?.status)||active&&!['PUBLISHED','FAILED'].includes(active.status)
    &&active.jobs?.some(row=>row.jobId===sourceJob.jobId))throw Error('GEO publication must finish before this revision');
  const now=Date.now();
  if(lease&&(!Number.isFinite(Date.parse(lease.until))||Date.parse(lease.until)>now))
   throw Error('Active GEO lease; never steal an existing worker claim');
  if(prior?.status==='LEASED'&&!lease)throw Error('Inconsistent LEASED state; reconcile before revising');
  let priorPayload;
  if(prior?.resultHash){
   if(!prior.resultPath?.startsWith('data/geo-knowledge/results/'+sourceJob.jobId+'/')
    ||prior.resultPath.split('/').some(part=>!part||part==='.'||part==='..')||/\\/.test(prior.resultPath))
    throw Error('Unsafe prior immutable result path');
   priorPayload=await wordJson(gh,prior.resultPath,head);
   if(core.digest(priorPayload)!==prior.resultHash)throw Error('Prior immutable result hash mismatch');
   if(priorPayload.sourceFingerprint===sourceJob.sourceFingerprint)
    throw Error('Current source already has a GEO result; reuse/reconcile it instead of replacing another collector');
  }
  const highest=queue.jobs.filter(row=>row.stage===sourceJob.stage).reduce((n,row)=>Math.max(n,Number(row.sourceOrder)||0),0);
  const job={...oldJob,...sourceJob,sourceOrder:oldJob?.sourceOrder??highest+1,registryPath:oldJob?.registryPath||null};
  const stamp=new Date(now).toISOString();
  if(oldJob)queue.jobs[queue.jobs.indexOf(oldJob)]=job;else queue.jobs.push(job);
  queue.jobs.sort((a,b)=>a.stage-b.stage||a.sourceOrder-b.sourceOrder||a.jobId.localeCompare(b.jobId));
  queue.incrementalUpdatedAt=stamp;
  const oldInv=inventory.entities.filter(row=>row.id===stableId);
  if(oldInv.length>1)throw Error('Duplicate source inventory entity');
  const inv={...oldInv[0],id:stableId,type:job.kind,name:job.name,url:job.url,
   contentPath:job.contentPath,entryPath:job.entryPath,countryIds:job.countryIds,destinationIds:job.destinationIds,
   status:'approved',sourceBlobSha:job.sourceBlobSha,wordRevisionCommit:contentCommit,verifiedMainCommit:inspected.mainCommit};
  if(oldInv.length)inventory.entities[inventory.entities.indexOf(oldInv[0])]=inv;else inventory.entities.push(inv);
  const history=wordClone(prior?.revisionHistory||[]);
  if(prior||oldJob||lease){
   const previousRecord=wordClone(prior||{});delete previousRecord.revisionHistory;
   history.push({record:previousRecord,job:oldJob||null,...(lease?{lease}:{}),
    sourceFingerprint:priorPayload?.sourceFingerprint||oldJob?.sourceFingerprint||null,
    supersededAt:stamp,supersededBy:{contentCommit,sourceFingerprint:job.sourceFingerprint,resultHash:hash}});
  }
  const next={...prior,status:result.status,attempt:Math.max(prior?.attempt||0,lease?.generation||0)+1,
   resultHash:hash,resultPath:'data/geo-knowledge/results/'+job.jobId+'/'+token+'-'+hash+'.json',
   completedToken:token,completedBy:ownerId,completedAt:stamp,wordRevisionCommit:contentCommit,
   revisionHistory:history,sourceInspection:{mainCommit:inspected.mainCommit,entryBlobSha:inspected.entryBlobSha,
    compactRowHash:inspected.compactRowHash,previousSourceBlobSha:inspected.previousSourceBlobSha},
   geoSheetSync:{status:'PENDING',requestedAt:stamp}};
  // Published receipts remain in history/publications. They cannot label the new revision.
  for(const field of ['publishedCommit','deployRun','publishedAt'])delete next[field];
  state.jobs[job.jobId]=next;
  if(lease)delete state.leases[job.jobId]; // Only a verified expired lease can reach this line.
  const parts=[['data/geo-knowledge/queue.json',queue],['data/geo-knowledge/source-inventory.json',inventory],
   ['data/geo-knowledge/state.json',state],[next.resultPath,result]].map(([path,value])=>({
    path,mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'}));
  const tree=wordUnwrap(await gh.tree({repository_full_name:WORD_GEO_REPO,base_tree_sha:base.tree.sha,tree_elements:parts})).sha;
  const commit=wordUnwrap(await gh.commit({repository_full_name:WORD_GEO_REPO,parent_sha:head,tree_sha:tree,
   message:'geo: revise Word source '+stableId+' '+contentCommit.slice(0,12)+' [skip ci]'})).sha;
  try{
   const updated=wordUnwrap(await gh.update({repository_full_name:WORD_GEO_REPO,branch_name:WORD_GEO_BRANCH,
    sha:commit,expected_sha:head,force:false}));
   if(updated.success===false)throw Error('Word GEO staging CAS rejected');
   return {status:'saved',job,resultHash:hash,resultPath:next.resultPath,record:next,stagingCommit:commit,needsSheetSync:true};
  }catch(error){
   const seen=(await wordApi(gh,WORD_GEO_API+'/git/ref/heads/'+WORD_GEO_BRANCH)).object.sha;
   if(seen===commit)return {status:'saved',job,resultHash:hash,resultPath:next.resultPath,record:next,stagingCommit:commit,needsSheetSync:true};
   if(attempt===4||seen===head)throw error;
  }
 }
 throw Error('Word GEO staging CAS exhausted');
}
export async function collectWordGeoRevision(tools,core,inline,request){
 if(typeof inline?.syncNewGeoSheets!=='function')throw Error('Existing GEO Sheets helper required');
 const saved=await saveWordGeoRevision(tools,core,inline,request);
 if(!saved.needsSheetSync)return {status:'already_collected_and_synced',saved};
 try{
  const sheet=await inline.syncNewGeoSheets(tools,core,saved,request.result);
  return {status:'collected_and_synced',saved,sheet};
 }catch(error){
  throw Error('Word GEO revision saved, Sheets PENDING for '+request.stableId+
   '. Retry exactly the same result and contentCommit. Cause: '+String(error));
 }
}
