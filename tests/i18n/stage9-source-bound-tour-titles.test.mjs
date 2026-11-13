import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleTourTitleRepair} from '../../src/lib/i18n/tour-title-repairs.mjs';
import {projectSharedEnglishEntry} from '../../src/lib/i18n/shared-content-loader.mjs';

const cases=[
 ['tour_source_argentina_buenos_ajres_kalafate_ushuaja_iguasu',
  'Тур в Аргентину на 12 дней: Буэнос-Айрес, Патагония, Ушуайя и Игуасу',
  'Argentina in 12 Days: Buenos Aires, Patagonia, Ushuaia and Iguazú'],
 ['tour_source_chili_argentina','Чили & Аргентина Делюкс','Chile & Argentina Deluxe'],
 ['tour_source_chudesa_gvatemaly_beliza','Чудеса Гватемалы & Белиза','Wonders of Guatemala & Belize']
];
for(const [sourceId,title,englishTitle] of cases){
 test('stage9: guarded EN Tour title for '+sourceId,()=>{
  const source={id:sourceId,locale:'ru',status:'published',title};
  const before=structuredClone(source);
  const patch=eligibleTourTitleRepair({sourceId,source});
  assert.deepEqual(patch&&{path:patch.path,text:patch.text},{path:'/title',text:englishTitle});
  assert.deepEqual(source,before,'RU canonical title stays untouched');
  assert.equal(eligibleTourTitleRepair({sourceId,source,alreadyTranslated:true}),null);
  assert.equal(eligibleTourTitleRepair({sourceId,source:{...source,status:'archived'}}),null);
  assert.equal(eligibleTourTitleRepair({sourceId,source:{...source,title:title+' updated'}}),null);
  assert.equal(eligibleTourTitleRepair({sourceId:'tour_unknown',source}),null);
 });
 test('stage9: the shared projector fills only a missing title for '+sourceId,()=>{
  const entry={id:'ru:'+sourceId,data:{id:sourceId,locale:'ru',status:'approved',
    title,lead:'Русское описание.'},body:''};
  const before=structuredClone(entry);
  const prepared={entityId:sourceId,entityType:'tour',
    sourceFingerprint:'sha256:test',translation:{lead:'English description.'}};
  const result=projectSharedEnglishEntry(entry,'tours',prepared);
  assert.equal(result.entry.data.title,englishTitle);
  assert.equal(result.entry.data.lead,'English description.');
  assert.deepEqual(result.sourceBoundRepairs,[{path:'/title',sourceTextSha256:patchHash(sourceId)}]);
  assert.equal(result.entry.data.status,'approved');
  assert.deepEqual(entry,before);
  const already={...prepared,translation:{title:'Previously approved title',lead:'English description.'}};
  assert.equal(projectSharedEnglishEntry(entry,'tours',already).entry.data.title,'Previously approved title');
  const changed={...entry,data:{...entry.data,title:title+' updated'}};
  assert.equal(projectSharedEnglishEntry(changed,'tours',prepared).entry.data.title,title+' updated');
 });
}
function patchHash(id){
 return eligibleTourTitleRepair({sourceId:id,source:{id,locale:'ru',status:'published',
   title:cases.find(row=>row[0]===id)[1]}}).sourceTextSha256;
}
