import { test } from 'node:test';
import assert from 'node:assert/strict';
import {resolveAstroBuildContext} from '../../src/lib/i18n/build-context.mjs';

test('RU build retains current published origin/base without additional flags',()=>{
  assert.deepEqual({...resolveAstroBuildContext({})}, {site:'https://adatours.ru',base:'/',locale:'ru'});
  assert.deepEqual({...resolveAstroBuildContext({SITE_LOCALE:'ru',SITE_ORIGIN:'https://adatours.ru',SITE_BASE:'/'})},
    {site:'https://adatours.ru',base:'/',locale:'ru'});
});
test('legitimate RU preview base remains allowed',()=>{
  const r=resolveAstroBuildContext({SITE_LOCALE:'ru',SITE_ORIGIN:'https://alexyakovlev79.github.io',SITE_BASE:'/adatours.ru/'});
  assert.equal(r.base,'/adatours.ru/');
  assert.equal(r.locale,'ru');
});
test('planned EN build rejects locale switch even when domain matches',()=>{
  assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'en',SITE_ORIGIN:'https://adatours.com'}),/readiness gate missing/);
});
test('EN cannot be enabled by environment flag alone',()=>{
  assert.throws(()=>resolveAstroBuildContext({
    SITE_LOCALE:'en',SITE_ORIGIN:'https://adatours.com',
    EN_RELEASE_READY:'1',ADA_FORCE_EN:'true',EN_PREVIEW:'1',
  }),/readiness gate missing/);
});
test('even forged status cannot enable planned public origin before registry release',()=>{
 const fake={runtimeLocaleAdapterConnected:true,automaticTextSynchronizationRunning:true,
   operationalDispatcherReady:true,newEnglishSitePublished:true,
   englishBuildGates:{content:true,ui:true,metadata:true,schema:true,links:true,search:true,forms:true}};
 assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'en'},fake),/not enabled for publication/);
});
test('unsupported or unsafe locale and origins fail closed',()=>{
 assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'cn'}),/unknown SITE_LOCALE/);
 assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'ru',SITE_ORIGIN:'http://adatours.ru'}),/HTTPS/);
 assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'ru',SITE_BASE:'//evil'}),/safe absolute/);
});
