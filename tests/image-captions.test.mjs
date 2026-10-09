import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCaption, isDescription, logicalImagePath, selectCaption, hoverFromAlt, captionVariants, diversifyCaptions } from '../scripts/lib/image-captions.mjs';
import { captionOverrideResult } from '../scripts/lib/image-captions.mjs';
import { createCaptionLookup } from '../src/lib/image-captions.mjs';

test('visual evidence survives normalization; text evidence cannot silently claim a visual review', () => {
  const row = { src: '/media/a.webp', alt: 'Река и лес', hover: 'Лес у реки', evidence: [{ ref: 'notes.json#scene', quote: 'Река и лес' }] };
  assert.equal(captionOverrideResult(row).visuallyReviewed, false);
  assert.throws(() => captionOverrideResult({ ...row, visuallyReviewed: true }), /exact image URL/);
  const reviewed = captionOverrideResult({ ...row, visuallyReviewed: true, evidence: [{ ref: 'https://img.adatours.ru/media/a.webp', quote: 'Река и лес' }] });
  assert.equal(reviewed.visuallyReviewed, true);
  assert.equal(reviewed.status, 'visually_reviewed');
  assert.equal(reviewed.basis, 'visual_review');
  const images = [{ ...reviewed, src: row.src, sourceImages: [], generationRefs: [], activeUses: 1 }];
  diversifyCaptions(images);
  assert.equal(images[0].visuallyReviewed, true);
  assert.deepEqual(images[0].reviewReasons, []);
});

test('reused and string media get the exact override; decorative images stay empty', () => {
  const lookup = createCaptionLookup([{ src: '/media/a.webp', alt: 'Река и лес', hover: 'Лес у реки', evidence: [{ ref: 'notes.json', quote: 'Река' }] }]);
  assert.deepEqual(lookup('/media/a.webp'), { alt: 'Река и лес', hover: 'Лес у реки' });
  assert.deepEqual(lookup('https://img.adatours.ru/media/a.webp', { alt: 'Ошибочный маршрут' }), lookup('/media/a.webp'));
  assert.deepEqual(lookup('/media/a.webp', {}, { decorative: true }), { alt: '', hover: undefined });
  assert.deepEqual(lookup('https://other.test/a.webp', { alt: 'Исходная подпись' }), { alt: 'Исходная подпись', hover: undefined });
  assert.deepEqual(lookup('/media/unknown.webp'), { alt: '', hover: undefined });
});

test('image identity unifies our CDN only and preserves exact donor URLs', () => {
  assert.equal(logicalImagePath('https://img.adatours.ru/media/a.webp'), '/media/a.webp');
  assert.equal(logicalImagePath('public/media/a.webp'), '/media/a.webp');
  assert.notEqual(logicalImagePath('https://donor/a.jpg?w=1'), logicalImagePath('https://donor/a.jpg?w=2'));
});
test('commercial title and gallery ordinal are not scene descriptions', () => {
  assert.equal(isDescription('Роскошная Бразилия', { type: 'tour', name: 'Роскошная Бразилия' }), false);
  assert.equal(isDescription('Ольгин: фото 2'), false);
  assert.equal(isDescription('Пляж Копакабана, Рио-де-Жанейро'), true);
  assert.equal(cleanCaption('На фото:снорклинг в реке'), 'снорклинг в реке');
});
test('incompatible accounts of a shared image remain a draft conflict', () => {
  const result = selectCaption([
    { text: 'Каньон Колка в Перу', rank: 70, ref: 'one', kind: 'production_alt' },
    { text: 'Солнечный остров в Боливии', rank: 70, ref: 'two', kind: 'production_alt' },
  ]);
  assert.equal(result.status, 'text_conflict');
  assert.equal(result.evidence.length, 2);
});
test('a generation description takes precedence over inherited tour label', () => {
  const result = selectCaption([
    { text: 'Копакабана: пляж и мозаичная набережная', rank: 95, ref: 'prompt', kind: 'generation_description' },
    { text: 'Рио-де-Жанейро', rank: 55, ref: 'old', kind: 'inherited_source_alt' },
  ]);
  assert.equal(result.status, 'source_described');
  assert.equal(result.basis, 'generation_description');
  assert.equal(result.alt, 'Копакабана: пляж и мозаичная набережная');
  assert.equal(hoverFromAlt('Вид на залив Гуанабара'), 'Вид на залив Гуанабара');
});
test('Russian paraphrases preserve place and grammatical forms without adding scene details', () => {
  assert.deepEqual(captionVariants('Водопады Игуасу в Бразилии'), ['Водопады Игуасу в Бразилии', 'Водопады Игуасу, Бразилия', 'Бразилия: водопады Игуасу']);
  assert.equal(hoverFromAlt('Панорама Рио-де-Жанейро'), 'Панорамный вид Рио-де-Жанейро');
  assert.equal(hoverFromAlt('Вид на статую Христа'), 'Вид на статую Христа');
});
test('different originals sharing a description may use variants without entering the review queue', () => {
  const row = (src, sourceImages = []) => ({src, sourceImages, generationRefs:[], alt:'Водопады Игуасу в Бразилии', hover:'', status:'source_described', basis:'production_alt', activeUses:1});
  const images = [row('/a.webp',['/original-a.jpg']),row('/a-copy.webp',['/original-a.jpg']),row('/b.webp',['/original-b.jpg'])];
  const result = diversifyCaptions(images);
  assert.equal(result.sharedDescriptionGroups,1);
  assert.equal(images[0].alt,images[1].alt);
  assert.notEqual(images[0].alt,images[2].alt);
  assert(images.every(r=>r.reviewReasons.length === 0));
});
test('alternative generated scene retains separate identity even with the same donor', () => {
  const images = ['/a.webp','/b.webp'].map(src=>({src,sourceImages:['/donor.jpg'],generationRefs:[{prompt:'Create a different scene at this location'}],alt:'Панорама Рио-де-Жанейро',hover:'',status:'source_described',basis:'production_alt',activeUses:1}));
  diversifyCaptions(images);
  assert.notEqual(images[0].captionIdentity,images[1].captionIdentity);
  assert(images.every(r=>r.reviewReasons.length === 0));
});
test('repeated descriptions preserve genuine conflict and missing-source review reasons', () => {
  const images = ['source_described','text_conflict','context_only','missing_description'].map((status,i)=>({src:`/${i}.webp`,sourceImages:[],generationRefs:[],alt:'Панорама Рио-де-Жанейро',hover:'',status,basis:'production_alt',activeUses:1}));
  diversifyCaptions(images);
  assert.deepEqual(images.map(r=>r.reviewReasons),[[],['text_conflict'],['context_only'],['missing_description']]);
});
