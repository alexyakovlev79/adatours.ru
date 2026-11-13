import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';
import {translateEnglishCatalogueMeta,localizeSharedUiDocument} from '../../src/lib/i18n/shared-ui-html.mjs';
import {translateAuthoredPageText} from '../../src/lib/i18n/page-copy.mjs';
import ui from '../../src/data/i18n/ui-copy.json' with {type:'json'};

test('stage9 port: add only genuinely new UI labels without changing prior translations',()=>{
  assert.equal(translateUiText('Станция','en'),'Station');
  assert.equal(translateUiText('Винодельня','en'),'Winery');
  assert.equal(translateUiText('Остров','en'),'Island');
  assert.equal(translateUiText('Остров','ru'),'Остров');
  assert.equal(ui.messages['stage9.taxonomy.island'].en,'Island');
});

test('stage9 port: catalogue metadata translates exact visitor labels, duration and price prefix',()=>{
  const ru='Пляж · 3 часа · от $150';
  assert.equal(translateEnglishCatalogueMeta(ru,'en'),'Beach · 3 hours · from $150');
  assert.equal(translateEnglishCatalogueMeta(ru,'ru'),ru);
  const doc=parse('<html lang="en"><body><p class="catalog-meta">'+ru+'</p></body></html>');
  assert.ok(localizeSharedUiDocument(doc,{locale:'en'})>0);
  assert.match(serialize(doc),/Beach · 3 hours · from \$150/);
});

test('stage9 port: exact editorial titles have EN copy and no RU source mutation',()=>{
  const ru='Аргентина и Бразилия: От льда к солнцу';
  assert.equal(translateAuthoredPageText(ru,'en'),'Argentina and Brazil: From Ice to Sunshine');
  assert.equal(translateAuthoredPageText(ru,'ru'),ru);
  assert.equal(translateAuthoredPageText('Непереведенный источник','en'),'Непереведенный источник');
});
