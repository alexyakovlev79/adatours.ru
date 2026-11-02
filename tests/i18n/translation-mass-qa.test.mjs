import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnMassQa} from '../../scripts/i18n/translation-mass-qa.mjs';
test('QA cannot publish or approve without exact identity',async()=>{
 await assert.rejects(runEnMassQa({}, {},{action:'publish',jobId:'en:bulk:tour:foo:b001'}),
  /Unsupported QA action/);
 await assert.rejects(runEnMassQa({}, {},{action:'approve',jobId:'wrong id'}),
  /Exact jobId required/);
});
