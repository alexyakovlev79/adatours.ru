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
    verification: {
      checkedAt: '2026-09-24',
      basis: 'public CNPJ records and Brazil Ministry of Tourism references',
    },
  },

  history: {
    legalRegistrationYear: 2006,
    publicFoundedYear: null as number | null,
    publicHistoryStatus: 'pending_owner_confirmation',
    note: 'Do not publish 2005/2007 or an age-in-years claim until the canonical company-history wording is approved.',
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
    languagesStatus: 'approved_from_anna_brief',
    groups: {
      standard: {
        display: '40–50',
        label: 'обычный размер группы',
        status: 'approved_from_anna_brief',
      },
      largeEvents: {
        display: '200–500',
        label: 'участников крупных событий',
        status: 'approved_from_anna_brief',
      },
      miceVip: {
        display: '2–50',
        label: 'участников в типичных MICE/VIP-группах',
        status: 'approved_from_anna_brief',
      },
    },
    support: {
      generalSupportAvailable: true,
      roundTheClockClaim: null as boolean | null,
      emergencyModel: null as string | null,
      status: 'pending_owner_confirmation',
    },
  },

  b2b: {
    repeatPartnerContracts: true,
    commissionModel: 'Для туроператоров используется договор; вознаграждение обычно согласуется как процент.',
    commercialTermsPerBooking: true,
    whiteLabel: null as boolean | null,
    clientRelationshipOwnership: null as string | null,
    netRates: null as boolean | null,
    responseTime: null as string | null,
    cancellationPolicy: null as string | null,
    emergencySupport: null as string | null,
    status: 'partial_pending_owner_confirmation',
  },

  externalProfiles: {
    evintra: 'https://www.evintra.com/in/country/br/dmc-in-brazil',
  },

  claims: {
    approvedNumeric: [
      'Обычные группы: 40–50 человек',
      'Крупные события: 200–500 человек',
      'Типичные MICE/VIP-группы: 2–50 человек',
      'Ada Tours может полноценно обрабатывать заявки на 7 языках',
    ],
    blockedUntilConfirmed: [
      '10 000+ clients',
      '1900 tourists',
      '50+ countries',
      '17 years',
      '20 years',
      '24/7 support',
      'white label',
      'net rates',
      'response time',
    ],
  },

  factStatus: 'partial_pending_owner_confirmation',
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
