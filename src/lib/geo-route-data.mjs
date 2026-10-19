// Stable-ID route matching. Runs during the Astro build, never in the browser.
// GEO coordinates are used only from published READY passports at the accepted 70% threshold.
export const MIN_ROUTE_PROBABILITY = 70;

export function normalizePlace(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/giu, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function verifiedCoordinate(passport, id) {
  if (!passport || passport.stableId !== id || passport.kind !== 'destination' ||
      passport.schemaVersion !== 2 || passport.status !== 'READY') return null;
  const {latitude, longitude} = passport.location || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const evidence = passport.evidence || [];
  if (!evidence.some(e => e.field === 'location' && /^https:\/\//.test(e.sourceUrl || ''))) return null;
  if (passport.decisionPolicy === 'probability-70-v1') {
    const score = field => (passport.assessments || []).find(a => a.field === field)?.probability ?? -1;
    if (score('identity') < MIN_ROUTE_PROBABILITY || score('location') < MIN_ROUTE_PROBABILITY) return null;
  } else if (passport.confidence !== 'high') return null;
  return [longitude, latitude];
}

const active = e => e && !['draft', 'archived', 'review'].includes(e.status);

export function makeGeoIndex({catalog, destinations, passports}) {
  const entries = new Map();
  const names = new Map();
  const add = (name, id) => {
    const key = normalizePlace(name);
    if (!key) return;
    if (!names.has(key)) names.set(key, new Set());
    names.get(key).add(id);
  };
  for (const item of catalog) {
    const dest = destinations.get(item.id);
    const coordinates = verifiedCoordinate(passports.get(item.id), item.id);
    if (!active(dest) || !coordinates) continue;
    const point = {
      id: item.id, name: dest.name || item.name,
      countryId: dest.countryId || item.countryId,
      type: dest.destinationType || item.destinationType,
      coordinates, href: item.url,
      image: dest.hero?.src || '', description: dest.summary || '',
      aliases: [...new Set([item.name, item.slug, ...(item.aliases || []), dest.name, ...(dest.searchAliases || [])].filter(Boolean))],
    };
    entries.set(item.id, point);
    for (const name of point.aliases) add(name, item.id);
  }
  return {entries, names};
}

function selectUnique(ids, index, {preferredIds = [], countryIds = []} = {}) {
  const countrySet = new Set(countryIds), preferredSet = new Set(preferredIds);
  const rows = [...ids].map(id => index.entries.get(id)).filter(Boolean);
  if (!rows.length) return null;
  const countries = countrySet.size ? rows.filter(p => countrySet.has(p.countryId)) : rows;
  if (!countries.length) return null;
  const preferred = preferredSet.size ? countries.filter(p => preferredSet.has(p.id)) : [];
  const remaining = preferred.length ? preferred : countries;
  return remaining.length === 1 ? remaining[0] : null;
}

export function resolvePlace(name, index, context = {}) {
  const normalized = normalizePlace(name);
  if (!normalized) return null;
  const exact = index.names.get(normalized);
  if (!exact) return null;
  const selected = selectUnique(exact, index, context);
  return selected ? {point: selected, probability: 98} : null;
}

function mentionedPlaces(text, index, context = {}) {
  const haystack = ' ' + normalizePlace(text) + ' ';
  if (!haystack.trim()) return [];
  const matches = [];
  for (const [id, point] of index.entries) {
    if (context.countryIds?.length && !context.countryIds.includes(point.countryId)) continue;
    let best = -1;
    for (const name of point.aliases) {
      const normalized = normalizePlace(name);
      if (normalized.length < 6) continue;
      const at = haystack.indexOf(' ' + normalized + ' ');
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    if (best >= 0) matches.push({id, at: best});
  }
  matches.sort((a, b) => a.at - b.at);
  // The title match is accepted only if exactly one identity occupies the span.
  return matches.filter((m, i) => i === 0 || !matches.slice(0, i).some(x => x.at === m.at))
    .map(m => ({point: index.entries.get(m.id), probability: 76}));
}

function appendVisit(visits, match, day) {
  if (!match || match.probability < MIN_ROUTE_PROBABILITY) return;
  const id = match.point.id, previous = visits[visits.length - 1];
  if (previous?.id === id) {
    if (Number.isInteger(day) && !previous.days.includes(day)) previous.days.push(day);
    return;
  }
  visits.push({id, days: Number.isInteger(day) ? [day] : []});
}

function matchNames(names, visits, index, context, day) {
  for (const name of names) appendVisit(visits, resolvePlace(name, index, context), day);
}

export function tourVisits(tour, index, excursions = new Map()) {
  const visits = [], context = {
    preferredIds: tour.routeDestinations || tour.destinations || [],
    countryIds: tour.countries || [],
  };
  for (const row of tour.itinerary || []) {
    const day = row.day;
    const names = Array.isArray(row.places) ? row.places : [];
    const before = visits.length;
    matchNames(names, visits, index, context, day);
    if (!names.length || visits.length === before) {
      for (const mention of mentionedPlaces(row.title || '', index, context))
        appendVisit(visits, mention, day);
    }
    const refs = [row.excursionRef, ...(row.contentBlocks || []).filter(b => b.type === 'excursion').map(b => b.excursionRef)].filter(Boolean);
    for (const ref of refs) {
      const ex = excursions.get(ref);
      if (!active(ex)) continue;
      const accepted = excursionVisits(ex, index);
      for (const v of accepted) {
        // Optional excursion geography cannot silently turn into a guaranteed tour stop.
        if (tour.routeDestinations?.length && !tour.routeDestinations.includes(v.id)) continue;
        appendVisit(visits, {point: index.entries.get(v.id), probability: 90}, day);
      }
    }
  }
  if (!visits.length) matchNames(tour.route || [], visits, index, context);
  if (!visits.length) for (const id of context.preferredIds)
    appendVisit(visits, index.entries.has(id) ? {point:index.entries.get(id), probability:75} : null);
  return visits;
}

export function excursionVisits(excursion, index) {
  const visits = [];
  const linked = [...new Set([excursion.destination, ...(excursion.relatedDestinations || [])].filter(Boolean))];
  const context = {preferredIds: linked, countryIds: [excursion.country].filter(Boolean)};
  matchNames(excursion.route || [], visits, index, context);
  if (visits.length < 2 && linked.length > 1) {
    const ordered = mentionedPlaces(excursion.title || '', index, context)
      .concat(mentionedPlaces(excursion.lead || '', index, context));
    for (const found of ordered) if (linked.includes(found.point.id)) appendVisit(visits, found);
    // The declared related-place order is the deterministic final fallback.
    if (visits.length < 2) for (const id of linked)
      appendVisit(visits, index.entries.has(id) ? {point:index.entries.get(id), probability:75} : null);
  }
  if (!visits.length && excursion.destination && index.entries.has(excursion.destination))
    appendVisit(visits, {point:index.entries.get(excursion.destination), probability:100});
  return visits;
}

export function finalizeGeoMap(visits, index) {
  const visited = visits.filter(v => index.entries.has(v.id));
  if (!visited.length) return null;
  const points = [], seen = new Map();
  for (const visit of visited) {
    if (!seen.has(visit.id)) {
      const base = index.entries.get(visit.id);
      const point = {...base, position: points.length + 1, days: [...visit.days]};
      seen.set(visit.id, point);
      points.push(point);
    } else {
      const current = seen.get(visit.id);
      for (const day of visit.days) if (!current.days.includes(day)) current.days.push(day);
    }
  }
  const route = visited.map(v => index.entries.get(v.id).coordinates);
  const lngs = points.map(p => p.coordinates[0]), lats = points.map(p => p.coordinates[1]);
  const bounds = {
    west: Math.min(...lngs), south: Math.min(...lats),
    east: Math.max(...lngs), north: Math.max(...lats),
  };
  const geojson = {type:'FeatureCollection', features: [
    ...(route.length > 1 ? [{
      type:'Feature', properties:{kind:'route'},
      geometry:{type:'LineString',coordinates:route}
    }] : []),
    ...points.map(p => ({type:'Feature',properties:{kind:'point',id:p.id,position:p.position,days:p.days},
      geometry:{type:'Point',coordinates:p.coordinates}})),
  ]};
  const first = points[0];
  const zoom = ({
    city:10, resort:10, island:10, national_park:8,
    natural_area:7, region:7, route_cluster:7,
  })[first.type] || 9;
  return {points, route, bounds, zoom, center: first.coordinates, geojson};
}


// A destination's "where next" map shows choices, not a visit sequence.
// The same relatedIds array used by the page's recommendation block is reused
// here, and only published, verified GEO destination coordinates are retained.
export function destinationNeighborhoodMap(primaryId, relatedIds, index) {
  if (!index.entries.has(primaryId)) return null;
  const ids = [primaryId, ...new Set((relatedIds || []).filter(id =>
    id !== primaryId && index.entries.has(id)))];
  const model = finalizeGeoMap(ids.map(id => ({id, days:[]})), index);
  if (!model) return null;
  return {
    ...model,
    points: model.points.map(p => ({
      ...p, isPrimary:p.id === primaryId, isRelated:p.id !== primaryId,
    })),
    route: [],
    geojson: {
      type:'FeatureCollection',
      features:model.geojson.features.filter(f => f.properties.kind === 'point')
        .map(f => ({
          ...f, properties:{...f.properties, isPrimary:f.properties.id === primaryId},
        })),
    },
  };
}
