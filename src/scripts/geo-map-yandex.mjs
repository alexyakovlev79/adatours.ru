import {fitGeoCamera} from '../lib/geo-map-camera.mjs';
import {coordinateKey, screenRouteGeometry} from '../lib/geo-map-screen-route.mjs';

// Route SVG uses the actual DOM positions of YMapMarker pins.
// Native YMapFeature line geometry previously appeared far west of those pins.
const SVG_NS = 'http://www.w3.org/2000/svg';
function failure(stage,error){
  const detail=error instanceof Error?error.message:String(error??'Unknown error');
  const wrapped=new Error(detail);
  wrapped.mapCode=stage;wrapped.name='GeoMapProviderError';
  return wrapped;
}
function withDeadline(promise,milliseconds){
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('API readiness timed out')),milliseconds);
    }),
  ]).finally(()=>clearTimeout(timer));
}
function svgNode(name,attributes){
  const node=document.createElementNS(SVG_NS,name);
  for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
  return node;
}
function paintRoute(svg,route,anchors){
  const viewport=svg.getBoundingClientRect();
  if(!viewport.width||!viewport.height)return false;
  const rectangles=new Map();
  for(const [key,element] of anchors)
    if(element.isConnected)rectangles.set(key,element.getBoundingClientRect());
  const {segments,arrows}=screenRouteGeometry(route,rectangles,viewport);
  svg.setAttribute('viewBox','0 0 '+viewport.width+' '+viewport.height);
  const result=[];
  for(const {x1,y1,x2,y2} of segments){
    result.push(svgNode('path',{
      d:'M '+x1+' '+y1+' L '+x2+' '+y2,
      fill:'none',stroke:'#8E691F','stroke-width':2.8,
      'stroke-linecap':'round',
    }));
  }
  for(const {x,y,angle} of arrows){
    const ux=Math.cos(angle),uy=Math.sin(angle);
    const px=-uy,py=ux;
    const tip=[x+ux*9,y+uy*9];
    const tail=[x-ux*5,y-uy*5];
    const left=[tail[0]+px*5,tail[1]+py*5];
    const right=[tail[0]-px*5,tail[1]-py*5];
    result.push(svgNode('path',{
      d:'M '+tip.join(' ')+' L '+left.join(' ')+' L '+right.join(' ')+' Z',
      fill:'#8E691F',stroke:'#FFFCF8','stroke-width':1.1,
      'stroke-linejoin':'round',
    }));
  }
  svg.replaceChildren(...result);
  return rectangles.size>=2;
}
function attachRouteOverlay(canvas,map,route,anchors,YMapListener){
  if(!Array.isArray(route)||route.length<2)return;
  const viewport=canvas.parentElement;
  if(!viewport||typeof document==='undefined')return;
  viewport.querySelector('[data-geo-map-route-overlay]')?.remove();
  const svg=svgNode('svg',{
    'data-geo-map-route-overlay':'','aria-hidden':'true',
    'preserveAspectRatio':'none',focusable:'false',
  });
  svg.classList.add('geo-map__route-overlay');
  viewport.appendChild(svg);
  let pending=false;
  const schedule=()=>{
    if(pending||!svg.isConnected)return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      if(svg.isConnected)paintRoute(svg,route,anchors);
    });
  };
  // Painting after the API's own DOM update keeps the line on its marker pins.
  map.addChild(new YMapListener({onUpdate:schedule}));
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(schedule);
    observer.observe(viewport);
  }
  schedule();
  // Markers sometimes enter the DOM asynchronously after construction.
  let warmupFrames=0;
  const warmup=()=>{
    if(!svg.isConnected)return;
    schedule();
    if([...anchors.values()].some(element=>!element.isConnected)&&
       ++warmupFrames<16)requestAnimationFrame(warmup);
  };
  requestAnimationFrame(warmup);
}
// Yandex Maps JS API 3; no geocoding, Directions API or map-route service.
export async function renderYandexMap(
  canvas,data,key,onSelect,loadScript,createPin,locale='ru',_createArrow
){
  const url='https://api-maps.yandex.ru/v3/?apikey='+
    encodeURIComponent(key)+'&lang='+(locale==='ru'?'ru_RU':'en_US');
  try{await loadScript('yandex-maps-v3',url);}
  catch(error){throw failure('YANDEX_SCRIPT',error);}
  const ymaps=window.ymaps3;
  if(!ymaps)throw failure('YANDEX_GLOBAL','The JS API script did not define ymaps3');
  try{await withDeadline(ymaps.ready,20000);}
  catch(error){throw failure('YANDEX_READY',error);}
  const {YMap,YMapDefaultSchemeLayer,YMapDefaultFeaturesLayer,YMapMarker,YMapListener}=ymaps;
  if(![YMap,YMapDefaultSchemeLayer,YMapDefaultFeaturesLayer,YMapMarker,YMapListener]
     .every(x=>typeof x==='function'))
    throw failure('YANDEX_EXPORTS','A required Yandex JS API component is unavailable');

  const coordinates=data.route?.length?data.route:data.points.map(p=>p.coordinates);
  const camera=fitGeoCamera(coordinates,{
    width:canvas.clientWidth,height:canvas.clientHeight,pointZoom:data.zoom,
  });
  const location=camera||{center:data.center,zoom:data.zoom};
  let map;
  try{
    map=new YMap(canvas,{location,theme:'light'});
    map.addChild(new YMapDefaultSchemeLayer());
    map.addChild(new YMapDefaultFeaturesLayer({zIndex:1800}));
  }catch(error){throw failure('YANDEX_CREATE',error);}

  const anchors=new Map();
  try{
    for(const point of data.points){
      const marker=createPin(point,onSelect);
      anchors.set(coordinateKey(point.coordinates),marker);
      map.addChild(new YMapMarker({
        coordinates:point.coordinates,zIndex:100,
      },marker));
    }
    attachRouteOverlay(canvas,map,data.route,anchors,YMapListener);
  }catch(error){throw failure('YANDEX_MARKERS',error);}
  return map;
}
