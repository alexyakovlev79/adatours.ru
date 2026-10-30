import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTeam,safeInterestCopy,safeMarkdown,safeReceipts,safeEnhancements,classifyChanges} from '../src/lib/deploy-change-scope.mjs';
const j=JSON.stringify;
const team={sourceUrl:'https://ada.example',updatedAt:'2026-10-30',members:[{id:'person_geovani',name:'Geovani',role:'Guide',paragraphs:['Bio'],photo:{src:'/media/people/geovani/photo-20261030.webp',alt:'Portrait',hover:'Geovani',width:560,height:800}}]};
test('team copy and portraits are eligible, identities and unknown paths are not',()=>{
  assert.ok(safeTeam(j(team),j({...team,members:[{...team.members[0],role:'Coordinator'}]})));
  assert.equal(safeTeam(j(team),j({...team,members:[{...team.members[0],id:'other'}]})),false);
  assert.equal(safeTeam(j(team),j({...team,members:[{...team.members[0],photo:{...team.members[0].photo,src:'data:bad'}}]})),false);
  assert.equal(classifyChanges([{status:'A',path:'src/content/tours/new.md'}],()=>'',()=>'' ).mode,'full');
});
test('intro copy can change, grammar forms are protected',()=>{
  const a={theme_test:{tourForms:['тур','тура','туров'],toursTitle:'Title',tourIntro:'Intro',geographyIntro:'Geo',catalogIntro:'Catalog'}};
  assert.ok(safeInterestCopy(j(a),j({theme_test:{...a.theme_test,tourIntro:'Other Intro'}})));
  assert.equal(safeInterestCopy(j(a),j({theme_test:{...a.theme_test,tourForms:['wrong']}})),false);
});
test('only existing plain Markdown prose is eligible',()=>{
  const a='---\nid: test\n---\n## Same heading\n\nGood **text** with [link](/brazil/).\n';
  assert.ok(safeMarkdown(a,a.replace('Good','Better')));
  assert.equal(safeMarkdown(a,a.replace('/brazil/','/argentina/')),false);
  assert.equal(safeMarkdown(a,a.replace('id: test','id: altered')),false);
  assert.equal(safeMarkdown(a,a.replace('Same heading','Other heading')),false);
});
test('media receipts and enhanced provenance are append-only',()=>{
  const a={version:1,assets:[{key:'media/people/g/photo-20261030.webp',sha256:'a'.repeat(64),bytes:100,contentType:'image/webp',uploadedAt:'2026-10-30',source:'direct-s3'}]};
  assert.ok(safeReceipts(j(a),j({...a,assets:[...a.assets,{...a.assets[0],key:'media/people/g/next-20261030.webp'}]})));
  assert.equal(safeReceipts(j(a),j({...a,assets:[{...a.assets[0],bytes:101}]})),false);
  const e={version:1,description:'gpt',enhancements:[{source:'/media/old.webp',enhanced:'/media/old.webp'}]};
  const f={...e,enhancements:[...e.enhancements,{source:'/media/people/geovani/new-20261030.webp',enhanced:'/media/people/geovani/new-20261030.webp',method:'gpt-image',revision:1,enhancedAt:'2026-10-30'}]};
  assert.ok(safeEnhancements(j(e),j(f)));
  f.enhancements[0].enhanced='/media/changed.webp';
  assert.equal(safeEnhancements(j(e),j(f)),false);
});
test('only allowlisted small changes get fast mode',()=>{
  const old=j(team),next=j({...team,members:[{...team.members[0],name:'Geovani Silva'}]});
  assert.equal(classifyChanges([{status:'M',path:'src/data/organization/team.json'}],()=>old,()=>next).mode,'fast');
  assert.equal(classifyChanges([{status:'M',path:'src/pages/team/index.astro'}],()=>old,()=>next).mode,'full');
  assert.equal(classifyChanges([{status:'M',path:'package.json'}],()=>old,()=>next).mode,'full');
});
