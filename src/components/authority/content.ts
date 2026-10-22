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

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const monthFormat = new Intl.DateTimeFormat('ru-RU', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export function authorityDate(source: AuthoritySource) {
  const value = source.startDate || source.datePublished || source.dateModified;
  if (!value) return undefined;
  const prefix = !source.startDate && !source.datePublished && source.dateModified ? 'Обновлено ' : '';
  const label = /^\d{4}$/.test(value) ? value
    : /^\d{4}-\d{2}$/.test(value) ? monthFormat.format(new Date(`${value}-01T00:00:00Z`))
      : dateFormat.format(new Date(value));
  return { value, label: `${prefix}${label}` };
}

export function authorityLanguage(language?: string) {
  if (language?.startsWith('ru')) return 'На русском';
  if (language?.startsWith('en')) return 'На английском';
  if (language?.startsWith('pt')) return 'На португальском';
  return undefined;
}
