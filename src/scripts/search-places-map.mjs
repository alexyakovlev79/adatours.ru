// Imported only when visitors enter the Places tab of search.
import {indexSearchGeoPlaces,searchGeoPoints}
  from '../lib/search-geo-place-matches.mjs';
import {loadProviderScript} from './geo-map-client.mjs';

export function createSearchPlacesMap(root) {
  const canvas=root.querySelector('[data-search-map-canvas]');
  const status=root.querySelector('[data-search-map-status]');
  const card=root.querySelector('[data-search-map-card]');
  const cardLink=root.querySelector('[data-search-map-link]');
  const close=root.querySelector('[data-search-map-card-close]');
  const keys={yandex:root.dataset.yandexKey,google:root.dataset.googleKey};
  let geoPromise=null, providerPromise=null, instance=null, desired=[],generation=0;
  let lastPaint='';
  const showStatus=message=>{
    if(!status)return;
    status.textContent=message;
    status.hidden=false;
  };
  const select=point=>{
    if(!card||!cardLink)return;
    cardLink.href=point.href;
    cardLink.textContent=point.name+' ↗';
    card.hidden=false;
  };
  close?.addEventListener('click',()=>{card.hidden=true;});
  const createPin=(point,onSelect)=>{
    const button=document.createElement('button');
    button.type='button';button.className='search-places-map__pin';
    button.textContent=String(point.position);button.title=point.name;
    button.setAttribute('aria-label',point.name+': показать место');
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();onSelect(point);
    });
    return button;
  };
  const getGeo=()=>{
    if(!geoPromise)geoPromise=fetch(root.dataset.geoUrl,{credentials:'same-origin'})
      .then(response=>{
        if(!response.ok)throw Error('GEO index HTTP '+response.status);
        return response.json();
      }).then(indexSearchGeoPlaces).catch(error=>{
        geoPromise=null;throw error;
      });
    return geoPromise;
  };
  const mount=async(initial)=>{
    let failure;
    for(const provider of ['yandex','google']){
      if(!keys[provider])continue;
      try{
        const data={points:initial,route:[],center:initial[0].coordinates,zoom:8};
        if(provider==='yandex'){
          const m=await import('./geo-map-yandex.mjs');
          const map=await m.renderYandexMap(canvas,data,keys.yandex,select,
            loadProviderScript,createPin,'ru');
          return {map,redraw:m.redrawYandexSearchPoints};
        }
        const m=await import('./geo-map-google.mjs');
        const map=await m.renderGoogleMap(canvas,data,keys.google,
          root.dataset.googleMapId||'',select,loadProviderScript,createPin,'ru');
        return {map,redraw:m.redrawGoogleSearchPoints};
      }catch(error){failure=error;canvas.replaceChildren();}
    }
    throw failure||Error('Нет настроенного картографического API');
  };
  const signature=points=>points.map(p=>p.id+'|'+p.position).join(';');
  const redraw=points=>{
    if(!instance)return;
    const key=signature(points);
    if(key===lastPaint)return;
    instance.redraw(instance.map,canvas,{points,route:[]},select,createPin);
    lastPaint=key;
  };
  return {
    async update(results){
      const current=++generation;
      const geo=await getGeo();
      if(current!==generation||root.hidden)return;
      desired=searchGeoPoints(results,geo);
      if(card)card.hidden=true;
      if(!desired.length){
        redraw([]);
        showStatus('У найденных мест пока нет подтвержденных координат.');
        return;
      }
      showStatus('Загружаем карту…');
      try{
        if(!providerPromise){
          const initial=desired;
          providerPromise=mount(initial).then(controller=>({
            ...controller,initialSignature:signature(initial),
          })).catch(error=>{providerPromise=null;throw error;});
        }
        const ready=await providerPromise;
        if(!instance){
          instance=ready;
          lastPaint=ready.initialSignature;
        }
        if(current!==generation||root.hidden){
          // The visitor may have cleared or changed tabs during API setup.
          if(!desired.length)redraw([]);
          return;
        }
        redraw(desired);
        if(status)status.hidden=true;
      }catch(error){
        showStatus('Карта временно недоступна. Список мест работает.');
        console.warn('[Ada Tours search map]',String(error?.message||error).slice(0,160));
      }
    },
    clear(){
      ++generation;desired=[];redraw([]);
      if(card)card.hidden=true;
      showStatus('Введите хотя бы 2 символа, чтобы увидеть места на карте.');
    },
    suspend(){
      ++generation;desired=[];redraw([]);
      if(card)card.hidden=true;
      showStatus('Введите хотя бы 2 символа, чтобы увидеть места на карте.');
    },
  };
}
