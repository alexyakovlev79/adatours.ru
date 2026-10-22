import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobileHeroSelector} from '../src/lib/mobile-hero-registry.mjs';
const row={pagePath:'/brazil/',source:'/media/brazil/hero.webp',profile:'photo-lead',manualObjectPosition:'62% 54%',status:'READY',variants:[{key:'media/crop.webp',width:480,height:640}]};
const registry=items=>({version:1,media:'(max-width: 479px)',items});
test('only the exact page, original, profile, and manual focus use a verified crop',()=>{
  const select=createMobileHeroSelector(registry([row]));const match={pagePath:row.pagePath,source:row.source,profile:row.profile,manualObjectPosition:row.manualObjectPosition};
  assert.equal(select(match),row);
  for(const change of [{pagePath:'/brazil/other/'},{source:'/media/brazil/new.webp'},{profile:'compact'},{manualObjectPosition:'center'}])assert.equal(select({...match,...change}),undefined);
});
test('empty scaffolding changes no photo; incomplete and duplicate mappings fail closed',()=>{
  assert.equal(createMobileHeroSelector(registry([]))({pagePath:'/',source:'x',profile:'home'}),undefined);
  assert.throws(()=>createMobileHeroSelector(registry([row,row])),/Duplicate/);
  assert.throws(()=>createMobileHeroSelector(registry([{...row,variants:[]}])),/without variants/);
});
