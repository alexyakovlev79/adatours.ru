export const ORG = {
  brand: 'Ada Tours',

  legal: {
    name: 'Ada Tours 2007 - Operadora de Turismo LTDA',
    cnpj: '08.537.782/0001-04',
    registeredAt: '2006-12-11',
    status: 'active',
    streetAddress: 'Avenida Nossa Senhora de Copacabana, 680, Sala 916',
    addressLocality: 'Rio de Janeiro',
    addressRegion: 'RJ',
    postalCode: '22050-001',
    addressCountry: 'BR',
    address: 'Avenida Nossa Senhora de Copacabana, 680, Sala 916, Copacabana, Rio de Janeiro, RJ, 22050-001, Brasil',
  },

  history: {
    toursSinceYear: 2005,
    toursSinceLabel: 'создаем поездки с 2005 года',
  },

  contacts: {
    email: 'info@adatours.com',
    phoneDisplay: '+55 21 3435-6408',
    phoneHref: 'tel:+552134356408',
    whatsappDisplay: '+55 21 98848-4456',
    whatsappHref: 'https://wa.me/5521988484456',
    telegramDisplay: '+55 21 98848-4456',
    telegramHref: 'https://t.me/+5521988484456',
    address: 'Avenida Nossa Senhora de Copacabana, 680, Sala 916, Copacabana, Rio de Janeiro, RJ, 22050-001, Brasil',
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
      standard: {
        display: '40–50',
        label: 'обычный размер группы',
      },
      largeEvents: {
        display: '200–500',
        label: 'участников крупных событий',
      },
      miceVip: {
        display: 'до 50',
        label: 'участников в MICE/VIP-группах',
      },
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
  telegramDisplay: '+55 21 98848-4456',
  telegramHref: 'https://t.me/+5521988484456',
  address: 'Avenida Nossa Senhora de Copacabana, 680, Sala 916, Copacabana, Rio de Janeiro, RJ, 22050-001, Brasil',
} as const;
