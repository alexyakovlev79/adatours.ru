import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';
import sourcePatches from '../../src/data/i18n/tour-field-repairs.en.json' with {type:'json'};
import {eligibleTourFieldRepairs} from '../../src/lib/i18n/tour-field-repairs.mjs';
import {projectSharedEnglishEntry} from '../../src/lib/i18n/shared-content-loader.mjs';

const at=(obj,path)=>path.startsWith('/route/')
 ? obj.route[Number(path.slice(7))] : obj[path.slice(1)];
test('stage 9 repairs: 21 exact fields across three active tour sources',()=>{
 let total=0;
 for(const [id,row] of Object.entries(sourcePatches.entries)){
  const file=fs.readFileSync(new URL('../../'+row.sourcePath,import.meta.url),'utf8');
  const match=/^---\r?\n([\s\S]*?)\r?\n---/u.exec(file);
  assert.ok(match,id+' must have frontmatter');
  const parsed=yaml.load(match[1]);
  assert.equal(parsed.id,id);
  const fields=eligibleTourFieldRepairs({sourceId:id,source:parsed});
  assert.equal(fields.length,Object.keys(row.fields).length,id);
  total+=fields.length;
  for(const patch of fields){
   assert.equal(at(parsed,patch.path),row.fields[patch.path].sourceText,id+' '+patch.path);
   assert.equal(patch.text,row.fields[patch.path].englishText);
   assert.ok(!/[\u0400-\u052f]/u.test(patch.text),patch.path);
  }
  assert.equal(eligibleTourFieldRepairs({sourceId:id,source:{...parsed,status:'archived'}}).length,0);
  const already=new Set(Object.keys(row.fields));
  assert.equal(eligibleTourFieldRepairs({sourceId:id,source:parsed,alreadyTranslated:already}).length,0);
  const changed={...parsed,lead:'Changed independently'};
  assert.equal(eligibleTourFieldRepairs({sourceId:id,source:changed}).length,fields.length-1);
  const entry={id:'ru:'+id,data:parsed,body:''};
  const previous=structuredClone(entry);
  const result=projectSharedEnglishEntry(entry,'tours',{entityId:id,entityType:'tour',
    translation:{title:'Previously approved English title'},sourceFingerprint:'sha256:test'});
  assert.equal(result.sourceBoundRepairs?.length,fields.length,id);
  assert.equal(result.entry.data.priceFrom,parsed.priceFrom);
  assert.equal(result.entry.data.currency,parsed.currency);
  assert.equal(result.entry.data.title,'Previously approved English title');
  for(const patch of fields){
    const actual=patch.path==='/format'?result.entry.data._i18n?.formatLabel:at(result.entry.data,patch.path);
    assert.equal(actual,patch.text,id+' '+patch.path);
  }
  assert.deepEqual(entry,previous,'Original RU Tour must not be mutated');
 }
 assert.equal(total,21);
});
