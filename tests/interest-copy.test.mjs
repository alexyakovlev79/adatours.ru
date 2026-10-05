import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERESTS, buildInterestHub, buildInterestIndex, countLabel, pluralIndex } from '../src/lib/interest-model.mjs';
import { INTEREST_COPY, interestCopy, interestTourCount, relatedInterestCount, interestCatalogDescription } from '../src/lib/interest-copy.mjs';
const A = 'theme_adventure', N = 'theme_wildlife';
const entity = (id, extra = {}) => ({ data: { id, locale: 'ru', status: 'published', name: id, title: id, slug: id.replaceAll('_', '-'), themes: [], ...extra } });
const themes = INTERESTS.map(row => entity(row.id, row));
const countries = [entity('one'), entity('two')];
const tour = (id, extra = {}) => entity(id, { primaryThemes: [A], countries: ['one'], destinations: ['place'], durationDays: 13, itinerary: [{excursionRef:'excursion'}], hero:{src:`/media/${id}.webp`}, ...extra });
const cases = [[0,2],[1,0],[2,1],[3,1],[4,1],[5,2],[10,2],[11,2],[12,2],[13,2],[14,2],[15,2],[20,2],[21,0],[22,1],[23,1],[24,1],[25,2],[41,0],[100,2],[101,0],[104,1],[110,2],[111,2],[112,2],[114,2],[121,0],[122,1]];
test('every approved interest has independent complete visitor copy and three grammatical forms', () => {
  assert.deepEqual(Object.keys(INTEREST_COPY).sort(), INTERESTS.map(r=>r.id).sort());
  for (const field of ['tourIntro','geographyIntro','catalogIntro']) {
    assert.equal(new Set(INTERESTS.map(r=>interestCopy(r.id)[field])).size,13);
    for (const interest of INTERESTS) assert.ok(interestCopy(interest.id)[field].length > 45);
  }
  for (const row of INTERESTS) assert.equal(interestCopy(row.id).tourForms.length,3);
  assert.throws(()=>interestCopy('unknown'));
});
test('all thirteen complete noun/adjective phrases inflect correctly, including teens and compound counts', () => {
  for (const [n,index] of cases) {
    assert.equal(pluralIndex(n), index);
    for (const {id} of INTERESTS) assert.equal(interestTourCount(id,n),`${n} ${interestCopy(id).tourForms[index]}`);
  }
  assert.equal(interestTourCount(A,5),'5 приключенческих туров');
  assert.equal(interestTourCount(A,4),'4 приключенческих тура');
  assert.equal(interestTourCount(A,21),'21 приключенческий тур');
  assert.equal(interestTourCount('theme_motorcycle',2),'2 мото-тура');
  assert.equal(interestTourCount('theme_motorcycle',11),'11 мото-туров');
  for (const n of [-1,1.5,NaN,Infinity]) assert.throws(()=>countLabel(n), RangeError);
});
test('related-interest sentences agree in both noun and verb', () => {
  assert.equal(relatedInterestCount(41),'41 тур объединяет эти интересы');
  assert.equal(relatedInterestCount(4),'4 тура объединяют эти интересы');
  assert.equal(relatedInterestCount(11),'11 туров объединяют эти интересы');
  assert.equal(relatedInterestCount(101),'101 тур объединяет эти интересы');
  assert.equal(relatedInterestCount(111),'111 туров объединяют эти интересы');
});
test('catalogue lead is individual, uses current total and does not expose internal ranking terminology', () => {
  for (const {id} of INTERESTS) {
    for (const n of [1,2,5,11,21,238]) {
      const text=interestCatalogDescription(id,n);
      assert.ok(text.startsWith(`${interestTourCount(id,n)}. `));
      assert.ok(!text.includes('по выбранному интересу'));
      assert.equal(interestCatalogDescription(id,n,'Бразилия'),`Бразилия: ${text}`);
    }
  }
});
test('interest index includes all 13, counts primary+secondary once and sorts by count then Russian name', () => {
  const tours=[tour('one',{primaryThemes:[N],themes:[A]}),tour('two',{primaryThemes:[N]}),tour('three',{status:'archived'}),tour('four',{status:'draft'}),tour('five',{locale:'en'})];
  const rows=buildInterestIndex(themes,[...tours,tours[0]]);
  assert.equal(rows.length,13);
  assert.deepEqual(rows.slice(0,2).map(r=>[r.entry.data.id,r.tourCount]),[[N,2],[A,1]]);
  for (let i=1;i<rows.length;i++) assert.ok(rows[i-1].tourCount >= rows[i].tourCount);
  const archived=buildInterestIndex(themes,[tour('one',{primaryThemes:[N],themes:[A],status:'archived'}),tours[1]]);
  assert.equal(archived.find(r=>r.entry.data.id===A).tourCount,0);
});
test('country rows retain the exact top thematic tour and change it after archiving or reranking', () => {
  const tours=[tour('top'),tour('second',{durationDays:12}),tour('secondary',{primaryThemes:[N],themes:[A],countries:['one','two']})];
  const get=(list)=>buildInterestHub(A,{tours:list,countries,themes}).allCountries.find(r=>r.entry.data.id==='one');
  assert.equal(get(tours).topTour.data.id,'top');
  assert.equal(get(tours).topTour.data.hero.src,'/media/top.webp');
  assert.equal(get([tour('top',{status:'archived'}),...tours.slice(1)]).topTour.data.id,'second');
  assert.equal(get([tour('top',{durationDays:30}),...tours.slice(1)]).topTour.data.id,'second');
  assert.equal(get([tour('top',{hero:undefined})]).topTour.data.hero,undefined); // no silent second-best image
});
test('archiving one of five tours recalculates all projections and changes five tours to four', () => {
  const tours=Array.from({length:5},(_,i)=>tour(`tour${i}`,{themes:[N]}));
  const content={themes,countries,excursions:[entity('excursion',{country:'one',themes:[A]})],destinations:[entity('place',{countryId:'one',themes:[A]})]};
  for (const [list,count] of [[tours,5],[[...tours.slice(1),tour('tour0',{themes:[N],status:'archived'})],4]]) {
    const hub=buildInterestHub(A,{...content,tours:list});
    assert.equal(hub.allTours.length,count);
    assert.equal(hub.countries[0].tourCount,count);
    for (const experience of hub.allExperiences) assert.equal(experience.tourCount,count);
    assert.equal(hub.relatedThemes[0].tourCount,count);
    assert.equal(interestTourCount(A,count),count===5?'5 приключенческих туров':'4 приключенческих тура');
    assert.equal(buildInterestIndex(themes,list).find(r=>r.entry.data.id===A).tourCount,count);
  }
});
