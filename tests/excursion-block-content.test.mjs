import test from 'node:test';
import assert from 'node:assert/strict';
import { excursionBlockContent } from '../src/lib/excursion-block-content.mjs';

test('Word variant uses its own title and complete text without changing the canonical product', () => {
  const canonical = Object.freeze({title:'Сахарная Голова: 4 часа',lead:'Каноническое описание',priceFrom:80});
  const block = Object.freeze({title:'  Сахарная Голова: полдня  ',text:'Урка и канатная дорога.\n\nПосле спуска — город.'});
  assert.deepEqual(excursionBlockContent(block,canonical),{
    title:'Сахарная Голова: полдня',overrideText:block.text,summary:block.text,
  });
  assert.equal(canonical.title,'Сахарная Голова: 4 часа');
  assert.equal(canonical.priceFrom,80);
});

test('absent or blank overrides preserve canonical fallback and permit title-only variants', () => {
  const canonical={title:'Лима',lead:'Центр города'};
  for (const block of [{},{title:'  ',text:'\n '},{title:null,text:undefined}]) {
    assert.deepEqual(excursionBlockContent(block,canonical),{title:'Лима',overrideText:null,summary:'Центр города'});
  }
  assert.deepEqual(excursionBlockContent({title:'Лима перед вылетом'},canonical),{
    title:'Лима перед вылетом',overrideText:null,summary:'Центр города',
  });
});

test('override remains plain text and never becomes trusted HTML', () => {
  const text='<script>alert(1)</script>\n\n**Входные билеты включены**';
  const result=excursionBlockContent({title:'<img src=x onerror=alert(1)>',text},{title:'Fallback',lead:'Fallback'});
  assert.equal(result.overrideText,text);
  assert.equal(result.summary,text);
  assert.deepEqual(Object.keys(result),['title','overrideText','summary']);
  assert.equal('bodyHtml' in result,false);
});
