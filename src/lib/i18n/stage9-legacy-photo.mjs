/** Source-bound exception for one confirmed legacy photo on an EN Tour page.
 * This external legacy src is never added to the shared /media/ identity map.
 * The noindex EN HTML view only (including its noscript duplicate) is changed.
 */
const src="https://brasiltours.ru/image/catalog/category/B/N/BN713_10.jpg";
const altRu='Двое мальчиков на оживленной улице среди прохожих';
const altEn='Two boys on a busy street among pedestrians';
const titleRu='Уличная сцена: улыбающиеся дети у торговых рядов';
const titleEn='Street scene: smiling children beside market stalls';

const annaSrc='https://img.adatours.ru/media/people/anna-avanesova/photo-provided-20261009-v1.jpg';
const annaAltRu='Портрет Анны Аванесовой, основательницы Ada Tours';
const annaAltEn='Portrait of Anna Avanesova, founder of Ada Tours';
const annaTitleRu='Анна Аванесова: портрет основательницы Ada Tours';
const annaTitleEn='Anna Avanesova: portrait of the founder of Ada Tours';

export function localizeKnownLegacyPhotoHtml(html,locale='en') {
  if(locale!=='en'||typeof html!=='string'||(!html.includes(src)&&!html.includes(annaSrc)))return html;
  return html.replace(/<img\b[^>]*>/gi,tag=>{
    if(tag.includes('src="'+src+'"'))
      return tag.replace('alt="'+altRu+'"','alt="'+altEn+'"')
        .replace('title="'+titleRu+'"','title="'+titleEn+'"');
    if(tag.includes('src="'+annaSrc+'"'))
      return tag.replace('alt="'+annaAltRu+'"','alt="'+annaAltEn+'"')
        .replace('title="'+annaTitleRu+'"','title="'+annaTitleEn+'"');
    return tag;
  });
}
