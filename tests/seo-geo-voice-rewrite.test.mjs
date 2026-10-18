import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVoiceRewrite, eligiblePublishedRows, newClaim, articlePath, possibleThirdPartyVoice,
} from '../src/lib/seo-geo-voice-rewrite.mjs';

const original=[
  '---',
  'targetPath: /vip/costa-rica/',
  'kind: vip_country',
  'status: approved',
  'buttonLabel: "VIP-туры"',
  'lead: >-',
  '  В программе указаны 13 дней маршрута.',
  '---',
  '',
  '## Как выбрать поездку',
  '',
  'В актуальной подборке представлены {{catalog.toursCountPhrase}}.',
  '',
  'В программе указаны 13 дней, **частный** формат и [Корковадо](/costa-rica/place/corcovado-national-park/).',
  '',
  '| Программа | Длительность |',
  '|---|---|',
  '| [Тур](/costa-rica/tour/test/) | 13 дней |',
  '',
  '### Частые вопросы',
  '',
  '#### Вопрос?',
  '',
  'В программе указан трансфер.',
  '',
  '- [Ссылка](/costa-rica/) остается прежней.',
  '',
].join('\n');
const adjusted=original
  .replace('В программе указаны 13 дней маршрута.', 'В нашем маршруте вас ждут 13 дней путешествия.')
  .replace('В актуальной подборке представлены', 'В VIP-подборке Ada Tours вы найдете')
  .replace('В программе указаны 13 дней,', 'Мы предлагаем поездку на 13 дней,')
  .replace('В программе указан трансфер.', 'Мы включили в эту программу трансфер.');

test('minimal changes to public prose and existing lead pass while metadata/links remain fixed',()=>{
  const found=validateVoiceRewrite(original,adjusted,'/vip/costa-rica/');
  assert.equal(found.changed,true);
  assert.equal(found.leadChanged,true);
  assert.equal(found.changedLines,3);
  assert.equal(articlePath('/vip/costa-rica/'),'data/seo-geo/articles/vip/costa-rica/index.md');
});
test('already suitable article passes as a no-change review',()=>{
  const found=validateVoiceRewrite(original,original,'/vip/costa-rica/');
  assert.equal(found.changed,false);
});
test('link href and link anchor cannot be modified',()=>{
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('/costa-rica/place/corcovado-national-park/','/costa-rica/'),
    '/vip/costa-rica/'),/hyperlink/);
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('[Корковадо]','[Парк Корковадо]'),
    '/vip/costa-rica/'),/hyperlink/);
});
test('no edits to any table or heading',()=>{
  assert.throws(()=>validateVoiceRewrite(original,adjusted.replace('Длительность','Дни'),
    '/vip/costa-rica/'),/fixed heading, table/);
  assert.throws(()=>validateVoiceRewrite(original,adjusted.replace('## Как выбрать','## Выбираем'),
    '/vip/costa-rica/'),/fixed heading, table/);
});
test('numeric data and shortcodes must remain intact',()=>{
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('13 дней, **частный**','14 дней, **частный**'),
    '/vip/costa-rica/'),/number, price or date/);
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('{{catalog.toursCountPhrase}}','{{catalog.minUsdPriceLabel}}'),
    '/vip/costa-rica/'),/hyperlink, shortcode/);
});
test('technical fields, paragraphs, list markers and bold markers cannot change',()=>{
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('kind: vip_country','kind: tours'),
    '/vip/costa-rica/'),/frontmatter/);
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('### Частые вопросы','### Частые вопросы\n\nЕще один абзац.'),
    '/vip/costa-rica/'),/paragraphs/);
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('**частный**','частный'),
    '/vip/costa-rica/'),/markup/);
  assert.throws(()=>validateVoiceRewrite(original,
    adjusted.replace('- [Ссылка]','1. [Ссылка]'),
    '/vip/costa-rica/'),/list/);
});
test('publisher/writer queue handles only published, active, unlocked, not prepared',()=>{
  const t=Date.parse('2026-10-18T10:00:00Z');
  const phases=[{entries:[
    {url:'/one/',work:'published',order:2,phase:1},
    {url:'/two/',work:'published',order:1,phase:1},
    {url:'/three/',work:'rewritten',order:3,phase:1},
    {url:'/four/',work:'published',order:4,phase:1,availability:'archived'},
    {url:'/five/',work:'published',order:5,phase:1}
  ]}];
  const claims={'/one/':{expiresAt:'2026-10-18T10:01:00Z'},
    '/two/':{expiresAt:'2026-10-18T09:59:00Z'}};
  const rows=eligiblePublishedRows(phases,claims,{'/five/':{status:'ready'}},t,10);
  assert.deepEqual(rows.map(x=>x.url),['/two/']);
});
test('lease expires precisely at 30 minutes; one chat has ten cycles',()=>{
  const t=Date.parse('2026-10-18T10:00:00Z');
  const c=newClaim('rewrite-example-20261018',10,t);
  assert.equal(Date.parse(c.expiresAt)-Date.parse(c.claimedAt),1800000);
  assert.throws(()=>newClaim('rewrite-example-20261018',11,t),/cycle/);
  assert.throws(()=>eligiblePublishedRows([],{}, {},t,11),/batch size/);
});
test('helper identifies external-narrator phrases for editorial review',()=>{
  assert.ok(possibleThirdPartyVoice('Ниже приведены опубликованные туры.').length);
});
