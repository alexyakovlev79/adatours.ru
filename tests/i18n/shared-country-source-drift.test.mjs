import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCompatibleCountryEnglish} from '../../src/lib/i18n/shared-content-loader.mjs';

const verified = [
 ['country_brazil','20d439895dbcbcb63db955e4a734be5b240b249c','bf71c692a9523bedabd666623da491b2aa265ff8'],
 ['country_chile','7383936a41ce28d06ff2ab18df0fd0fa85b15760','0c0fc806026211a9f535265919a298a754800642'],
 ['country_colombia','eac7c29a80aa2cab9406eb0feec00f804ed98c37','efc1ef5d926356dea9abade33aa45b2a1243789c'],
];
test('only three already-translated countries accept audited source drift',()=>{
 for(const [id,expectedSha,actualSha] of verified){
  assert.equal(sourceCompatibleCountryEnglish({kind:'country',id,expectedSha,actualSha}),true,id);
  assert.equal(sourceCompatibleCountryEnglish({kind:'destination',id,expectedSha,actualSha}),false,id);
  assert.equal(sourceCompatibleCountryEnglish({kind:'country',id,expectedSha,actualSha:expectedSha}),false,id);
  assert.equal(sourceCompatibleCountryEnglish({kind:'country',id,expectedSha:actualSha,actualSha}),false,id);
  assert.equal(sourceCompatibleCountryEnglish({kind:'country',id,expectedSha,actualSha:'0'.repeat(40)}),false,id);
 }
 assert.equal(sourceCompatibleCountryEnglish({
  kind:'country',id:'country_peru',expectedSha:verified[0][1],actualSha:verified[0][2],
 }),false);
});
