import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifiedEnglishRoutes,rewriteEnglishPilotLinks,stageEnglishTranslations} from '../../scripts/i18n/stage-en-translations.mjs';

const english=body=>'<!doctype html><html lang="en" data-ada-en-pilot="true"><head><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"></head><body>'+body+'</body></html>';

test('21 approved entity IDs resolve to existing canonical source-index URLs',()=>{
 const routes=verifiedEnglishRoutes();
 assert.equal(routes.length,22);
 assert.equal(new Set(routes.map(x=>x.target)).size,22);
 assert.equal(routes[0].target,'/en/tours/');
 const rio=routes.find(x=>x.id==='tour_brazil_rio_four_days');
 assert.equal(rio.target,'/en/brazil/tour/rio-de-janeiro-four-days/');
 assert.equal(rio.source,'/en/tour/rio-de-janeiro-four-days/');
 assert.equal(routes.find(x=>x.id==='country_brazil').target,'/en/brazil/');
 assert.equal(routes.find(x=>x.id==='destination_brazil_rio').target,'/en/brazil/place/rio-de-janeiro/');
});
test('translation page links are rewritten to shared canonical EN routes',()=>{
 const mapping=new Map([
  ['/en/tour/rio-de-janeiro-four-days/','/en/brazil/tour/rio-de-janeiro-four-days/'],
  ['/en-pilot-private/place/rio-de-janeiro/','/en/brazil/place/rio-de-janeiro/']
 ]);
 const source=english('<a href="/adatours-en/en/tour/rio-de-janeiro-four-days/?from=nav#day-1">Tour</a>'+
  '<a href="/en-pilot-private/place/rio-de-janeiro/">Rio</a>'+
  '<img src="https://img.adatours.ru/media/shared.webp" alt="Shared">');
 const rendered=rewriteEnglishPilotLinks(source,mapping);
 assert.match(rendered,/\/adatours-en\/en\/brazil\/tour\/rio-de-janeiro-four-days\/\?from=nav#day-1/);
 assert.match(rendered,/\/adatours-en\/en\/brazil\/place\/rio-de-janeiro\//);
 assert.match(rendered,/https:\/\/img\.adatours\.ru\/media\/shared\.webp/);
 assert.doesNotMatch(rendered,/en-pilot-private|\/en\/tour\/rio-de-janeiro/);
 assert.throws(()=>rewriteEnglishPilotLinks(source.replace('lang="en"','lang="ru"'),mapping),/sealed translated/);
});
test('English source wins over canonical RU fallback with no second media folder',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ada-translated-stage-'));
 const dist=path.join(dir,'dist'),out=path.join(dir,'output');
 const routes=[
  {id:null,kind:'catalog',source:'/en/tours/',target:'/en/tours/',canonical:'/tours/'},
  {id:'test_tour',kind:'tour',source:'/en/tour/one/',target:'/en/brazil/tour/one/',canonical:'/brazil/tour/one/'}
 ];
 try{
  for(const route of routes){
   for(const name of [path.join(dist,route.canonical.slice(1),'index.html'),path.join(dist,route.source.slice(1),'index.html')])
    fs.mkdirSync(path.dirname(name),{recursive:true});
   fs.writeFileSync(path.join(dist,route.canonical.slice(1),'index.html'),'<html lang="ru">Russian</html>');
   fs.writeFileSync(path.join(dist,route.source.slice(1),'index.html'),
    english('<a href="/adatours-en/en/tour/one/">One</a>'));
  }
  const output=stageEnglishTranslations({dist,output:out,routes});
  assert.equal(output.pages,2);
  const html=fs.readFileSync(path.join(out,'en/brazil/tour/one/index.html'),'utf8');
  assert.match(html,/lang="en"/);
  assert.match(html,/\/adatours-en\/en\/brazil\/tour\/one\//);
  assert.equal(fs.existsSync(path.join(out,'en/tour/one/index.html')),false);
  assert.equal(fs.existsSync(path.join(out,'media')),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
