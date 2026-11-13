import test from 'node:test';
import assert from 'node:assert/strict';
import {parse, serialize} from 'parse5';
import coversMulti from '../../src/data/media/multi-country-heroes.json' with {type:'json'};
import coversCatalog from '../../src/data/media/catalog-hero-overrides.json' with {type:'json'};
import en from '../../src/data/i18n/media-captions.en.json' with {type:'json'};
import {localizeMediaField,localizeMediaDocument,mediaEnglishEntry,collectRenderedEnglishMediaLabels,unambiguousEnglishMediaLabels} from '../../src/lib/i18n/media-copy.mjs';

const originalRows=[
  ...Object.entries(coversMulti.covers).map(([key,value])=>['multi-country-heroes',key,value]),
  ...Object.entries(coversCatalog.covers).map(([key,value])=>['catalog-hero-overrides',key,value]),
];

test('all 319 multi-country and 31 catalog photo descriptions have exact source-bound English',()=>{
  assert.equal(Object.keys(coversMulti.covers).length,319);
  assert.equal(Object.keys(coversCatalog.covers).length,31);
  assert.ok(Object.keys(en.entries).length>=350);
  const sources=new Set(),paths=new Set();
  for(const [source,sourceKey,photo] of originalRows){
    const item=en.entries[photo.src];
    assert.ok(item,'Missing EN photo '+photo.src);
    assert.ok(!paths.has(photo.src),'Duplicate photo src '+photo.src);paths.add(photo.src);
    assert.equal(item.source,source);
    assert.equal(item.sourceKey,sourceKey);
    assert.equal(item.sourceAlt,photo.alt);
    assert.ok(item.alt.length>=8&& !/[А-Яа-яЁё]/u.test(item.alt),'Untranslated photo '+photo.src);
    assert.equal(mediaEnglishEntry(photo.src),item);
    sources.add(source);
  }
  assert.deepEqual([...sources].sort(),['catalog-hero-overrides','multi-country-heroes']);
});

test('EN-only media resolver preserves approved English, decorative alt and URLs',()=>{
  const row=Object.entries(coversMulti.covers)[0][1];
  const expected=en.entries[row.src].alt;
  assert.equal(localizeMediaField(row.src,row.alt,{locale:'en'}),expected);
  assert.equal(localizeMediaField('https://img.adatours.ru'+row.src,row.alt,{locale:'en'}),expected);
  assert.equal(localizeMediaField('/adatours-en'+row.src,row.alt,{locale:'en'}),expected);
  assert.equal(localizeMediaField(row.src,row.alt,{locale:'ru'}),row.alt);
  assert.equal(localizeMediaField(row.src,'',{locale:'en'}),'');
  assert.equal(localizeMediaField(row.src,row.alt,{locale:'en',decorative:true}),row.alt);
  assert.equal(localizeMediaField(row.src,expected,{locale:'en'}),expected);
  assert.equal(localizeMediaField('/media/unlisted.webp',row.alt,{locale:'en'}),row.alt);
  assert.equal(localizeMediaField('https://other.example'+row.src,row.alt,{locale:'en'}),row.alt);
});

test('HTML pass changes only attached visible alt, hover and exact caption',()=>{
  const first=Object.entries(coversCatalog.covers)[0][1],english=en.entries[first.src].alt;
  const same=first.alt;
  const source=`<!doctype html><html><head></head><body><figure><img src="/adatours-en${first.src}" alt="${same}" title="${same}"><figcaption>${same}</figcaption></figure><figure><img src="/adatours-en${first.src}" alt="" aria-hidden="true"></figure><p>${same}</p></body></html>`;
  const doc=parse(source);
  assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:2,captions:1});
  const after=serialize(doc);
  assert.ok(after.includes(`alt="${english}"`));
  assert.ok(after.includes(`title="${english}"`));
  assert.ok(after.includes(`<figcaption>${english}</figcaption>`));
  assert.ok(after.includes('<img src="/adatours-en'+first.src+'" alt="" aria-hidden="true">'));
  assert.ok(after.includes('<p>'+same+'</p>'));
  assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:0,captions:0});
});

test('mobile crop technical registry notes are not localized by media labels',()=>{
  assert.equal(mediaEnglishEntry('/media/hero-mobile-swarm/not-a-source.webp'),null);
  assert.equal(localizeMediaField('/media/hero-mobile-swarm/not-a-source.webp','Обрезка кадра',{locale:'en'}),'Обрезка кадра');
});


test('published English alt can be reused only for the identical media source',()=>{
  const src='/media/destinations/example/gallery-01.webp';
  const html='<img data-lazy-src="/adatours-en'+src+'" alt="Lush tropical forest and a winding river">'+
    '<img src="/adatours-en'+src+'" alt="Lush tropical forest and a winding river">';
  const labels=unambiguousEnglishMediaLabels(collectRenderedEnglishMediaLabels(html));
  assert.equal(labels.get(src),'Lush tropical forest and a winding river');
  const ru='<figure><img src="data:image/svg+xml,placeholder" data-lazy-src="/adatours-en'+src+
    '" alt="Тропический лес и извилистая река" title="Тропический лес и извилистая река"></figure>';
  const doc=parse(ru);
  assert.deepEqual(localizeMediaDocument(doc,{reusedLabels:labels}),{attributes:2,captions:0});
  assert.match(serialize(doc),/alt="Lush tropical forest and a winding river"/);
  assert.equal(localizeMediaField(src,'Тропический лес',{locale:'ru',reusedLabels:labels}),'Тропический лес');
  assert.equal(localizeMediaField('/media/another.webp','Тропический лес',{reusedLabels:labels}),'Тропический лес');
  const ambiguous=collectRenderedEnglishMediaLabels('<img src="'+src+'" alt="Another tropical forest scene">',collectRenderedEnglishMediaLabels(html));
  assert.equal(unambiguousEnglishMediaLabels(ambiguous).has(src),false);
});

test('stage-six source-bound extension includes 76 curated descriptions',()=>{
 const rows=Object.entries(en.entries).filter(([,entry])=>entry.source==='stage6-rendered-en-audit');
 assert.equal(rows.length,76);
 for(const [src,row] of rows){
  assert.ok(src.startsWith('/media/'));
  assert.equal(row.sourceKey,src);
  assert.ok(row.alt.length>=15&&!/[А-Яа-яЁё]/u.test(row.alt));
  assert.equal(mediaEnglishEntry(src),row);
 }
});

test('stage six retains 67 independently translated second-batch image sources',()=>{
 const rows=Object.entries(en.entries).filter(([,v])=>v.source==='stage6-rendered-en-audit-b2');
 assert.equal(rows.length,67);
 for(const [src,entry] of rows){
  assert.equal(entry.sourceKey,src);
  assert.ok(entry.alt.length>=12&&!/[А-Яа-яЁё]/u.test(entry.alt));
  assert.equal(mediaEnglishEntry(src),entry);
 }
});

test('third through sixth stage-six batches keep 327 exact image-owned translations',()=>{
 const expected={
  'stage6-html-residual-20261113-b3':51,
  'stage6-html-residual-20261113-b4':72,
  'stage6-html-residual-20261113-b5':91,
  'stage6-html-residual-20261113-b6':113
 };
 for(const [source,count] of Object.entries(expected)){
  const rows=Object.entries(en.entries).filter(([,record])=>record.source===source);
  assert.equal(rows.length,count,source+' changed');
  for(const [src,record] of rows){
   assert.ok(src.startsWith('/media/'),src);
   assert.equal(record.sourceKey,src);
   assert.ok(typeof record.alt==='string'&&record.alt.length>=8&&!/[А-Яа-яЁё]/u.test(record.alt),src);
   assert.equal(mediaEnglishEntry(src),record);
   assert.equal(localizeMediaField(src,'Русская подпись',{locale:'en'}),record.alt);
  }
 }
 assert.equal(Object.keys(en.entries).length,820);
});
