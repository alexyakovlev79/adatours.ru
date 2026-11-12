/** Exact, locale-scoped copy for the six MICE/DMC commercial pages.
 * RU remains the canonical source. Never replace substrings, IDs, prices,
 * URLs, media paths or original testimonials.
 */
import t0 from '../../data/i18n/commercial/mice-overview.en.json' with {type:'json'};
import t1 from '../../data/i18n/commercial/mice-delegations.en.json' with {type:'json'};
import t2 from '../../data/i18n/commercial/mice-programmes.en.json' with {type:'json'};
import t3 from '../../data/i18n/commercial/dmc-overview.en.json' with {type:'json'};
import t4 from '../../data/i18n/commercial/dmc-agencies.en.json' with {type:'json'};
import t5 from '../../data/i18n/commercial/dmc-terms.en.json' with {type:'json'};
import {translateUiText} from './shared-ui-locale.mjs';

const sources = [t0, t1, t2, t3, t4, t5];
const extraPairs = [
  [
    "Турагентствам",
    "For travel agencies"
  ],
  [
    "Условия работы",
    "Partnership terms"
  ],
  [
    "B2B-программы",
    "B2B programmes"
  ],
  [
    "MICE и корпоративные поездки",
    "MICE and corporate travel"
  ],
  [
    "Деловые делегации",
    "Business delegations"
  ],
  [
    "Раздел для агентств",
    "Agency section"
  ],
  [
    "Раздел MICE",
    "MICE section"
  ],
  [
    "Для агентств · Разделы",
    "For agencies · Sections"
  ],
  [
    "MICE · Разделы",
    "MICE · Sections"
  ],
  [
    "Вопросы о работе с Ada Tours",
    "Questions about working with Ada Tours"
  ],
  [
    "Вопросы и ответы",
    "Questions and answers"
  ],
  [
    "Выполненные проекты",
    "Completed projects"
  ],
  [
    "Задача и работа команды",
    "The brief and our work"
  ],
  [
    "Для бизнеса",
    "For business"
  ],
  [
    "Бразилия и Латинская Америка",
    "Brazil and Latin America"
  ],
  [
    "Подробнее",
    "Learn more"
  ],
  [
    "Поездка, которую хочется повторить",
    "A journey worth repeating"
  ],
  [
    "После путешествия",
    "After the journey"
  ],
  [
    "Как была устроена эта поездка",
    "How the trip was organised"
  ],
  [
    "Обсудите задачу с командой, которая работает на месте",
    "Discuss your plans with our local team"
  ],
  [
    "Ada Tours работает из Рио-де-Жанейро. Основатель компании Анна Аванесова знакомит партнеров с направлениями и практикой организации поездок на [вебинарах для турагентств](/webinars/). Пришлите вашу задачу: команда свяжет пожелания гостей с маршрутом и условиями местных поставщиков.",
    "Ada Tours is based in Rio de Janeiro. Founder Anna Avanesova introduces partners to the destinations and the practicalities of arranging travel in our [webinars for travel agencies](/webinars/). Tell us what your guests need and we will match their preferences with the itinerary and local supplier arrangements."
  ],
  [
    "Экспертиза Ada Tours",
    "Ada Tours expertise"
  ],
  [
    "Анна Аванесова",
    "Anna Avanesova"
  ],
  [
    "Основатель и руководитель Ada Tours",
    "Founder and director of Ada Tours"
  ],
  [
    "Анна Аванесова, основатель Ada Tours",
    "Anna Avanesova, founder of Ada Tours"
  ],
  [
    "Опыт и выступления Анны",
    "Anna’s experience and talks"
  ],
  [
    "Деловая делегация в Сан-Паулу и Кампинасе",
    "Business delegation to São Paulo and Campinas"
  ],
  [
    "Корпоративная группа в Рио и Ангра-дус-Рейш",
    "Corporate group in Rio and Angra dos Reis"
  ],
  [
    "Перу и Боливия: от Амазонии до Уюни",
    "Peru and Bolivia: from the Amazon to Uyuni"
  ],
  [
    "MICE / деловые делегации",
    "MICE / business delegations"
  ],
  [
    "MICE / корпоративные группы",
    "MICE / corporate groups"
  ],
  [
    "Индивидуальные поездки по нескольким странам",
    "Private multi-country journeys"
  ],
  [
    "8 человек",
    "8 guests"
  ],
  [
    "30 человек",
    "30 guests"
  ],
  [
    "Английский",
    "English"
  ],
  [
    "Русский",
    "Russian"
  ],
  [
    "Китайский",
    "Chinese"
  ],
  [
    "Японский",
    "Japanese"
  ],
  [
    "Арабский",
    "Arabic"
  ],
  [
    "Малайский",
    "Malay"
  ],
  [
    "Испанский",
    "Spanish"
  ]
];
const english = new Map();
for(const source of sources)for(const {ru,en} of source.entries) {
  if(typeof ru!=='string'||typeof en!=='string'||!ru.trim()||!en.trim())
    throw Error('Invalid MICE/DMC English translation');
  if(english.has(ru) && english.get(ru)!==en)
    throw Error('Conflicting MICE/DMC English translation: '+ru);
  english.set(ru,en);
}
for(const [ru,en] of extraPairs) {
  if(english.has(ru) && english.get(ru)!==en)
    throw Error('Conflicting shared commercial English translation: '+ru);
  english.set(ru,en);
}
export const commercialTranslationCount=english.size;
export function commercialText(value,locale='ru'){
  if(locale!=='en'||typeof value!=='string')return value;
  return english.get(value)??translateUiText(value,locale);
}
