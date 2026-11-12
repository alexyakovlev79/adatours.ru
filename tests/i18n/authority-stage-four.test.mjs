import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorityPage, localizedAuthorityPartners } from '../../src/lib/i18n/authority-pages.mjs';
import { getAuthorityPartners, getAuthorityPageSources } from '../../src/lib/entity-authority.mjs';

const ru = JSON.parse(readFileSync('src/data/authority-pages.json','utf8'));
const english = {
  press: JSON.parse(readFileSync('src/data/i18n/authority-pages.press.en.json','utf8')),
  webinars: JSON.parse(readFileSync('src/data/i18n/authority-pages.webinars.en.json','utf8')),
  partners: JSON.parse(readFileSync('src/data/i18n/authority-pages.partners.en.json','utf8'))
};
const visibleCyrillic = /[А-Яа-яЁё]/u;
const controlKeys = new Set(['path','id','href','leadEntityId','sourceId','anchorId','displaySeparately','heroImage','photo']);
let publicCount = 0, translatedCount = 0;
function compare(a,b,path='',key=''){
  if(typeof a === 'string'){
    assert.equal(typeof b,'string',path);
    if(controlKeys.has(key)||key==='searchAliases')assert.equal(a,b,'Canonical identity changed: '+path);
    else if(visibleCyrillic.test(a)){
      assert.ok(!visibleCyrillic.test(b),'Untranslated visitor string: '+path);
      publicCount++;
      if(a!==b)translatedCount++;
    }
  }else if(Array.isArray(a)){
    assert.ok(Array.isArray(b),'Array changed: '+path);
    assert.equal(a.length,b.length,'Array length: '+path);
    a.forEach((item,i)=>compare(item,b[i],path+'['+i+']',key));
  }else if(a && typeof a==='object'){
    assert.ok(b && typeof b==='object','Object changed: '+path);
    assert.deepEqual(Object.keys(a),Object.keys(b),'Shape changed: '+path);
    for(const [next,value] of Object.entries(a))compare(value,b[next],path+'.'+next,next);
  }else assert.deepEqual(a,b,'Technical value changed: '+path);
}
test('three English authority pages cover visitor-facing prose without changing Russian source identity',()=>{
  for(const id of ['press','webinars','partners']){
    assert.deepEqual(authorityPage(id,'ru'),ru[id]);
    assert.deepEqual(authorityPage(id,'en'),english[id]);
    compare(ru[id],english[id],id);
    assert.ok(getAuthorityPageSources(ru[id].path).length>0);
  }
  assert.ok(publicCount>400,'Expected the entire visitor-facing inventory');
  assert.equal(translatedCount,publicCount);
});
test('original publication names, verified source URLs and language labels are kept in their canonical registry',()=>{
  for(const id of ['press','webinars','partners']){
    const sources=getAuthorityPageSources(ru[id].path);
    assert.ok(sources.every(source=>source.name&&source.url&&source.language));
    assert.equal(authorityPage(id,'en').path,authorityPage(id,'ru').path);
    assert.deepEqual(authorityPage(id,'en').searchAliases,authorityPage(id,'ru').searchAliases);
  }
});
test('partner EN projection changes only explanatory copy, not evidence, URLs or names',()=>{
  const original=getAuthorityPartners();
  const localized=localizedAuthorityPartners(original,'en');
  assert.equal(localized.length,original.length);
  assert.deepEqual(localizedAuthorityPartners(original,'ru'),original);
  for(let i=0;i<localized.length;i++){
    const a=original[i],b=localized[i];
    assert.equal(a.id,b.id);
    assert.equal(a.name,b.name);
    assert.equal(a.url,b.url);
    assert.deepEqual(a.sourceIds,b.sourceIds);
    assert.deepEqual(a.sources,b.sources);
    assert.ok(!visibleCyrillic.test(b.role));
    assert.ok(!visibleCyrillic.test(b.description));
  }
});
