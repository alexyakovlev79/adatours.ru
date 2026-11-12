import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyFulltextToSource,splitFulltextMarkdown} from '../../scripts/i18n/materialize-fulltext-en.mjs';
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
 assert.equal(registry.ruLocaleInEnglish.length,19);
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
