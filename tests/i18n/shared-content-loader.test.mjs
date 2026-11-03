import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createStableBlockMap} from '../../src/lib/i18n/block-map.mjs';
import {sourceFromContentEntry} from '../../src/lib/i18n/content-adapter.mjs';
import {sourceBlockEvidence,translationApprovalHash} from '../../src/lib/i18n/content-overlay.mjs';
import {sharedEnglishContentEnabled,projectSharedEnglishEntry,withSharedEnglishContent} from '../../src/lib/i18n/shared-content-loader.mjs';

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
    await put('data/i18n/pilot-previews/v1/word-sources/'+original.data.id+'.json',{});
    await put('data/i18n/pilot-excursions/v1/manifest.json',{schemaVersion:1,locale:'en',publicationAuthorized:false,status:'prepared_for_private_preview',entries:[]});
    await put('data/i18n/pilot-geography/v1/manifest.json',{schemaVersion:1,locale:'en',publicationAuthorized:false,status:'prepared_for_private_visual_pilot',items:[]});
    const records=new Map(),rendered=[];
    const store={values:()=>records.values(),set:entry=>{records.set(entry.id,entry);return true;}};
    const loader={name:'glob',async load(){store.set(structuredClone(original));}};
    await withSharedEnglishContent(loader,'tours',{env,root}).load({store,config:{root:pathToFileURL(root+'/')},
      parseData:async({data})=>data,generateDigest:JSON.stringify,
      async renderMarkdown(body,options){rendered.push({body,options});return {html:'<p>English Markdown rendered</p>'};}});
    const result=records.get(original.id);
    assert.equal(result.body,'## Prices\n\nFrom USD 1,255.');
    assert.equal(result.rendered.html,'<p>English Markdown rendered</p>');
    assert.equal(rendered.length,1);
    assert.equal(rendered[0].options.fileURL.href,pathToFileURL(join(root,original.filePath)).href);
    assert.notEqual(result.digest,'canonical');
    const receipt=JSON.parse(await readFile(join(root,'.astro/ada-en-shared-content.json'),'utf8'));
    assert.equal(receipt.canonicalSourceSha,env.ADA_CANONICAL_SHA);
    assert.equal(receipt.counts.translated,1);
    assert.equal(receipt.entries[0].sourceId,original.data.id);
  } finally {await rm(root,{recursive:true,force:true});}
});
