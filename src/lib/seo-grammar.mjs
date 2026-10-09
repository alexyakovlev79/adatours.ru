import table from '../data/seo/geo-case-table.json' with { type: 'json' };
export const SEO_CASES = table;
const countryNames=Object.values(table.countries);
export function seoCountryCase(idOrName, grammaticalCase = 'prepositional') {
 const row=table.countries[idOrName] ?? countryNames.find(value=>value.name===idOrName);
 return row?.[grammaticalCase] ?? row?.name ?? idOrName ?? '';
}
export function seoCountryName(idOrName) { return seoCountryCase(idOrName,'name'); }
function inflectLocative(name) {
 const words=name.split(/\s+/),last=words.pop() || '';
 let result=last;
 if(/ия$/iu.test(last))result=last.replace(/ия$/iu,'ии');
 else if(/(?:ый|ий)$/iu.test(last))result=last.replace(/(?:ый|ий)$/iu,'ом');
 else if(/ая$/iu.test(last))result=last.replace(/ая$/iu,'ой');
 else if(/[ая]$/iu.test(last))result=last.slice(0,-1)+'е';
 else if(/ь$/iu.test(last))result=last.slice(0,-1)+'и';
 else if(/й$/iu.test(last))result=last.slice(0,-1)+'е';
 else if(/[бвгджзклмнпрстфхцчшщ]$/iu.test(last))result=last+'е';
 return [...words,result].join(' ');
}
function locativeRow(id,name) {
 const row=table.destinations[id];
 if(row && (!name || row.name===name))return row;
 return null;
}
export function seoPlacePhrase(id, fallbackName = '') {
 const row=locativeRow(id,fallbackName);
 if(row)return row.preposition+' '+row.prepositional;
 const name=fallbackName || table.destinations[id]?.name || '';
 return name?'в '+inflectLocative(name):'';
}
const GEO_DIRECTION_EXCEPTIONS=Object.freeze({
 'Гвианская Амазония':'в Гвианскую Амазонию',
 'Золотой путь Бразилии':'на Золотой путь Бразилии',
 'Дельта реки Ориноко':'в дельту реки Ориноко',
 'Солнечный остров':'на Солнечный остров',
 'Солончак Уюни':'на солончак Уюни',
 'Фернанду-ди-Норонья':'на Фернанду-ди-Норонья',
 'Канайма и водопад Анхель':'в Канайму и к водопаду Анхель',
 'Манаус и Амазония':'в Манаус и Амазонию',
 'Пуно и о.Титикака':'в Пуно и на озеро Титикака',
 'Тикаль & Флорес':'в Тикаль и Флорес',
 'Монтеверде & Санта Елена':'в Монтеверде и Санта-Елену',
 'Ла Фортуна & Вулкан Ареналь':'в Ла-Фортуну и к вулкану Ареналь',
 'Линии Наска и Острова Бальестас':'к линиям Наска и на острова Бальестас',
 'Вальпараисо и Винья дель Мар':'в Вальпараисо и Винья-дель-Мар',
 'Остров Пасхи':'на остров Пасхи',
 'Галапагосские острова':'на Галапагосские острова',
 'Лос Рокес':'на острова Лос-Рокес',
 'Плайя-дель-Кармен':'в Плайя-дель-Кармен',
 'Колония дель Сакраменто':'в Колонию-дель-Сакраменто'
});
export function seoPlaceDirectionPhrase(id,fallbackName='') {
 const name=fallbackName||table.destinations[id]?.name||'';
 if(!name)return '';
 if(GEO_DIRECTION_EXCEPTIONS[name])return GEO_DIRECTION_EXCEPTIONS[name];
 if(/^Острова\s/iu.test(name))return 'на острова '+name.slice(8);
 if(/^Остров\s/iu.test(name))return 'на остров '+name.slice(7);
 if(/^Озеро\s/iu.test(name))return 'на озеро '+name.slice(6);
 if(/^Гора\s/iu.test(name))return 'на гору '+name.slice(5);
 if(/^Полуостров\s/iu.test(name))return 'на полуостров '+name.slice(11);
 if(/^Архипелаг\s/iu.test(name))return 'на архипелаг '+name.slice(10);
 if(/^Водопад\s/iu.test(name))return 'к водопаду '+name.slice(8);
 if(/^Водопады\s/iu.test(name))return 'к водопадам '+name.slice(9);
 if(/^Лагуна\s/iu.test(name))return 'на лагуну '+name.slice(7);
 if(/^Река\s/iu.test(name))return 'на реку '+name.slice(5);
 if(/^Пляж\s/iu.test(name))return 'на пляж '+name.slice(5);
 if(/^Национальный парк\s/iu.test(name))return 'в национальный парк '+name.slice(19);
 if(/^Долина\s/iu.test(name))return 'в долину '+name.slice(7);
 if(/^Солончак\s/iu.test(name))return 'на солончак '+name.slice(9);
 if(/^Сенот\s/iu.test(name))return 'в сенот '+name.slice(6);
 if(/^Архипелаг\s/iu.test(name))return 'на архипелаг '+name.slice(10);
 if(/^Вулкан\s/iu.test(name))return 'на вулкан '+name.slice(7);
 if(/^Каньон\s/iu.test(name))return 'в каньон '+name.slice(7);
 if(/^Пещера\s/iu.test(name))return 'в пещеру '+name.slice(7);
 if(/^Космодром\s/iu.test(name))return 'на космодром '+name.slice(10);
 if(/^Парк\s/iu.test(name))return 'в парк '+name.slice(5);
 if(/^Заповедник\s/iu.test(name))return 'в заповедник '+name.slice(11);
 if(/^Плато\s/iu.test(name))return 'на плато '+name.slice(6);
 if(/^Залив\s/iu.test(name))return 'в залив '+name.slice(6);
 if(/^Мыс\s/iu.test(name))return 'на мыс '+name.slice(4);
 if(name==='Галапагосские острова')return 'на Галапагосские острова';
 if(name==='Самаипата')return 'в Самаипату';
 const parts=name.split(/\s+/);
 const last=parts.at(-1);
 if(/ия$/iu.test(last))parts[parts.length-1]=last.replace(/ия$/iu,'ию');
 else if(/а$/iu.test(last))parts[parts.length-1]=last.slice(0,-1)+'у';
 else if(/я$/iu.test(last))parts[parts.length-1]=last.slice(0,-1)+'ю';
 const row=locativeRow(id,name);
 const prep=row?.preposition==='на'?'на':'в';
 return prep+' '+parts.join(' ');
}
export function seoInterestCase(id, grammaticalCase = 'name') {
 return table.interests[id]?.[grammaticalCase] ?? table.interests[id]?.name ?? '';
}
