import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorityRegistry, acceptedAuthoritySources, getAuthoritySources, getAuthorityEntity,
  getAuthorityPageSources, getAuthorityPartners, getVisibleAuthorityPartners } from '../src/lib/entity-authority.mjs';
import { buildStructuredData, hasType } from '../src/lib/structured-data.mjs';
import { inspectHtml } from '../src/lib/structured-data-html.mjs';

const root = 'https://adatours.ru/';
const annaPath = '/team/anna-avanesova/';
const annaId = root + 'team/anna-avanesova/#person';
const orgId = root + '#organization';
const organization = { name: 'Ada Tours', url: root, logo: '/brand/adatours-logo-black.svg',
  sameAs: ['https://adatours.com/'], areaServedEntityIds: ['country_brazil','country_argentina','country_peru'],
  areaServed: [{ '@type':'Country',name:'Бразилия' },{ '@type':'Country',name:'Аргентина' },
    { '@type':'Country',name:'Перу' },{ '@type':'Place',name:'Латинская Америка' }] };
const records = [
  ...[['brazil','Бразилия'],['argentina','Аргентина'],['peru','Перу']].map(([slug,name]) => ({
    kind:'country',path:`/${slug}/`,data:{id:`country_${slug}`,slug,name,status:'published'},
  })),
  { kind:'person',path:annaPath,data:{id:'person_anna',name:'Анна Аванесова',role:'Основатель и CEO Ada Tours',status:'approved',
    expertise:['Бразилия','VIP / Luxury'],externalProfiles:['https://www.xing.com/profile/Anna_Avanesova2']} },
];
const passports = new Map(records.filter((r)=>r.kind==='country').map((r)=>[
  r.data.id,JSON.parse(readFileSync(new URL(`../data/geo-knowledge/entities/${r.data.id}.json`,import.meta.url),'utf8')),
]));
const visible = (path) => ({ groups: [{ links: authorityRegistry.sources.filter((s)=>s.displayOn.includes(path)).map((s)=>({href:s.url})) }] });
function graph(path, document=visible(path), extra={}) {
  return buildStructuredData({root,organization,records,authority:authorityRegistry,geoKnowledge:passports,
    page:{path,url:new URL(path,root).href,title:'Профиль',description:'Описание',lang:'ru'},document,...extra})['@graph'];
}
const entity = (nodes,id) => nodes.find((n)=>n['@id']===id);
const sourceLink = (source) => `<a data-authority-source="${source.id}" href="${source.url}">${source.label || source.name}</a>`;
const facts = (path, html) => inspectHtml(html, { root, pageUrl: new URL(path, root).href }).facts;
const collectionFacts = (path) => facts(path, `<section><h1>Материалы Ada Tours</h1>${getAuthorityPageSources(path).map(sourceLink).join('')}</section>`);
const partnersFacts = () => facts('/partners/', getAuthorityPartners().map((partner) =>
  `<section><h2>${partner.name}</h2><a href="${partner.url}">${partner.name}</a><p>${partner.description}</p>${partner.sources.map(sourceLink).join('')}</section>`).join(''));

test('evidence register has unique URLs, known entities, and no accepted low-confidence sources',()=>{
  const accepted = acceptedAuthoritySources();
  assert.equal(new Set(accepted.map((s)=>s.url)).size,accepted.length);
  assert.equal(new Set(accepted.map((s)=>s.id)).size,accepted.length);
  for (const source of accepted) {
    assert.ok(source.probability>=70 && source.evidence && source.checkedAt);
    assert.ok(['page_read','search_index','official_outlink'].includes(source.verificationMode));
    for (const keys of Object.values(source.relations)) for (const key of keys) assert.ok(authorityRegistry.entities[key]);
    if (source.kind==='article' && source.displayOn.length) assert.ok(source.summary && source.publisher.name);
  }
  for (const candidate of authorityRegistry.candidates.filter((s)=>s.probability<70))
    assert.ok(!accepted.some((s)=>s.url===candidate.url));
});

test('70 percent is accepted; missing evidence, unsafe URL and lower confidence are not',()=>{
  const base={id:'sample',url:'https://example.org/company',status:'verified',probability:70,evidence:'Exact company domain and address.',relations:{sameAs:['organization']}};
  for (const [change,expected] of [[{},1],[{probability:69},0],[{evidence:''},0],[{status:'candidate'},0],[{url:'javascript:alert(1)'},0],[{url:'https://user:secret@example.org/'},0]]) {
    assert.equal(acceptedAuthoritySources({sources:[{...base,...change}]}).length,expected);
  }
});

test('company identity, map and membership share canonical @id and preserve geographic passports',()=>{
  const nodes=graph('/about/'); const org=entity(nodes,orgId);
  assert.equal(nodes.filter((n)=>hasType(n,'Organization')).length,1);
  assert.equal(org.founder['@id'],annaId);
  assert.equal(org.mainEntityOfPage['@id'],root+'about/#webpage');
  assert.ok(org.hasMap.some((url)=>url.includes('maps')));
  assert.equal(org.memberOf[0].name,'ABAV-RJ');
  assert.equal(new Set(org.sameAs).size,org.sameAs.length);
  assert.deepEqual(org.areaServed.slice(0,3).map((r)=>r['@id']),['brazil','argentina','peru'].map((slug)=>root+slug+'/#country'));
  assert.ok(entity(nodes,root+'brazil/#country').sameAs.includes('https://www.wikidata.org/wiki/Q155'));
  assert.equal(org.foundingDate,undefined);
  const contactNodes=graph('/contacts/');
  assert.deepEqual(entity(contactNodes,orgId).areaServed,org.areaServed);
  assert.equal(contactNodes.filter((n)=>hasType(n,'Country')).length,0);
});

test('profile connects interviews and four visible webinars without invented author/reviewer assertions',()=>{
  const nodes=graph(annaPath); const anna=entity(nodes,annaId);
  assert.equal(nodes.filter((n)=>hasType(n,'Person')).length,1);
  assert.equal(entity(nodes,root+'team/anna-avanesova/#webpage').mainEntity['@id'],annaId);
  assert.ok(anna.sameAs.some((url)=>url.includes('linkedin.com/in/anna-avanesova')));
  assert.ok(anna.alternateName.includes('Anna Avanesova'));
  assert.equal(anna.worksFor['@id'],orgId);
  assert.equal(anna.knowsAbout[0]['@id'],root+'brazil/#country');
  assert.ok(anna.subjectOf.some((item)=>item['@id'].includes('thetimesusa.com')));
  assert.ok(!anna.subjectOf.some((item)=>item['@id'].includes('panrotas.com')));
  assert.equal(anna.performerIn.length,4);
  for (const ref of anna.performerIn) {
    const event=entity(nodes,ref['@id']);
    assert.ok(hasType(event,'EducationEvent'));
    assert.equal(event.performer[0]['@id'],annaId);
    assert.equal(event.organizer[0]['@id'],orgId);
    assert.equal(event.location['@type'],'VirtualLocation');
    assert.equal(event.publisher,undefined);
  }
  for (const node of nodes) { assert.equal(node.author,undefined); assert.equal(node.reviewedBy,undefined); }
});

test('unrendered external articles and events stay out of JSON-LD, identity remains consistent',()=>{
  const empty=graph(annaPath,{});
  assert.equal(empty.filter((n)=>hasType(n,'Article')||hasType(n,'NewsArticle')||hasType(n,'EducationEvent')).length,0);
  assert.equal(entity(empty,annaId).subjectOf,undefined);
  assert.equal(entity(empty,annaId).performerIn,undefined);
  assert.deepEqual(entity(empty,annaId).sameAs,entity(graph('/contacts/'),annaId).sameAs);
  const subset=graph('/about/',{groups:[{links:[{href:'https://www.thetimesusa.com/luxury-travel-in-latin-america/'}]}]});
  assert.equal(subset.filter((n)=>hasType(n,'Article')).length,1);
  assert.equal(entity(subset,orgId).subjectOf.length,1);
});

test('incidental press mentions remain distinct from interviews and internal evidence is private to the register',()=>{
  const nodes=graph(annaPath);
  const panrotas=nodes.find((n)=>n.url?.includes('panrotas.com') && hasType(n,'NewsArticle'));
  assert.ok(panrotas.mentions.some((n)=>n['@id']===annaId));
  assert.equal(panrotas.about,undefined);
  const serialized=JSON.stringify(nodes);
  for(const property of ['probability','verificationMode','evidenceUrls','decisionPolicy','mediaCandidate'])
    assert.ok(!serialized.includes('"'+property+'"'));
  assert.equal(new Set(nodes.map((n)=>n['@id'])).size,nodes.length);
  const profileSources=getAuthoritySources('person_anna',{path:annaPath,groups:['profiles']});
  assert.equal(profileSources.length,4);
  assert.equal(getAuthorityEntity('person_anna').hasMap.length,0);
});

test('implemented authority pages activate the seven saved sources while preserving the evidence decisions',()=>{
  assert.equal(getAuthorityPageSources('/press/').length,13);
  assert.equal(getAuthorityPageSources('/webinars/').length,7);
  assert.equal(getAuthorityPageSources('/partners/').length,5);
  assert.equal(getAuthorityPageSources('/unregistered/').length,0);
  assert.ok(authorityRegistry.futurePages.every((page)=>page.status==='implemented'));
  assert.equal(authorityRegistry.sources.filter((source)=>source.deployment==='saved_for_future_page').length,0);
  for (const source of authorityRegistry.sources) assert.ok(source.displayOn.length);
});

test('press is a collection of thirteen visible works without turning incidental mentions into subjectOf',()=>{
  const nodes=graph('/press/',collectionFacts('/press/'));
  const page=entity(nodes,root+'press/#webpage');
  const list=entity(nodes,page.mainEntity['@id']);
  assert.ok(hasType(page,'CollectionPage'));
  assert.equal(list.numberOfItems,13);
  assert.deepEqual(list.itemListElement.map((item)=>item.url),getAuthorityPageSources('/press/').map((source)=>source.url));
  assert.equal(nodes.filter((node)=>hasType(node,'Article')||hasType(node,'NewsArticle')).length,13);
  assert.equal(page.citation.length,13);
  const photoReport=authorityRegistry.sources.find((source)=>source.id==='anna-me-wtm-2024');
  const report=entity(nodes,photoReport.url+'#article');
  assert.ok(report.mentions.some((item)=>item['@id']===annaId));
  assert.equal(report.about,undefined);
  assert.ok(!entity(nodes,annaId).subjectOf.some((item)=>item['@id']===report['@id']));
  assert.deepEqual(entity(nodes,orgId).sameAs,entity(graph('/about/'),orgId).sameAs);
});

test('webinar collection lists six events and keeps the visible interview as a separate citation',()=>{
  const nodes=graph('/webinars/',collectionFacts('/webinars/'));
  const page=entity(nodes,root+'webinars/#webpage');
  const list=entity(nodes,page.mainEntity['@id']);
  assert.ok(hasType(page,'CollectionPage'));
  assert.equal(list.numberOfItems,6);
  assert.equal(nodes.filter((node)=>hasType(node,'EducationEvent')).length,6);
  assert.equal(entity(nodes,annaId).performerIn.length,6);
  for(const item of list.itemListElement) {
    const event=entity(nodes,item.item['@id']);
    assert.ok(hasType(event,'EducationEvent'));
    assert.equal(event.performer[0]['@id'],annaId);
    assert.equal(event.organizer[0]['@id'],orgId);
  }
  assert.equal(page.citation.length,1);
  assert.ok(hasType(entity(nodes,page.citation[0]['@id']),'Article'));
  assert.ok(!list.itemListElement.some((item)=>item.item['@id']===page.citation[0]['@id']));
  assert.ok(!nodes.some((node)=>hasType(node,'VideoObject')||hasType(node,'AudioObject')));
});

test('partner organizations have separate identities and the general directory only mentions Ada Tours',()=>{
  const nodes=graph('/partners/',partnersFacts());
  const page=entity(nodes,root+'partners/#webpage');
  const list=entity(nodes,page.mainEntity['@id']);
  assert.ok(hasType(page,'CollectionPage'));
  assert.equal(list.numberOfItems,4);
  assert.equal(nodes.filter((node)=>hasType(node,'Organization')).length,5);
  assert.equal(new Set(nodes.map((node)=>node['@id'])).size,nodes.length);
  const company=entity(nodes,orgId);
  assert.deepEqual(company.memberOf,[{'@id':'https://abavrio.com.br/#organization'}]);
  const directoryUrl='https://www.globaldestinations.in/partners.html';
  const directory=entity(nodes,directoryUrl+'#webpage');
  assert.ok(hasType(directory,'CollectionPage'));
  assert.deepEqual(directory.mentions,[{'@id':orgId}]);
  assert.equal(directory.mainEntity,undefined);
  assert.equal(directory.publisher['@id'],'https://www.globaldestinations.in/#organization');
  assert.ok(!company.sameAs.includes(directoryUrl));
  assert.equal(page.citation.length,5);
  for (const partner of getAuthorityPartners()) {
    assert.ok(entity(nodes,partner.schemaId));
    assert.ok(!company.sameAs.includes(partner.url));
  }
  for (const node of nodes) for (const property of ['parentOrganization','subOrganization','author','reviewedBy'])
    assert.equal(node[property],undefined);
});

test('new collections respect actual HTML visibility and order, not all registered sources',()=>{
  const [first,second,third]=getAuthorityPageSources('/press/');
  const html=`<section>${sourceLink(third)}<div hidden>${sourceLink(first)}</div><div aria-hidden="true">${sourceLink(first)}</div>${sourceLink(second)}<a href="https://example.org/unverified">Unknown</a></section>`;
  const nodes=graph('/press/',facts('/press/',html));
  const page=entity(nodes,root+'press/#webpage');
  const list=entity(nodes,page.mainEntity['@id']);
  assert.deepEqual(list.itemListElement.map((item)=>item.url),[third.url,second.url]);
  assert.equal(page.citation.length,2);
  assert.equal(entity(nodes,first.url+'#article'),undefined);
  assert.ok(!JSON.stringify(nodes).includes('https://example.org/unverified'));
  const empty=graph('/webinars/',facts('/webinars/','<section hidden>Hidden webinars</section>'));
  assert.equal(entity(empty,root+'webinars/#authority-list'),undefined);
  assert.equal(empty.filter((node)=>hasType(node,'EducationEvent')).length,0);
});

test('separate partner nodes require visible homepages, supporting links and accepted evidence',()=>{
  const partner=getAuthorityPartners()[0];
  const homepage=`<a href="${partner.url}">${partner.name}</a>`;
  const proof=sourceLink(partner.sources[0]);
  for (const html of [homepage,proof,`${homepage}<span hidden>${proof}</span>`]) {
    const document=facts('/partners/',`<section>${html}</section>`);
    assert.equal(getVisibleAuthorityPartners('/partners/',document).length,0);
    assert.equal(entity(graph('/partners/',document),partner.schemaId),undefined);
  }
  const rejected=structuredClone(authorityRegistry);
  rejected.partners[0].probability=69;
  assert.ok(!getAuthorityPartners(rejected).some((entry)=>entry.id===partner.id));
  const missingProof=structuredClone(authorityRegistry);
  missingProof.sources=missingProof.sources.filter((source)=>source.id!==partner.sourceIds[0]);
  assert.ok(!getAuthorityPartners(missingProof).some((entry)=>entry.id===partner.id));
});
