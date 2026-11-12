export interface AuthoritySource {
  id: string;
  url: string;
  name: string;
  label?: string;
  language?: string;
  publisher: { name: string; url?: string };
  datePublished?: string;
  dateModified?: string;
  startDate?: string;
}

export interface AuthoritySourceCopy {
  sourceId: string;
  title: string;
  category: string;
  annotationMarkdown: string;
  linkLabel: string;
  anchorId?: string;
  displaySeparately?: boolean;
  relatedLinks?: Array<{ sourceId: string; label: string }>;
}

export interface AuthoritySectionCopy {
  id: string;
  eyebrow: string;
  heading: string;
  paragraphsMarkdown: string[];
}

export interface AuthorityPartner {
  id: string;
  name: string;
  url: string;
  role: string;
  description: string;
  sources: AuthoritySource[];
}

const dateFormats = {
  ru: {
    date: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    month: new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  },
  en: {
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    month: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  },
};

export function authorityDate(source: AuthoritySource, locale: 'ru' | 'en' = 'ru') {
  const value = source.startDate || source.datePublished || source.dateModified;
  if (!value) return undefined;
  const formats = dateFormats[locale];
  const prefix = !source.startDate && !source.datePublished && source.dateModified
    ? locale === 'en' ? 'Updated ' : 'Обновлено ' : '';
  const label = /^\\d{4}$/.test(value) ? value
    : /^\\d{4}-\\d{2}$/.test(value)
      ? formats.month.format(new Date(`${value}-01T00:00:00Z`))
      : formats.date.format(new Date(value));
  return { value, label: `${prefix}${label}` };
}

export function authorityLanguage(language?: string, locale: 'ru' | 'en' = 'ru') {
  if (language?.startsWith('ru')) return locale === 'en' ? 'In Russian' : 'На русском';
  if (language?.startsWith('en')) return locale === 'en' ? 'In English' : 'На английском';
  if (language?.startsWith('pt')) return locale === 'en' ? 'In Portuguese' : 'На португальском';
  return undefined;
}
