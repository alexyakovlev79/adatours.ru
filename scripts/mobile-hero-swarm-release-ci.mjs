#!/usr/bin/env node
/** Master-only, commit-pinned Ada Tours mobile hero release. No edits to worker state. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const repo='alexyakovlev79/adatours.ru';
const root='data/media/hero-mobile-swarm-20261023';
const workspace=process.env.GITHUB_WORKSPACE;
if(!workspace)throw Error('Run this master only inside the controlled GitHub Actions job');
const stage=path.join(workspace,'queue'),main=path.join(workspace,'current');
const out='/tmp/mobile-hero-release',metaFile='/tmp/mobile-hero-release-meta.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const get=(folder,rel)=>path.join(folder,rel);
const assert=(yes,why)=>{if(!yes)throw Error(why)};
const env={...process.env,GH_REPO:repo,GH_TOKEN:process.env.GH_TOKEN};
const run=(name,args,cwd=main)=>execFileSync(name,args,{cwd,env,stdio:'inherit',timeout:36*60*1000});
const capture=(name,args,cwd=main)=>execFileSync(name,args,{cwd,env,encoding:'utf8',maxBuffer:4*1024*1024}).trim();
const saveMeta=data=>fs.writeFileSync(metaFile,JSON.stringify(data,null,2)+'\n');
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const manifest=read(get(stage,root+'/manifest.json'));
const dispatch=read(get(stage,root+'/release-dispatch.json'));
const initialMain=capture('git',['rev-parse','HEAD']);
const queueHead=capture('git',['rev-parse','HEAD'],stage);
const parent=capture('git',['rev-parse','HEAD^'],stage);
const batchFrom=Number(dispatch.batchFrom??0),batchCount=Number(dispatch.batchCount??24);
assert(Number.isSafeInteger(batchFrom)&&batchFrom>=0&&Number.isSafeInteger(batchCount)&&batchCount>=1&&batchCount<=24,'Invalid bounded release batch');
const selectedMetas=manifest.packets.slice(batchFrom,batchFrom+batchCount);
assert(selectedMetas.length>0,'No packets left to publish');
const batchId=selectedMetas[0].id+'-'+selectedMetas.at(-1).id;
const isLast=batchFrom+selectedMetas.length===manifest.packets.length;

async function runRelease(){
  assert(queueHead===process.env.GITHUB_SHA,'Dispatch staging commit differs from exact workflow SHA');
  assert(dispatch.swarmHead===parent,'Dispatch must be one direct commit after frozen swarm SHA');
  assert(manifest.status==='active'&&manifest.packets.length===206&&manifest.counts?.pendingAssets===2053,'Unexpected frozen manifest');
  let accounted=0;
  for(const job of selectedMetas){
    const state=read(get(stage,job.path));
    const result=read(get(stage,root+'/results/'+job.id+'.json'));
    assert(state.status==='completed'&&state.id===job.id,'Unfinished packet: '+job.id);
    assert(state.progress?.length===job.assetIds.length&&state.progress.every(x=>x.status==='ready'),'Unresolved photos in '+job.id);
    assert(result.packetGeneration===state.generation&&result.results?.length===job.assetIds.length,'Invalid completed packet generation '+job.id);
    accounted+=job.assetIds.length;
  }
  assert(accounted===selectedMetas.reduce((sum,x)=>sum+x.assetIds.length,0),'Batch ready count mismatch');
  console.log('Confirmed batch '+batchId+' with '+selectedMetas.length+' packets / '+accounted+' ready sources');
  saveMeta({state:'validated_worker_results',batchId,batchFrom,batchCount:selectedMetas.length,queueHead,initialMain,completedPackets:selectedMetas.length,readyAssets:accounted});

  console.log('Rendering the exact current main checkout to establish a fresh page/hero inventory');
  run('npm',['run','build']);
  run('node',['scripts/mobile-hero-inventory.mjs','--dist',get(main,'dist'),'--source-commit',initialMain,'--write','/tmp/current-main-hero.json']);
  console.log('Collecting immutable worker results and independently checking originals and mobile variants by GET+SHA-256');
  run('node',[
    'scripts/mobile-hero-swarm-collect.mjs','--root',stage,
    '--current-inventory','/tmp/current-main-hero.json','--current-main',initialMain,
    '--registry',get(main,'src/data/media/mobile-hero-registry.json'),
    '--ledger',get(main,'src/data/media/direct-s3-uploads.json'),
    '--packet-from',String(batchFrom),'--packet-count',String(selectedMetas.length),
    '--out-dir',out
  ],stage);

  const report=read(get(out,root+'/collection-report.json'));
  const counts=report.counts;
  console.log('Collection report: '+JSON.stringify(counts));
  assert(counts.packets===selectedMetas.length&&counts.completedPackets===selectedMetas.length,'Batch accounting mismatch');
  assert(counts.verificationFailures===0,'Original or variant verification failed');
  const unsafe=(report.unpublished??[]).filter(x=>!['stale_usage','stale_source'].includes(x.status));
  assert(unsafe.length===0,'Unresolved non-stale results: '+JSON.stringify(unsafe.slice(0,20)));
  assert(counts.readyAssets>0&&counts.readyAssets<=accounted,'Invalid verified source count for selected batch');
  if(report.staleUsages.length||report.unpublished.length)console.warn('Safe release will exclude only stale/no-longer-matching uses. Stale usages='+report.staleUsages.length+'; unresolved sources='+report.unpublished.length);
  assert(counts.addedRows>0,'No mobile hero rows selected: refuse empty publication');

  const files=read(get(out,'files.json')).files;
  const allowed=new Set(['src/data/media/mobile-hero-registry.json','src/data/media/direct-s3-uploads.json',root+'/collection-report.json']);
  assert(files.length===3&&files.every(f=>allowed.has(f.path)),'Collector unexpectedly changed targets');
  for(const item of files){
    assert(digest(item.localPath)===item.sha256,'Staging output mutated: '+item.path);
    const to=get(main,item.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(item.localPath,to);
  }
  const newReg=read(get(main,'src/data/media/mobile-hero-registry.json'));
  const newLedger=read(get(main,'src/data/media/direct-s3-uploads.json'));
  assert(newReg.items?.length>=counts.addedRows,'Registry output lost rows');
  assert(Array.isArray(newLedger.assets),'S3 ledger malformed');
  console.log('Running targeted tests, direct receipt validation and final full-site build');
  run('node',['--test','tests/mobile-hero-swarm.test.mjs','tests/mobile-hero-swarm-collect.test.mjs','tests/mobile-hero-inventory.test.mjs','tests/mobile-hero-registry.test.mjs']);
  run('node',['scripts/verify-direct-s3-assets.mjs','--local']);
  run('npm',['run','build']);

  const currentRemote=capture('git',['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];
  assert(currentRemote===initialMain,'main moved during verification. Do not publish a stale collection; rerun master on fresh main.');
  run('git',['add',...files.map(f=>f.path)]);
  run('git',['diff','--cached','--check']);
  const staged=capture('git',['diff','--cached','--name-only']).split('\n').filter(Boolean);
  assert(staged.length>0&&staged.every(p=>allowed.has(p)),'Unexpected staged files: '+staged.join(', '));
  run('git',['config','user.name','ADA Tours release bot']);
  run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
  run('git',['commit','-m','media(hero): publish verified mobile crops '+batchId+' [skip ci]']);
  const releaseSha=capture('git',['rev-parse','HEAD']);
  const meta={state:'main_committed_locally',batchId,batchFrom,batchCount:selectedMetas.length,queueHead,initialMain,releaseSha,counts,
    registrySha256:digest(get(main,'src/data/media/mobile-hero-registry.json')),
    ledgerSha256:digest(get(main,'src/data/media/direct-s3-uploads.json')),
    reportSha256:digest(get(main,root+'/collection-report.json'))};
  saveMeta(meta);
  run('git',['push','origin','HEAD:refs/heads/main']);
  meta.state='main_pushed';saveMeta(meta);
  const remoteAfter=capture('git',['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];
  assert(remoteAfter===releaseSha,'Ref moved after publication commit; do not dispatch wrong build');
  console.log('Published one production content commit '+releaseSha+'; explicitly dispatching standard GitHub Pages');
  run('gh',['workflow','run','deploy.yml','--ref','main']);
  meta.state='pages_dispatched';meta.dispatchedAt=new Date().toISOString();saveMeta(meta);

  let deployment;
  for(let attempt=0;attempt<36;attempt++){
    const runs=readFromGh('repos/'+repo+'/actions/workflows/deploy.yml/runs?branch=main&per_page=40');
    deployment=(runs.workflow_runs||[]).filter(r=>r.head_sha===releaseSha&&r.event==='workflow_dispatch').sort((a,b)=>b.id-a.id)[0];
    if(deployment)break;
    await sleep(10000);
  }
  assert(deployment?.id,'Pages workflow dispatch was not observable for release SHA '+releaseSha);
  meta.pagesRunId=deployment.id;meta.pagesRunUrl=deployment.html_url;meta.state='pages_running';saveMeta(meta);
  console.log('Awaiting exact standard Pages deployment '+deployment.html_url);
  run('gh',['run','watch',String(deployment.id),'--interval','20','--exit-status']);
  const conclusion=readFromGh('repos/'+repo+'/actions/runs/'+deployment.id);
  assert(conclusion.head_sha===releaseSha&&conclusion.conclusion==='success','Pages not confirmed successful for this commit');
  meta.state='pages_deployed';meta.deployedAt=new Date().toISOString();saveMeta(meta);

  // A Pages success is authoritative for deployment. Check representative public HTML additionally.
  const newlyAdded=new Set(report.preparedRows.map(r=>JSON.stringify([r.pagePath,r.source,r.profile])));
  const examples=[...new Map(newReg.items.filter(r=>r.status==='READY'&&newlyAdded.has(JSON.stringify([r.pagePath,r.source,r.profile]))).map(r=>[r.profile,r])).values()].slice(0,7);
  const checks=[];
  for(const row of examples){
    const marker=row.variants?.[0]?.key?.split('/').at(-1);
    assert(marker,'Representative mobile crop lacks variant key');
    const url='https://adatours.ru'+row.pagePath;
    let found=false,lastError='';
    for(let attempt=0;attempt<3&&!found;attempt++){
      try{
        const response=await fetch(url,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(25000)});
        const html=response.ok?await response.text():'';
        found=response.ok&&html.includes(marker);
        if(!found)lastError='HTTP '+response.status+' or crop '+marker+' absent';
      }catch(error){lastError=String(error)}
      if(!found&&attempt<2)await sleep(12000);
    }
    checks.push({url,profile:row.profile,found,error:found?undefined:lastError});
  }
  meta.smoke=checks;
  if(checks.some(x=>!x.found)){
    meta.state='pages_deployed_smoke_needs_review';saveMeta(meta);
    throw Error('Pages deployed but live mobile hero smoke check failed: '+JSON.stringify(checks.filter(x=>!x.found)));
  }

  // Confirmed deployment: publication history is a separate text-only main commit.
  run('git',['fetch','--no-tags','origin','main']);
  run('git',['reset','--hard','origin/main']);
  const publication={
    version:1,status:'published',publishedAt:new Date().toISOString(),
    sourceMainCommit:initialMain,swarmCommit:queueHead,releaseCommit:releaseSha,
    pagesRunId:deployment.id,pagesRunUrl:deployment.html_url,
    batchId,batchFrom,batchCount:selectedMetas.length,packets:selectedMetas.length,workerReadyAssets:accounted,verifiedReadyAssets:counts.readyAssets,unpublishedSourceCount:report.unpublished.length,staleUsageCount:report.staleUsages.length,addedPageHeroRows:counts.addedRows,verifiedVariants:report.verified.length,
    verifiedSources:report.verifiedSources.length,
    registrySha256:meta.registrySha256,ledgerSha256:meta.ledgerSha256,
    collectionReportSha256:meta.reportSha256,smoke:checks
  };
  const publicationPath=root+'/publication-batches/'+batchId+'.json';
  const publicationFile=get(main,publicationPath);
  fs.mkdirSync(path.dirname(publicationFile),{recursive:true});
  const old=fs.existsSync(publicationFile)?read(publicationFile):null;
  assert(!old||old.releaseCommit===releaseSha,'Another release already owns this batch');
  if(!old){
    fs.writeFileSync(publicationFile,JSON.stringify(publication,null,2)+'\n');
    run('git',['add',publicationPath]);
    run('git',['commit','-m','docs(hero): certify mobile hero batch '+batchId+' [skip ci]']);
    run('git',['push','origin','HEAD:refs/heads/main']);
  }
  meta.state='batch_published';meta.publicationCommit=capture('git',['rev-parse','HEAD']);saveMeta(meta);
  console.log('PUBLISHED BATCH '+batchId+' '+JSON.stringify(meta));

  if(isLast){
    const publicationDir=get(main,root+'/publication-batches');
    const batchPublications=fs.readdirSync(publicationDir).filter(n=>/^b\d+-b\d+\.json$/.test(n)).map(n=>read(get(main,root+'/publication-batches/'+n)));
    const covered=new Set();
    for(const p of batchPublications){
      assert(p.status==='published','Unconfirmed batch in publication index');
      const rows=manifest.packets.slice(p.batchFrom,p.batchFrom+p.batchCount);
      for(const row of rows){assert(!covered.has(row.id),'Duplicate published packet '+row.id);covered.add(row.id);}
    }
    assert(covered.size===manifest.packets.length,'Incomplete publication batches: '+covered.size+'/'+manifest.packets.length);
    const summary={version:1,status:'published',completedAt:new Date().toISOString(),packetCount:covered.size,
      sourceAssets:manifest.counts.pendingAssets,batchCount:batchPublications.length,
      addedPageHeroRows:batchPublications.reduce((a,p)=>a+p.addedPageHeroRows,0),
      publications:batchPublications.map(p=>({batchId:p.batchId,releaseCommit:p.releaseCommit,pagesRunId:p.pagesRunId}))};
    const summaryPath=get(main,root+'/publication.json');
    fs.writeFileSync(summaryPath,JSON.stringify(summary,null,2)+'\n');
    run('git',['add',root+'/publication.json']);
    run('git',['commit','-m','docs(hero): certify complete mobile hero swarm publication [skip ci]']);
    run('git',['push','origin','HEAD:refs/heads/main']);
    meta.state='all_batches_published';saveMeta(meta);
    console.log('ALL MOBILE HERO BATCHES PUBLISHED '+JSON.stringify(summary));
    return;
  }

  // Every successful batch triggers the next independent GitHub Actions execution.
  const nextFrom=batchFrom+selectedMetas.length;
  const stagingRef='refs/heads/feature/mobile-hero-swarm-20261023';
  const stagingRemote=capture('git',['ls-remote','origin',stagingRef],stage).split(/\s+/)[0];
  assert(stagingRemote===queueHead,'Staging branch changed during batch, refuse competing continuation');
  const nextDispatch={...dispatch,swarmHead:queueHead,batchFrom:nextFrom,batchCount,
    completedBatchId:batchId,previousReleaseCommit:releaseSha,
    previousPagesRunId:deployment.id,requestedAt:new Date().toISOString()};
  fs.writeFileSync(get(stage,root+'/release-dispatch.json'),JSON.stringify(nextDispatch,null,2)+'\n');
  run('git',['config','user.name','ADA Tours release bot'],stage);
  run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],stage);
  run('git',['add',root+'/release-dispatch.json'],stage);
  run('git',['commit','-m','release(hero): dispatch next verified crop batch '+nextFrom],stage);
  run('git',['push','origin','HEAD:'+stagingRef],stage);
  // Pushes made with GITHUB_TOKEN do NOT trigger other push-based workflows.
  // A workflow_dispatch is allowed to trigger downstream jobs, provided the
  // workflow is registered on the default branch.
  run('gh',['workflow','run','mobile-hero-swarm-release.yml','--ref','feature/mobile-hero-swarm-20261023'],stage);
  meta.state='next_batch_dispatched';meta.nextFrom=nextFrom;saveMeta(meta);
  console.log('NEXT MOBILE HERO BATCH DISPATCHED from '+nextFrom);
}
function readFromGh(apiPath){
  return JSON.parse(capture('gh',['api',apiPath],main));
}
runRelease().catch(error=>{
  console.error('MOBILE HERO MASTER RELEASE BLOCKED: '+(error.stack||String(error)));
  process.exitCode=1;
});
