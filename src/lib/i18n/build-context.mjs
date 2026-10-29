/** Explicit build-localisation gate. Astro may never emit RU content under
 * the planned EN origin simply because SITE_ORIGIN or SITE_LOCALE was set.
 * The strict content adapter is shared, but it has not been wired into all
 * Astro routes/layouts/search/schema/metadata as of 2026-10-29.
 */
import { localeSite, validateOrigin, validateBase, assertPublicLocaleRelease } from './locale-site.mjs';
import foundation from '../../../data/i18n/foundation-status.json' with { type: 'json' };

const gates = ['content','ui','metadata','schema','links','search','forms'];
const fail = message => { throw new Error('Ada Tours locale build blocked: '+message); };
/** Pure configuration derived from env; status is optional only for synthetic unit tests. */
export function resolveAstroBuildContext(env = {}, status = foundation) {
  if (env === null || typeof env !== 'object') fail('environment must be an object');
  const locale = env.SITE_LOCALE ?? 'ru';
  if (!['ru','en'].includes(locale)) fail('unknown SITE_LOCALE='+String(locale));
  const registry = localeSite(locale);
  const site = validateOrigin(env.SITE_ORIGIN ?? registry.origin);
  const base = validateBase(env.SITE_BASE ?? registry.base);
  if (locale === 'ru' && site === localeSite('en').origin) fail('RU build cannot use the configured English origin');
  if (locale === 'en') {
    const needed = [
      'runtimeLocaleAdapterConnected','automaticTextSynchronizationRunning',
      'operationalDispatcherReady','newEnglishSitePublished',
    ];
    for (const key of needed) if (status[key] !== true) fail('EN readiness gate missing: '+key);
    const releaseGates = status.englishBuildGates;
    if (!releaseGates || gates.some(key => releaseGates[key] !== true)) fail('EN locale surface checks are incomplete');
    if (site !== registry.origin || base !== registry.base) fail('English public origin/base must be approved in site registry first');
    assertPublicLocaleRelease(registry,releaseGates);
  }
  return Object.freeze({ site, base, locale });
}
