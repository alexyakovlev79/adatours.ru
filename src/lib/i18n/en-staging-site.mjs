/** A separate GitHub Pages project staging host, never the public EN release.
 * This is the only allowed EN staging address. Keep it distinct from the RU
 * GitHub Pages repository, which already serves adatours.ru.
 */
export const EN_STAGING_ORIGIN='https://alexyakovlev79.github.io';
export const EN_STAGING_BASE='/adatours-en/';
export const EN_STAGING_ROUTE='/en/';
export function enStagingSiteEnabled(env={}){
 return env?.EN_STAGING_PAGES==='1' &&
  env.SITE_LOCALE==='en' &&
  env.SITE_ORIGIN===EN_STAGING_ORIGIN &&
  env.SITE_BASE===EN_STAGING_BASE &&
  env.PUBLIC_EN_RELEASE==='0' &&
  env.EN_PILOT_PREVIEW!=='1';
}
