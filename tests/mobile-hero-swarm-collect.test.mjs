import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectMobileHeroSwarm} from '../scripts/mobile-hero-swarm-collect.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>structuredClone(value);
const main='c'.repeat(40), frozen='a'.repeat(40), content=Buffer.from('verified WebP bytes');
const original=Buffer.from('original photograph bytes');
const sourceResponse=()=>new Response(original,{headers:{'content-type':'image/webp'}});
const geometry={fit:'cover',widthCss:'100%',heightCss:'clamp(460px, 125vw, 560px)',cropSourceMaxWidth:479};
function usage(id,pagePath='/example/') {
  return {id,pagePath,source:'/media/example/source.webp',profile:'standard',geometry:clone(geometry),objectPosition:'center',context:{manualObjectPosition:null}};
}
function setup() {
  const usages=[usage('usage-a'),usage('usage-b','/second/')];
  const job={id:'hero-test',source:usages[0].source,sourceSha256:hash(original),sourceWidth:1600,sourceHeight:800,usages};
  const variant={key:'media/hero-mobile-swarm/example-480-20261023-v1.webp',width:480,height:640,bytes:content.length,sha256:hash(content)};
  const result={assetId:job.id,status:'ready',source:job.source,sourceSha256:job.sourceSha256,sourceWidth:1600,sourceHeight:800,
    processing:{sharpVersion:'0.35.5',format:'webp',quality:78,withoutEnlargement:true},recipes:[{
      id:'standard',profile:'standard',usageIds:usages.map(row=>row.id),crop:{left:400,top:0,width:600,height:800},
      objectPosition:'center top',focusReason:'The visible subject and both faces remain inside the crop.',variants:[variant],
      visualQA:{sourceViewed:true,previewsViewed:true,notes:'All mobile previews and original photograph were inspected.'},
    }]};
  const receipt={version:1,assets:[{...variant,contentType:'image/webp',source:'direct-s3',status:'uploaded-and-verified',uploadedAt:'2026-10-23T00:00:00Z'}]};
  const meta={id:'b001',path:'data/media/hero-mobile-swarm-20261023/packets/b001.json',assetIds:[job.id],jobsBlobSha:'d'.repeat(40)};
  const packet={status:'completed',id:'b001',generation:1,progress:[result]};
  const resultsDocument={schemaVersion:1,packetId:meta.id,sourceCommit:frozen,packetGeneration:1,submissionId:'submission-test',results:[result]};
  const input={manifest:{schemaVersion:1,sourceCommit:frozen,packets:[meta]},
    packets:[{meta,packet,jobsBlobSha:meta.jobsBlobSha,jobsDocument:{schemaVersion:1,id:meta.id,jobs:[job]},resultsDocument,receipt}],
    currentInventory:{schemaVersion:1,sourceCommit:main,usages:clone(usages),assets:[clone(job)]},currentMain:main,
    fetchImpl:async url=>url.endsWith('/source.webp')?sourceResponse():new Response(content,{headers:{'content-type':'image/webp','content-length':String(content.length)}})};
  return {input,job,result,variant,receipt,packet};
}

test('collects completed ready jobs with GET+SHA, preserves existing rows and merges selected receipts only',async()=>{
  const {input,receipt}=setup();let calls=0;
  input.fetchImpl=async(url,options)=>{assert.equal(options.method,'GET');assert.match(url,/^https:\/\/img\.adatours\.ru\//);if(url.endsWith('/source.webp'))return sourceResponse();calls++;return new Response(content,{headers:{'content-type':'image/webp'}});};
  input.existingRegistry={version:1,media:'(max-width: 479px)',items:[{pagePath:'/untouched/',source:'/media/other.webp',profile:'compact',status:'READY',sourceSha256:'e'.repeat(64)}]};
  receipt.assets.push({key:'media/invalid/unrelated-20261023.webp',sha256:'wrong',bytes:-1});
  const output=await collectMobileHeroSwarm(input);
  assert.equal(calls,1);assert.equal(output.registry.items.length,3);
  assert.deepEqual(output.registry.items[0],input.existingRegistry.items[0]);
  assert.equal(output.ledger.assets.length,1);
  assert.equal(output.report.counts.addedRows,2);
  assert.equal(output.registry.items[1].provenance.currentMain,main);
  assert.deepEqual(output.registry.items[1].geometry,geometry);
});

test('partial queue skips unfinished packets and leaves review and retry unpublished',async()=>{
  const {input,packet}=setup();packet.status='leased';
  const partial=await collectMobileHeroSwarm(input);
  assert.equal(partial.registry.items.length,0);assert.equal(partial.report.counts.completedPackets,0);
  for(const status of ['review','retry','stale_source']){
    const next=setup().input;next.packets[0].resultsDocument.results[0]={assetId:'hero-test',status,note:'Needs another attempt or a coordinator decision.'};next.packets[0].packet.progress=next.packets[0].resultsDocument.results;
    const output=await collectMobileHeroSwarm(next);
    assert.equal(output.registry.items.length,0);assert.equal(output.ledger.assets.length,0);assert.equal(output.report.unpublished[0].status,status);
  }
});

test('changed geometry or manual focus marks only stale usages and retains valid uses of a shared photo',async()=>{
  for(const change of [u=>u.geometry.heightCss='300px',u=>u.context.manualObjectPosition='90% center',u=>u.profile='compact',u=>u.source='/media/replacement.webp']){
    const {input}=setup();change(input.currentInventory.usages[1]);
    const output=await collectMobileHeroSwarm(input);
    assert.equal(output.registry.items.length,1);assert.equal(output.registry.items[0].pagePath,'/example/');
    assert.equal(output.report.staleUsages.length,1);assert.equal(output.ledger.assets.length,1);
  }
  const {input}=setup();input.currentInventory.usages=[];
  const output=await collectMobileHeroSwarm(input);
  assert.equal(output.registry.items.length,0);assert.equal(output.ledger.assets.length,0);
});

test('changed current source hash and stale inventory provenance block publication',async()=>{
  const {input}=setup();input.currentInventory.assets[0].sourceSha256='f'.repeat(64);
  const output=await collectMobileHeroSwarm(input);
  assert.equal(output.registry.items.length,0);assert.equal(output.report.unpublished[0].status,'stale_source');
  input.currentInventory.sourceCommit=frozen;
  await assert.rejects(()=>collectMobileHeroSwarm(input),/sourceCommit/);
});

test('reused receipt conflict and an existing registry with different source hash are never overwritten',async()=>{
  const {input,receipt}=setup();input.ledger={version:1,assets:[{...receipt.assets[0],sha256:'a'.repeat(64)}]};
  const conflict=await collectMobileHeroSwarm(input);
  assert.equal(conflict.registry.items.length,0);assert.equal(conflict.ledger.assets[0].sha256,'a'.repeat(64));
  assert.match(conflict.report.unpublished[0].note,/Different file/);
  const fresh=setup().input;
  const existing={pagePath:'/example/',source:'/media/example/source.webp',profile:'standard',sourceSha256:'f'.repeat(64)};
  fresh.existingRegistry={version:1,items:[existing]};
  const blocked=await collectMobileHeroSwarm(fresh);
  assert.deepEqual(blocked.registry.items,[existing]);assert.match(blocked.report.unpublished[0].note,/registry source hash conflict/);
});

test('network hash, MIME and transport failures block all rows and receipts of that source',async()=>{
  for(const fetchImpl of [async()=>new Response(Buffer.alloc(content.length,1),{headers:{'content-type':'image/webp'}}),async()=>new Response(content,{headers:{'content-type':'text/html'}}),async()=>{throw new TypeError('fetch failed');}]){
    const {input}=setup();input.fetchImpl=async url=>url.endsWith('/source.webp')?sourceResponse():fetchImpl(url);
    const output=await collectMobileHeroSwarm(input);
    assert.equal(output.registry.items.length,0);assert.equal(output.ledger.assets.length,0);assert.equal(output.report.counts.verificationFailures,1);
  }
});

test('a stale recipe contributes neither remote downloads nor receipts while another profile remains valid',async()=>{
  const {input,result,receipt,job}=setup();
  job.usages[1].profile='compact';input.currentInventory.usages[1].profile='compact';
  const compact=clone(result.recipes[0]);compact.id='compact';compact.profile='compact';compact.usageIds=['usage-b'];compact.variants[0].key='media/hero-mobile-swarm/compact-480-20261023-v1.webp';
  result.recipes[0].usageIds=['usage-a'];result.recipes.push(compact);
  receipt.assets.push({...receipt.assets[0],key:compact.variants[0].key});
  input.currentInventory.usages[1].geometry.heightCss='200px';let calls=0;
  input.fetchImpl=async url=>{if(url.endsWith('/source.webp'))return sourceResponse();calls++;assert.ok(!url.includes('compact-480'));return new Response(content,{headers:{'content-type':'image/webp'}});};
  const output=await collectMobileHeroSwarm(input);
  assert.equal(output.registry.items.length,1);assert.equal(output.ledger.assets.length,1);assert.equal(calls,1);
});

test('recollection is idempotent without duplicate page/source/profile rows',async()=>{
  const {input}=setup(), first=await collectMobileHeroSwarm(input);
  const second=await collectMobileHeroSwarm({...input,existingRegistry:first.registry,ledger:first.ledger});
  assert.deepEqual(second.registry,first.registry);assert.equal(second.report.alreadyPresent.length,2);assert.equal(second.report.counts.addedRows,0);
});

test('original source GET detects changed legacy bytes when current inventory has no hash',async()=>{
  const {input}=setup();delete input.currentInventory.assets[0].sourceSha256;
  let calls=0;input.fetchImpl=async()=>{calls++;return new Response(Buffer.from('different original bytes'),{headers:{'content-type':'image/webp'}});};
  const output=await collectMobileHeroSwarm(input);
  assert.equal(calls,1);assert.equal(output.registry.items.length,0);assert.equal(output.ledger.assets.length,0);
  assert.equal(output.report.unpublished[0].status,'stale_source');assert.equal(output.report.counts.verificationFailures,1);
});
