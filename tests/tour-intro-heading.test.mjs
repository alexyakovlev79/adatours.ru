import test from 'node:test';
import assert from 'node:assert/strict';
import { isMisplacedTourIntroHeading, splitTourIntroHtml } from '../src/lib/tour-intro-heading.mjs';

test('opening price table: service title follows the lead as H3', () => {
  const result = splitTourIntroHtml('\n<h2>Стоимость на человека, USD</h2>\n<table><tr><td>6680</td></tr></table>');
  assert.equal(result.introHeadingHtml, '<h2>О путешествии</h2>');
  assert.match(result.descriptionHtml, /^\s*<h3>Стоимость на человека, USD<\/h3>/);
  assert.match(result.descriptionHtml, /6680/);
  assert.equal(result.relocatedHeading, 'Стоимость на человека, USD');
});
test('pricing, dates and accommodation relocate without losing anchors', () => {
  for (const title of ['Стоимость на 2027 год', 'Стоимость и размещение', 'Цены и даты', 'Тарифы', 'Условия бронирования', 'Что входит в стоимость', 'Размещение и отели']) {
    assert.ok(isMisplacedTourIntroHeading(title), title);
    const result = splitTourIntroHtml('<!-- source -->\n<h2 id="prices">' + title + '</h2>\n<p>Тарифная таблица</p>');
    assert.equal(result.introHeadingHtml, '<h2>О путешествии</h2>');
    assert.match(result.descriptionHtml, /<h3 id="prices">/);
    assert.match(result.descriptionHtml, /Тарифная таблица/);
  }
});
test('editorial title remains H2 above lead', () => {
  const result = splitTourIntroHtml('<h2 id="road">От Карибского моря к городам майя</h2>\n<p>Программа</p>');
  assert.equal(result.introHeadingHtml, '<h2 id="road">От Карибского моря к городам майя</h2>');
  assert.equal(result.relocatedHeading, null);
  assert.match(result.descriptionHtml, /Программа/);
});
test('non-leading H2 stays in the authored body', () => {
  const body = '<p>Вступление</p><h2>Стоимость</h2><p>от $2000</p>';
  const result = splitTourIntroHtml(body);
  assert.equal(result.introHeadingHtml, '<h2>О путешествии</h2>');
  assert.equal(result.descriptionHtml, body);
});
test('empty body safely receives only a neutral heading', () => {
  assert.deepEqual(splitTourIntroHtml(''), {introHeadingHtml:'<h2>О путешествии</h2>', descriptionHtml:'', relocatedHeading:null});
});
