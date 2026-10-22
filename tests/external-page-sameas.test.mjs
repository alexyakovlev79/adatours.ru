import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authoritativeEnglishTarget, externalPageSameAs, externalSameAsCounts,
  attachExternalPageSameAs,
} from '../src/lib/external-page-sameas.mjs';

const ROOT = 'https://adatours.ru';
test('frozen registry contains all three independent external sources', () => {
  assert.deepEqual(externalSameAsCounts(), {
    'vipdeluxetravel.ru': 1271, 'adatours.com': 351, 'brasiltours.ru': 674,
  });
  assert.deepEqual(externalPageSameAs('/made-up-404/'), []);
  assert.ok(externalPageSameAs('/vip/').includes('https://vipdeluxetravel.ru/'));
  assert.ok(externalPageSameAs('/peru/tour/best-of-peru-21-days/').includes(
    'https://brasiltours.ru/21-dnevnoe-priklyuchenie-v-peru'));
});

test('current EN adjudication wins over obsolete competing source-to-RU claims', () => {
  const source = 'https://adatours.com/argentina-chile-and-bolivia';
  const winningPath = '/multi-country/tour/patagonia-uyuni-salt-flats-12-days/';
  assert.equal(authoritativeEnglishTarget(source), winningPath);
  assert.ok(externalPageSameAs(winningPath).includes(source));
  assert.ok(!externalPageSameAs('/multi-country/tour/argentina-chile-bolivia-patagonia-12-days/').includes(source));
});

test('own page receives de-duplicated entity sameAs without adding any browser fetch', () => {
  const path = '/peru/tour/best-of-peru-21-days/';
  const entityId = ROOT + path + '#tour';
  const graph = { '@graph': [
    { '@type': 'WebPage', '@id': ROOT + path + '#webpage' },
    { '@type': 'TouristTrip', '@id': entityId,
      sameAs: ['https://brasiltours.ru/21-dnevnoe-priklyuchenie-v-peru'] },
  ] };
  assert.equal(attachExternalPageSameAs(graph, { path, pageUrl: ROOT + path, entityId }), graph);
  const trip = graph['@graph'][1];
  assert.equal(trip.sameAs.filter((x) => x === 'https://brasiltours.ru/21-dnevnoe-priklyuchenie-v-peru').length, 1);
  assert.equal(graph['@graph'][0].sameAs, undefined);
});

test('generated catalogues carry links on WebPage, not on global Organization', () => {
  const path = '/vip/';
  const graph = { '@graph': [
    { '@type': 'Organization', '@id': ROOT + '/#organization' },
    { '@type': 'CollectionPage', '@id': ROOT + path + '#webpage' },
  ] };
  attachExternalPageSameAs(graph, { path, pageUrl: ROOT + path });
  assert.ok(graph['@graph'][1].sameAs.includes('https://vipdeluxetravel.ru/'));
  assert.equal(graph['@graph'][0].sameAs, undefined);
});

test('removes obsolete EN sameAs for a competing primary tour', () => {
  const path = '/multi-country/tour/patagonia-uyuni-salt-flats-12-days/';
  const id = ROOT + path + '#tour';
  const ambiguousSource = 'https://adatours.com/argentina-chile-and-bolivia';
  const graph = { '@graph': [{ '@id': id, sameAs: [ambiguousSource] }] };
  attachExternalPageSameAs(graph, { path, pageUrl: ROOT + path, entityId: id });
  assert.deepEqual(graph['@graph'][0].sameAs.filter((s) => s === ambiguousSource), [ambiguousSource]);
});
