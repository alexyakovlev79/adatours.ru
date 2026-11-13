/** Minimal valid source-graph contract for noindex EN publish unit fixtures.
 * Production validates all Graph nodes separately; these tests isolate DOM/UI.
 */
const origin='https://alexyakovlev79.github.io/adatours-en/';
export function schemaFixture(route='/') {
 if(typeof route!=='string'||!route.startsWith('/')||!route.endsWith('/'))throw TypeError('Canonical fixture route required');
 const url=origin+route.slice(1);
 const data={
  '@context':'https://schema.org',
  '@graph':[
   {'@type':['Organization','TravelAgency'],'@id':'https://adatours.ru/#organization',
     url:'https://adatours.ru/',name:'Ada Tours'},
   {'@type':'WebSite','@id':origin+'#website',url:origin,name:'Ada Tours',inLanguage:'en'},
   {'@type':'WebPage','@id':url+'#webpage',url,name:'Ada Tours',inLanguage:'en',
     isPartOf:{'@id':origin+'#website'}}
  ]
 };
 return '<script type="application/ld+json" data-schema-version="2026-10-22.3">'
  +JSON.stringify(data)+'</script>';
}
