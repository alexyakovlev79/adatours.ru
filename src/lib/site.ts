export const SITE = {
  name: 'Ada Tours',
  url: 'https://adatours.ru',
  locale: 'ru',
  defaultTitle: 'Ada Tours — путешествия по Бразилии и Латинской Америке',
  defaultDescription:
    'Ada Tours — принимающий туроператор и DMC по Бразилии и Латинской Америке: индивидуальные путешествия, VIP, MICE и программы для турагентств.',
};

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

const SECONDARY_NAV_LINKS = [
  { href: '/cases/', label: 'Кейсы' },
  { href: '/reviews/', label: 'Отзывы' },
  { href: '/team/', label: 'Команда' },
];

export const MOBILE_NAV_LINKS = [
  ...NAV_LINKS.slice(0, -1),
  ...SECONDARY_NAV_LINKS,
  NAV_LINKS[NAV_LINKS.length - 1],
];

export const FOOTER_NAV_LINKS = MOBILE_NAV_LINKS;
