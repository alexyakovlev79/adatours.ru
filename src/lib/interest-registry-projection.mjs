/** Project only computed interest catalog metadata; retain every editorial/history field. */
import { buildTourFilterIndex } from './tour-filters.mjs';
import { buildVipFilterIndex } from './vip-filters.mjs';
import { buildInterestHub } from './interest-model.mjs';
import { isActiveEntity } from './archive.mjs';

const data = row => row?.data ?? row;
const KINDS = new Map([
  [2, new Set(['interest', 'interest_tours', 'interest_related'])],
  [3, new Set(['country_interest_tours'])],
  [4, new Set(['country_interest_vip'])],
  [5, new Set(['vip_interest'])],
  [6, new Set(['interest_places'])],
  [7, new Set(['interest_excursions'])],
]);

export function projectInterestRegistryRows(content) {
  const regular = buildTourFilterIndex(content.tours, content.countries, content.themes);
  const vip = buildVipFilterIndex(content.tours, content.countries, content.themes);
  const rows = [];
  const add = (phase, kind, name, url, themeId, extra = {}) => rows.push({
    phase, kind, name, url, themeId, availability: 'active_interest_catalog', ...extra,
  });
  for (const entry of content.themes.filter(row => data(row).locale === 'ru' && isActiveEntity(row))) {
    const theme = data(entry), root = `/interests/${theme.slug}/`;
    const hub = buildInterestHub(theme.id, content);
    add(2, 'interest', theme.name, root, theme.id, { id: theme.id });
    if (hub.allTours.length) add(2, 'interest_tours', 'Туры: ' + theme.name, root + 'tours/', theme.id, { tours: hub.allTours.length });
    if (hub.allRelatedThemes.length) add(2, 'interest_related', 'Близкие интересы: ' + theme.name, root + 'related/', theme.id);
    if (hub.allExperiences.some(row => row.kind === 'destination')) add(6, 'interest_places', 'Места: ' + theme.name, root + 'places/', theme.id);
    if (hub.allExperiences.some(row => row.kind === 'excursion')) add(7, 'interest_excursions', 'Экскурсии: ' + theme.name, root + 'excursions/', theme.id);
  }
  for (const row of regular.filter(row => row.themeId && row.countryId)) {
    const theme = data(row.theme), country = data(row.country);
    add(3, 'country_interest_tours', `${theme.name}: туры, ${country.name}`, row.href, row.themeId,
      { countryId: row.countryId, tours: row.count });
  }
  for (const row of vip.filter(row => row.themeId)) {
    add(row.countryId ? 4 : 5, row.countryId ? 'country_interest_vip' : 'vip_interest', row.title, row.href, row.themeId,
      { id: 'vip:' + (row.countryId ? row.countryId + ':' : '') + row.themeId,
        ...(row.countryId ? { countryId: row.countryId } : {}), tours: row.count });
  }
  return rows;
}

export function reconcileInterestRegistries(phases, content) {
  const output = structuredClone(phases), current = projectInterestRegistryRows(content);
  for (const phase of output) {
    const kinds = KINDS.get(phase.phase);
    if (!kinds) continue;
    const desired = current.filter(row => row.phase === phase.phase), byUrl = new Map(desired.map(row => [row.url, row]));
    const known = new Set();
    phase.entries = phase.entries.map(prior => {
      if (!kinds.has(prior.kind)) return prior;
      const row = byUrl.get(prior.url);
      known.add(prior.url);
      if (!row) {
        const unavailable = { ...prior, availability: 'temporarily_unavailable' };
        if (Object.hasOwn(unavailable, 'tours')) unavailable.tours = 0;
        if (!['temporarily_unavailable', 'archived'].includes(prior.work)) {
          unavailable.workBeforeUnavailable = prior.work;
          unavailable.work = 'temporarily_unavailable';
        }
        return unavailable;
      }
      // A prior ID is an identity, not a display field. URL remains the registry key.
      const updated = { ...prior, ...row, ...(prior.id ? { id: prior.id } : {}) };
      if (['temporarily_unavailable', 'waiting_for_page'].includes(prior.work)) {
        updated.work = prior.workBeforeUnavailable ?? 'queued';
        delete updated.workBeforeUnavailable;
      }
      return updated;
    });
    for (const row of desired) if (!known.has(row.url)) {
      const entry = { ...row, work: 'queued' };
      const lastOfKind = phase.entries.findLastIndex(item => item.kind === row.kind);
      phase.entries.splice(lastOfKind < 0 ? phase.entries.length : lastOfKind + 1, 0, entry);
    }
  }
  return output;
}
