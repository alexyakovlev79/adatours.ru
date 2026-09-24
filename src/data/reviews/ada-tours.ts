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
    sourceReviewNumber: 1,
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
    sourceReviewNumber: 24,
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
];
