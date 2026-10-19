// Load the provider map on the explicit click opening search.
// GEO index and marker updates are delayed until the Places tab is selected.
import {indexSearchGeoPlaces,searchGeoPoints}
  from '../lib/search-geo-place-matches.mjs';
import {loadProviderScript} from './geo-map-client.mjs';

export function createSearchPlacesMap(root) {
  const canvas=root.querySelector('[data-search-map-canvas]');
  const status=root.querySelector('[data-search-map-status]');
  const card=root.querySelector('[data-search-map-card]');
  const cardLink=root.querySelector('[data-search-map-link]');
  const cardTitle=root.querySelector('[data-search-map-title]');
  const cardSummary=root.querySelector('[data-search-map-description]');
  const cardPhoto=root.querySelector('[data-search-map-photo]');
  const close=root.querySelector('[data-search-map-card-close]');
  const keys={yandex:root.dataset.yandexKey,google:root.dataset.googleKey};
  let geoPromise=null,providerPromise=null,instance=null,generation=0;
  let lastPaint='',active=false;
  const DEFAULT_CENTER=[-62,-15];
  const showStatus=message=>{
    if(!status||!active)return;
    status.textContent=message;status.hidden=false;
  };
  const hideCard=()=>{if(card)card.hidden=true;};
  const photoUrl=value=>{
    const image=String(value||'').trim();
    if(!image)return '';
    if(image.startsWith('/media/'))
      return (root.dataset.mediaOrigin||'https://img.adatours.ru').replace(/\/$/,'')+image;
    if(image.startsWith('/')&&!image.startsWith('//'))
      return new URL(image,window.location.origin).href;
    return /^https?:\/\//i.test(image)?image:'';
  };
  const select=point=>{
    if(!card||!cardLink||!cardTitle||!cardSummary||!cardPhoto)return;
    cardTitle.textContent=point.name;
    cardSummary.textContent=point.description||'';
    cardSummary.hidden=!point.description;
    const photo=photoUrl(point.image);
    if(photo){cardPhoto.src=photo;cardPhoto.alt=point.name;cardPhoto.hidden=false;}
    else{cardPhoto.removeAttribute('src');cardPhoto.hidden=true;}
    cardLink.href=point.href;
    card.hidden=false;
  };
  close?.addEventListener('click',hideCard);
  const createPin=(point,onSelect)=>{
    const button=document.createElement('button');
    button.type='button';button.className='search-places-map__pin';
    button.textContent=String(point.position);button.title=point.name;
    button.setAttribute('aria-label',point.name+': показать место');
    button.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();onSelect(point);
    });
    return button;
  };
  const getGeo=()=>{
    if(!geoPromise)geoPromise=fetch(root.dataset.geoUrl,{credentials:'same-origin'})
      .then(response=>{if(!response.ok)throw Error('GEO index HTTP '+response.status);
        return response.json();})
      .then(indexSearchGeoPlaces)
      .catch(error=>{geoPromise=null;throw error;});
    return geoPromise;
  };
  const mount=async()=>{
    let error;
    const data={points:[],route:[],center:DEFAULT_CENTER,zoom:3};
    for(const provider of ['yandex','google']){
      if(!keys[provider])continue;
      try{
        if(provider==='yandex'){
          const mod=await import('./geo-map-yandex.mjs');
          const map=await mod.renderYandexMap(canvas,data,keys.yandex,select,
            loadProviderScript,createPin,'ru');
          return {map,redraw:mod.redrawYandexSearchPoints};
        }
        const mod=await import('./geo-map-google.mjs');
        const map=await mod.renderGoogleMap(canvas,data,keys.google,
          root.dataset.googleMapId||'',select,loadProviderScript,createPin,'ru');
        return {map,redraw:mod.redrawGoogleSearchPoints};
      }catch(e){error=e;canvas.replaceChildren();}
    }
    throw error||Error('Нет настроенного картографического API');
  };
  const ensureMap=async()=>{
    if(!providerPromise)providerPromise=mount().catch(e=>{
      providerPromise=null;throw e;
    });
    const ready=await providerPromise;
    if(!instance)instance=ready;
    return instance;
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
    show(visible){
      active=visible;
      root.hidden=false;
      root.classList.toggle('is-preparing',!visible);
      root.setAttribute('aria-hidden',String(!visible));
      if(!visible)hideCard();
      else if(instance&&status&&lastPaint)status.hidden=true;
    },
    async prewarm(){
      root.hidden=false;
      if(!active)root.classList.add('is-preparing');
      await new Promise(resolve=>requestAnimationFrame(resolve));
      try{await ensureMap();}
      catch(error){
        showStatus('Карта временно недоступна. Список мест работает.');
        console.warn('[Ada Tours search map]',String(error?.message||error).slice(0,160));
      }
    },
    async update(results){
      const current=++generation;
      showStatus('Обновляем места на карте…');
      try{
        const [geo]=await Promise.all([getGeo(),ensureMap()]);
        if(current!==generation||!active)return;
        const points=searchGeoPoints(results,geo);
        hideCard();redraw(points);
        if(!points.length){
          showStatus('У найденных мест пока нет подтвержденных координат.');
          return;
        }
        if(status)status.hidden=true;
      }catch(error){
        if(current!==generation||!active)return;
        showStatus('Карта временно недоступна. Список мест работает.');
        console.warn('[Ada Tours search map]',String(error?.message||error).slice(0,160));
      }
    },
    clear(){
      ++generation;redraw([]);hideCard();
      showStatus('Введите хотя бы 2 символа, чтобы увидеть места на карте.');
    },
    suspend(){++generation;redraw([]);hideCard();},
  };
}
