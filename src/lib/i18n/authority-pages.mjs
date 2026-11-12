/** Page-scoped English projection of Ada Tours' verified authority pages.
 * The Russian JSON and all external source identity/provenance remain canonical.
 * Select only in the explicitly enabled EN noindex staging build.
 */
import russian from '../../data/authority-pages.json' with { type: 'json' };
import pressEnglish from '../../data/i18n/authority-pages.press.en.json' with { type: 'json' };
import webinarsEnglish from '../../data/i18n/authority-pages.webinars.en.json' with { type: 'json' };
import partnersEnglish from '../../data/i18n/authority-pages.partners.en.json' with { type: 'json' };
import partnerEnglish from '../../data/i18n/authority-partners.en.json' with { type: 'json' };
import { sharedUiLocale } from './shared-ui-locale.mjs';

const english = { press: pressEnglish, webinars: webinarsEnglish, partners: partnersEnglish };

export function authorityPage(id, locale = sharedUiLocale()) {
  if (!Object.hasOwn(russian, id)) throw new Error('Unknown authority page: ' + id);
  return locale === 'en' ? english[id] : russian[id];
}

export function localizedAuthorityPartners(partners, locale = sharedUiLocale()) {
  if (locale !== 'en') return partners;
  return partners.map(partner => {
    const copy = partnerEnglish[partner.id];
    if (!copy) throw new Error('Missing English partner copy: ' + partner.id);
    return { ...partner, role: copy.role, description: copy.description };
  });
}
