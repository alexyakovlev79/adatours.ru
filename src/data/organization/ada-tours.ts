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
    email: 'info@adatours.ru',
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
      emergencyModel: 'Для группового проекта назначаем контактное лицо до выезда, передаем необходимые контакты на время пребывания и координируем непредвиденные ситуации с поставщиками и агентством. Часы доступности, порядок экстренной помощи и стоимость услуг определяем в предложении.',
      groupProjectCoordinator: true,
      status: 'scope_confirmed_hours_pending',
      confirmedAt: '2026-10-22',
      sourceQuestion: 19,
    },
  },

  b2b: {
    repeatPartnerContracts: true,
    commissionModel: 'Для агентств предлагаем нетто-тариф с самостоятельной наценкой или, когда это подходит проекту, комиссионный тариф. Выбранную модель указываем в коммерческом предложении; расчет зависит от направления, сезона, состава группы, категории услуг и индивидуализации программы.',
    commercialTermsPerBooking: true,
    netRates: true,
    whiteLabel: true,
    whiteLabelScope: 'Адаптируем программы, подробные маршруты и практические документы к фирменному стилю агентства с учетом доступных инструментов. Ваучеры и подтверждения оформляем в согласованном формате с обязательными сведениями о поставщиках; повторное использование фото и текстов требует соответствующих прав.',
    commercialContactRole: 'Агентство остается основным коммерческим контактом для своего клиента. Ada Tours ведет операционные и логистические вопросы в координации с агентством и по согласованному порядку принятия решений.',
    travellerCommunication: 'Прямой контакт с путешественниками возможен для трансферов, встреч и непредвиденных вопросов, сохраняя коммерческую роль партнера. Конфиденциальность и порядок последующих прямых обращений согласуются между сторонами.',
    clientRelationshipOwnership: null as string | null,
    responseTime: null as string | null,
    proposal: 'После подробного запроса готовим маршрут, включенные и не включенные услуги, предварительную смету или коммерческое предложение, условия расчета и бронирования. Стоимость разработки, минимальный объем заказа и условия бесплатного расчета согласуем до значительной подготовки.',
    bookingConfirmation: 'В предложении указываем срок действия и различаем предлагаемые услуги и подтвержденные бронирования. Наличие проверяется у поставщиков; условия фиксации цены и состава услуг приводятся в письменном подтверждении.',
    cancellationPolicy: 'Изменения зависят от сроков, объема запроса и правил поставщиков. Размер группы, даты и замена участника могут влиять на тарифы и доступность. Штрафы и возвраты указываем в договорных условиях конкретного бронирования.',
    emergencySupport: 'Для группового проекта назначаем координатора подготовки и передаем контакты на время поездки. При непредвиденной ситуации координируем поставщиков и информируем агентство; часы, порядок помощи и включенные либо дополнительные услуги определяем в предложении.',
    professionalVisits: 'Определяем цели группы, подбираем организации, устанавливаем контакты, проверяем доступность и при необходимости организуем языковое сопровождение. Встреча подтверждается после прямого согласия принимающей стороны с учетом ее графика, конфиденциальности и безопасности.',
    acceptedRequests: 'Индивидуальные программы, небольшие делегации, группы и отдельные услуги: трансферы, гиды и устный перевод. Выполнение зависит от направления, ресурсов и требований запроса; минимальные группа, бюджет и срок подготовки уточняются для проекта.',
    status: 'confirmed_scope_with_open_terms',
    evidence: {
      status: 'user-confirmed',
      confirmedAt: '2026-10-22',
      source: 'Ada_Tours_Proposed_Responses_RU(1).docx',
      confirmation: 'Алексей подтвердил, что содержательные ответы уверенно диктовала Анна; оговорки о необходимости подтверждения были добавлены при переводе ИИ.',
      questions: [
        { question: 11, paragraph: 'P005', fields: ['commissionModel', 'netRates'] },
        { question: 12, paragraph: 'P007', fields: ['commercialContactRole', 'travellerCommunication'] },
        { question: 13, paragraph: 'P009', fields: ['whiteLabel', 'whiteLabelScope'] },
        { question: 15, paragraph: 'P011', fields: ['proposal'] },
        { question: 17, paragraph: 'P013', fields: ['bookingConfirmation'] },
        { question: 18, paragraph: 'P015', fields: ['cancellationPolicy'] },
        { question: 19, paragraph: 'P017', fields: ['emergencySupport', 'service.support'] },
        { question: 21, paragraph: 'P019', fields: ['professionalVisits'] },
        { question: 22, paragraph: 'P021', fields: ['acceptedRequests'] },
      ],
      openQuestions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 16, 20, 23, 24, 25],
      limits: 'Не подтверждены проценты комиссии, фиксированные сроки ответа и подготовки, депозит, валюта и юридическая сторона договора, единая шкала отмен, круглосуточная поддержка и эксклюзивность повторных клиентских обращений.',
    },
  },

  externalProfiles: {
    officialInternationalSite: 'https://adatours.com/',
    abavRio: 'https://agencias.abavrio.com.br/agencias/64b68797-aa75-4730-ba08-d2ebc50d943f',
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
      'response time',
    ],
  },

  factStatus: 'partial_pending_owner_confirmation',
  checkedAt: '2026-10-22',

  // Compatibility aliases used by existing global components.
  email: 'info@adatours.ru',
  phoneDisplay: '+55 21 3435-6408',
  phoneHref: 'tel:+552134356408',
  whatsappDisplay: '+55 21 98848-4456',
  whatsappHref: 'https://wa.me/5521988484456',
  telegramDisplay: '+55 21 98848-4456',
  telegramHref: 'https://t.me/+5521988484456',
  address: 'Avenida Nossa Senhora de Copacabana, 680, Sala 916, Copacabana, Rio de Janeiro, RJ, 22050-001, Brasil',
} as const;
