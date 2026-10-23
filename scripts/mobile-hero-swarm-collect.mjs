#!/usr/bin/env node
/** Master-only collection. Produces reviewable text files; never changes Git refs or deploys. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {canonical, validateReadyResult, mergeReceipts} from './mobile-hero-swarm-core.mjs';
import {mergeDirectAssetReceipts, validateDirectAssetLedger} from './lib/direct-media-ledger.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const QUEUE='data/media/hero-mobile-swarm-20261023';
const sha=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const key=row=>canonical([row.pagePath,row.source,row.profile]);
const check=(ok,message)=>{if(!ok)throw Error(message);};
const json=value=>JSON.stringify(value,null,2)+'\n';
const manual=usage=>usage.context?.manualObjectPosition??null;
const geometryIdentity=usage=>canonical({geometry:usage.geometry,objectPosition:usage.objectPosition??'center',manualObjectPosition:manual(usage)});

/** Always GET and hash the actual object, even when cloud metadata contains a hash. */
export async function verifyCollectedVariant(variant,receipt,{fetchImpl=globalThis.fetch}={}) {
  const url='https://img.adatours.ru/'+variant.key.split('/').map(encodeURIComponent).join('/');
  const response=await fetchImpl(url,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});
  check(response.ok,`Variant GET failed: ${variant.key} HTTP ${response.status}`);
  check((response.headers.get('content-type')??'').split(';')[0].trim()==='image/webp',`Variant MIME mismatch: ${variant.key}`);
  const length=response.headers.get('content-length');
  if(length!==null)check(Number(length)===variant.bytes,`Variant declared size mismatch: ${variant.key}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  check(bytes.length===variant.bytes && bytes.length===receipt.bytes,`Variant size mismatch: ${variant.key}`);
  check(sha(bytes)===variant.sha256 && variant.sha256===receipt.sha256,`Variant SHA-256 mismatch: ${variant.key}`);
  return {key:variant.key,bytes:bytes.length,sha256:variant.sha256,method:'GET+SHA-256'};
}

/** Legacy originals may have no current hash ledger: verify their public bytes too. */
export async function verifyCollectedSource(result,{fetchImpl=globalThis.fetch}={}) {
  const url=new URL(result.source.startsWith('/media/')?'https://img.adatours.ru'+result.source:result.source);
  check(url.protocol==='https:' && !url.username && !url.password,'Unsafe original source URL');
  const response=await fetchImpl(url.href,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(45000)});
  check(response.ok,`Source GET failed: ${result.source} HTTP ${response.status}`);
  check((response.headers.get('content-type')??'').split(';')[0].trim().startsWith('image/'),`Source MIME mismatch: ${result.source}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  check(bytes.length>0 && sha(bytes)===result.sourceSha256,`STALE_SOURCE: original public bytes changed: ${result.source}`);
  return {source:result.source,bytes:bytes.length,sha256:result.sourceSha256,method:'GET+SHA-256'};
}

/** Verify every immutable original and variant concurrently (bounded), returning only hashes/metadata.
 * The final collector still validates job membership, usage geometry, receipts and provenance.
 * These caches are populated ONLY after GET, bytes and SHA-256 checks succeed. */
export async function preverifyMobileHeroFiles(packets,{maxConcurrent=16,fetchImpl=globalThis.fetch}={}) {
  check(Number.isSafeInteger(maxConcurrent)&&maxConcurrent>=1&&maxConcurrent<=32,'Invalid verification concurrency');
  const sources=new Map(),variants=new Map();
  for(const entry of packets){
    if(entry.packet.status!=='completed')continue;
    const receipts=new Map((entry.receipt?.assets??[]).map(row=>[row.key,row]));
    for(const result of entry.resultsDocument?.results??[]){
      if(result.status!=='ready')continue;
      const sourceId=canonical([result.source,result.sourceSha256]);
      if(!sources.has(sourceId))sources.set(sourceId,()=>verifyCollectedSource(result,{fetchImpl}));
      for(const recipe of result.recipes??[])for(const variant of recipe.variants??[]){
        const variantId=canonical([variant.key,variant.sha256,variant.bytes]);
        if(!variants.has(variantId))variants.set(variantId,()=>verifyCollectedVariant(variant,receipts.get(variant.key),{fetchImpl}));
      }
    }
  }
  const tasks=[
    ...[...sources].map(([key,verify])=>({key,verify,type:'source'})),
    ...[...variants].map(([key,verify])=>({key,verify,type:'variant'}))
  ];
  console.log('Mobile hero parallel proof: '+sources.size+' unique source objects and '+variants.size+' unique mobile variants; concurrency='+maxConcurrent);
  const verifiedSources=new Map(),verifiedVariants=new Map(),failures=[];
  let cursor=0,done=0;
  async function verifyWithRetry(task){
    for(let attempt=0;attempt<3;attempt++){
      try{return await task.verify();}
      catch(error){
        const message=String(error?.message??error);
        const temporary=/HTTP\s+(?:429|5\d\d)|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|AbortError|TimeoutError|timed out|socket hang up/i.test(message);
        if(!temporary||attempt===2)throw error;
        await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)*(attempt+1)));
      }
    }
  }
  const worker=async()=>{
    while(true){
      const index=cursor++;
      if(index>=tasks.length)return;
      const task=tasks[index];
      try{
        const record=await verifyWithRetry(task);
        (task.type==='source'?verifiedSources:verifiedVariants).set(task.key,record);
      }catch(error){
        failures.push({type:task.type,key:task.key,error:String(error?.message??error)});
      }
      done++;
      if(done%200===0||done===tasks.length)console.log('Mobile hero verified '+done+'/'+tasks.length+' objects; failures='+failures.length);
    }
  };
  await Promise.all(Array.from({length:Math.min(maxConcurrent,tasks.length)},()=>worker()));
  return{verifiedSources,verifiedVariants,failures,total:tasks.length,sourceCount:sources.size,variantCount:variants.size};
}

/** fetchImpl is injectable only for tests; the CLI has no offline/skip-verification flag. */
export async function collectMobileHeroSwarm({manifest,packets,currentInventory,currentMain,
  existingRegistry={version:1,media:'(max-width: 479px)',items:[]},ledger={version:1,assets:[]},
  fetchImpl=globalThis.fetch,verifiedSources=null,verifiedVariants=null,selectedPacketIds=null,now=new Date().toISOString()}={}) {
  check(/^[a-f0-9]{40}$/.test(currentMain??''),'A full --current-main SHA is required');
  check(currentInventory?.sourceCommit===currentMain,'Current rendered inventory sourceCommit does not match current main');
  check(currentInventory?.schemaVersion===1 && Array.isArray(currentInventory.usages) && Array.isArray(currentInventory.assets),'Invalid current rendered inventory');
  check(manifest?.schemaVersion===1 && /^[a-f0-9]{40}$/.test(manifest.sourceCommit??'') && Array.isArray(manifest.packets),'Invalid swarm manifest');
  check(existingRegistry.version===1 && Array.isArray(existingRegistry.items),'Invalid existing generic registry');
  check(!existingRegistry.media || existingRegistry.media==='(max-width: 479px)','Existing registry has a different media rule');
  const ledgerValidation=validateDirectAssetLedger(ledger);
  check(!ledgerValidation.errors.length,'Existing direct-S3 ledger invalid: '+ledgerValidation.errors.join('; '));
  let mergedLedger=copy(ledger);
  const items=copy(existingRegistry.items), occupied=new Map();
  for(const item of items){check(!occupied.has(key(item)),'Duplicate existing page/source/profile registry row');occupied.set(key(item),item);}
  const byUsage=new Map(), bySource=new Map(currentInventory.assets.map(asset=>[asset.source,asset]));
  for(const usage of currentInventory.usages){const id=key(usage);byUsage.set(id,[...(byUsage.get(id)??[]),usage]);}
  const selectedMetas=selectedPacketIds===null?manifest.packets:manifest.packets.filter(meta=>selectedPacketIds.includes(meta.id));
  check(selectedPacketIds===null||(selectedMetas.length===selectedPacketIds.length&&new Set(selectedPacketIds).size===selectedPacketIds.length),'Unknown or duplicate batch packet IDs');
  const report={version:1,collectedAt:now,currentMain,frozenSourceCommit:manifest.sourceCommit,
    packets:[],preparedRows:[],alreadyPresent:[],unpublished:[],staleUsages:[],verified:[],verifiedSources:[],
    counts:{packets:selectedMetas.length,completedPackets:0,readyAssets:0,addedRows:0,staleUsages:0,verificationFailures:0}};
  const entries=new Map(packets.map(entry=>[entry.meta.id,entry]));

  const verificationCache=verifiedVariants??new Map();
  const sourceVerificationCache=verifiedSources??new Map();
  for(const meta of selectedMetas){
    const entry=entries.get(meta.id);
    if(!entry || entry.packet.status!=='completed'){report.packets.push({packetId:meta.id,status:entry?.packet.status??'missing'});continue;}
    report.counts.completedPackets++;
    try {
      check(entry.packet.id===meta.id && entry.jobsDocument.id===meta.id,'Packet/job identity mismatch');
      check(entry.jobsDocument.schemaVersion===1 && Array.isArray(entry.jobsDocument.jobs),'Invalid immutable jobs document');
      check(meta.jobsBlobSha || meta.jobsSha256,'Immutable jobs require a pinned checksum');
      if(meta.jobsBlobSha)check(meta.jobsBlobSha===entry.jobsBlobSha,'Immutable jobs Git blob changed');
      if(meta.jobsSha256)check(meta.jobsSha256===entry.jobsSha256,'Immutable jobs SHA-256 changed');
      const jobs=entry.jobsDocument.jobs, expectedIds=meta.assetIds??entry.packet.assetIds;
      check(Array.isArray(expectedIds) && canonical([...expectedIds].sort())===canonical(jobs.map(job=>job.id).sort()),'Frozen job membership changed');
      const doc=entry.resultsDocument;
      check(doc?.schemaVersion===1 && doc.packetId===meta.id && Array.isArray(doc.results),'Missing/invalid completed results document');
      check(doc.sourceCommit===manifest.sourceCommit,'Results frozen commit mismatch');
      check(doc.packetGeneration===entry.packet.generation,'Results generation does not match completed packet');
      check(Array.isArray(entry.packet.progress) && canonical(doc.results)===canonical(entry.packet.progress),'Results do not match completed packet progress');
      check(doc.results.length===jobs.length && new Set(doc.results.map(row=>row.assetId)).size===jobs.length,'Completed packet must account for every immutable job');
      check(doc.results.every(row=>jobs.some(job=>job.id===row.assetId)),'Unknown result asset');
      report.packets.push({packetId:meta.id,status:'completed',submissionId:doc.submissionId});
      for(const result of doc.results){
        const job=jobs.find(row=>row.id===result.assetId), label={packetId:meta.id,assetId:result.assetId,source:job.source};
        if(result.status!=='ready'){report.unpublished.push({...label,status:result.status,note:result.note??''});continue;}
        try {
          // Ignore receipt rows unrelated to this job; never merge unselected keys.
          const recipeKeys=new Set((result.recipes??[]).flatMap(recipe=>(recipe.variants??[]).map(variant=>variant.key)));
          const jobReceipt=mergeReceipts({version:1,assets:[]},{version:1,assets:(entry.receipt?.assets??[]).filter(row=>recipeKeys.has(row.key))});
          validateReadyResult(result,job,jobReceipt);
          const currentSource=bySource.get(job.source);
          if(currentSource?.sourceSha256)check(currentSource.sourceSha256===result.sourceSha256,'STALE_SOURCE: current source SHA-256 changed');
          for(const dimension of ['sourceWidth','sourceHeight'])if(currentSource?.[dimension])check(currentSource[dimension]===result[dimension],'STALE_SOURCE: current source dimensions changed');
          const candidates=[], selectedVariants=new Map();
          for(const recipe of result.recipes){
            for(const usageId of recipe.usageIds){
              const frozen=job.usages.find(usage=>usage.id===usageId), fresh=byUsage.get(key(frozen))??[];
              if(fresh.length!==1 || geometryIdentity(frozen)!==geometryIdentity(fresh[0])){
                report.staleUsages.push({...label,usageId,pagePath:frozen.pagePath,profile:frozen.profile,
                  reason:fresh.length===0?'usage_missing_or_source_profile_changed':fresh.length>1?'ambiguous_current_usage':'geometry_or_manual_focus_changed'});
                continue;
              }
              const row={pagePath:frozen.pagePath,source:job.source,profile:recipe.profile,status:'READY',
                sourceSha256:result.sourceSha256,sourceWidth:result.sourceWidth,sourceHeight:result.sourceHeight,
                crop:copy(recipe.crop),objectPosition:recipe.objectPosition,geometry:copy(frozen.geometry),
                manualObjectPosition:manual(frozen),originalObjectPosition:frozen.objectPosition??'center',
                variants:copy(recipe.variants),focusReason:recipe.focusReason,visualQA:copy(recipe.visualQA),
                provenance:{packetId:meta.id,assetId:job.id,recipeId:recipe.id,usageId,
                  frozenSourceCommit:manifest.sourceCommit,currentMain,submissionId:doc.submissionId,
                  packetGeneration:doc.packetGeneration,verifiedAt:now,processing:copy(result.processing)}};
              const previous=occupied.get(key(row));
              if(previous){
                check(previous.sourceSha256===row.sourceSha256,'Existing registry source hash conflict; explicit revision required');
                check(canonical({crop:previous.crop,objectPosition:previous.objectPosition,variants:previous.variants,
                  geometry:previous.geometry??null,manualObjectPosition:previous.manualObjectPosition??null,originalObjectPosition:previous.originalObjectPosition??'center'})===canonical({crop:row.crop,objectPosition:row.objectPosition,variants:row.variants,
                  geometry:row.geometry,manualObjectPosition:row.manualObjectPosition,originalObjectPosition:row.originalObjectPosition}),'Existing registry recipe conflict; explicit revision required');
                candidates.push({row,already:true});
              } else candidates.push({row,already:false});
              for(const variant of recipe.variants){
                const old=selectedVariants.get(variant.key);
                check(!old || canonical(old)===canonical(variant),'Different variants reuse one immutable key');
                selectedVariants.set(variant.key,variant);
              }
            }
          }
          if(!candidates.length){report.unpublished.push({...label,status:'stale_usage',note:'No unchanged current hero usages remain'});continue;}
          check(new Set(candidates.map(item=>key(item.row))).size===candidates.length,'Duplicate page/source/profile in frozen result');
          const selectedKeys=new Set(selectedVariants.keys());
          const selectedReceipt={version:1,assets:jobReceipt.assets.filter(row=>selectedKeys.has(row.key))};
          const proposedLedger=mergeDirectAssetReceipts(mergedLedger,selectedReceipt);
          const receiptByKey=new Map(selectedReceipt.assets.map(row=>[row.key,row]));
          const sourceKey=canonical([result.source,result.sourceSha256]);
          if(!sourceVerificationCache.has(sourceKey)){
            try{sourceVerificationCache.set(sourceKey,await verifyCollectedSource(result,{fetchImpl}));}
            catch(cause){throw Object.assign(new Error(cause.message??String(cause)),{sourceVerification:true});}
          }
          // A failed variant blocks the entire source job, while other jobs remain collectable.
          for(const variant of selectedVariants.values()){
            const verificationKey=canonical([variant.key,variant.sha256,variant.bytes]);
            if(!verificationCache.has(verificationKey)){
              try{verificationCache.set(verificationKey,await verifyCollectedVariant(variant,receiptByKey.get(variant.key),{fetchImpl}));}
              catch(cause){throw Object.assign(new Error(cause.message??String(cause)),{variantVerification:true});}
            }
          }
          mergedLedger=proposedLedger;report.counts.readyAssets++;
          for(const {row,already} of candidates){
            if(already)report.alreadyPresent.push({...label,pagePath:row.pagePath,profile:row.profile});
            else {items.push(row);occupied.set(key(row),row);report.preparedRows.push({...label,pagePath:row.pagePath,profile:row.profile});}
          }
        }catch(error){
          const message=error.message??String(error);
          const status=message.startsWith('STALE_SOURCE:')?'stale_source':'blocked';
          if(error.variantVerification || error.sourceVerification)report.counts.verificationFailures++;
          report.unpublished.push({...label,status,note:message});
        }
      }
    }catch(error){report.unpublished.push({packetId:meta.id,status:'invalid_packet',note:error.message??String(error)});}
  }
  report.verified=[...verificationCache.values()];
  report.verifiedSources=[...sourceVerificationCache.values()];
  report.counts.addedRows=report.preparedRows.length;report.counts.staleUsages=report.staleUsages.length;
  return {registry:{...copy(existingRegistry),version:1,media:'(max-width: 479px)',items},ledger:mergedLedger,report};
}

async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT' && fallback!==undefined)return fallback;throw error;}}
export async function loadCollectionPackets(rootDir,manifest,selectedMetas=manifest.packets) {
  return Promise.all(selectedMetas.map(async meta=>{
    const packet=await readJson(path.resolve(rootDir,meta.path));
    if(packet.status!=='completed')return {meta,packet};
    const jobsPath=meta.jobsPath??packet.jobsPath;
    check(jobsPath,'Missing immutable jobs path');
    const raw=await fs.readFile(path.resolve(rootDir,jobsPath));
    const queueRoot=path.posix.dirname(path.posix.dirname(meta.path));
    return {meta,packet,jobsDocument:JSON.parse(raw),jobsSha256:sha(raw),
      jobsBlobSha:sha(Buffer.concat([Buffer.from('blob '+raw.length+'\0'),raw]),'sha1'),
      resultsDocument:await readJson(path.resolve(rootDir,queueRoot,'results',meta.id+'.json'),null),
      receipt:await readJson(path.resolve(rootDir,queueRoot,'receipts',meta.id+'.json'),{version:1,assets:[]})};
  }));
}

async function main(argv) {
  const options={root:ROOT,queueRoot:QUEUE};
  const flags={'--root':'root','--queue-root':'queueRoot','--current-inventory':'currentInventory','--current-main':'currentMain','--out-dir':'outDir','--registry':'registry','--ledger':'ledger','--packet-from':'packetFrom','--packet-count':'packetCount'};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--help'){console.log('node scripts/mobile-hero-swarm-collect.mjs --current-inventory <fresh-main-inventory.json> --current-main <40-char SHA> [--queue-root '+QUEUE+'] [--out-dir <staged-output-directory>] [--root <repository>]\nDefault: verify network objects and print dry-run report. Writes only inside --out-dir; never publishes.');return;}
    check(flags[argv[i]] && argv[i+1] && !argv[i+1].startsWith('--'),'Unknown or missing option: '+argv[i]);options[flags[argv[i]]]=argv[++i];
  }
  check(options.currentInventory,'--current-inventory is required; collection needs a fresh main render');
  check(options.currentMain,'--current-main is required');
  const root=path.resolve(options.root), manifest=await readJson(path.resolve(root,options.queueRoot,'manifest.json'));
  const from=Number(options.packetFrom??0),count=Number(options.packetCount??manifest.packets.length);
  check(Number.isSafeInteger(from)&&from>=0&&from<manifest.packets.length&&Number.isSafeInteger(count)&&count>0&&count<=32,'Invalid bounded packet batch');
  const selectedMetas=manifest.packets.slice(from,from+count);
  check(selectedMetas.length>0,'Empty packet slice');
  console.log('Mobile hero batch '+selectedMetas[0].id+'–'+selectedMetas.at(-1).id+' ('+selectedMetas.length+' packets)');
  const packets=await loadCollectionPackets(root,manifest,selectedMetas);
  const proof=await preverifyMobileHeroFiles(packets,{maxConcurrent:16});
  if(proof.failures.length)throw Error('S3 GET+SHA256 preflight failed for '+proof.failures.length+' objects (first 20): '+JSON.stringify(proof.failures.slice(0,20)));
  const result=await collectMobileHeroSwarm({manifest,packets,selectedPacketIds:selectedMetas.map(p=>p.id),verifiedSources:proof.verifiedSources,verifiedVariants:proof.verifiedVariants,
    currentInventory:await readJson(path.resolve(root,options.currentInventory)),currentMain:options.currentMain,
    existingRegistry:await readJson(path.resolve(root,options.registry??'src/data/media/mobile-hero-registry.json'),{version:1,media:'(max-width: 479px)',items:[]}),
    ledger:await readJson(path.resolve(root,options.ledger??'src/data/media/direct-s3-uploads.json'),{version:1,assets:[]})});
  if(options.outDir){
    const output=path.resolve(root,options.outDir);check(output!==root,'--out-dir must be a staging directory, not the repository root');
    const files=[];
    for(const [target,data] of [['src/data/media/mobile-hero-registry.json',result.registry],['src/data/media/direct-s3-uploads.json',result.ledger],[options.queueRoot+'/collection-report.json',result.report]]){
      const localPath=path.resolve(output,target),content=json(data);
      check(localPath.startsWith(output+path.sep),'Output path escapes staging directory');
      await fs.mkdir(path.dirname(localPath),{recursive:true});await fs.writeFile(localPath,content);
      files.push({path:target,localPath,sha256:sha(content)});
    }
    await fs.writeFile(path.join(output,'files.json'),json({version:1,currentMain:options.currentMain,files}));
    console.log(json({outDir:output,...result.report.counts}));
  }else console.log(json({dryRun:true,...result.report}));
  if(result.report.counts.verificationFailures)process.exitCode=1;
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
