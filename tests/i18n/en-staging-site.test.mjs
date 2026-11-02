import test from 'node:test';
import assert from 'node:assert/strict';
import {enStagingSiteEnabled,EN_STAGING_BASE,EN_STAGING_ORIGIN} from '../../src/lib/i18n/en-staging-site.mjs';
import {resolveAstroBuildContext} from '../../src/lib/i18n/build-context.mjs';
import {privatePilotEnabled} from '../../src/lib/i18n/pilot-html.mjs';

const valid={
 SITE_LOCALE:'en',SITE_ORIGIN:EN_STAGING_ORIGIN,SITE_BASE:EN_STAGING_BASE,
 EN_STAGING_PAGES:'1',PUBLIC_EN_RELEASE:'0',EN_PILOT_PREVIEW:'0'
};
test('only the separate EN GitHub Pages target can build nonindex staging',()=>{
 assert.equal(enStagingSiteEnabled(valid),true);
 assert.equal(privatePilotEnabled(valid),true);
 assert.deepEqual({...resolveAstroBuildContext(valid)},
  {site:EN_STAGING_ORIGIN,base:EN_STAGING_BASE,locale:'en',staging:true});
});
test('staging cannot replace Russian Pages or live English host by environment alone',()=>{
 for(const bad of [
  {...valid,SITE_ORIGIN:'https://adatours.ru'},
  {...valid,SITE_ORIGIN:'https://adatours.com'},
  {...valid,SITE_BASE:'/'},
  {...valid,SITE_BASE:'/adatours.ru/'},
  {...valid,PUBLIC_EN_RELEASE:'1'},
  {...valid,EN_PILOT_PREVIEW:'1'},
  {...valid,EN_STAGING_PAGES:'0'},
  {...valid,SITE_LOCALE:'ru'}
 ]){
  assert.equal(enStagingSiteEnabled(bad),false);
  assert.throws(()=>resolveAstroBuildContext(bad),/EN readiness gate|RU build cannot use|not enabled|blocked/);
 }
});
test('legacy source-bound local pilot remains isolated and EN is not enabled by default',()=>{
 assert.equal(privatePilotEnabled({EN_PILOT_PREVIEW:'1',SITE_LOCALE:'ru'}),true);
 assert.equal(privatePilotEnabled({SITE_LOCALE:'en'}),false);
 assert.throws(()=>resolveAstroBuildContext({SITE_LOCALE:'en'}),/EN readiness gate/);
});
