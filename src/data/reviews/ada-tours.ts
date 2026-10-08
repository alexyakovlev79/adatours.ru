export interface AdaReview {
  id: string;
  author: string;
  organization?: string;
  role?: string;
  segment: string;
  route?: string;
  sourceReviewNumber: number;
  sourceUrl: string;
  sourceLanguage: 'ru' | 'en';
  translated: boolean;
  permission: 'approved_full_publication';
  text: string;
}

export const ADA_REVIEWS: AdaReview[] = [
  {
    id: 'review_irina_hernandez_02',
    author: 'Ирина Эрнандес Фернандес',
    segment: 'Групповой маршрут',
    route: 'Ушуайя · Буэнос-Айрес · Игуасу · Рио-де-Жанейро',
    sourceReviewNumber: 1,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'ru',
    translated: false,
    permission: 'approved_full_publication',
    text: 'Высокий уровень организации трансферов, ответственность и внимательность гидов.',
  },
  {
    id: 'review_sana_mehta_03',
    author: 'Sana Mehta',
    segment: 'B2B / индивидуальная поездка',
    route: 'Рио-де-Жанейро',
    sourceReviewNumber: 2,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Клиенты вернулись и остались очень довольны услугами Ada Tours в Рио. Гид и водитель были превосходны и дали очень много полезной информации.',
  },
  {
    id: 'review_marina_ryzhuk_10',
    author: 'Марина Рыжук',
    segment: 'VIP-группа',
    route: 'Рио-де-Жанейро',
    sourceReviewNumber: 9,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Особо важные гости особенно оценили персональный подход. Благодаря экскурсиям они смогли по-настоящему почувствовать город.',
  },
  {
    id: 'review_anna_korona_21',
    author: 'Анна',
    organization: 'Korona Travel',
    segment: 'B2B / группа',
    sourceReviewNumber: 20,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Местная команда отлично сработала, очень быстро отвечая на каждый запрос. У нас остались очень приятные впечатления от поездки.',
  },
  {
    id: 'review_olga_karlsson_23',
    author: 'Ольга Карлссон',
    segment: 'Группа / логистика',
    route: 'Бразилия',
    sourceReviewNumber: 22,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Отели были хорошие, трансферы и сопровождение на высшем уровне, все точно и вовремя.',
  },
  {
    id: 'review_alexandra_bulert_25',
    author: 'Александра Булерт',
    segment: 'Multi-country',
    route: 'Бразилия · Аргентина · Перу',
    sourceReviewNumber: 24,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Я вернулась домой после поездки по Бразилии, Аргентине и Перу. Спасибо вам и вашей компании за организацию тура. Все было замечательно.',
  },
  {
    id: 'review_svetlana_26',
    author: 'Светлана',
    segment: 'B2B / повторное сотрудничество',
    sourceReviewNumber: 25,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'За многие годы сотрудничества вы показали себя очень надежным партнером с интересными турами и профессиональной командой.',
  },
  {
    id: 'review_anastasia_badi_28',
    author: 'Anastasia Badi',
    segment: 'B2B / сложная группа',
    sourceReviewNumber: 28,
    sourceUrl: 'https://adatours.com/about-us',
    sourceLanguage: 'en',
    translated: true,
    permission: 'approved_full_publication',
    text: 'Спасибо за работу с нашей большой и сложной группой с очень насыщенной программой. Вы смогли организовать и принять ее на самом высоком уровне.',
  },

  {
    id: 'review_evgeniya_bykasova_12',
    author: 'Евгения Быкасова',
    segment: 'B2B / сложный маршрут',
    route: 'Аргентина · Бразилия · 25 дней',
    sourceReviewNumber: 12,
    sourceUrl: 'https://brasiltours.ru/ekskursii',
    sourceLanguage: 'ru',
    translated: false,
    permission: 'approved_full_publication',
    text: 'Туристы вернулись в восторге от поездки по Аргентине и Бразилии. За 25 дней экскурсии, перелеты и трансферы прошли без сбоев. Спасибо за организацию непростого маршрута и оперативные ответы на все вопросы.',
  },
  {
    id: 'review_clients_russo_turisto_21',
    author: 'Туристы ТК «Руссо Туристо»',
    segment: 'Индивидуальный multi-country',
    route: 'Аргентина · Уругвай · Бразилия',
    sourceReviewNumber: 21,
    sourceUrl: 'https://brasiltours.ru/ekskursii',
    sourceLanguage: 'ru',
    translated: false,
    permission: 'approved_full_publication',
    text: 'От самой идеи путешествия до его завершения команда была с нами на связи, подбирала экскурсии и меняла программу по нашим пожеланиям. Поездка по Аргентине, Уругваю и Бразилии превзошла ожидания.',
  },
  {
    id: 'review_dmitry_romanov_19',
    author: 'Дмитрий Романов',
    organization: 'ARSANA TRAVEL BOUTIQUE',
    segment: 'B2B / VIP-клиенты',
    route: 'Бразилия · Сан-Паулу',
    sourceReviewNumber: 19,
    sourceUrl: 'https://brasiltours.ru/ekskursii',
    sourceLanguage: 'ru',
    translated: false,
    permission: 'approved_full_publication',
    text: 'Все было четко и по делу. Особенно ценна была поддержка в самых разных вопросах: от общения с отелями до рекомендации ресторана в Сан-Паулу. Ресторан клиентам очень понравился.',
  },
  {
    id: 'review_clients_quinta_tour_06',
    author: 'Клиенты «Квинта Тур»',
    segment: 'Новогодний multi-country',
    route: 'Бразилия · Аргентина · Уругвай',
    sourceReviewNumber: 6,
    sourceUrl: 'https://brasiltours.ru/ekskursii',
    sourceLanguage: 'ru',
    translated: false,
    permission: 'approved_full_publication',
    text: 'Новогодняя поездка стала одним из самых ярких путешествий: праздник на Копакабане, водопады Игуасу, ледники Патагонии и Буэнос-Айрес. Расписание позволило совместить утренние экскурсии и свободное время для отдыха.',
  },
];

// Confirmed overall company score; individual testimonial star scores are unknown.
export const ADA_REVIEW_RATING = 5;

export const adaReviewPageSchema = (reviews: AdaReview[]) => [
  ...reviews.map((review) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: review.author },
    itemReviewed: { '@id': 'https://adatours.ru/#organization' },
    reviewBody: review.text,
    inLanguage: 'ru',
    citation: review.sourceUrl,
  })),
  {
    '@type': 'AggregateRating',
    itemReviewed: { '@id': 'https://adatours.ru/#organization' },
    ratingValue: ADA_REVIEW_RATING,
    bestRating: 5,
    worstRating: 1,
    reviewCount: reviews.length,
  },
];
