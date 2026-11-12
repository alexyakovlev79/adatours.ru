import test from 'node:test';
import assert from 'node:assert/strict';
import team from '../../src/data/organization/team.json' with { type: 'json' };
import teamEn from '../../src/data/i18n/team.en.json' with { type: 'json' };
import reviewsEn from '../../src/data/i18n/reviews.en.json' with { type: 'json' };
import orgEn from '../../src/data/i18n/organization.en.json' with { type: 'json' };
import stageFive from '../../src/data/i18n/stage-five-page-copy.en.json' with { type: 'json' };
import { localizedTeamMembers, localizedReviews, localizedOrganization,
  reviewProvenanceNote, caseTestimonialProvenanceNote } from '../../src/lib/i18n/company-proof.mjs';
import { stageFiveText } from '../../src/lib/i18n/stage-five-copy.mjs';
import { translateAuthoredPageText } from '../../src/lib/i18n/page-copy.mjs';

const CYRILLIC = /[\u0400-\u052f]/u;
const enText = (value, field) => {
  assert.equal(typeof value, 'string', field);
  assert.ok(value.trim(), field);
  assert.ok(!CYRILLIC.test(value), field);
};
test('Stage 5 team localises all 9 members without editing canonical RU or media', () => {
  const before = structuredClone(team.members);
  assert.equal(localizedTeamMembers(team.members, 'ru'), team.members);
  const en = localizedTeamMembers(team.members, 'en');
  assert.equal(en.length, 9);
  assert.deepEqual(team.members, before);
  assert.deepEqual(new Set(en.map(x=>x.id)),new Set(team.members.map(x=>x.id)));
  for (let i=0; i<en.length; i++) {
    const member = en[i],ru=team.members[i];
    assert.equal(member.id,ru.id);
    assert.equal(member.photo.src,ru.photo.src);
    assert.equal(member.photo.width,ru.photo.width);
    assert.equal(member.photo.height,ru.photo.height);
    assert.equal(member.paragraphs.length,ru.paragraphs.length);
    for (const [field,value] of [['name',member.name],['role',member.role],['photo.alt',member.photo.alt],['photo.hover',member.photo.hover]])
      enText(value,member.id+'.'+field);
    member.paragraphs.forEach((p,j)=>enText(p,member.id+'.paragraphs.'+j));
  }
  assert.deepEqual(new Set(Object.keys(teamEn.members)),new Set(team.members.map(x=>x.id)));
  assert.throws(()=>localizedTeamMembers(team.members.slice(1),'en'),/ID mismatch/);
});
test('Review excerpts maintain original source language, identity and URLs', () => {
  const ids=Object.keys(reviewsEn.entries);
  const sourceLanguages=Object.fromEntries(ids.map(id=>[id,
    ['review_irina_hernandez_02','review_evgeniya_bykasova_12','review_clients_russo_turisto_21',
     'review_dmitry_romanov_19','review_clients_quinta_tour_06'].includes(id)?'ru':'en']));
  const source=ids.map(id=>({id,author:'Русское имя',segment:'Русская категория',
    ...(reviewsEn.entries[id].route?{route:'Русский маршрут'}:{}),
    text:'Русский отрывок',sourceLanguage:sourceLanguages[id],
    sourceUrl:'https://example.com/source',translated:sourceLanguages[id]==='en'}));
  const before=structuredClone(source);
  assert.equal(localizedReviews(source,'ru'),source);
  const en=localizedReviews(source,'en');
  assert.deepEqual(source,before);
  assert.equal(en.length,12);
  en.forEach((review,i)=>{
    for(const field of ['id','sourceUrl','sourceLanguage','translated'])assert.equal(review[field],source[i][field]);
    ['author','segment','text',...(review.route?['route']:[])].forEach(field=>enText(review[field],review.id+'.'+field));
    enText(reviewProvenanceNote(review,'en'),review.id+'.provenance');
    assert.equal(reviewProvenanceNote(review,'en').includes('Translated from Russian'),review.sourceLanguage==='ru');
  });
  assert.equal(reviewProvenanceNote(source[0],'ru'),source[0].translated?'Перевод с английского.':'');
  assert.match(caseTestimonialProvenanceNote('case_fit_peru_bolivia_complex_trip','en'),/Russian testimonial/);
  assert.equal(caseTestimonialProvenanceNote('unknown','en'),'');
  assert.throws(()=>localizedReviews(source.slice(1),'en'),/ID mismatch/);
});
test('Company values are a display-only projection with preserved numeric facts', () => {
  const source={
    business:{primarySegments:Array(5).fill('ru'),coreCountries:Array(3).fill('ru'),
      micePriorityCountries:Array(4).fill('ru'),b2bPartnerTypes:Array(3).fill('ru')},
    service:{languages:Array(7).fill('ru'),groups:{standard:{display:'40–50',label:'ru',status:'approved'},
      largeEvents:{display:'200–500',label:'ru',status:'approved'},
      miceVip:{display:'2–50',label:'ru',status:'approved'}},
      support:{roundTheClockClaim:null,emergencyModel:'ru'}},
    b2b:{commissionModel:'ru',netRates:true,commercialTermsPerBooking:true},
    claims:{approvedNumeric:Array(4).fill('ru'),blockedUntilConfirmed:['24/7 support']},
    legal:{cnpj:'08.537.782/0001-04'}
  };
  const before=structuredClone(source);
  assert.equal(localizedOrganization(source,'ru'),source);
  const en=localizedOrganization(source,'en');
  assert.deepEqual(source,before);
  assert.equal(en.legal.cnpj,source.legal.cnpj);
  assert.equal(en.b2b.netRates,true);
  assert.equal(en.service.groups.standard.display,'40–50');
  assert.equal(en.service.support.roundTheClockClaim,null);
  assert.deepEqual(en.claims.blockedUntilConfirmed,source.claims.blockedUntilConfirmed);
  for(const label of Object.values(en.service.groups).map(g=>g.label))enText(label,'group label');
  for(const text of [...en.business.primarySegments,...en.service.languages,...Object.values(orgEn.b2b)])enText(text,'company');
});
test('Stage 5 authored copy is unique, language-bound and visible in exact renderer',()=>{
  const seen=new Set();
  for(const {ru,en} of stageFive.messages){
    assert.ok(!seen.has(ru));seen.add(ru);
    enText(en,ru);
    assert.equal(stageFiveText(ru,'en'),en);
    assert.equal(stageFiveText(ru,'ru'),ru);
    assert.equal(translateAuthoredPageText(ru,'en'),en);
  }
  assert.ok(stageFive.messages.length>=90);
  assert.equal(translateAuthoredPageText('Unrelated original text','en'),'Unrelated original text');
});
