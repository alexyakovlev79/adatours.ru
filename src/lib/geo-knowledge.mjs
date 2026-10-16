// Adds approved GEO facts to the canonical Country/Place node, without duplicate @id.
const isHttps = s => typeof s==='string' && /^https:\/\/[^/\s]+/.test(s);
const proved = (p,k) => (p.evidence||[]).some(e=>e.field===k&&isHttps(e.sourceUrl)&&e.note);

const GEO_DECISION_POLICY='probability-70-v1',MIN_ACCEPTED_PROBABILITY=70;
const accepted=(p,field)=>p.decisionPolicy!==GEO_DECISION_POLICY ||
 (Array.isArray(p.assessments)&&p.assessments.some(a=>a?.field===field&&
 Number.isFinite(a.probability)&&a.probability>=MIN_ACCEPTED_PROBABILITY));

export function mergeGeoPassport(node,record,passports) {
 if(!passports||!record||!['country','destination'].includes(record.kind))return node;
 const p=passports.get(record.data.id);
 const acceptedIdentity=p?.decisionPolicy===GEO_DECISION_POLICY
 ? accepted(p,'identity')&&p.confidence!=='low'
 : p?.confidence==='high'&&p.identityScope==='single';
 if(!p||p.schemaVersion!==2||p.status!=='READY'||!acceptedIdentity
 ||p.stableId!==record.data.id||p.kind!==record.kind
 ||p.canonicalPath!==record.path||!Array.isArray(p.evidence))return node;
 const x=p.external||{},sameAs=[...(node.sameAs||[])],identifier=[record.data.id];
 if(/^Q[1-9]\d*$/.test(x.wikidataQid||'')&&proved(p,'external.wikidataQid')&&accepted(p,'external.wikidataQid')){
 sameAs.push('https://www.wikidata.org/wiki/'+x.wikidataQid);
 identifier.push({'@type':'PropertyValue',propertyID:'Wikidata',value:x.wikidataQid});}
 if(/^[1-9]\d*$/.test(x.geonamesId||'')&&proved(p,'external.geonamesId')&&accepted(p,'external.geonamesId'))
 identifier.push({'@type':'PropertyValue',propertyID:'GeoNames',value:x.geonamesId});
 let hasMap;
 if(x.osm&&['node','way','relation'].includes(x.osm.type)&&Number.isSafeInteger(x.osm.id)
 &&x.osm.id>0&&proved(p,'external.osm')&&accepted(p,'external.osm')){
 hasMap='https://www.openstreetmap.org/'+x.osm.type+'/'+x.osm.id;
 identifier.push({'@type':'PropertyValue',propertyID:'OpenStreetMap',value:x.osm.type+'/'+x.osm.id});}
 const subjectOf=Object.values(x.wikipedia||{}).filter(u=>isHttps(u)&&
 /^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\//.test(u)&&proved(p,'external.wikipedia')&&accepted(p,'external.wikipedia'))
 .map(u=>({'@type':'WebPage','@id':u,url:u}));
 const alternateName=accepted(p,'alternateNames')?[...new Set((p.alternateNames||[]).filter(n=>typeof n==='string'&&n.trim()&&n!==node.name))]:[];
 const l=p.location,hasGeo=l&&proved(p,'location')&&accepted(p,'location')&&isHttps(l.coordinateSource)
 &&Number.isFinite(l.latitude)&&Math.abs(l.latitude)<=90
 &&Number.isFinite(l.longitude)&&Math.abs(l.longitude)<=180
 &&['centroid','entrance','settlement_center','feature_point','representative'].includes(l.pointRole);
 return {...node,identifier,sameAs:[...new Set(sameAs)],...(hasMap?{hasMap}:{}),
 ...(subjectOf.length?{subjectOf:[...(node.subjectOf||[]),...subjectOf]}:{}),
 ...(alternateName.length?{alternateName}:{}),
 ...(hasGeo?{geo:{'@type':'GeoCoordinates',latitude:l.latitude,longitude:l.longitude}}:{})};
}
