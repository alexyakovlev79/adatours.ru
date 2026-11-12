/** Stage 5 exact text lookup. In EN noindex only; RU canonical strings remain intact. */
import stageFive from '../../data/i18n/stage-five-page-copy.en.json' with { type: 'json' };
import { sharedUiLocale } from './shared-ui-locale.mjs';
const normalize = text => text.replace(/\s+/gu,' ').trim();
const messages = new Map(stageFive.messages.map(({ru,en})=>[normalize(ru),en]));
export function stageFiveText(value, locale = sharedUiLocale()) {
  if(locale !== 'en' || typeof value !== 'string') return value;
  const en = messages.get(normalize(value));
  return en === undefined ? value : (value.match(/^\s*/u)?.[0]??'')+en+(value.match(/\s*$/u)?.[0]??'');
}
