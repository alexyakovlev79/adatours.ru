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
 assert.ok(Object.keys(en.entries).length>=820);
});

test('English image labels also replace matching original figcaption and aria-label',()=>{
 const src='/media/multi-country/antarctica_argentina/hero-generated-20261015-v1.webp';
 const ru='Канал Бигль и антарктический экспедиционный корабль';
 const enLabel='Beagle Channel and an Antarctic expedition ship';
 const doc=parse('<html><body><figure><img src="'+src+'" alt="'+ru+'" aria-label="'+ru+'"><figcaption>'+ru+'</figcaption></figure></body></html>');
 const changed=localizeMediaDocument(doc,{locale:'en'});
 assert.deepEqual(changed,{attributes:2,captions:1});
 const output=serialize(doc);
 assert.ok(output.includes('alt="'+enLabel+'"'),output);
 assert.ok(output.includes('aria-label="'+enLabel+'"'),output);
 assert.ok(output.includes('<figcaption>'+enLabel+'</figcaption>'),output);
 assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:0,captions:0});
});

test('stage six includes 37 new source-bound English media captions without altering previous entries',()=>{
 const rows=Object.entries(en.entries).filter(([,row])=>row.source==='stage6-html-residual-20261113-b7');
 assert.equal(rows.length,37);
 for(const [src,row] of rows){
  assert.equal(row.sourceKey,src);
  assert.ok(src.startsWith('/media/'));
  assert.ok(row.alt.length>=12&&!/[А-Яа-яЁё]/u.test(row.alt));
  assert.equal(localizeMediaField(src,'Русское описание',{locale:'en'}),row.alt);
 }
 assert.ok(Object.keys(en.entries).length>=857);
});

test('stage six continuation keeps source-bound English descriptions for all five batches',()=>{
 const expected={
  'stage6-html-residual-20261113-b8':4,
  'stage6-html-residual-20261113-b9':49,
  'stage6-html-residual-20261113-b10':56,
  'stage6-html-residual-20261113-b11':61,
  'stage6-html-residual-20261113-b12':71
 };
 for(const [source,count] of Object.entries(expected)){
  const rows=Object.entries(en.entries).filter(([,row])=>row.source===source);
  assert.equal(rows.length,count,source);
  for(const [src,row] of rows){
   assert.ok(src.startsWith('/media/'),src);
   assert.equal(row.sourceKey,src);
   assert.ok(row.alt.length>=8&&!/[А-Яа-яЁё]/u.test(row.alt),src);
   assert.equal(mediaEnglishEntry(src),row);
  }
 }
 assert.ok(Object.keys(en.entries).length>=1098);
});

test('stage six resumed batches b13 through b16 are exact source-bound English labels',()=>{
 const expected={
  'stage6-html-residual-20261113-b13':47,
  'stage6-html-residual-20261113-b14':21,
  'stage6-html-residual-20261113-b15':46,
  'stage6-html-residual-20261113-b16':31
 };
 for(const [source,count] of Object.entries(expected)){
  const matching=Object.entries(en.entries).filter(([,item])=>item.source===source);
  assert.equal(matching.length,count,source);
  for(const [src,item] of matching){
   assert.equal(item.sourceKey,src,source+': '+src);
   assert.ok(src.startsWith('/media/'),src);
   assert.ok(item.alt.length>=7&&!/[А-Яа-яЁё]/u.test(item.alt),src);
   assert.equal(localizeMediaField(src,'Русская подпись',{locale:'en'}),item.alt);
  }
 }
 assert.ok(Object.keys(en.entries).length>=1243);
});


test('stage 6.1 preserves 100 additional exact-source media captions',()=>{
 const rows=Object.entries(en.entries).filter(([,row])=>row.source==='stage6-html-residual-20261113-b17');
 assert.equal(rows.length,100);
 for(const [src,row] of rows){
  assert.equal(row.sourceKey,src);
  assert.ok(src.startsWith('/media/'),src);
  assert.ok(row.alt.length>=7&&!/[А-Яа-яЁё]/u.test(row.alt),src);
  assert.equal(localizeMediaField(src,'Русское описание',{locale:'en'}),row.alt);
 }
 assert.ok(Object.keys(en.entries).length>=1343);
});

test('stage 6.5 applies known translations inside noscript and inline figcaption markup',()=>{
 const source=Object.entries(en.entries).find(([,row])=>row.sourceAlt&&/[А-Яа-яЁё]/u.test(row.sourceAlt));
 assert.ok(source,'Need a real source-bound Russian media caption');
 const [src,row]=source;
 const markup='<html><body><figure><img src="'+src+'" alt="'+row.sourceAlt+'" title="'+row.sourceAlt+
  '" aria-label="'+row.sourceAlt+'"><figcaption><span>'+row.sourceAlt+'</span></figcaption></figure>'+
  '<noscript><figure><img src="'+src+'" alt="'+row.sourceAlt+'" title="'+row.sourceAlt+
  '"><figcaption><em>'+row.sourceAlt+'</em></figcaption></figure></noscript></body></html>';
 const doc=parse(markup,{scriptingEnabled:false});
 assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:5,captions:2});
 const output=serialize(doc);
 assert.ok(output.includes('<figcaption><span>'+row.alt+'</span></figcaption>'));
 assert.ok(output.includes('<figcaption><em>'+row.alt+'</em></figcaption>'));
 assert.equal((output.match(/alt="/g)||[]).length,2);
 assert.ok(!output.includes(row.sourceAlt));
 assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:0,captions:0});
});

test('stage 6.5 translates exact image-only link labels but protects unrelated text',()=>{
 const source=Object.entries(en.entries).find(([,row])=>row.sourceAlt&&/[А-Яа-яЁё]/u.test(row.sourceAlt));
 const [src,row]=source;
 const doc=parse('<html><body><a href="/test" title="'+row.sourceAlt+'" aria-label="'+row.sourceAlt+
  '"><img src="'+src+'" alt="'+row.sourceAlt+'"></a><a href="/other" aria-label="Открыть экскурсию">'+
  '<img src="'+src+'" alt="'+row.alt+'"></a><p>'+row.sourceAlt+'</p></body></html>');
 assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:3,captions:0});
 const output=serialize(doc);
 assert.ok(output.includes('title="'+row.alt+'" aria-label="'+row.alt+'"'));
 assert.ok(output.includes('aria-label="Открыть экскурсию"'));
 assert.ok(output.includes('<p>'+row.sourceAlt+'</p>'));
 assert.deepEqual(localizeMediaDocument(doc,{locale:'en'}),{attributes:0,captions:0});
});

test('stage 6.5 keeps all 1944 exact image keys and translates no Russian values twice',()=>{
 assert.ok(Object.keys(en.entries).length>=1944);
 for(const [src,row] of Object.entries(en.entries)){
   if(['multi-country-heroes','catalog-hero-overrides'].includes(row.source))
     assert.ok(typeof row.sourceKey==='string'&&row.sourceKey.length>0,src);
   else assert.equal(row.sourceKey,src);
   assert.ok(src.startsWith('/media/'),src);
   assert.ok(typeof row.alt==='string'&&row.alt.trim()&& !/[А-Яа-яЁё]/u.test(row.alt),src);
   assert.equal(mediaEnglishEntry(src),row);
   assert.equal(localizeMediaField(src,row.alt,{locale:'en'}),row.alt);
 }
});


test('stage 9: Anna Avanesova supplied portrait has an exact English source-bound alt',()=>{
 const src='/media/people/anna-avanesova/photo-provided-20261009-v1.jpg';
 const translated='Portrait of Anna Avanesova, founder of Ada Tours';
 assert.equal(mediaEnglishEntry(src).alt,translated);
 assert.equal(localizeMediaField(src,'Портрет Анны Аванесовой, основательницы Ada Tours',{locale:'en'}),translated);
 assert.equal(localizeMediaField(src,'Портрет Анны Аванесовой, основательницы Ada Tours',{locale:'ru'}),'Портрет Анны Аванесовой, основательницы Ada Tours');
});

test('P155 Carnival Alagoas media uses only two exact source-bound EN alts and noscript duplicates',()=>{
 const rows=[
  ['/media/destinations/destination_brazil_alagoas/destination_brazil_alagoas-generated-20261008.webp','Светлый пляж с пальмами и прозрачным мелководьем в Алагоасе, Бразилия','Bright beach with palm trees and clear shallow water in Alagoas, Brazil'],
  ['/media/destinations/destination_brazil_masejo/destination_brazil_masejo-generated-20261008.webp','Пляж Масейо с пальмами и высотными домами у прозрачного моря, Бразилия','Maceió beach with palm trees and high-rise buildings beside clear water, Brazil']
 ];
 for(const [src,ru,enAlt] of rows){
  const record=mediaEnglishEntry(src);
  assert.equal(record.source,'stage9-p155-word-tour-media-20261114');
  assert.equal(record.sourceAlt,ru);
  assert.equal(record.alt,enAlt);
  const tag='<img src="https://img.adatours.ru'+src+'" alt="'+ru+'" title="'+ru+'">';
  const html='<html><body><figure>'+tag+'<noscript>'+tag+'</noscript></figure></body></html>';
  const doc=parse(html,{scriptingEnabled:false});
  const count=localizeMediaDocument(doc,{locale:'en'});
  assert.ok(count.attributes>=4,src);
  const serialized=serialize(doc);
  assert.equal(serialized.includes('alt="'+ru+'"'),false);
  assert.equal(serialized.split('alt="'+enAlt+'"').length,3);
 }
});
