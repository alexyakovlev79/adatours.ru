/** Source-bound exception for one confirmed legacy photo on an EN Tour page.
 * This external legacy src is never added to the shared /media/ identity map.
 * The noindex EN HTML view only (including its noscript duplicate) is changed.
 */
const src="https://brasiltours.ru/image/catalog/category/B/N/BN713_10.jpg";
const altRu='Двое мальчиков на оживленной улице среди прохожих';
const altEn='Two boys on a busy street among pedestrians';
const titleRu='Уличная сцена: улыбающиеся дети у торговых рядов';
const titleEn='Street scene: smiling children beside market stalls';

export function localizeKnownLegacyPhotoHtml(html,locale='en') {
  if(locale!=='en'||typeof html!=='string'||!html.includes(src))return html;
  return html.replace(/<img\b[^>]*>/gi,tag=>{
    if(!tag.includes('src="'+src+'"'))return tag;
    return tag.replace('alt="'+altRu+'"','alt="'+altEn+'"')
      .replace('title="'+titleRu+'"','title="'+titleEn+'"');
  });
}
