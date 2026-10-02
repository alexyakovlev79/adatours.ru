import test from 'node:test';
import assert from 'node:assert/strict';
import { contentIdentity } from '../src/lib/content-identity.mjs';

test('same English place slug in different countries keeps both content entries', () => {
  const bolivia = { id: 'destination_bolivia_la_pas', locale: 'ru', slug: 'la-paz' };
  const mexico = { id: 'destination_mexico_la_pas', locale: 'ru', slug: 'la-paz' };
  assert.notEqual(contentIdentity({ data: bolivia }), contentIdentity({ data: mexico }));
  assert.equal(contentIdentity({ data: { ...bolivia, slug: 'la-pas' } }), contentIdentity({ data: bolivia }));
});

test('translations share the stable entity ID without overwriting another locale', () => {
  const data = { id: 'country_brazil', locale: 'ru', slug: 'brazil' };
  assert.notEqual(contentIdentity({ data }), contentIdentity({ data: { ...data, locale: 'en' } }));
  assert.throws(() => contentIdentity({ data: { slug: 'brazil', locale: 'ru' } }), /Missing stable/);
  assert.throws(() => contentIdentity({ data: { id: 'country_brazil' } }), /Missing content locale/);
});
