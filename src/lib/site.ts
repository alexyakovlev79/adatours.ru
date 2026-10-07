export const SITE = {
  name: 'Ada Tours',
  url: 'https://adatours.ru',
  locale: 'ru',
  defaultTitle: 'Ada Tours — путешествия по Бразилии и Латинской Америке',
  defaultDescription:
    'Ada Tours — принимающий туроператор и DMC по Бразилии и Латинской Америке: индивидуальные путешествия, VIP, MICE и программы для турагентств.',
};

export const DMC_NAV_LINKS = [
  { id: 'overview', href: '/dmc/', label: 'DMC / B2B' },
  { id: 'agencies', href: '/dmc/travel-agencies/', label: 'Турагентствам' },
  { id: 'terms', href: '/dmc/terms/', label: 'Условия работы' },
] as const;

export const ABOUT_NAV_LINKS = [
  { id: 'overview', href: '/about/', label: 'О компании' },
  { id: 'anna', href: '/team/anna-avanesova/', label: 'Анна Аванесова' },
  { id: 'team', href: '/team/', label: 'Команда' },
  { id: 'reviews', href: '/reviews/', label: 'Отзывы' },
  { id: 'cases', href: '/cases/', label: 'Кейсы' },
] as const;

export const NAV_LINKS = [
  { href: '/country/', label: 'Страны' },
  { href: '/tours/', label: 'Туры' },
  { href: '/multi-country/', label: 'Multi-country' },
  { href: '/interests/', label: 'По интересам' },
  { href: '/vip/', label: 'VIP' },
  { href: '/mice/', label: 'MICE' },
  { href: '/dmc/', label: 'Для агентств' },
  { href: '/about/', label: 'О нас' },
  { href: '/contacts/', label: 'Контакты' },
];

export const MOBILE_NAV_LINKS = NAV_LINKS;

export const FOOTER_NAV_LINKS = MOBILE_NAV_LINKS.flatMap((link) => {
  if (link.href === '/dmc/') return [link, ...DMC_NAV_LINKS.slice(1)];
  if (link.href === '/about/') return [link, ...ABOUT_NAV_LINKS.slice(1)];
  return [link];
});
