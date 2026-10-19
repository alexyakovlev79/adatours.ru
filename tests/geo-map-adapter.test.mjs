import test from 'node:test';
import assert from 'node:assert/strict';
import {renderYandexMap} from '../src/scripts/geo-map-yandex.mjs';
import {renderGoogleMap} from '../src/scripts/geo-map-google.mjs';

const sample = {
  points: [
    {id:'rio',name:'Рио-де-Жанейро',position:1,coordinates:[-43.205,-22.911]},
    {id:'iguacu',name:'Фоз-ду-Игуасу',position:2,coordinates:[-54.587,-25.540]},
    {id:'lima',name:'Лима',position:3,coordinates:[-77.038,-12.060]},
  ],
  route:[[-43.205,-22.911],[-54.587,-25.540],[-77.038,-12.060]],
  bounds:{west:-77.038,east:-43.205,south:-25.54,north:-12.06},
  center:[-43.205,-22.911],zoom:6,
};

test('Yandex route uses a matching vector source, fitted camera, arrows and pins',async()=>{
  const previous=globalThis.window;
  class Map {
    constructor(root,props){this.root=root;this.props=props;this.children=[];}
    addChild(child){this.children.push(child);}
  }
  class Layer {constructor(props={}){this.props=props;}}
  class Feature {constructor(props){this.props=props;}}
  class Marker {constructor(props,element){this.props=props;this.element=element;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:Map,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Feature,YMapMarker:Marker,
  }};
  try {
    const canvas={clientWidth:1030,clientHeight:480};
    const map=await renderYandexMap(canvas,sample,'TEST_BROWSER_KEY',
      ()=>{},async()=>{},p=>({kind:'pin',id:p.id}),'ru',angle=>({kind:'arrow',angle}));
    assert.deepEqual(map.props.location.center.length,2);
    assert.ok(map.props.location.zoom<sample.zoom);
    assert.ok(!('bounds' in map.props.location));
    assert.equal(map.children[1].props.source,'adatours-route-lines');
    const routes=map.children.filter(x=>x instanceof Feature);
    assert.equal(routes.length,sample.route.length-1);
    assert.ok(routes.every(x=>x.props.source===map.children[1].props.source));
    assert.deepEqual(routes[0].props.geometry.coordinates,sample.route.slice(0,2));
    assert.deepEqual(routes[1].props.geometry.coordinates,sample.route.slice(1,3));
    assert.ok(routes.every(x=>x.props.style.stroke.length===1));
    assert.ok(routes.every(x=>x.props.style.stroke[0].color!=='#FFFCF8'));
    assert.equal(map.children.filter(x=>x instanceof Marker && x.element.kind==='pin').length,3);
    assert.ok(map.children.some(x=>x instanceof Marker && x.element.kind==='arrow'));
    assert.ok(map.children.filter(x=>x instanceof Marker && x.element.kind==='pin').every(x=>x.props.zIndex===100));
  } finally {globalThis.window=previous;}
});

test('Yandex one-place map has no route or arrows',async()=>{
  const previous=globalThis.window;
  class Map {constructor(root,props){this.props=props;this.children=[];}addChild(x){this.children.push(x);}}
  class Layer {constructor(props={}){this.props=props;}}
  class Feature {constructor(props){this.props=props;}}
  class Marker {constructor(props,element){this.props=props;this.element=element;}}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:Map,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Feature,YMapMarker:Marker,
  }};
  try{
    const data={...sample,points:[sample.points[0]],route:[sample.route[0]]};
    const map=await renderYandexMap({clientWidth:390,clientHeight:445},data,'TEST',
      ()=>{},async()=>{},()=>({kind:'pin'}),'ru',()=>({kind:'arrow'}));
    assert.equal(map.props.location.zoom,sample.zoom);
    assert.equal(map.children.filter(x=>x instanceof Feature).length,0);
    assert.equal(map.children.filter(x=>x instanceof Marker).length,1);
  }finally {globalThis.window=previous;}
});

test('Yandex provider still categorizes network and initialization failures',async()=>{
  await assert.rejects(
    renderYandexMap({},sample,'TEST_KEY',()=>{},
      async()=>{throw Error('Blocked network request');},()=>({})),
    e=>e.mapCode==='YANDEX_SCRIPT' && !e.message.includes('TEST_KEY'),
  );
  const previous=globalThis.window;
  class BadMap{constructor(){throw Error('Bad map constructor');}}
  class Layer{}
  globalThis.window={ymaps3:{
    ready:Promise.resolve(),YMap:BadMap,YMapDefaultSchemeLayer:Layer,
    YMapDefaultFeaturesLayer:Layer,YMapFeature:Layer,YMapMarker:Layer,
  }};
  try {
    await assert.rejects(renderYandexMap({},sample,'TEST_KEY',()=>{},
      async()=>{},()=>({})),e=>e.mapCode==='YANDEX_CREATE');
  }finally{globalThis.window=previous;}
});

test('Google uses the same custom camera and directions instead of provider fitBounds',async()=>{
  const previous=globalThis.window;
  let mapInstance;const created={polylines:[],markers:[]};
  class Map {
    constructor(canvas,props){this.props=props;mapInstance=this;}
    fitBounds(){throw Error('Google fitBounds must not be called');}
  }
  class Polyline{constructor(props){created.polylines.push(props);}}
  class Marker{
    constructor(props){created.markers.push(props);}
    addListener(){}
  }
  globalThis.window={google:{maps:{
    importLibrary:async name => name==='maps'?{Map}:{AdvancedMarkerElement:null},
    Polyline,Marker,SymbolPath:{CIRCLE:0},
  }}};
  try{
    await renderGoogleMap({clientWidth:1030,clientHeight:480},sample,'TEST_KEY','',
      ()=>{},async()=>{},()=>({kind:'pin'}),'en');
    assert.ok(mapInstance.props.zoom<sample.zoom);
    assert.equal(created.polylines.length,sample.route.length-1);
    assert.ok(created.polylines.every(x=>x.path.length===2));
    assert.ok(created.polylines.every(x=>x.strokeColor!=='#FFFCF8' && x.strokeWeight<=3));
    assert.ok(created.markers.length>sample.points.length);
  }finally {globalThis.window=previous;}
});
