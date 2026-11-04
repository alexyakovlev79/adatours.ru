import test from 'node:test';
import assert from 'node:assert/strict';
import {runEnMassQa} from '../../scripts/i18n/translation-mass-qa.mjs';
test('QA cannot publish or approve without exact identity',async()=>{
 await assert.rejects(runEnMassQa({}, {},{action:'publish',jobId:'en:bulk:tour:foo:b001'}),
  /Unsupported QA action/);
 await assert.rejects(runEnMassQa({}, {},{action:'approve',jobId:'wrong id'}),
  /Exact jobId required/);
});

test('independent QA rejects unsupported decisions before touching Github',async()=>{
 await assert.rejects(runEnMassQa({}, {},{action:'revise_and_approve',jobId:'invalid id'}),/Exact jobId required/);
 await assert.rejects(runEnMassQa({}, {},{action:'reject',jobId:'en:bulk:tour:test:b001'}),/Unsupported QA action/);
});
