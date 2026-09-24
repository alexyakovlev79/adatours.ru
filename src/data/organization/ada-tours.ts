export const ORG = {
  brand: 'Ada Tours',

  contacts: {
    email: 'info@adatours.com',
    phoneDisplay: '+55 21 3435-6408',
    phoneHref: 'tel:+552134356408',
    whatsappDisplay: '+55 21 98848-4456',
    whatsappHref: 'https://wa.me/5521988484456',
    telegramHref: null as string | null,
    address: 'Nsa Sra de Copacabana 680/916, Copacabana, Rio de Janeiro, Brazil',
  },

  business: {
    primarySegments: [
      'B2B: зарубежные туроператоры и турагентства',
      'Luxury / VIP',
      'MICE / incentive / corporate groups',
      'Multi-country',
      'Прямой premium B2C',
    ],
    coreCountries: ['Бразилия', 'Аргентина', 'Перу'],
    micePriorityCountries: ['Бразилия', 'Аргентина', 'Перу', 'Коста-Рика'],
    b2bPartnerTypes: ['Крупные туроператоры', 'Luxury travel advisors', 'MICE-агентства'],
  },

  service: {
    languages: [
      'Английский',
      'Русский',
      'Китайский',
      'Японский',
      'Арабский',
      'Малайский',
      'Испанский',
    ],
    groups: {
      standard: 'обычно 40–50 человек',
      largeEvents: '200–500 человек',
      miceVip: 'от небольших VIP-групп до примерно 50 человек',
    },
  },

  factStatus: 'partial',
  checkedAt: '2026-09-24',

  // Compatibility aliases used by existing global components.
  email: 'info@adatours.com',
  phoneDisplay: '+55 21 3435-6408',
  phoneHref: 'tel:+552134356408',
  whatsappDisplay: '+55 21 98848-4456',
  whatsappHref: 'https://wa.me/5521988484456',
  address: 'Nsa Sra de Copacabana 680/916, Copacabana, Rio de Janeiro, Brazil',
  telegramHref: null as string | null,
} as const;
