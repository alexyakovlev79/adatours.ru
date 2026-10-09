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
export function seoPlaceDirectionPhrase(id,fallbackName='') {
 const name=fallbackName||table.destinations[id]?.name||'';
 if(!name)return '';
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
