import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseSeoGeoArticle} from '../../src/lib/seo-geo.mjs';
import {applyFulltextToSource,splitFulltextMarkdown,sameSeoLeadNumerals,seoNumberSemanticFacts} from '../../scripts/i18n/materialize-fulltext-en.mjs';
import {authorizeFulltextSource,repairFulltextEnglishSyntax,reconcileFulltextLinks,repairedFulltextBody} from '../../scripts/i18n/fulltext-publication-repairs.mjs';
const registry=JSON.parse(readFileSync(new URL('../../data/i18n/fulltext-publication-repairs/2026-11-12.json',import.meta.url),'utf8'));
test('repair list is exact, limited to 87 originally nonfull documents',()=>{
 const nums=new Set([
  ...registry.countries.map(x=>x.number),...registry.sourceShaReceipts.map(x=>x.number),
  ...registry.ruLocaleInEnglish,...registry.yamlSyntax,...registry.seoKindsKeepCanonical,
  ...registry.seoProseDataToken,...registry.linkReconcile,...registry.complexNeedsRevisions
 ]);
 assert.equal(nums.size,87);
 assert.equal(registry.countries.length,21);
 assert.equal(registry.ruLocaleInEnglish.length,30);
 assert.equal(registry.sourceShaReceipts.length,6);
});
test('saved RU locale typo in fully-English theme does not change canonical identity',()=>{
 const ru='---\nid: theme_sample\nlocale: ru\nslug: nature\nname: Природа\nstatus: approved\n---\n\nЭто природа.\n';
 const en='---\nid: theme_sample\nlocale: ru\nslug: nature\nname: Nature\nstatus: approved\n---\n\nThis is nature.\n';
 assert.throws(()=>applyFulltextToSource(ru,en,'themes','sha'),/identity/);
 const output=applyFulltextToSource(ru,en,'themes','sha',{ruLocaleAllowed:true});
 assert.equal(output.status,'applied');
 const parsed=splitFulltextMarkdown(output.content);
 assert.equal(parsed.data.locale,'ru');
 assert.equal(parsed.data.name,'Nature');
 assert.match(parsed.body,/This is nature/);
});
test('only audited current country source SHA is eligible for drift recovery',()=>{
 const c=registry.countries.find(x=>x.number===7035);
 const correct=authorizeFulltextSource(c.number,c.frozenSha,c.approvedCurrentSha,c.frozenSha,registry);
 assert.equal(correct.compatibleCountry?.number,7035);
 assert.throws(()=>authorizeFulltextSource(c.number,c.frozenSha,'a'.repeat(40),c.frozenSha,registry),/source_changed/);
});
test('country href and other canonical facts remain unchanged while approved changed text is localized',()=>{
 const ru='---\nid: country_test\nlocale: ru\nslug: test\nstatus: approved\nname: Суринам\nfeatureBands:\n  - eyebrow: Реки\n    title: Кабалебо и тропические леса\n    text: Кабалебо — лесной район Суринама.\n    image: /media/f.webp\n    href: /suriname/place/kabalebo/\n---\n\nОписание.\n';
 const en='---\nid: country_test\nlocale: en\nslug: test\nstatus: approved\nname: Suriname\nfeatureBands:\n  - eyebrow: Rivers\n    title: Brownsberg and Brokopondo\n    text: A forest region.\n    image: /media/other.webp\n---\n\nDescription.\n';
 const out=applyFulltextToSource(ru,en,'countries','sha',{textOverrides:{
  '/featureBands/0/title':'Kabalebo and tropical forests',
  '/featureBands/0/text':'Kabalebo is a forest region of Suriname.'
 }});
 const parsed=splitFulltextMarkdown(out.content);
 assert.equal(parsed.data.featureBands[0].title,'Kabalebo and tropical forests');
 assert.equal(parsed.data.featureBands[0].href,'/suriname/place/kabalebo/');
 assert.equal(parsed.data.featureBands[0].image,'/media/f.webp');
});
test('recover only the explicitly audited mismatched saved SHA',()=>{
 const r=registry.sourceShaReceipts.find(x=>x.number===6361);
 assert.equal(authorizeFulltextSource(6361,r.canonical,r.canonical,r.claimed,registry).recoveredReceipt,true);
 assert.throws(()=>authorizeFulltextSource(6361,r.canonical,r.canonical,'f'.repeat(40),registry),/source_identity_mismatch/);
});
test('YAML repairs preserve prose apostrophes and colon-bearing titles',()=>{
 const texts=[
  [938,'---\nfeatureBands:\n  - eyebrow: City\n    title: Mendoza: Squares and Leafy Avenues\n---\n\nA city'],
  [1057,"---\nsummary: 'Penola Strait reveals Antarctica's snowy islands.'\n---\n\nStrait"],
  [1301,"---\nhero:\n  hover: 'Sugarloaf Mountain: a cable car above Rio's bays'\n---\n\nView"]
 ];
 for(const [number,src] of texts){
  const out=repairFulltextEnglishSyntax(src,number,registry);
  const parsed=splitFulltextMarkdown(out);
  assert.equal(number===938?parsed.data.featureBands[0].title:
               number===1057?parsed.data.summary:parsed.data.hero.hover,
               number===938?'Mendoza: Squares and Leafy Avenues':
               number===1057?"Penola Strait reveals Antarctica's snowy islands.":
               "Sugarloaf Mountain: a cable car above Rio's bays");
 }
});
test('preserve canonical internal link multiset and remove unsupported additions',()=>{
 const source='## History\n\n[Bonito](/brazil/place/bonito/) and [Rio](/brazil/place/rio-de-janeiro/) are places.\n';
 const english='## History\n\nBonito and Rio de Janeiro are places. See [an unrelated option](/extra/).\n';
 const fixed=reconcileFulltextLinks(source,english);
 assert.match(fixed,/\[Bonito\]\(\/brazil\/place\/bonito\/\)/);
 assert.match(fixed,/\[Rio de Janeiro\]\(\/brazil\/place\/rio-de-janeiro\/\)/);
 assert.doesNotMatch(fixed,/\]\(\/extra\/\)/);
});
test('neutralize only the exact prohibited data-colon prose in allowed SEO articles',()=>{
 const src='---\nkind: destination\n---\n\nDetails from live data:\n\n{{catalog.tourTable:example}}\n';
 const result=repairFulltextEnglishSyntax(src,1687,registry);
 assert.match(result,/information:\n\n\{\{catalog/);
 assert.throws(()=>repairFulltextEnglishSyntax('---\n---\n\nNothing',1687,registry),/token absent/);
});
test('unapproved link changes cannot silently bypass canonical text contract',()=>{
 const src='---\ntargetPath: /foo/\nkind: one\n---\n\n## A\n\n[A](/a/)\n';
 const en='---\ntargetPath: /foo/\nkind: one\n---\n\n## A\n\nB\n';
 assert.equal(repairedFulltextBody(src,en,100,registry),en);
});

test('five revised Peru articles match exact current source blobs, link targets and content format',()=>{
 const sha=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const linkTargets=body=>[...body.matchAll(/\]\(([^)]+)\)/g)].map(x=>x[1]).sort();
 const templates=body=>[...body.matchAll(/\{\{[^}]+\}\}/g)].map(x=>x[0]).sort();
 for(const num of registry.complexNeedsRevisions){
  const name=String(num).padStart(5,'0')+'.json';
  const bytes=readFileSync(new URL('../../data/i18n/fulltext-publication-repairs/entries/'+name,import.meta.url));
  assert.equal(sha(bytes),registry.revisionBlobs[String(num)]);
  const revision=JSON.parse(bytes.toString('utf8'));
  assert.equal(revision.number,num);
  assert.equal(revision.locale,'en');
  assert.equal(revision.status,'review');
  const originalBytes=readFileSync(new URL('../../'+revision.path,import.meta.url));
  assert.equal(sha(originalBytes),revision.sourceBlobSha);
  const original=originalBytes.toString('utf8');
  const src=splitFulltextMarkdown(original),en=splitFulltextMarkdown(revision.enMarkdown);
  assert.equal(en.data.targetPath,src.data.targetPath);
  assert.equal(en.data.kind,src.data.kind);
  assert.equal(en.data.status,src.data.status);
  assert.deepEqual(linkTargets(en.body),linkTargets(src.body));
  assert.deepEqual(templates(en.body),templates(src.body));
  assert.doesNotMatch(revision.enMarkdown,/[\u0400-\u052f]/u);
  parseSeoGeoArticle(revision.enMarkdown,revision.path);
 }
});


test('Anna changed FULLTEXT source is allowed only with exact current blob and appended sentence',()=>{
 const item=registry.personAppendOnly?.find(x=>x.number===7056);
 assert.ok(item);
 assert.equal(item.path,'src/content/people/anna-avanesova.md');
 // The original appended version remains a valid historic pinned revision.
 // It must not fail the whole EN build when the RU biography is rewritten later.
 const auth=authorizeFulltextSource(item.number,item.frozenSha,item.approvedCurrentSha,item.frozenSha,registry);
 assert.equal(auth.compatiblePerson?.englishSuffix,'Anna enjoys sport.');
 assert.equal(auth.sourceReconciled,true);
 assert.throws(()=>authorizeFulltextSource(item.number,item.frozenSha,'a'.repeat(40),item.frozenSha,registry),/source_changed/);
 assert.throws(()=>authorizeFulltextSource(item.number,item.frozenSha,item.approvedCurrentSha,'a'.repeat(40),registry),/source_changed/);
});

test('fully rewritten Anna biography has a separate exact source-bound EN translation',()=>{
 const entry=registry.personFullRevisions?.find(x=>x.number===7056);
 assert.ok(entry);
 assert.equal(entry.path,'src/content/people/anna-avanesova.md');
 assert.notEqual(entry.approvedCurrentSha,registry.personAppendOnly.find(x=>x.number===7056).approvedCurrentSha);
 const en=splitFulltextMarkdown(entry.enMarkdown);
 assert.equal(en.data.id,'person_anna');
 assert.equal(en.data.locale,'en');
 assert.equal(en.data.slug,'anna-avanesova');
 assert.doesNotMatch(entry.enMarkdown,/[\u0400-\u052f]/u);
 assert.match(en.body,/300 tropical islands/);
 assert.match(en.body,/7 languages/);
 const auth=authorizeFulltextSource(entry.number,entry.frozenSha,entry.approvedCurrentSha,entry.frozenSha,registry);
 assert.equal(auth.compatiblePersonComplete?.path,entry.path);
 assert.throws(()=>authorizeFulltextSource(entry.number,entry.frozenSha,'a'.repeat(40),entry.frozenSha,registry),/source_changed/);
 assert.throws(()=>authorizeFulltextSource(entry.number,entry.frozenSha,entry.approvedCurrentSha,'a'.repeat(40),registry),/source_changed/);
 const bytes=readFileSync(new URL('../../'+entry.path,import.meta.url));
 const current=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(current===entry.approvedCurrentSha){
   const result=applyFulltextToSource(bytes.toString('utf8'),entry.enMarkdown,'people',current);
   assert.equal(result.status,'applied');
   const projected=splitFulltextMarkdown(result.content);
   assert.equal(projected.data.name,'Anna Avanesova');
   assert.match(projected.body,/Your dream, made real/);
 }else{
   // A later legitimate RU edit must be withheld, not break the EN deployment.
   assert.throws(()=>authorizeFulltextSource(entry.number,entry.frozenSha,current,entry.frozenSha,registry),/source_changed/);
 }
});

test('stage9 numeric equivalence accepts Russian word durations only for the same English facts',()=>{
 const pairs=[
  ['Сравните дневной вариант и 2 поездки с ночевкой.','Compare a day trip and two overnight options.'],
  ['Четырнадцатидневную программу можно сравнить с прогулкой.','Compare the 14-day itinerary with an excursion.'],
  ['Фасад XVIII века и трехчасовую программу.','An 18th-century facade and a three-hour programme.'],
  ['В шестидневную программу входит экскурсия.','The excursion forms part of a 6-day itinerary.'],
  ['Шестичасовая поездка стоит $150 на человека.','A 6-hour trip costs $150 per person.'],
  ['32-дневный тур по восьми странам.','A 32-day tour through eight countries.']
 ];
 for(const [ru,en] of pairs)assert.equal(sameSeoLeadNumerals(ru,en),true,ru);
 for(const [ru,en] of [
   ['Шестичасовая поездка стоит $150.','A 7-hour trip costs $150.'],
   ['32-дневный тур по восьми странам.','A 32-day tour through seven countries.'],
   ['Поездка стоит $150.','The trip costs $180.'],
   ['В 2 поездках.','In two trips, using a 4x4.'],
 ])assert.equal(sameSeoLeadNumerals(ru,en),false,ru);
 assert.deepEqual(seoNumberSemanticFacts('XIX век и трехдневный тур','ru'),['19','3']);
});

test('2027 Carnival SEO Word revision is source-bound and preserves exact terms',()=>{
 const row=registry.seoArticleFullRevisions?.find(x=>x.number===2635);
 assert.ok(row);
 const bytes=readFileSync(new URL('../../'+row.path,import.meta.url));
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,row.approvedCurrentSha);
 const src=splitFulltextMarkdown(bytes.toString('utf8'));
 const en=splitFulltextMarkdown(row.enMarkdown);
 assert.equal(en.data.targetPath,src.data.targetPath);
 assert.equal(en.data.kind,src.data.kind);
 assert.equal(en.data.status,src.data.status);
 assert.equal(sameSeoLeadNumerals(src.data.lead,en.data.lead),true);
 assert.doesNotMatch(row.enMarkdown,/[\u0400-\u052f]/u);
 assert.match(en.body,/USD 60,700 for two people/);
 assert.match(en.body,/USD 850 per person/);
 assert.match(en.body,/5–15 February 2027/);
 const links=s=>[...s.matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]).sort();
 assert.deepEqual(links(en.body),links(src.body));
 assert.equal(applyFulltextToSource(bytes.toString('utf8'),row.enMarkdown,'seo_geo_article',actual).status,'applied');
 const auth=authorizeFulltextSource(row.number,row.frozenSha,row.approvedCurrentSha,row.frozenSha,registry);
 assert.equal(auth.compatibleSeoComplete?.approvedCurrentSha,row.approvedCurrentSha);
 assert.throws(()=>authorizeFulltextSource(row.number,row.frozenSha,'a'.repeat(40),row.frozenSha,registry),/source_changed/);
 assert.throws(()=>authorizeFulltextSource(row.number,row.frozenSha,row.approvedCurrentSha,'a'.repeat(40),registry),/source_changed/);
});

test('stage9 source-bound numeral equivalence covers jeep 4×4, historic centuries and ordinal days',()=>{
 for(const [ru,en] of [
  ['На джип-маршруте по Альтиплано.','On a 4×4 route across the Altiplano.'],
  ['Пересечь солончак на внедорожнике.','Cross the salt flats in a 4x4.'],
  ['Историческая фазенда XIX века на седьмой день.','A nineteenth-century estate on day 7.'],
  ['Двенадцатидневный тур.','A twelve-day itinerary.']
 ])assert.equal(sameSeoLeadNumerals(ru,en),true,ru);
 for(const [ru,en] of [
  ['Семь дней на маршруте.','An eight-day journey.'],
  ['Полет длится 15 минут.','The flight lasts 20 minutes.'],
  ['Из аэропорта едем в город.','We travel from the airport in a 4x4.']
 ])assert.equal(sameSeoLeadNumerals(ru,en),false,ru);
});

test('generic source-change refresh uses only a pinned and complete EN revision',()=>{
 const frozen='a'.repeat(40),latest='b'.repeat(40);
 const row={
  number:7056,path:'src/content/people/anna-avanesova.md',
  frozenSha:frozen,approvedCurrentSha:latest,
  enMarkdown:'---\nid: person_anna\nlocale: en\nslug: anna-avanesova\nstatus: approved\nname: Anna Avanesova\n---\n\nThe fully translated biography.\n'
 };
 const config={sourceFullRevisions:[row],countries:[],seoArticleFullRevisions:[],
  personFullRevisions:[],personAppendOnly:[],sourceShaReceipts:[]};
 const result=authorizeFulltextSource(7056,frozen,latest,frozen,config);
 assert.equal(result.compatibleSourceComplete,row);
 assert.equal(result.sourceReconciled,true);
 assert.throws(()=>authorizeFulltextSource(7056,frozen,latest,'c'.repeat(40),config),/source_changed/);
 assert.throws(()=>authorizeFulltextSource(7056,frozen,'d'.repeat(40),frozen,config),/source_changed/);
 assert.throws(()=>authorizeFulltextSource(7056,frozen,latest,frozen,{...config,sourceFullRevisions:[row,row]}),/ambiguous/);
 const ru='---\nid: person_anna\nlocale: ru\nslug: anna-avanesova\nstatus: approved\nname: Анна Аванесова\n---\n\nПолностью новая биография.\n';
 const projected=applyFulltextToSource(ru,row.enMarkdown,'people',latest);
 assert.equal(projected.status,'applied');
 assert.match(projected.content,/The fully translated biography/);
 assert.match(projected.content,/name: Anna Avanesova/);
});
