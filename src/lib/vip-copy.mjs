import { vipCountryTitle } from './vip-countries.mjs';
import { countLabel } from './interest-model.mjs';

const dataOf = (entry) => entry?.data ?? entry;
const copy = {
  theme_adventure: {
    title: 'Приключенческие VIP-туры{country}',
    intro: 'Выберите активную программу с треккингом, сплавами или другими приключениями.',
  },
  theme_nature: {
    title: 'VIP-туры{country} для любителей природы',
    intro: 'Выберите путешествие к водопадам, ледникам, вулканам, озерам и тропическим лесам.',
  },
  theme_wildlife: {
    title: 'VIP-туры{country} с наблюдением за животными и сафари',
    intro: 'Сравните программы с наблюдением за дикими животными и птицами, сафари и бердвотчингом.',
  },
  theme_culture: {
    title: 'Культурно-исторические VIP-туры{country}',
    intro: 'Познакомьтесь с историей и местными традициями, посетите древние города и музеи.',
  },
  theme_cruises: {
    title: 'VIP-туры{country} с круизами и экспедициями',
    intro: 'Сравните маршруты круизов и экспедиций, суда и программу на берегу.',
  },
  theme_events: {
    title: 'VIP-туры{country} на праздники и фестивали',
    intro: 'Выберите поездку к карнавалу, фестивалю или другому событию.',
  },
  theme_beach: {
    title: 'VIP-туры{country} с пляжным отдыхом',
    intro: 'Выберите маршрут, в котором есть время для отдыха на пляже.',
  },
  theme_gastronomy_wine: {
    title: 'Гастрономические VIP-туры{country}',
    intro: 'Выберите программу с местной кухней, дегустациями или посещением виноделен.',
  },
  theme_coffee: {
    title: 'Кофейные VIP-туры{country}',
    intro: 'Посетите кофейные плантации, познакомьтесь с производством и попробуйте кофе у его создателей.',
  },
  theme_fishing: {
    title: 'Рыболовные VIP-туры{country}',
    intro: 'Выберите программу по акватории и способу ловли, сравните условия размещения.',
  },
  theme_diving: {
    title: 'VIP-туры{country} с дайвингом',
    intro: 'Выберите путешествие с погружениями, подходящими вашему опыту.',
  },
  theme_motorcycle: {
    title: 'VIP-туры{country} на мотоциклах',
    intro: 'Сравните маршруты и дневные переезды, выберите дорогу для следующей поездки.',
  },
  theme_family: {
    title: 'Семейные VIP-туры{country}',
    intro: 'Выберите путешествие с детьми с учетом их возраста и интересов всей семьи.',
  },
  theme_spa: {
    title: 'VIP-туры{country} со спа-отдыхом',
    intro: 'Совместите новые впечатления со спа-процедурами и временем для себя.',
  },
  theme_weddings_romance: {
    title: 'Романтические VIP-туры{country}',
    intro: 'Выберите путешествие для свадьбы, медового месяца или отдыха вдвоем.',
  },
};

function copyFor(theme) {
  const id = dataOf(theme).id;
  if (!Object.hasOwn(copy, id)) throw new Error(`Missing VIP interest copy: ${id}`);
  return copy[id];
}
const directionFor = (country) => country ? ` ${vipCountryTitle(country).slice('VIP-туры '.length)}` : '';

export function vipFilterTitle(country, theme) {
  if (!theme) return country ? vipCountryTitle(country) : 'VIP-туры';
  return copyFor(theme).title.replace('{country}', directionFor(country));
}

export function tourFilterTitle(country, theme) {
  const title = vipFilterTitle(country, theme).replace('VIP-туры', 'туры');
  return title.charAt(0).toLocaleUpperCase('ru') + title.slice(1);
}

function catalogDescription(country, theme, count, vip) {
  const intro = theme ? copyFor(theme).intro : 'Сравните программы, длительность и стоимость.';
  const forms = vip ? ['VIP-маршрут', 'VIP-маршрута', 'VIP-маршрутов'] : ['маршрут', 'маршрута', 'маршрутов'];
  return `Собрали ${countLabel(count, forms)}${directionFor(country)}. ${intro} Адаптируем поездку под ваши даты и привычный темп.`;
}

export function vipFilterDescription(country, theme, count) {
  return catalogDescription(country, theme, count, true);
}
export function tourFilterDescription(country, theme, count) {
  return catalogDescription(country, theme, count, false);
}

/** Shared introductory wording for combined catalogues; never infer a new service. */
export function tourFilterIntro(theme) {
  return copy[dataOf(theme)?.id]?.intro ?? 'Сравните программы, длительность и стоимость поездок.';
}
