import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createStableBlockMap} from '../../src/lib/i18n/block-map.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
import {sourceBlockEvidence,translationApprovalHash} from '../../src/lib/i18n/content-overlay.mjs';
import {sharedEnglishContentEnabled,projectSharedEnglishEntry,withSharedEnglishContent,
  verifyAcceptedMassPacket,ACCEPTED_MASS_SNAPSHOT_SHA} from '../../src/lib/i18n/shared-content-loader.mjs';

const env={SITE_LOCALE:'en',SITE_ORIGIN:'https://alexyakovlev79.github.io',SITE_BASE:'/adatours-en/',
  EN_STAGING_PAGES:'1',EN_SHARED_CONTENT:'1',PUBLIC_EN_RELEASE:'0',EN_PILOT_PREVIEW:'0',
  ADA_CANONICAL_SHA:'a'.repeat(40)};
const fixture=()=>({id:'ru:tour_brazil_rio_four_days',filePath:'src/content/tours/rio-de-janeiro-four-days.md',
  data:{id:'tour_brazil_rio_four_days',locale:'ru',slug:'rio-de-janeiro-four-days',status:'approved',
    title:'Рио за четыре дня',lead:'Знакомство с Рио.',format:'Сборный',priceFrom:1255,currency:'USD',
    durationDays:4,durationNights:3,countries:['country_brazil'],routeCountries:['country_brazil'],
    destinations:['destination_brazil_rio'],routeDestinations:['destination_brazil_rio'],
    themes:['theme_cities'],route:['Рио'],priceNote:'От 1255 USD',
    hero:{src:'/media/rio.webp',alt:'Панорама Рио',hover:'Рио вечером'},gallery:[],
    itinerary:[
      {day:1,title:'Прилёт',text:'Встреча в аэропорту.',places:['Рио'],images:[{src:'/media/arrival.webp',alt:'Прибытие'}],contentBlocks:[]},
      {excursionRef:'excursion_rio_sugarloaf_urca_four_hours',places:['Сахарная голова'],contentBlocks:[]},
      {day:4,title:'Отъезд',text:'Трансфер.',places:[],images:[],contentBlocks:[]},
    ],included:['Проживание'],notIncluded:['Перелёт'],notes:[],highlights:[],faq:[]},
  body:'## Цены\n\nСтоимость от 1255 USD.',rendered:{html:'<h2>Цены</h2><p>Стоимость от 1255 USD.</p>'},digest:'canonical'});

function approved(entry=fixture()) {
  const map=createStableBlockMap(entry,'tour');
  const source=sourceFromContentEntry(entry,'tour',map);
  const texts={'/title':'4 Days in Rio de Janeiro','/lead':'Discover Rio.','/format':'Group tour',
    '/priceNote':'From USD 1,255','/__body':'## Prices\n\nFrom USD 1,255.'};
  const overlay={schemaVersion:1,entityId:entry.data.id,entityType:'tour',locale:'en',sourceLocale:'ru',
    blocks:map.paths.map((slot,index)=>{
      const block={blockId:slot.blockId,field:slot.field,text:texts[slot.path]??'English text '+index,
        ...sourceBlockEvidence(source,slot.blockId),state:'approved',
        provenance:{kind:'ai_translation',model:'test',runId:'source-bound-fixture'}};
      block.approval={reviewerId:'test',reviewedAt:'2026-11-03T06:00:00Z',checks:{meaning:true,voice:true,facts:true},
        approvedContentHash:translationApprovalHash(block)};
      return block;
    })};
  return {entityId:entry.data.id,entityType:'tour',overlay,wordSources:{},sourceFingerprint:'sha256:fixture',map};
}

const digest=value=>createHash('sha256').update(value).digest('hex');
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function acceptedMassFixture(source=fixture()) {
  const sourceBytes=Buffer.from('canonical source bytes');
  const block=approved(source).overlay.blocks.find(block=>block.field==='title');
  const job={schemaVersion:2,jobId:'en:bulk:tour:'+source.data.id+':b001',stableId:source.data.id,
    entityType:'tour',locale:'en',stage:'word_2027',sourceFingerprint:'a'.repeat(64),
    source:{contentPath:source.filePath,contentSha256:digest(sourceBytes),sourceBlobSha:gitBlob(sourceBytes),
      selectedWord:{fileId:'word-rio',sha256:'b'.repeat(64),modifiedTime:'2026-10-21T20:19:00.892Z'}},
    blocks:[{blockId:block.blockId,path:'/title',field:block.field,ruText:source.data.title,
      ruTextSha256:block.sourceTextHash.slice(7),dependsOn:[]}]};
  const result={jobId:job.jobId,stableId:job.stableId,locale:'en',status:'review',releaseEligible:false,
    sourceFingerprint:job.sourceFingerprint,blocks:[{blockId:block.blockId,field:block.field,
      text:'Rio de Janeiro: four days',sourceTextSha256:block.sourceTextHash.slice(7),
      provenance:{kind:'word_aligned',fileId:'word-rio',documentSha256:'b'.repeat(64),
        paragraphs:[{ref:'word/document.xml#p0002',textSha256:'c'.repeat(64)}],
        transformation:'contextual_label',rationale:'The exact approved Word title is displayed as a route label.'}}]};
  const resultBytes=Buffer.from(JSON.stringify(result,null,2)+'\n'),hash=gitBlob(resultBytes);
  const row={jobId:job.jobId,status:'ready',sourceFingerprint:job.sourceFingerprint,
    submission:{blobSha:hash,resultPath:'data/i18n/translation-mass/v2/results/en_bulk_tour_rio_b001/accepted.json'},
    review:{acceptedBlobSha:hash,reviewerId:'independent-reviewer',at:'2026-11-02T21:27:04.327Z',
      checks:{word:true,meaning:true,facts:true,voice:true,structure:true,relations:true}}};
  const wordSources={'word-rio':{revision:job.source.selectedWord.modifiedTime,documentHash:'sha256:'+'b'.repeat(64),blocks:{}}};
  return {job,row,resultBytes,sourceBytes,wordSources};
}

test('the shared projection requires the exact closed English staging gate',()=>{
  assert.equal(sharedEnglishContentEnabled(env),true);
  const loader={name:'canonical',load(){throw Error('must not run')}};
  for(const change of [{SITE_LOCALE:'ru'},{PUBLIC_EN_RELEASE:'1'},{EN_SHARED_CONTENT:'0'},
    {SITE_ORIGIN:'https://adatours.ru'},{SITE_BASE:'/'},{EN_STAGING_PAGES:'0'}]) {
    assert.equal(sharedEnglishContentEnabled({...env,...change}),false);
    assert.equal(withSharedEnglishContent(loader,'tours',{env:{...env,...change}}),loader);
  }
  assert.equal(withSharedEnglishContent(loader,'people',{env}),loader);
});

test('approved text reaches the canonical entry without duplicating media, facts or relationships',()=>{
  const source=fixture(),before=structuredClone(source);
  const result=projectSharedEnglishEntry(source,'tours',approved(source));
  assert.equal(result.status,'translated');
  assert.equal(result.entry.data.title,'4 Days in Rio de Janeiro');
  assert.equal(result.entry.body,'## Prices\n\nFrom USD 1,255.');
  assert.equal(result.entry.id,source.id);
  for(const key of ['id','locale','slug','status','priceFrom','currency','durationDays','durationNights',
    'countries','routeCountries','destinations','routeDestinations','themes','format'])
    assert.deepEqual(result.entry.data[key],source.data[key]);
  assert.equal(result.entry.data._i18n.formatLabel,'Group tour');
  assert.equal(result.entry.data._i18n.contentLanguage,'en');
  assert.equal(result.entry.data.hero.src,source.data.hero.src);
  assert.equal(result.entry.data.itinerary[0].images[0].src,source.data.itinerary[0].images[0].src);
  assert.equal(result.entry.data.itinerary[1].excursionRef,source.data.itinerary[1].excursionRef);
  assert.deepEqual(source,before,'the canonical input is not mutated');
});

test('one changed text or price invalidates only its own dependent English fields',()=>{
  const source=fixture(),prepared=approved(source);
  const current=structuredClone(source);
  current.data.lead='Обновлённая программа.';
  current.data.priceFrom=1400;
  const result=projectSharedEnglishEntry(current,'tours',prepared);
  assert.equal(result.status,'partial');
  assert.equal(result.entry.data.title,'4 Days in Rio de Janeiro');
  assert.equal(result.entry.data.lead,current.data.lead);
  assert.equal(result.entry.data.priceNote,current.data.priceNote);
  assert.equal(result.entry.body,current.body);
  assert.equal(result.entry.data.priceFrom,1400);
  assert.equal(result.entry.data._i18n.contentLanguage,'ru');
  assert.deepEqual(new Set(result.missing),new Set(['/lead','/priceNote','/__body']));
});

test('media refreshes and day order changes keep stable translated text and current shared images',()=>{
  const source=fixture(),prepared=approved(source),current=structuredClone(source);
  current.data.hero.src='/media/rio-new.webp';
  current.data.itinerary=[current.data.itinerary[2],current.data.itinerary[1],current.data.itinerary[0]];
  const result=projectSharedEnglishEntry(current,'tours',prepared);
  assert.equal(result.status,'translated');
  assert.equal(result.entry.data.hero.src,'/media/rio-new.webp');
  assert.equal(result.entry.data.title,'4 Days in Rio de Janeiro');
  assert.equal(result.entry.data.itinerary[0].day,4);
  assert.equal(result.entry.data.itinerary[2].day,1);
  const originalProjection=projectSharedEnglishEntry(source,'tours',prepared);
  assert.equal(result.entry.data.itinerary[0].title,originalProjection.entry.data.itinerary[2].title);
});

test('missing or unapproved slots remain Russian and absent translations preserve the original object',()=>{
  const source=fixture(),prepared=approved(source);
  prepared.overlay.blocks=prepared.overlay.blocks.filter(block=>block.field!=='lead');
  const title=prepared.overlay.blocks.find(block=>block.field==='title');
  title.state='review'; delete title.approval;
  const result=projectSharedEnglishEntry(source,'tours',prepared);
  assert.equal(result.status,'partial');
  assert.equal(result.entry.data.title,source.data.title);
  assert.equal(result.entry.data.lead,source.data.lead);
  assert.notEqual(result.entry.body,source.body);
  assert.equal(projectSharedEnglishEntry(source,'tours',undefined).entry,source);
  assert.equal(projectSharedEnglishEntry(source,'tours',{...prepared,stale:true,reason:'canonical_source_changed'}).entry,source);
});

test('geography projection never imports pilot hrefs, images, identities or commercial facts',()=>{
  const source={id:'ru:country_brazil',data:{id:'country_brazil',locale:'ru',slug:'brazil',status:'approved',
    name:'Бразилия',summary:'Описание',regions:['Рио'],languages:['Португальский'],bestTime:'Круглый год',
    hero:{src:'/media/brazil.webp',alt:'Бразилия'},gallery:[{src:'/media/rio.webp',alt:'Рио'}],
    featureBands:[{eyebrow:'Место',title:'Рио',text:'Описание Рио',image:'/media/band.webp',href:'/brazil/place/rio-de-janeiro/'}],
    featuredTours:['tour_brazil_rio_four_days'],currency:'BRL'},body:'Описание страны'};
  const translation={name:'Brazil',summary:'Description',regions:['Rio'],languages:['Portuguese'],bestTime:'All year',
    hero:{src:'/evil.webp',alt:'Brazil'},gallery:[{src:'/evil2.webp',alt:'Rio'}],
    featureBands:[{eyebrow:'Place',title:'Rio',text:'Rio description',image:'/evil3.webp',href:'/en-pilot-private/place/rio/'}],
    body:'Country description',id:'wrong',slug:'wrong',currency:'USD',featuredTours:[]};
  const result=projectSharedEnglishEntry(source,'countries',{entityId:source.data.id,entityType:'country',translation,
    sourceFingerprint:'git:verified'});
  assert.equal(result.status,'translated');
  assert.equal(result.entry.data.name,'Brazil');
  assert.equal(result.entry.data.hero.src,source.data.hero.src);
  assert.equal(result.entry.data.gallery[0].src,source.data.gallery[0].src);
  assert.equal(result.entry.data.featureBands[0].href,source.data.featureBands[0].href);
  assert.equal(result.entry.data.featureBands[0].image,source.data.featureBands[0].image);
  for(const key of ['id','locale','slug','currency','featuredTours'])assert.deepEqual(result.entry.data[key],source.data[key]);
});

test('latest accepted mass text supersedes the pilot without forging approval or changing source facts',()=>{
  const source=fixture(),input=acceptedMassFixture(source),before=JSON.stringify(input);
  const packet=verifyAcceptedMassPacket(input);
  const result=projectSharedEnglishEntry(source,'tours',{...approved(source),acceptedMass:[packet]});
  assert.equal(result.entry.data.title,'Rio de Janeiro: four days');
  assert.equal(result.entry.data.priceFrom,source.data.priceFrom);
  assert.equal(result.entry.data.hero.src,source.data.hero.src);
  assert.equal(result.applied,approved(source).map.paths.length,'replacement is counted once');
  assert.equal(result.acceptedMass[0].appliedBlocks,1);
  assert.equal(result.acceptedMass[0].changedTexts,1);
  assert.equal(result.acceptedMass[0].resultBlobSha,input.row.review.acceptedBlobSha);
  assert.equal(input.row.status,'ready');
  assert.equal(JSON.parse(input.resultBytes).releaseEligible,false);
  assert.equal(JSON.stringify(input),before);
});

test('mass projection rejects changed result bytes, missing independent QA and another Word document',()=>{
  const input=acceptedMassFixture();
  assert.throws(()=>verifyAcceptedMassPacket({...input,resultBytes:Buffer.from(input.resultBytes.toString().replace('four days','five days'))}),/blob changed/);
  assert.throws(()=>verifyAcceptedMassPacket({...input,row:{...input.row,status:'review'}}),/Unaccepted/);
  const review={...input.row.review,checks:{...input.row.review.checks,facts:false}};
  assert.throws(()=>verifyAcceptedMassPacket({...input,row:{...input.row,review}}),/Unaccepted/);
  assert.throws(()=>verifyAcceptedMassPacket({...input,wordSources:{'word-rio':{revision:input.wordSources['word-rio'].revision,documentHash:'sha256:'+'d'.repeat(64)}}}),/Word source differs/);
});

test('changed canonical source skips only the accepted mass packet',()=>{
  const input=acceptedMassFixture();
  const packet=verifyAcceptedMassPacket({...input,sourceBytes:Buffer.from('new canonical source bytes')});
  assert.equal(packet.status,'stale');assert.deepEqual(packet.blocks,[]);
  const source=fixture(),result=projectSharedEnglishEntry(source,'tours',{...approved(source),acceptedMass:[packet]});
  assert.equal(result.entry.data.title,'4 Days in Rio de Janeiro');
  assert.equal(result.status,'translated');
});

test('glob wrapper recompiles translated Markdown and records the actual canonical source receipt',async()=>{
  const root=await mkdtemp(join(tmpdir(),'ada-en-loader-'));
  try {
    const original=fixture(),prepared=approved(original);
    const put=async(path,value)=>{const file=join(root,path);await mkdir(dirname(file),{recursive:true});
      await writeFile(file,typeof value==='string'?value:JSON.stringify(value));};
    await put(original.filePath,'canonical source bytes');
    await put('data/i18n/pilot-previews/v1/summary.json',{phase:'approved_nonpublishing_pilot',publicationAuthorized:false,
      reports:[{entityId:original.data.id,approved:true,state:'ready',issues:0}],failures:[]});
    await put('data/i18n/block-maps/tours/'+original.data.id+'.json',{...prepared.map,sourceContentPath:original.filePath});
    await put('data/i18n/pilot-previews/v1/overlays/'+original.data.id+'.json',prepared.overlay);
    const mass=acceptedMassFixture(original);
    await put('data/i18n/pilot-previews/v1/word-sources/'+original.data.id+'.json',mass.wordSources);
    await put('data/i18n/pilot-excursions/v1/manifest.json',{schemaVersion:1,locale:'en',publicationAuthorized:false,status:'prepared_for_private_preview',entries:[]});
    await put('data/i18n/pilot-geography/v1/manifest.json',{schemaVersion:1,locale:'en',publicationAuthorized:false,status:'prepared_for_private_visual_pilot',items:[]});
    await put('accepted/.git/HEAD',ACCEPTED_MASS_SNAPSHOT_SHA+'\n');
    const massRoot='accepted/data/i18n/translation-mass/v2/';
    await put(massRoot+'index.json',{schemaVersion:2,publicationEnabled:false,counts:{ready:1},shards:{'1a':{stages:{word_2027:{ready:1}}}}});
    await put(massRoot+'state/1a.json',{schemaVersion:2,items:[mass.row]});
    await put(massRoot+'jobs/1a.json',{schemaVersion:2,jobs:[mass.job]});
    await put('accepted/'+mass.row.submission.resultPath,mass.resultBytes.toString());
    const records=new Map(),rendered=[];
    const store={values:()=>records.values(),set:entry=>{records.set(entry.id,entry);return true;}};
    const loader={name:'glob',async load(){store.set(structuredClone(original));}};
    await withSharedEnglishContent(loader,'tours',{env:{...env,EN_ACCEPTED_TRANSLATIONS_ROOT:'accepted'},root}).load({store,config:{root:pathToFileURL(root+'/')},
      parseData:async({data})=>data,generateDigest:JSON.stringify,
      async renderMarkdown(body,options){rendered.push({body,options});return {html:'<p>English Markdown rendered</p>'};}});
    const result=records.get(original.id);
    assert.equal(result.data.title,'Rio de Janeiro: four days');
    assert.equal(result.body,'## Prices\n\nFrom USD 1,255.');
    assert.equal(result.rendered.html,'<p>English Markdown rendered</p>');
    assert.equal(rendered.length,1);
    assert.equal(rendered[0].options.fileURL.href,pathToFileURL(join(root,original.filePath)).href);
    assert.notEqual(result.digest,'canonical');
    const receipt=JSON.parse(await readFile(join(root,'.astro/ada-en-shared-content.json'),'utf8'));
    assert.equal(receipt.canonicalSourceSha,env.ADA_CANONICAL_SHA);
    assert.equal(receipt.counts.translated,1);
    assert.equal(receipt.entries[0].sourceId,original.data.id);
    assert.equal(receipt.acceptedMassSnapshot.sha,ACCEPTED_MASS_SNAPSHOT_SHA);
    assert.equal(receipt.entries[0].acceptedMass[0].appliedBlocks,1);
    const before=await readFile(join(root,'accepted/'+mass.row.submission.resultPath),'utf8');
    assert.equal(before,mass.resultBytes.toString(),'reading the snapshot never rewrites worker output');
  } finally {await rm(root,{recursive:true,force:true});}
});
