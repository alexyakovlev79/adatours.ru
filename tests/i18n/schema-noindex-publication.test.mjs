import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {russianFallbackHtml,rebaseEnglishSchemaGraph} from '../../scripts/i18n/ru-fallback.mjs';

const origin='https://alexyakovlev79.github.io/adatours-en/';
const en=origin+'en/';
const ref=(url)=>({'@id':url});
const graph={
 '@context':'https://schema.org',
 '@graph':[
  {'@type':['Organization','TravelAgency'],'@id':'https://adatours.ru/#organization',
   name:'Ada Tours',url:'https://adatours.ru',sameAs:['https://adatours.com/']},
  {'@type':'WebSite','@id':origin+'#website',url:origin,inLanguage:'en'},
  {'@type':'CollectionPage','@id':origin+'brazil/#webpage',url:origin+'brazil/',
   name:'Brazil',inLanguage:'en',isPartOf:ref(origin+'#website'),
   mainEntity:ref(origin+'brazil/#country')},
  {'@type':'Country','@id':origin+'brazil/#country',url:origin+'brazil/',
   name:'Brazil',identifier:'country_brazil',mainEntityOfPage:ref(origin+'brazil/#webpage')},
  {'@type':'ImageObject','@id':origin+'brazil/#primaryimage',
   contentUrl:origin+'media/country/brazil.webp'},
  {'@type':'BreadcrumbList','@id':origin+'brazil/#breadcrumb',
   itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin},
    {'@type':'ListItem',position:2,name:'Brazil',item:origin+'brazil/'}]}
 ]
};
const find=(n,fn)=>{const out=[];const visit=x=>{if(fn(x))out.push(x);for(const y of x.childNodes??[])visit(y)};visit(n);return out};
const attr=(n,key)=>n.attrs?.find(x=>x.name===key)?.value;
const schemaTag=JSON.stringify(graph).replaceAll('<','\\u003c');

test('EN noindex pages retain exactly one parseable JSON-LD with real /en/ self URL and stable facts',()=>{
 const source='<!doctype html><html lang="en" data-ada-shared-locale="en"><head>'
  +'<meta name="robots" content="noindex, nofollow">'
  +'<script type="application/ld+json" data-schema-version="2026-10-22.3">'
  +schemaTag+'</script>'
  +'<script type="text/javascript">window.mustNotRun=true</script>'
  +'</head><body><h1>Brazil</h1><main>Brazil tours</main></body></html>';
 const rendered=russianFallbackHtml(source,'/brazil/',new Set(['/','/brazil/']),{sharedContent:true});
 const dom=parse(rendered);
 const scripts=find(dom,n=>n.tagName==='script');
 assert.equal(scripts.length,1);
 assert.equal(attr(scripts[0],'type'),'application/ld+json');
 const result=JSON.parse(scripts[0].childNodes.map(n=>n.value??'').join(''));
 const page=result['@graph'].find(n=>n['@id']===en+'brazil/#webpage');
 assert.equal(page.url,en+'brazil/');
 assert.equal(page.isPartOf['@id'],en+'#website');
 assert.equal(result['@graph'].find(n=>n['@type']==='Country').identifier,'country_brazil');
 assert.equal(result['@graph'].find(n=>n['@type']==='ImageObject').contentUrl,'https://img.adatours.ru/media/country/brazil.webp');
 assert.equal(result['@graph'].find(n=>n['@type']==='BreadcrumbList').itemListElement[0].item,en);
 assert.equal(result['@graph'].find(n=>Array.isArray(n['@type'])).sameAs[0],'https://adatours.com/');
 assert.match(rendered,/noindex,nofollow,noarchive,nosnippet/u);
 assert.doesNotMatch(rendered,/window.mustNotRun/u);
 assert.doesNotMatch(rendered,/rel="canonical"/u);
});

test('EN schema rebasing never converts external sources or unbuilt routes to invented /en/ pages',()=>{
 const source=structuredClone(graph);
 source['@graph'].push({'@type':'Article','@id':'https://publisher.example.com/post#article',
  url:'https://publisher.example.com/post',name:'Original publication',
  inLanguage:'ru'});
 const result=rebaseEnglishSchemaGraph(source,'/brazil/',new Set(['/','/brazil/']));
 assert.equal(result['@graph'].at(-1)['@id'],'https://publisher.example.com/post#article');
 assert.equal(graph['@graph'][2]['@id'],origin+'brazil/#webpage');
 assert.throws(()=>rebaseEnglishSchemaGraph({'@context':'https://schema.org','@graph':[]},'/brazil/',new Set(['/'])),/Invalid EN Schema/u);
});

test('Schema Stage 8: shared site-shell is not a page and has no JSON-LD obligation',()=>{
 const source='<!doctype html><html lang="en" data-ada-shared-locale="en"><head>'+
  '<meta name="robots" content="noindex, nofollow"></head>'+
  '<body><header data-site-shell="header"><a href="/tours/">Tours</a></header></body></html>';
 const siteShell=russianFallbackHtml(source,'/',new Set(['/','/tours/']),
  {sharedContent:true,siteShellFragment:true});
 const dom=parse(siteShell);
 assert.equal(find(dom,x=>x.tagName==='script'&&attr(x,'type')==='application/ld+json').length,0);
 assert.match(siteShell,/noindex,nofollow,noarchive,nosnippet/u);
 assert.match(siteShell,/Tours/);
 assert.throws(()=>russianFallbackHtml(source,'/',new Set(['/']),
  {sharedContent:true}),/Expected one inspectable EN Schema.org JSON-LD graph/u);
});
