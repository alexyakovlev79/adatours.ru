/** Stable taxonomy for destination cards, filters, source contracts and navigation. */
export const DESTINATION_TYPES=Object.freeze([
'city','town','village','district','region','island','national_park','resort',
'natural_area','route_cluster','mountain','volcano','glacier','waterfall',
'lake','river','beach','canyon','cave','desert','valley','forest','wetland',
'archaeological_site','historic_site','museum','monument','religious_site',
'viewpoint','square','building','garden','peninsula','bay','attraction','other_landmark'
]);
export const NAVIGATION_ROLES=Object.freeze(['hub','sight']);
export const TYPE_LABELS=Object.freeze({
city:'Город',town:'Городок',village:'Деревня',district:'Район',region:'Регион',
island:'Остров',national_park:'Национальный парк',resort:'Курорт',
natural_area:'Природная территория',route_cluster:'Маршрут и окрестности',
mountain:'Гора',volcano:'Вулкан',glacier:'Ледник',waterfall:'Водопад',
lake:'Озеро',river:'Река',beach:'Пляж',canyon:'Каньон',cave:'Пещера',
desert:'Пустыня',valley:'Долина',forest:'Лес',wetland:'Водно-болотная территория',
archaeological_site:'Археологический объект',historic_site:'Историческое место',
museum:'Музей',monument:'Памятник',religious_site:'Религиозный объект',
viewpoint:'Смотровая площадка',square:'Площадь',building:'Здание',
garden:'Сад и парк',peninsula:'Полуостров',bay:'Залив',
attraction:'Аттракцион',other_landmark:'Достопримечательность'
});
const typeSet=new Set(DESTINATION_TYPES),roleSet=new Set(NAVIGATION_ROLES);
export const isDestinationType=value=>typeSet.has(value);
export const isNavigationRole=value=>roleSet.has(value);
export const destinationTypeLabel=value=>TYPE_LABELS[value]??'Место';
export const isNavigationHub=place=>(place?.data??place)?.navigationRole==='hub';
export const isNavigationSight=place=>(place?.data??place)?.navigationRole==='sight';
/** A hub/sight decision is independent of geographic type. */
export function compareDestinationsForNavigation(a,b,fallback=()=>0){
 const x=a?.data??a,y=b?.data??b;
 const role=v=>v.navigationRole==='hub'?0:v.navigationRole==='sight'?1:2;
 const subtype=v=>['city','town','region','district','resort','route_cluster'].includes(v.destinationType)?0:
   ['national_park','natural_area','island','peninsula'].includes(v.destinationType)?1:2;
 return role(x)-role(y)||(role(x)===0?subtype(x)-subtype(y):0)||fallback(a,b);
}
