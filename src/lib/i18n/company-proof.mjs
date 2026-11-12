/** EN display-only overlays for company facts, colleagues and review excerpts.
 * No changes to canonical Russian data, source languages, links, prices or IDs.
 */
import teamEn from '../../data/i18n/team.en.json' with { type: 'json' };
import reviewsEn from '../../data/i18n/reviews.en.json' with { type: 'json' };
import organizationEn from '../../data/i18n/organization.en.json' with { type: 'json' };
import { sharedUiLocale } from './shared-ui-locale.mjs';

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const requireIds = (records, entries, label) => {
  const keys = Object.keys(entries).sort(), ids = records.map(row => row.id).sort();
  if (JSON.stringify(keys) !== JSON.stringify(ids)) throw new Error('EN '+label+' ID mismatch');
};
const ensureText = (text, label) => {
  if (typeof text !== 'string' || !text.trim() || /[\u0400-\u052f]/u.test(text))
    throw new Error('Untranslated EN '+label);
  return text;
};
export function localizedTeamMembers(members, locale = sharedUiLocale()) {
  if (locale !== 'en') return members;
  requireIds(members, teamEn.members, 'team');
  return members.map(member => {
    const en = teamEn.members[member.id];
    if (en.paragraphs.length !== member.paragraphs.length) throw new Error('EN team paragraph count '+member.id);
    const name = ensureText(en.name, member.id+'.name');
    const role = ensureText(en.role, member.id+'.role');
    const paragraphs = en.paragraphs.map((text,i) => ensureText(text,member.id+'.paragraphs.'+i));
    return { ...member, name, role, paragraphs, photo: {
      ...member.photo, alt: name+', '+role+' at Ada Tours', hover: name+' from the Ada Tours team'
    }};
  });
}
export function localizedReviews(records, locale = sharedUiLocale()) {
  if (locale !== 'en') return records;
  requireIds(records, reviewsEn.entries, 'review');
  return records.map(review => {
    const en = reviewsEn.entries[review.id];
    if (Boolean(en.route) !== Boolean(review.route)) throw new Error('EN review route mismatch '+review.id);
    return {...review, author:ensureText(en.author,review.id+'.author'),
      segment:ensureText(en.segment,review.id+'.segment'),
      ...(review.route ? {route:ensureText(en.route,review.id+'.route')} : {}),
      text:ensureText(en.text,review.id+'.text')};
  });
}
export function localizedOrganization(source, locale = sharedUiLocale()) {
  if (locale !== 'en') return source;
  const e = organizationEn;
  const sameLen = (a,b,label) => {
    if (a.length !== b.length) throw new Error('EN organisation list length '+label);
    return b.map((v,i)=>ensureText(v,label+'.'+i));
  };
  return {...source,
    business:{...source.business,
      primarySegments:sameLen(source.business.primarySegments,e.business.primarySegments,'business.primarySegments'),
      coreCountries:sameLen(source.business.coreCountries,e.business.coreCountries,'business.coreCountries'),
      micePriorityCountries:sameLen(source.business.micePriorityCountries,e.business.micePriorityCountries,'business.micePriorityCountries'),
      b2bPartnerTypes:sameLen(source.business.b2bPartnerTypes,e.business.b2bPartnerTypes,'business.b2bPartnerTypes')},
    service:{...source.service,
      languages:sameLen(source.service.languages,e.service.languages,'service.languages'),
      groups:Object.fromEntries(Object.entries(source.service.groups).map(([id,group]) =>
        [id,{...group,label:ensureText(e.service.groupLabels[id],'service.groups.'+id)}])),
      support:{...source.service.support,emergencyModel:ensureText(e.service.emergencyModel,'service.support.emergencyModel')}},
    b2b:{...source.b2b,...Object.fromEntries(Object.entries(e.b2b).map(([key,value]) =>
      [key,ensureText(value,'b2b.'+key)]))},
    claims:{...source.claims,approvedNumeric:sameLen(source.claims.approvedNumeric,e.approvedNumericClaims,'claims.approvedNumeric')}
  };
}
export function reviewProvenanceNote(review, locale = sharedUiLocale()) {
  if (locale !== 'en') return review.translated ? 'Перевод с английского.' : '';
  return review.sourceLanguage === 'ru'
    ? 'Translated from Russian; edited excerpt.'
    : 'Edited English-language excerpt; see the original review.';
}
export function caseTestimonialProvenanceNote(caseId, locale = sharedUiLocale()) {
  if (locale !== 'en' || !own(reviewsEn.caseTestimonials,caseId)) return '';
  const source = reviewsEn.caseTestimonials[caseId];
  return source.sourceLanguage === 'ru' ? 'Translated from the original Russian testimonial.' : '';
}
