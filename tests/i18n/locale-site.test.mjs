import test from 'node:test';
import assert from 'node:assert/strict';
import { localeSite, localeUrl, validateOrigin, validateBase, languageAlternates, localizedOrganizationIdentity,
  assertPublicLocaleRelease, translationRelations } from '../../src/lib/i18n/locale-site.mjs';
import { uiText, validateUiCatalog, localizedNavigation, countInEnglish } from '../../src/lib/i18n/messages.mjs';

test('candidate English host can change without changing IDs, routes or media', () => {
  const before = localeSite('en');
  const after = localeSite('en', { origin: 'https://travel.example.org', base: '/preview/', preview: true });
  assert.equal(localeUrl('/brazil/tour/rio/', before), 'https://adatours.com/brazil/tour/rio/');
  assert.equal(localeUrl('/brazil/tour/rio/', after), 'https://travel.example.org/preview/brazil/tour/rio/');
  assert.equal(before.entityOrigin, after.entityOrigin);
  assert.equal(before.mediaOrigin, after.mediaOrigin);
  assert.equal(after.indexable, false);
  assert.equal(before.indexable, false);
});

test('invalid origins and canonical route injection are rejected', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?q=x', 'javascript:alert(1)']) {
    assert.throws(() => validateOrigin(value));
  }
  for (const value of ['//foreign.example/', '/x/../y/', '/%2e%2e/', '/x?lang=en', '/x#x', 'https://example.com']) {
    assert.throws(() => localeUrl(value, localeSite('ru')));
  }
  assert.throws(() => localeSite('en', { releaseState: 'published' }));
});

test('unreleased English pages never produce public hreflang', () => {
  const variants = [
    { entityId: 'tour_x', locale: 'ru', path: '/brazil/tour/rio/', url: 'https://adatours.ru/brazil/tour/rio/', state: 'published', deployReceipt: 'ru-release-1' },
    { entityId: 'tour_x', locale: 'en', path: '/brazil/tour/rio/', url: 'https://adatours.com/brazil/tour/rio/', state: 'published', deployReceipt: 'unverified-en' },
  ];
  assert.deepEqual(languageAlternates('tour_x', variants), [{ hreflang: 'ru', href: variants[0].url }]);
  assert.deepEqual(languageAlternates('another_tour', variants), []);
  assert.throws(() => assertPublicLocaleRelease(localeSite('en'), {}));
  assert.throws(() => assertPublicLocaleRelease(localeSite('ru'), { content: true }));
});

test('enabled paired release requires exact URLs and deploy evidence', () => {
  const sites = { en: { ...localeSite('en'), indexable: true, releaseState: 'published' } };
  const variant = { entityId: 'tour_x', locale: 'en', path: '/brazil/tour/rio/', url: 'https://adatours.com/brazil/tour/rio/', state: 'published', deployReceipt: 'en-verified-release' };
  assert.equal(languageAlternates('tour_x', [variant], sites).length, 1);
  assert.deepEqual(languageAlternates('tour_x', [{ ...variant, deployReceipt: null }], sites), []);
  assert.throws(() => languageAlternates('tour_x', [{ ...variant, url: 'https://old.example/x' }], sites));
  assert.throws(() => languageAlternates('tour_x', [variant, variant], sites));
});

test('English organization points to RU while translations use CreativeWork relations', () => {
  const org = localizedOrganizationIdentity('en', ['https://profile.example/ada', 'https://adatours.com/']);
  assert.equal(org['@id'], 'https://adatours.ru/#organization');
  assert.deepEqual(org.sameAs, ['https://profile.example/ada', 'https://adatours.ru/']);
  const pair = [{ entityId: 'tour_a', locale: 'ru', webPageId: 'https://adatours.ru/a/#webpage', state: 'published', deployReceipt: 'ru-release' },
    { entityId: 'tour_a', locale: 'en', webPageId: 'https://adatours.com/a/#webpage', state: 'published', deployReceipt: 'en-release',
      approvedTranslationOfWorkId: 'https://adatours.ru/a/#webpage' }];
  assert.deepEqual(translationRelations('en', pair), { translationOfWork: { '@id': pair[0].webPageId } });
  assert.deepEqual(translationRelations('ru', pair), { workTranslation: [{ '@id': pair[1].webPageId }] });
  assert.deepEqual(translationRelations('en', [pair[1]]), {});
});

test('all UI messages retain parameters and missing translations never fall back', () => {
  assert.deepEqual(validateUiCatalog(), []);
  assert.equal(uiText('en', 'pagination.showing', { from: 1, to: 10, total: 58 }), 'Showing 1–10 of 58');
  assert.throws(() => uiText('en', 'missing.key'));
  assert.throws(() => uiText('en', 'pagination.showing', { from: 1, to: 10 }));
  assert.throws(() => uiText('en', 'cta.enquire', { extra: 'x' }));
  assert.throws(() => uiText('de', 'cta.enquire'));
  assert.equal(countInEnglish(0, 'tour', 'tours'), '0 tours');
  assert.equal(countInEnglish(1, 'country', 'countries'), '1 country');
  assert.equal(countInEnglish(22, 'country', 'countries'), '22 countries');
});

test('URL normalization cannot turn whitespace, encoded separators or dot segments into another host', () => {
  for (const path of ['/\t/foreign.example/', '/\r/foreign.example/', '/\n/foreign.example/',
    '/a/./b/', '/a//b/', '/%252f%252fforeign.example/', '/%252e%252e/', '/%3fpreview=1/', '/%23fragment/', '/%00/']) {
    assert.throws(() => localeUrl(path, localeSite('ru')), path);
    assert.throws(() => validateBase(path), path);
  }
  assert.throws(() => validateOrigin('https://adatours.ru/\n'));
});

test('alternate origin/base defaults to preview and cannot silently inherit public RU status', () => {
  const alternate = localeSite('ru', { origin: 'https://preview.example.org' });
  assert.equal(alternate.preview, true);
  assert.equal(alternate.indexable, false);
  assert.throws(() => localeSite('ru', { origin: 'https://preview.example.org', preview: false }));
  assert.throws(() => localeSite('en', { preview: 'false' }));
  assert.throws(() => localeSite('ru', Object.create({ origin: 'https://foreign.example' })));
  assert.throws(() => assertPublicLocaleRelease(alternate, {
    content: true, ui: true, metadata: true, schema: true, links: true, search: true, forms: true,
  }));
});

test('published alternates require matching locale, explicit release state and nonempty receipt', () => {
  const variant = { entityId: 'tour_x', locale: 'en', path: '/a/', url: 'https://adatours.com/a/',
    state: 'published', deployReceipt: 'en-verified-release' };
  assert.deepEqual(languageAlternates('tour_x', [variant], {
    en: { ...localeSite('en'), indexable: true },
  }), [], 'indexable alone cannot override planned state');
  const sites = { en: { ...localeSite('en'), indexable: true, releaseState: 'published' } };
  assert.deepEqual(languageAlternates('tour_x', [{ ...variant, deployReceipt: true }], sites), []);
  assert.deepEqual(languageAlternates('tour_x', [{ ...variant, deployReceipt: '  ' }], sites), []);
  assert.throws(() => languageAlternates('tour_x', [variant], { en: localeSite('ru') }), /locale mismatch/);
});

test('CreativeWork translation relations reject unpublished or different-entity counterparts', () => {
  const ru = { entityId: 'tour_a', locale: 'ru', webPageId: 'https://adatours.ru/a/#webpage', state: 'published', deployReceipt: 'ru-release' };
  const en = { entityId: 'tour_a', locale: 'en', webPageId: 'https://adatours.com/a/#webpage', state: 'planned' };
  assert.deepEqual(translationRelations('ru', [ru, en]), {});
  assert.deepEqual(translationRelations('en', [ru, en]), {});
  assert.throws(() => translationRelations('ru', [ru, { ...en, entityId: 'tour_b', state: 'published', deployReceipt: 'en-release' }]), /one explicit entity/);
  assert.throws(() => translationRelations('ru', [ru, ru]), /Duplicate translation locale/);
});

test('independent English Word pages do not imply translationOfWork merely from paired publication', () => {
  const ru = { entityId: 'tour_a', locale: 'ru', webPageId: 'https://adatours.ru/a/#webpage', state: 'published', deployReceipt: 'ru-release' };
  const en = { entityId: 'tour_a', locale: 'en', webPageId: 'https://adatours.com/a/#webpage', state: 'published', deployReceipt: 'en-release' };
  assert.deepEqual(translationRelations('en', [ru, en]), {});
  assert.deepEqual(translationRelations('ru', [ru, en]), {});
  assert.deepEqual(translationRelations('en', [ru, { ...en, approvedTranslationOfWorkId: 'https://adatours.ru/unrelated/#webpage' }]), {});
  const approved = { ...en, approvedTranslationOfWorkId: ru.webPageId };
  assert.deepEqual(translationRelations('en', [ru, approved]), { translationOfWork: { '@id': ru.webPageId } });
  assert.deepEqual(translationRelations('ru', [ru, approved]), { workTranslation: [{ '@id': en.webPageId }] });
});

test('UI validation rejects empty or malformed catalogs and non-finite numeric parameters', () => {
  for (const candidate of [null, {}, { messages: {} }, { messages: [] }, { messages: { key: { ru: 1, en: 'one' } } }]) {
    assert.ok(validateUiCatalog(candidate).length > 0);
  }
  assert.ok(validateUiCatalog({ messages: { key: { ru: '{count}', en: '{amount}' } } }).length > 0);
  for (const count of [NaN, Infinity, -Infinity]) assert.throws(() => uiText('en', 'search.found', { count }));
  assert.throws(() => countInEnglish(2, 'country'), /explicit singular and plural/);
  assert.equal(countInEnglish(2, 'tour with a beach stay', 'tours with a beach stay'), '2 tours with a beach stay');
  assert.equal(uiText('en', 'tour.itineraryLength', { days: '12 days' }), 'Your journey: 12 days');
});

test('navigation translates labels but retains the exact existing hrefs and IDs', () => {
  const ru = localizedNavigation('ru'), en = localizedNavigation('en');
  for (const group of Object.keys(ru)) {
    assert.deepEqual(en[group].map(({ href, id }) => ({ href, id })), ru[group].map(({ href, id }) => ({ href, id })));
  }
  assert.equal(en.primary.find((v) => v.href === '/tours/').label, 'Tours');
  assert.equal(ru.primary.find((v) => v.href === '/tours/').label, 'Туры');
});
